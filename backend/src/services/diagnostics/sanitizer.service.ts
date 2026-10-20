import { logger } from '../../utils/logger';

const SENSITIVE_KEYS = new Set([
  'password', 'passwd', 'pwd', 'secret', 'token', 'api_key', 'apikey', 'api-key',
  'authorization', 'bearer', 'credential', 'credentials', 'private_key',
  'privatekey', 'private-key', 'access_key', 'accesskey', 'secret_key',
  'secretkey', 'connection_string', 'connectionstring', 'conn_str',
  'database_url', 'db_password', 'db_pass', 'mongodb_uri', 'mongo_uri',
  'redis_url', 'redis_password', 'aws_secret_access_key', 'aws_access_key_id',
  'client_secret', 'client_id', 'session_secret', 'cookie_secret', 'jwt_secret',
  'data', 'stringdata', // Explicitly strip data/stringData blocks if present on secret/configmap
]);

const SENSITIVE_PATTERNS = [
  // Specific auth headers and tokens
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /Basic\s+[A-Za-z0-9+/]+=*/gi,
  // Private keys and certificates
  /-----BEGIN\s+(?:RSA\s+|EC\s+|DSA\s+|OPENSSH\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:RSA\s+|EC\s+|DSA\s+|OPENSSH\s+)?PRIVATE\s+KEY-----/gi,
  // Database connection strings containing user:pass
  /(?:mongodb(?:\+srv)?|mysql|postgresql?|postgres|redis|amqp|mssql):\/\/[^\s"']+/gi,
  // JWT tokens
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  // AWS Credentials
  /(?:AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY)\s*[:=]\s*\S+/gi,
  // Specific key:value patterns in logs (e.g. password=..., api_key=..., token=...)
  /(?:password|passwd|pwd|secret|token|api[_-]?key|authorization|bearer|credential|credentials|private[_-]?key|client[_-]?secret)\s*[:=]\s*[^\s,;'"}\]]+/gi,
  // Query parameters in URLs like ?api_key=... or ?token=...
  /[?&](?:api_key|apikey|token|password|secret|access_token|key)=[^\s&"']+/gi,
];

export function sanitize<T>(data: T): T {
  return sanitizeValue(data, '', null) as T;
}

function sanitizeValue(value: any, key: string, parentKey: string | null): any {
  if (value === null || value === undefined) return value;

  // Preserve reference objects like { secretRef: { name: "db-secret" } } or { configMapRef: { name: "app-cfg" } }
  // but strip any data or value inside
  const lowerKey = key.toLowerCase();

  // If parent object is secretData or configMapData, all values inside are confidential
  if (parentKey && (parentKey.toLowerCase().includes('secretdata') || parentKey.toLowerCase().includes('configmapdata'))) {
    return '[REDACTED]';
  }

  // If this is a Secret or ConfigMap data payload, remove it entirely
  if ((lowerKey === 'data' || lowerKey === 'stringdata') && parentKey && (parentKey.toLowerCase().includes('secret') || parentKey.toLowerCase().includes('configmap'))) {
    return '[REDACTED CONFIGMAP/SECRET DATA]';
  }

  // Redact environment variable values if an object has { name: "FOO", value: "BAR" }
  if (lowerKey === 'value' && parentKey === 'env' && typeof value === 'string') {
    return '[REDACTED]';
  }

  if (typeof value === 'string') {
    return sanitizeString(value, key);
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, key, parentKey));
  }

  if (typeof value === 'object') {
    // If it's an env item with name and value, redact the value while preserving name
    if (value.name && 'value' in value && typeof value.value === 'string') {
      const sanitizedObj: Record<string, any> = {};
      for (const [k, v] of Object.entries(value)) {
        if (k === 'value') {
          sanitizedObj[k] = '[REDACTED]';
        } else {
          sanitizedObj[k] = sanitizeValue(v, k, key);
        }
      }
      return sanitizedObj;
    }

    const sanitized: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      sanitized[k] = sanitizeValue(v, k, key);
    }
    return sanitized;
  }

  return value;
}

function sanitizeString(value: string, key: string): string {
  // Allow safe Kubernetes reference strings like "secret:database-credentials" or "configMap:app-settings"
  if (
    value.startsWith('secret:') ||
    value.startsWith('configMap:') ||
    value.startsWith('fieldRef:') ||
    value.startsWith('resourceField:')
  ) {
    return value;
  }

  // Allow resource reference names like "secretRef: { name: 'db-secret' }" or "name: 'my-secret'"
  const normalizedKey = key.toLowerCase().replace(/[-_.]/g, '');

  // If the key specifically designates a secret value (not just a resource name or reference)
  if (
    normalizedKey !== 'name' &&
    normalizedKey !== 'secretname' &&
    normalizedKey !== 'configmapname' &&
    normalizedKey !== 'source' &&
    !normalizedKey.includes('ref')
  ) {
    for (const sensitiveKey of SENSITIVE_KEYS) {
      const normalizedSensitive = sensitiveKey.toLowerCase().replace(/[-_.]/g, '');
      if (normalizedKey.includes(normalizedSensitive)) {
        if (value.length > 0) {
          return '[REDACTED]';
        }
      }
    }
  }

  // Apply pattern-based sanitization to string content (e.g. In pod logs or status messages)
  let sanitized = value;

  // 1. Bearer token patterns (e.g. "Bearer eyJ..." or "Bearer token=...")
  sanitized = sanitized.replace(/Bearer\s+(?:token=)?\S+/gi, 'Bearer [REDACTED]');
  sanitized = sanitized.replace(/Basic\s+[A-Za-z0-9+/]+=*/gi, 'Basic [REDACTED]');

  // 2. Private keys
  sanitized = sanitized.replace(
    /-----BEGIN\s+(?:RSA\s+|EC\s+|DSA\s+|OPENSSH\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:RSA\s+|EC\s+|DSA\s+|OPENSSH\s+)?PRIVATE\s+KEY-----/gi,
    '[REDACTED PRIVATE KEY]'
  );

  // 3. Database connection strings
  sanitized = sanitized.replace(
    /(?:mongodb(?:\+srv)?|mysql|postgresql?|postgres|redis|amqp|mssql):\/\/[^\s"']+/gi,
    '[REDACTED CONNECTION STRING]'
  );

  // 4. JWT tokens
  sanitized = sanitized.replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, '[REDACTED JWT]');

  // 5. AWS credentials
  sanitized = sanitized.replace(/(?:AWS_ACCESS_KEY_ID|AWS_SECRET_ACCESS_KEY)\s*[:=]\s*\S+/gi, (m) => {
    const sep = m.includes('=') ? '=' : ':';
    return `${m.split(/[:=]/)[0]}${sep}[REDACTED]`;
  });

  // 6. Generic key=value or key:value assignments in logs (e.g. password=..., token=..., api_key=...)
  sanitized = sanitized.replace(
    /(?:password|passwd|pwd|token|api[_-]?key|client[_-]?secret|secret[_-]?key|credentials?|private[_-]?key)\s*[:=]\s*[^\s,;'"}\]]+/gi,
    (m) => {
      const sep = m.includes('=') ? '=' : ':';
      return `${m.split(/[:=]/)[0]}${sep}[REDACTED]`;
    }
  );

  // 7. secret= assignments (explicitly matching equals so as not to match secret:reference)
  sanitized = sanitized.replace(/secret\s*=\s*[^\s,;'"}\]]+/gi, 'secret=[REDACTED]');

  // 8. URL query parameters
  sanitized = sanitized.replace(/[?&](?:api_key|apikey|token|password|secret|access_token|key)=[^\s&"']+/gi, (m) => {
    const prefix = m.charAt(0);
    const param = m.substring(1).split('=')[0];
    return `${prefix}${param}=[REDACTED]`;
  });

  return sanitized;
}

