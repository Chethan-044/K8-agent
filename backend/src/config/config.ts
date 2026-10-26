import path from 'path';

// Backend configuration
export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  kubeconfigPath: process.env.KUBECONFIG || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  geminiBaseUrl: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com',
  logTailLines: parseInt(process.env.LOG_TAIL_LINES || '300', 10),
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  },
  dataDir: process.env.DATA_DIR || path.resolve(process.cwd(), 'data'),
  dbPath: process.env.DB_PATH || (process.env.DATA_DIR ? path.join(process.env.DATA_DIR, 'k8s-agent.db') : path.resolve(process.cwd(), 'data', 'k8s-agent.db')),
  sessionSecret: process.env.SESSION_SECRET || 'k8s-agent-session-secret-key-change-in-prod',
  sessionTtlHours: parseInt(process.env.SESSION_TTL_HOURS || '24', 10),
};


