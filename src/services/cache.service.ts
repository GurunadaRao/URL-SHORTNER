import Redis from 'ioredis';
import { config } from '../config';

export interface ICacheService {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  increment(key: string): Promise<bigint>;
  isHealthy(): Promise<boolean>;
  disconnect(): Promise<void>;
}

export class RedisCacheService implements ICacheService {
  private client: Redis | null = null;
  private isConnected = false;
  // In-memory fallback if Redis is unreachable in local dev / unit testing
  private memoryFallback: Map<string, { value: string; expiresAt: number }> = new Map();
  private memoryCounter: bigint = config.idOffset;

  constructor() {
    this.initClient();
  }

  private initClient(): void {
    try {
      this.client = new Redis({
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        retryStrategy: (times) => {
          if (times > 3) {
            return null; // Stop retrying and fallback
          }
          return Math.min(times * 100, 1000);
        },
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        console.log('[Cache] Connected to Redis successfully.');
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        // Keep logs clean when fallback is active
        // console.warn('[Cache] Redis error, operating in fallback mode:', err.message);
      });
    } catch {
      this.isConnected = false;
    }
  }

  public async connect(): Promise<void> {
    if (this.client && !this.isConnected) {
      try {
        await this.client.connect();
        this.isConnected = true;
      } catch {
        this.isConnected = false;
        console.warn('[Cache] Could not connect to external Redis. Falling back to in-memory cache.');
      }
    }
  }

  public async get(key: string): Promise<string | null> {
    if (this.isConnected && this.client) {
      try {
        return await this.client.get(key);
      } catch {
        // Fallback on error
      }
    }

    // In-memory fallback check
    const entry = this.memoryFallback.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.memoryFallback.delete(key);
      return null;
    }
    return entry.value;
  }

  public async set(
    key: string,
    value: string,
    ttlSeconds: number = config.redis.cacheTtlSeconds
  ): Promise<void> {
    if (this.isConnected && this.client) {
      try {
        if (ttlSeconds > 0) {
          await this.client.set(key, value, 'EX', ttlSeconds);
        } else {
          await this.client.set(key, value);
        }
        return;
      } catch {
        // Fallback on error
      }
    }

    // In-memory fallback
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.memoryFallback.set(key, { value, expiresAt });
  }

  public async delete(key: string): Promise<void> {
    if (this.isConnected && this.client) {
      try {
        await this.client.del(key);
        return;
      } catch {
        // Fallback
      }
    }
    this.memoryFallback.delete(key);
  }

  /**
   * Atomic ID Counter generator (e.g. for distributed unique sequence allocation)
   */
  public async increment(key: string = 'url_id_counter'): Promise<bigint> {
    if (this.isConnected && this.client) {
      try {
        const val = await this.client.incr(key);
        return BigInt(val) + config.idOffset;
      } catch {
        // Fallback
      }
    }

    this.memoryCounter += 1n;
    return this.memoryCounter;
  }

  public async isHealthy(): Promise<boolean> {
    if (!this.isConnected || !this.client) return false;
    try {
      const pong = await this.client.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }

  public async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
      } catch {
        // Ignore
      }
    }
  }
}

export const cacheService = new RedisCacheService();
