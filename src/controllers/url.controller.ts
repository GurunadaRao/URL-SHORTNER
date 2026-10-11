import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { config } from '../config';
import { CreateShortUrlSchema } from '../models/url.model';
import { urlRepository } from '../repositories/url.repository';
import { cacheService } from '../services/cache.service';
import { urlService } from '../services/url.service';

export class UrlController {
  /**
   * POST /api/urls
   * Creates a shortened URL with Base62 encoding and 5-year retention.
   */
  public async shortenUrl(req: Request, res: Response): Promise<void> {
    try {
      const validatedData = CreateShortUrlSchema.parse(req.body);
      const result = await urlService.createShortUrl(validatedData);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err: any) {
      if (err instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          details: err.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        });
        return;
      }

      const statusCode = err.message.includes('already exists') ? 409 : 500;
      res.status(statusCode).json({
        success: false,
        error: err.message || 'Internal Server Error',
      });
    }
  }

  /**
   * GET /:shortCode
   * Performs HTTP 302 Redirection to the original destination URL.
   */
  public async redirectUrl(req: Request, res: Response): Promise<void> {
    const rawCode = req.params.shortCode;
    const shortCode = Array.isArray(rawCode) ? rawCode[0] : rawCode;

    if (!shortCode) {
      res.status(400).json({ success: false, error: 'Short code is required' });
      return;
    }

    try {
      const result = await urlService.resolveShortUrl(shortCode);

      if (result.isNotFound) {
        res.status(404).json({
          success: false,
          error: 'Short URL not found',
        });
        return;
      }

      if (result.isExpired) {
        res.status(410).json({
          success: false,
          error: 'Short URL has expired after retention period (5 years)',
        });
        return;
      }

      // Indicate whether redirection was served from Redis cache or persistent DB
      res.setHeader('X-Cache', result.fromCache ? 'HIT' : 'MISS');
      // Set Cache-Control so client doesn't permanently bypass click-telemetry
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

      // Execute HTTP 302 Redirection
      res.redirect(config.redirectStatusCode, result.url!);
    } catch (err: any) {
      console.error(`[Redirect] Error resolving short code ${shortCode}:`, err);
      res.status(500).json({
        success: false,
        error: 'Failed to process redirection',
      });
    }
  }

  /**
   * GET /api/urls/:shortCode/analytics
   * Returns analytics and retention data for the given short code.
   */
  public async getUrlAnalytics(req: Request, res: Response): Promise<void> {
    const rawCode = req.params.shortCode;
    const shortCode = Array.isArray(rawCode) ? rawCode[0] : rawCode;

    try {
      if (!shortCode) {
        res.status(400).json({ success: false, error: 'Short code is required' });
        return;
      }
      const analytics = await urlService.getAnalytics(shortCode);
      if (!analytics) {
        res.status(404).json({
          success: false,
          error: 'Short code not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: analytics,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err.message || 'Failed to retrieve analytics',
      });
    }
  }

  /**
   * GET /health
   * System health check for load balancers and orchestrators.
   */
  public async healthCheck(_req: Request, res: Response): Promise<void> {
    const isDbHealthy = await urlRepository.isHealthy();
    const isRedisHealthy = await cacheService.isHealthy();

    const isSystemHealthy = true; // Still operational via graceful fallback

    res.status(isSystemHealthy ? 200 : 503).json({
      status: isSystemHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: isDbHealthy ? 'connected' : 'in-memory-fallback',
        redis: isRedisHealthy ? 'connected' : 'in-memory-fallback',
      },
      retentionConfig: {
        years: 5,
        defaultTtlSeconds: config.retentionPeriodSeconds,
        redirectCode: config.redirectStatusCode,
      },
    });
  }
}

export const urlController = new UrlController();
