import { app } from './app';
import { config } from './config';
import { urlRepository } from './repositories/url.repository';
import { cacheService } from './services/cache.service';

async function bootstrap() {
  console.log('='.repeat(60));
  console.log('⚡ Starting URL Shortener Service');
  console.log(`- Port: ${config.port}`);
  console.log(`- Base URL: ${config.baseUrl}`);
  console.log(`- Retention Period: 5 Years (${config.retentionPeriodSeconds}s)`);
  console.log(`- Redirection Code: HTTP ${config.redirectStatusCode}`);
  console.log('='.repeat(60));

  // Initialize database and cache connections
  await cacheService.connect();
  await urlRepository.connect();

  const server = app.listen(config.port, () => {
    console.log(`🚀 URL Shortener is running at: ${config.baseUrl}`);
    console.log(`📊 Health check: ${config.baseUrl}/health`);
  });

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    console.log(`\n[Server] Received ${signal}. Gracefully shutting down...`);
    server.close(async () => {
      await cacheService.disconnect();
      await urlRepository.close();
      console.log('[Server] Connections closed. Exiting process.');
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
