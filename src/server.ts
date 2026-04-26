import express from 'express';
import { config } from './config';
import { logger } from './services/logger';

export function createExpressApp() {
  const app = express();

  // CORS middleware
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });

  // API routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/api/send', express.json(), (req, res) => {
    try {
      const payload = req.body;
      logger.info(`Received send request: ${JSON.stringify(payload)}`);
      res.json({ success: true });
    } catch (err) {
      logger.error(`Failed to parse send request: ${err}`);
      res.status(400).json({ error: 'Invalid request' });
    }
  });

  return app;
}

export function startServer(expressApp: express.Application) {
  expressApp.listen(config.apiPort, () => {
    logger.info(`HTTP server listening on port ${config.apiPort}`);
  });
}
