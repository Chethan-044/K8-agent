import winston from 'winston';
import { config } from '../config/config';

const sensitivePatterns = [
  /(?:password|passwd|secret|token|api[_-]?key|authorization|bearer|credential|private[_-]?key)\s*[:=]\s*\S+/gi,
];

const sanitizeMessage = (message: string): string => {
  let sanitized = message;
  for (const pattern of sensitivePatterns) {
    sanitized = sanitized.replace(pattern, (match) => {
      const separator = match.includes('=') ? '=' : ':';
      const key = match.split(/[:=]/)[0];
      return `${key}${separator}[REDACTED]`;
    });
  }
  return sanitized;
};

const sanitizeFormat = winston.format((info) => {
  if (typeof info.message === 'string') {
    info.message = sanitizeMessage(info.message);
  }
  return info;
});

export const logger = winston.createLogger({
  level: config.nodeEnv === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    sanitizeFormat(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      return `${timestamp} [${level.toUpperCase()}] ${message}${metaStr}`;
    })
  ),
  transports: [new winston.transports.Console()],
});
