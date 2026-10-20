import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import { getDatabase, closeDatabase } from '../../src/db/database';
import {
  registerUser,
  loginUser,
  validateSession,
  logoutSession,
  setUserAiConfig,
  getUserAiConfig,
  getMaskedApiKey,
} from '../../src/services/auth/auth.service';
import { sanitize } from '../../src/services/diagnostics/sanitizer.service';
import { buildDiagnosticPrompt } from '../../src/services/ai/prompt.service';
import { DiagnosticContext } from '../../models/diagnosis.model';
import { getApiKey, getMaskedKey, setApiKey } from '../../src/services/ai/gemini.service';

describe('Security & Authentication Test Suite', () => {
  const testDbPath = ':memory:';

  beforeEach(() => {
    closeDatabase();
    getDatabase(testDbPath);
  });

  afterAll(() => {
    closeDatabase();
  });

  describe('1. Password Security & Hashing (Argon2id/bcrypt)', () => {
    it('should hash passwords and never store plaintext passwords', async () => {
      const plainPassword = 'SuperSecretPassword!123';
      const user = await registerUser({
        username: 'alice_sec',
        email: 'alice@example.com',
        password: plainPassword,
      });

      const db = getDatabase(testDbPath);
      const row: any = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);

      expect(row.password_hash).toBeDefined();
      expect(row.password_hash).not.toBe(plainPassword);
      expect(row.password_hash.startsWith('$2')).toBe(true); // bcrypt prefix
      expect(await bcrypt.compare(plainPassword, row.password_hash)).toBe(true);
    });

    it('should reject passwords shorter than 8 characters', async () => {
      await expect(
        registerUser({
          username: 'short_pass_user',
          email: 'short@example.com',
          password: 'short',
        })
      ).rejects.toThrow('Password must be at least 8 characters long');
    });

    it('should reject mismatched password confirmation', async () => {
      await expect(
        registerUser({
          username: 'mismatch_user',
          email: 'mismatch@example.com',
          password: 'Password123!',
          confirmPassword: 'DifferentPassword123!',
        })
      ).rejects.toThrow('Passwords do not match');
    });
  });

  describe('2. User Registration & Enumeration Defense', () => {
    it('should register a new user successfully', async () => {
      const user = await registerUser({
        username: 'bob_devops',
        email: 'bob@example.com',
        password: 'ValidPassword123',
      });

      expect(user.id).toBeDefined();
      expect(user.username).toBe('bob_devops');
      expect(user.email).toBe('bob@example.com');
      expect((user as any).password).toBeUndefined();
      expect((user as any).password_hash).toBeUndefined();
    });

    it('should prevent duplicate username or email registrations', async () => {
      await registerUser({
        username: 'charlie',
        email: 'charlie@example.com',
        password: 'ValidPassword123',
      });

      await expect(
        registerUser({
          username: 'charlie',
          email: 'other_email@example.com',
          password: 'ValidPassword123',
        })
      ).rejects.toThrow('An account with this username or email already exists');

      await expect(
        registerUser({
          username: 'other_username',
          email: 'charlie@example.com',
          password: 'ValidPassword123',
        })
      ).rejects.toThrow('An account with this username or email already exists');
    });
  });

  describe('3. Login, Generic Authentication Errors & Session Management', () => {
    it('should authenticate valid user and issue a secure session', async () => {
      await registerUser({
        username: 'dave',
        email: 'dave@example.com',
        password: 'DaveStrongPassword123!',
      });

      const auth = await loginUser({
        identifier: 'dave',
        password: 'DaveStrongPassword123!',
      });

      expect(auth.user.username).toBe('dave');
      expect(auth.sessionId).toBeDefined();
      expect(auth.sessionId.length).toBe(64); // 32 bytes hex

      // Session is valid in database
      const validated = validateSession(auth.sessionId);
      expect(validated).not.toBeNull();
      expect(validated?.username).toBe('dave');
    });

    it('should return a generic error message for invalid username or password', async () => {
      await registerUser({
        username: 'eve',
        email: 'eve@example.com',
        password: 'EvePassword123!',
      });

      // Wrong password
      await expect(
        loginUser({ identifier: 'eve', password: 'WrongPassword' })
      ).rejects.toThrow('Invalid username or password.');

      // Non-existent user
      await expect(
        loginUser({ identifier: 'non_existent_user', password: 'SomePassword123' })
      ).rejects.toThrow('Invalid username or password.');
    });

    it('should invalidate session on logout', async () => {
      await registerUser({
        username: 'frank',
        email: 'frank@example.com',
        password: 'FrankPassword123!',
      });

      const auth = await loginUser({
        identifier: 'frank',
        password: 'FrankPassword123!',
      });

      expect(validateSession(auth.sessionId)).not.toBeNull();

      logoutSession(auth.sessionId);

      expect(validateSession(auth.sessionId)).toBeNull();
    });
  });

  describe('4. Multi-Tenant User Data Isolation & Masked API Keys', () => {
    it('should isolate AI credentials between User A and User B', () => {
      const userAId = 'user-a-uuid';
      const userBId = 'user-b-uuid';

      setApiKey('key-user-a-12345678', 'https://api.openai.com/v1', 'gpt-4o', userAId);
      setApiKey('key-user-b-87654321', 'https://integrate.api.nvidia.com/v1', 'meta/llama-3.1-70b-instruct', userBId);

      expect(getApiKey(userAId)).toBe('key-user-a-12345678');
      expect(getApiKey(userBId)).toBe('key-user-b-87654321');
      expect(getApiKey(userAId)).not.toBe(getApiKey(userBId));

      // User A cannot read raw key in masked format
      expect(getMaskedKey(userAId)).toBe('••••••••••••5678');
      expect(getMaskedKey(userBId)).toBe('••••••••••••4321');
    });

    it('should NOT leak API key to a new user who has not configured one', () => {
      const userAId = 'user-a-configured';
      const userCId = 'user-c-new';

      setApiKey('key-user-a-12345678', 'https://api.openai.com/v1', 'gpt-4o', userAId);

      // New user C should have NO key — must not fall back to User A's config
      expect(getApiKey(userCId)).toBeNull();
      expect(getMaskedKey(userCId)).toBe('');
    });

    it('should never expose full API key in getMaskedApiKey utility', () => {
      const rawKey = 'AIzaSyBNm987654321xyz1234';
      const masked = getMaskedApiKey(rawKey);
      expect(masked).toBe('••••••••••••1234');
      expect(masked).not.toContain('AIzaSyBNm');
    });
  });

  describe('5. Kubernetes Secret & ConfigMap Sanitization', () => {
    it('should preserve Secret and ConfigMap reference names while removing any raw data values', () => {
      const rawDiagnosticContext = {
        resource: { kind: 'Pod', name: 'payment-api', namespace: 'production' },
        configReferences: [
          { type: 'ConfigMap', name: 'payment-config' },
          { type: 'Secret', name: 'payment-secret' },
        ],
        secretData: {
          DATABASE_PASSWORD: 'plain_secret_password',
          API_TOKEN: 'raw_api_token_abc',
        },
        configMapData: {
          DATABASE_URL: 'postgres://admin:topsecret@pg:5432/app',
          INTERNAL_KEY: 'internal_secret_value',
        },
      };

      const sanitized = sanitize(rawDiagnosticContext);

      // References must remain intact
      expect(sanitized.configReferences[0].name).toBe('payment-config');
      expect(sanitized.configReferences[1].name).toBe('payment-secret');

      // Raw secret and configmap data must be redacted
      expect(sanitized.secretData.DATABASE_PASSWORD).toBe('[REDACTED]');
      expect(sanitized.secretData.API_TOKEN).toBe('[REDACTED]');
      expect(sanitized.configMapData.DATABASE_URL).toContain('[REDACTED');
      expect(sanitized.configMapData.DATABASE_URL).not.toContain('topsecret');
      expect(sanitized.configMapData.INTERNAL_KEY).toBe('[REDACTED]');
    });

    it('should redact sensitive environment variable values and keep names and references', () => {
      const podContext = {
        env: [
          { name: 'NODE_ENV', value: 'production' },
          { name: 'DATABASE_URL', value: 'mongodb://admin:secretPass@mongo:27017' },
          { name: 'SECRET_TOKEN', value: 'secretTokenValue999' },
          { name: 'DB_PASSWORD', source: 'secret:database-credentials' },
          { name: 'APP_CONFIG', source: 'configMap:app-settings' },
        ],
      };

      const sanitized = sanitize(podContext);

      expect(sanitized.env[1].value).toBe('[REDACTED]');
      expect(sanitized.env[2].value).toBe('[REDACTED]');
      expect(sanitized.env[3].source).toBe('secret:database-credentials');
      expect(sanitized.env[4].source).toBe('configMap:app-settings');
    });

    it('should redact sensitive patterns in logs (passwords, tokens, bearer, aws, private keys)', () => {
      const logs = [
        'Connecting with password=MySecretPassword123 to database',
        'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.test.sig',
        'AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
        'api_key=secret_api_key_8888',
        '-----BEGIN RSA PRIVATE KEY-----\nMIIEogIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----',
        'mongodb://appuser:clusterpass123@mongodb.internal:27017/prod',
      ].join('\n');

      const sanitizedLogs = sanitize(logs);

      expect(sanitizedLogs).not.toContain('MySecretPassword123');
      expect(sanitizedLogs).not.toContain('eyJhbGciOiJIUzI1NiJ9');
      expect(sanitizedLogs).not.toContain('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY');
      expect(sanitizedLogs).not.toContain('secret_api_key_8888');
      expect(sanitizedLogs).not.toContain('MIIEogIBAAKCAQEA');
      expect(sanitizedLogs).not.toContain('clusterpass123');
    });
  });

  describe('6. Acceptance Test: Test Pod with Fake Credentials (Requirement #35)', () => {
    it('verifies TEST_PASSWORD_123, TEST_API_KEY_456, TEST_TOKEN_789 never appear in AI payload', () => {
      // Create a test Pod context containing fake credentials
      const testPodContext: DiagnosticContext = {
        cluster: { context: 'test-cluster' },
        resource: { kind: 'Pod', namespace: 'default', name: 'payment-api-test' },
        problem: { reason: 'CrashLoopBackOff', severity: 'critical' },
        container: {
          name: 'payment-api',
          restartCount: 12,
          exitCode: 1,
        } as any,
        storage: {
          volumes: [
            { name: 'db-cred-vol', type: 'secret', source: 'database-secret' },
            { name: 'app-cfg-vol', type: 'configMap', source: 'application-config' },
          ],
          envInfo: [
            {
              name: 'payment-api',
              env: [
                { name: 'DATABASE_PASSWORD', source: 'secret:database-secret' },
                { name: 'APP_CONFIG', source: 'configMap:application-config' },
                { name: 'TEST_VAR', source: 'literal', value: 'TEST_PASSWORD_123' },
              ],
              envFrom: [
                { secretRef: 'database-secret' },
                { configMapRef: 'application-config' },
              ],
            },
          ],
        } as any,
        logs: {
          current: `
            [INFO] Starting payment-api service...
            [DEBUG] Connection attempt with password=TEST_PASSWORD_123 to database
            [DEBUG] Using api_key=TEST_API_KEY_456 for third-party billing
            [ERROR] Bearer token=TEST_TOKEN_789 validation failed
            [FATAL] Connection to database failed. Exiting with code 1.
          `,
          previous: `
            [DEBUG] password=TEST_PASSWORD_123 token=TEST_TOKEN_789 api_key=TEST_API_KEY_456
          `,
        } as any,
      };

      // 1. Pass through sanitizer
      const sanitizedContext = sanitize(testPodContext);

      // 2. Build the final prompt payload that will be sent to Gemini / AI model
      const aiPromptPayload = buildDiagnosticPrompt(sanitizedContext);

      // 3. VERIFY: None of the test fake secrets appear anywhere in the AI payload
      expect(aiPromptPayload).not.toContain('TEST_PASSWORD_123');
      expect(aiPromptPayload).not.toContain('TEST_API_KEY_456');
      expect(aiPromptPayload).not.toContain('TEST_TOKEN_789');

      // 4. VERIFY: Safe references to Secret and ConfigMap names REMAIN in the payload
      expect(aiPromptPayload).toContain('database-secret');
      expect(aiPromptPayload).toContain('application-config');

      // 5. VERIFY: Mandatory AI access & security rules are present in the prompt
      expect(aiPromptPayload).toContain('Never request Secret values');
      expect(aiPromptPayload).toContain('Never request ConfigMap values');
      expect(aiPromptPayload).toContain('Never attempt to access Kubernetes');
    });
  });
});
