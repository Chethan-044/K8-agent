import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { config } from './config/config';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/error-handler';
import { getDatabase } from './db/database';
import authRoutes from './routes/auth.routes';
import clusterRoutes from './routes/cluster.routes';
import problemRoutes from './routes/problem.routes';
import workloadRoutes from './routes/workload.routes';
import aiRoutes from './routes/ai.routes';

const app = express();

// Security headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Managed per route or by frontend Vite dev server
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS configuration supporting credentials (HttpOnly cookies)
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin)
      if (!origin) return callback(null, true);
      // In dev or local docker, allow localhost origins
      if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) {
        return callback(null, true);
      }
      if (origin === config.cors.origin) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Routes
app.use('/api', authRoutes);
app.use('/api', clusterRoutes);
app.use('/api', problemRoutes);
app.use('/api', workloadRoutes);
app.use('/api', aiRoutes);

// Error handler
app.use(errorHandler);

// Initialize SQLite database
try {
  getDatabase();
} catch (err: any) {
  logger.error(`Database initialization error: ${err.message}`);
}

// Start server
app.listen(config.port, () => {
  logger.info(`K8s Agent backend running on port ${config.port}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info(`Database path: ${config.dbPath}`);
  logger.info(`CORS origin: ${config.cors.origin}`);
});

export default app;

