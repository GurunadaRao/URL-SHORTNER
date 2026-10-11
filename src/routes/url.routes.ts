import { Router } from 'express';
import { urlController } from '../controllers/url.controller';

const router = Router();

// API routes for shortening and analytics
router.post('/api/urls', (req, res) => urlController.shortenUrl(req, res));
router.get('/api/urls/:shortCode/analytics', (req, res) =>
  urlController.getUrlAnalytics(req, res)
);
router.get('/health', (req, res) => urlController.healthCheck(req, res));

// Redirection route at root: GET /:shortCode -> HTTP 302
router.get('/:shortCode', (req, res) => urlController.redirectUrl(req, res));

export default router;
