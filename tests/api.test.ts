import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

const app = createApp();

describe('URL Shortener API Integration Tests', () => {
  let createdShortCode: string;
  const targetUrl = 'https://example.com/system-design/distributed-systems';

  it('GET /health should return healthy status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.retentionConfig.years).toBe(5);
    expect(res.body.retentionConfig.redirectCode).toBe(302);
  });

  it('POST /api/urls should create a short URL with Base62 and 5-year retention', async () => {
    const res = await request(app)
      .post('/api/urls')
      .send({ url: targetUrl });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.shortCode).toBeDefined();
    expect(res.body.data.originalUrl).toBe(targetUrl);
    expect(res.body.data.retentionYears).toBe(5);

    // Verify 5-year retention calculation
    const createdAt = new Date(res.body.data.createdAt);
    const expiresAt = new Date(res.body.data.expiresAt);
    const diffYears = (expiresAt.getTime() - createdAt.getTime()) / (1000 * 3600 * 24 * 365.25);
    expect(Math.round(diffYears)).toBe(5);

    createdShortCode = res.body.data.shortCode;
  });

  it('POST /api/urls should validate invalid URLs', async () => {
    const res = await request(app)
      .post('/api/urls')
      .send({ url: 'not-a-valid-url' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('GET /:shortCode should perform HTTP 302 Redirection', async () => {
    const res = await request(app).get(`/${createdShortCode}`);

    // Must be HTTP 302 redirect
    expect(res.status).toBe(302);
    expect(res.header.location).toBe(targetUrl);
    // First time might be warmed into cache or from cache
    expect(['HIT', 'MISS']).toContain(res.header['x-cache']);
  });

  it('GET /:shortCode subsequent request should be served from Cache (X-Cache: HIT)', async () => {
    const res = await request(app).get(`/${createdShortCode}`);

    expect(res.status).toBe(302);
    expect(res.header.location).toBe(targetUrl);
    expect(res.header['x-cache']).toBe('HIT');
  });

  it('GET /api/urls/:shortCode/analytics should return click metrics and retention details', async () => {
    const res = await request(app).get(`/api/urls/${createdShortCode}/analytics`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.shortCode).toBe(createdShortCode);
    expect(res.body.data.originalUrl).toBe(targetUrl);
    expect(res.body.data.isExpired).toBe(false);
    expect(res.body.data.clickCount).toBeGreaterThanOrEqual(1);
  });

  it('POST /api/urls with custom alias should allow custom code', async () => {
    const customAlias = 'custom-test-url';
    const res = await request(app)
      .post('/api/urls')
      .send({
        url: 'https://google.com',
        customAlias,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.shortCode).toBe(customAlias);

    const redirectRes = await request(app).get(`/${customAlias}`);
    expect(redirectRes.status).toBe(302);
    expect(redirectRes.header.location).toBe('https://google.com');
  });

  it('GET /non-existent-code should return 404', async () => {
    const res = await request(app).get('/nonExistent999');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
