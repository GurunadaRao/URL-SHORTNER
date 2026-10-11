import dotenv from 'dotenv';

dotenv.config();

// 5 years in seconds: 5 years * 365.25 days/year * 24 hrs * 3600 secs = 157,788,000 seconds
export const DEFAULT_RETENTION_PERIOD_SECONDS = 5 * 365.25 * 24 * 3600; // 157,788,000

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',

  // Redirection: HTTP 302 (Found)
  redirectStatusCode: parseInt(process.env.REDIRECT_STATUS_CODE || '302', 10),

  // Retention period in seconds (default 5 years)
  retentionPeriodSeconds: parseInt(
    process.env.RETENTION_PERIOD_SECONDS || String(DEFAULT_RETENTION_PERIOD_SECONDS),
    10
  ),

  // Redis configuration
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    cacheTtlSeconds: parseInt(
      process.env.REDIS_CACHE_TTL_SECONDS || String(DEFAULT_RETENTION_PERIOD_SECONDS),
      10
    ),
  },

  // PostgreSQL Database configuration
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/urlshortener',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'urlshortener',
  },

  // Numeric offset for short URL sequence generation (e.g., 1 billion => Base62 '14dTC')
  idOffset: BigInt(process.env.ID_OFFSET || '1000000000'),
};
