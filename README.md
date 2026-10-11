# Distributed URL Shortener Service

A production-grade URL Shortener system design implemented with **TypeScript**, **Express**, **Base62 Encoding**, **Redis Cache-Aside Architecture**, **PostgreSQL Persistent Store**, and **HTTP 302 Redirection** with a **guaranteed 5-year retention period**.

---

## 🚀 Key System Features

1. **Deterministic Base62 Encoding (`0-9a-zA-Z`)**:
   - Zero hash collision overhead: converts 64-bit monotonically increasing distributed sequence IDs directly into compact alphanumeric short codes.
   - Initial ID offset ($1,000,000,000$) ensures initial short codes are minimum 6 characters ($62^6 \approx 56.8$ billion capacity, $62^7 \approx 3.52$ trillion capacity).
   - Implemented using native JavaScript `BigInt` to prevent 64-bit IEEE-754 precision truncation.

2. **Redis Ultra-Low Latency Caching**:
   - Cache-Aside (Lazy loading) strategy.
   - Warm-up upon creation and fast O(1) in-memory resolution on redirects.
   - Configurable Redis memory policy (`allkeys-lru`) and 5-year cache TTL (`157,788,000` seconds).
   - Built-in automatic in-memory fallback for local development without external dependencies.

3. **HTTP 302 Redirection**:
   - Returns `HTTP 302 (Found)` rather than `HTTP 301 (Moved Permanently)`.
   - **Why 302?** Browser caches `301` aggressively on client disks, bypassing servers on repeat clicks. `302` ensures each visit reaches the server for click telemetry, analytics, and security audits.

4. **5-Year Retention Lifecycle**:
   - Automatically computes `expires_at = NOW() + 5 * 365.25 * 24 * 3600 seconds` ($157,788,000$ seconds).
   - Indexed database column `idx_urls_expires_at` for efficient background archival.
   - Returns `HTTP 410 (Gone)` once the 5-year retention window has elapsed.

---

## 📁 Project Structure

```
url-shortener/
├── src/
│   ├── config/            # Environment and retention configurations
│   ├── controllers/       # HTTP request handlers & redirects
│   ├── models/            # Zod validation schemas and DTOs
│   ├── repositories/      # PostgreSQL persistent store & sequence generator
│   ├── routes/            # Express route declarations
│   ├── services/          # Base62 coordination & cache-aside logic
│   ├── utils/             # Base62 encoder/decoder (BigInt support)
│   ├── app.ts             # Express application setup & middleware
│   └── server.ts          # Server bootstrap & graceful shutdown
├── tests/
│   ├── base62.test.ts     # Unit tests for Base62 encoding/decoding
│   └── api.test.ts        # Integration tests for API, 302 redirect, & cache
├── docker-compose.yml     # Multi-container orchestration (App, Redis, PostgreSQL)
├── Dockerfile             # Multi-stage production container build
├── init.sql               # PostgreSQL schema & sequence initialization
└── package.json           # Scripts and dependencies
```

---

## 🛠️ Quick Start

### 1. Local Development (Zero External Dependencies Required)

The project includes an automatic in-memory fallback for both Redis and PostgreSQL, allowing you to run and test immediately:

```bash
cd url-shortener
npm install
npm run dev
```

Server starts at: `http://localhost:3000`

### 2. Full Production Stack with Docker Compose

To run with real PostgreSQL 16 and Redis 7:

```bash
docker compose up -d
```

Check service status:
```bash
docker compose ps
```

### 3. Running Test Suite

```bash
npm test
```

---

## 📡 API Reference

### 1. Shorten a URL
- **Endpoint**: `POST /api/urls`
- **Request Body**:
  ```json
  {
    "url": "https://en.wikipedia.org/wiki/Distributed_computing",
    "retentionYears": 5,
    "customAlias": "dist-sys"
  }
  ```
  *(Note: `customAlias` and `retentionYears` are optional. Default retention is 5 years).*
- **Response (`201 Created`)**:
  ```json
  {
    "success": true,
    "data": {
      "shortCode": "14dTC",
      "shortUrl": "http://localhost:3000/14dTC",
      "originalUrl": "https://en.wikipedia.org/wiki/Distributed_computing",
      "createdAt": "2026-10-11T10:00:00.000Z",
      "expiresAt": "2031-10-11T10:00:00.000Z",
      "retentionYears": 5
    }
  }
  ```

---

### 2. Redirect to Target URL
- **Endpoint**: `GET /:shortCode`
- **Behavior**:
  - Responds with **`HTTP 302 Found`**
  - Response Header `Location: <originalUrl>`
  - Response Header `X-Cache: HIT` (if served from Redis) or `X-Cache: MISS` (if served from PostgreSQL)
  - Asynchronously increments click metrics

---

### 3. Get URL Analytics
- **Endpoint**: `GET /api/urls/:shortCode/analytics`
- **Response (`200 OK`)**:
  ```json
  {
    "success": true,
    "data": {
      "shortCode": "14dTC",
      "originalUrl": "https://en.wikipedia.org/wiki/Distributed_computing",
      "createdAt": "2026-10-11T10:00:00.000Z",
      "expiresAt": "2031-10-11T10:00:00.000Z",
      "isExpired": false,
      "clickCount": 42,
      "lastAccessedAt": "2026-10-11T10:15:32.000Z"
    }
  }
  ```

---

### 4. Health Check
- **Endpoint**: `GET /health`
- **Response (`200 OK`)**:
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-10-11T10:00:00.000Z",
    "services": {
      "database": "connected",
      "redis": "connected"
    },
    "retentionConfig": {
      "years": 5,
      "defaultTtlSeconds": 157788000,
      "redirectCode": 302
    }
  }
  ```
