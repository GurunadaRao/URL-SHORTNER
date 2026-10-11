import { config, DEFAULT_RETENTION_PERIOD_SECONDS } from '../config';
import {
  CreateShortUrlDto,
  ShortUrlResponseDto,
  UrlAnalyticsDto,
  UrlRecord,
} from '../models/url.model';
import { IUrlRepository, urlRepository } from '../repositories/url.repository';
import { Base62 } from '../utils/base62';
import { cacheService, ICacheService } from './cache.service';

export interface ResolveResult {
  url?: string;
  isExpired?: boolean;
  isNotFound?: boolean;
  fromCache?: boolean;
}

export class UrlService {
  constructor(
    private readonly repo: IUrlRepository = urlRepository,
    private readonly cache: ICacheService = cacheService
  ) {}

  /**
   * Generates a short URL using Base62 encoding with a guaranteed 5-year retention period.
   */
  public async createShortUrl(dto: CreateShortUrlDto): Promise<ShortUrlResponseDto> {
    const retentionYears = dto.retentionYears || 5;
    // 5 years in milliseconds (using 365.25 days/year to account for leap years)
    const retentionSeconds = Math.round(retentionYears * 365.25 * 24 * 3600);
    const expiresAt = new Date(Date.now() + retentionSeconds * 1000);

    let shortCode = dto.customAlias;

    if (!shortCode) {
      // Step 1: Generate a globally unique sequence ID
      const sequenceId = await this.repo.getNextSequenceId();

      // Step 2: Base62 encode the 64-bit integer ID
      shortCode = Base62.encode(sequenceId);
    }

    // Step 3: Persist record in primary persistent database
    const savedRecord = await this.repo.save({
      shortCode,
      originalUrl: dto.url,
      expiresAt,
    });

    // Step 4: Warm Redis cache with 5-year TTL for ultra-low latency redirection
    await this.cache.set(shortCode, savedRecord.originalUrl, retentionSeconds);

    const shortUrl = `${config.baseUrl}/${shortCode}`;

    return {
      shortCode,
      shortUrl,
      originalUrl: savedRecord.originalUrl,
      createdAt: savedRecord.createdAt.toISOString(),
      expiresAt: savedRecord.expiresAt.toISOString(),
      retentionYears,
    };
  }

  /**
   * Resolves a short code to the original destination URL.
   * Leverages Cache-Aside pattern with Redis for O(1) in-memory resolution.
   */
  public async resolveShortUrl(shortCode: string): Promise<ResolveResult> {
    // 1. Check Redis Cache first (Cache-Aside hit path)
    const cachedUrl = await this.cache.get(shortCode);
    if (cachedUrl) {
      // Fire-and-forget click analytics tracking
      this.repo.incrementClickCount(shortCode).catch((err) => {
        console.error(`[Analytics] Error updating click count for ${shortCode}:`, err);
      });

      return {
        url: cachedUrl,
        fromCache: true,
      };
    }

    // 2. Cache Miss: Query persistent database
    const record = await this.repo.findByShortCode(shortCode);

    if (!record) {
      return { isNotFound: true };
    }

    // Check 5-year retention expiration
    const now = new Date();
    if (record.expiresAt < now) {
      // Expired URL
      await this.cache.delete(shortCode);
      return { isExpired: true };
    }

    // 3. Populate Redis Cache for subsequent requests
    const remainingSeconds = Math.max(
      1,
      Math.floor((record.expiresAt.getTime() - now.getTime()) / 1000)
    );
    await this.cache.set(shortCode, record.originalUrl, remainingSeconds);

    // Fire-and-forget click telemetry
    this.repo.incrementClickCount(shortCode).catch((err) => {
      console.error(`[Analytics] Error updating click count for ${shortCode}:`, err);
    });

    return {
      url: record.originalUrl,
      fromCache: false,
    };
  }

  /**
   * Retrieves analytics metadata for a given short code.
   */
  public async getAnalytics(shortCode: string): Promise<UrlAnalyticsDto | null> {
    const record = await this.repo.findByShortCode(shortCode);
    if (!record) return null;

    const now = new Date();
    return {
      shortCode: record.shortCode,
      originalUrl: record.originalUrl,
      createdAt: record.createdAt.toISOString(),
      expiresAt: record.expiresAt.toISOString(),
      isExpired: record.expiresAt < now,
      clickCount: record.clickCount,
      lastAccessedAt: record.lastAccessedAt ? record.lastAccessedAt.toISOString() : null,
    };
  }
}

export const urlService = new UrlService();
