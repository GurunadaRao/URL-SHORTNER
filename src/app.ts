import cors from 'cors';
import express, { Application, Request, Response } from 'express';
import urlRoutes from './routes/url.routes';

export function createApp(): Application {
  const app = express();

  // Standard middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Basic request logger in development
  app.use((req, res, next) => {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    }
    next();
  });

  // Mount routes
  app.use('/', urlRoutes);

  // 404 handler for unknown routes
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: 'Resource not found',
    });
  });

  return app;
}

export const app = createApp();
