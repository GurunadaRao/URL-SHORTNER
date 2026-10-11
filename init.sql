-- Database Initialization Script for URL Shortener

CREATE TABLE IF NOT EXISTS urls (
    id BIGSERIAL PRIMARY KEY,
    short_code VARCHAR(16) NOT NULL UNIQUE,
    original_url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    click_count BIGINT NOT NULL DEFAULT 0,
    last_accessed_at TIMESTAMPTZ
);

-- Index for O(1) short_code lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_urls_short_code ON urls(short_code);

-- Index for efficient background cleanup of expired URLs (5 years retention)
CREATE INDEX IF NOT EXISTS idx_urls_expires_at ON urls(expires_at);

-- Optional telemetry click logs
CREATE TABLE IF NOT EXISTS click_events (
    id BIGSERIAL PRIMARY KEY,
    short_code VARCHAR(16) NOT NULL,
    referrer TEXT,
    user_agent TEXT,
    ip_hash VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_click_events_short_code_created ON click_events(short_code, created_at);

-- Sequence offset to ensure initial short codes have sufficient length (e.g., 6+ chars in Base62)
ALTER SEQUENCE urls_id_seq RESTART WITH 1000000000;
