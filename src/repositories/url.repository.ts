import { Pool } from 'pg';
import { config } from '../config';
import { UrlRecord } from '../models/url.model';

export interface IUrlRepository {
  save(record: {
    shortCode: string;
    originalUrl: string;
    expiresAt: Date;
  }): Promise<UrlRecord>;
  findByShortCode(shortCode: string): Promise<UrlRecord | null>;
  incrementClickCount(shortCode: string): Promise<void>;
  getNextSequenceId(): Promise<bigint>;
  isHealthy(): Promise<boolean>;
  close(): Promise<void>;
}

export class PostgresUrlRepository implements IUrlRepository {
  private pool: Pool | null = null;
  private isConnected = false;

  // Fallback in-memory store if DB is unreachable
  private memoryStore: Map<string, UrlRecord> = new Map();
  private memorySequence: bigint = config.idOffset;

  constructor() {
    this.initPool();
  }

  private initPool(): void {
    try {
      this.pool = new Pool({
        connectionString: config.database.url,
        connectionTimeoutMillis: 2000,
        max: 20,
      });

      this.pool.on('error', () => {
        this.isConnected = false;
      });
    } catch {
      this.isConnected = false;
    }
  }

  public async connect(): Promise<void> {
    if (this.pool && !this.isConnected) {
      try {
        const client = await this.pool.connect();
        this.isConnected = true;
        client.release();
        console.log('[Database] Connected to PostgreSQL successfully.');
        await this.ensureSchema();
      } catch {
        this.isConnected = false;
        console.warn('[Database] Could not connect to PostgreSQL. Using in-memory repository fallback.');
      }
    }
  }

  private async ensureSchema(): Promise<void> {
    if (!this.isConnected || !this.pool) return;
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS urls (
        id BIGSERIAL PRIMARY KEY,
        short_code VARCHAR(16) NOT NULL UNIQUE,
        original_url TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        click_count BIGINT NOT NULL DEFAULT 0,
        last_accessed_at TIMESTAMPTZ
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_urls_short_code ON urls(short_code);
      CREATE INDEX IF NOT EXISTS idx_urls_expires_at ON urls(expires_at);
    `;
    try {
      await this.pool.query(createTableQuery);
    } catch (err: any) {
      console.warn('[Database] Schema initialization notice:', err.message);
    }
  }

  public async getNextSequenceId(): Promise<bigint> {
    if (this.isConnected && this.pool) {
      try {
        const res = await this.pool.query("SELECT nextval(pg_get_serial_sequence('urls', 'id')) AS seq;");
        if (res.rows[0]?.seq) {
          return BigInt(res.rows[0].seq);
        }
      } catch {
        // Fallback on error
      }
    }

    this.memorySequence += 1n;
    return this.memorySequence;
  }

  public async save(data: {
    shortCode: string;
    originalUrl: string;
    expiresAt: Date;
  }): Promise<UrlRecord> {
    const createdAt = new Date();

    if (this.isConnected && this.pool) {
      try {
        const query = `
          INSERT INTO urls (short_code, original_url, created_at, expires_at, click_count)
          VALUES ($1, $2, $3, $4, 0)
          RETURNING id, short_code, original_url, created_at, expires_at, click_count, last_accessed_at;
        `;
        const res = await this.pool.query(query, [
          data.shortCode,
          data.originalUrl,
          createdAt,
          data.expiresAt,
        ]);
        const row = res.rows[0];
        return {
          id: BigInt(row.id),
          shortCode: row.short_code,
          originalUrl: row.original_url,
          createdAt: new Date(row.created_at),
          expiresAt: new Date(row.expires_at),
          clickCount: parseInt(row.click_count, 10),
          lastAccessedAt: row.last_accessed_at ? new Date(row.last_accessed_at) : null,
        };
      } catch (err: any) {
        if (err.code === '23505') {
          throw new Error(`Short code '${data.shortCode}' already exists`);
        }
        // Fall through to memory fallback
      }
    }

    // In-memory fallback
    if (this.memoryStore.has(data.shortCode)) {
      throw new Error(`Short code '${data.shortCode}' already exists`);
    }

    const record: UrlRecord = {
      id: this.memorySequence,
      shortCode: data.shortCode,
      originalUrl: data.originalUrl,
      createdAt,
      expiresAt: data.expiresAt,
      clickCount: 0,
      lastAccessedAt: null,
    };
    this.memoryStore.set(data.shortCode, record);
    return record;
  }

  public async findByShortCode(shortCode: string): Promise<UrlRecord | null> {
    if (this.isConnected && this.pool) {
      try {
        const query = `
          SELECT id, short_code, original_url, created_at, expires_at, click_count, last_accessed_at
          FROM urls
          WHERE short_code = $1;
        `;
        const res = await this.pool.query(query, [shortCode]);
        if (res.rows.length === 0) return null;
        const row = res.rows[0];
        return {
          id: BigInt(row.id),
          shortCode: row.short_code,
          originalUrl: row.original_url,
          createdAt: new Date(row.created_at),
          expiresAt: new Date(row.expires_at),
          clickCount: parseInt(row.click_count, 10),
          lastAccessedAt: row.last_accessed_at ? new Date(row.last_accessed_at) : null,
        };
      } catch {
        // Fallback
      }
    }

    return this.memoryStore.get(shortCode) || null;
  }

  public async incrementClickCount(shortCode: string): Promise<void> {
    if (this.isConnected && this.pool) {
      try {
        const query = `
          UPDATE urls
          SET click_count = click_count + 1, last_accessed_at = NOW()
          WHERE short_code = $1;
        `;
        await this.pool.query(query, [shortCode]);
        return;
      } catch {
        // Fallback
      }
    }

    const item = this.memoryStore.get(shortCode);
    if (item) {
      item.clickCount += 1;
      item.lastAccessedAt = new Date();
    }
  }

  public async isHealthy(): Promise<boolean> {
    if (!this.isConnected || !this.pool) return false;
    try {
      const res = await this.pool.query('SELECT 1');
      return res.rowCount !== null && res.rowCount > 0;
    } catch {
      return false;
    }
  }

  public async close(): Promise<void> {
    if (this.pool) {
      try {
        await this.pool.end();
      } catch {
        // Ignore
      }
    }
  }
}

export const urlRepository = new PostgresUrlRepository();
