import { describe, it, expect } from 'vitest';
import { sanitize } from '../../src/services/diagnostics/sanitizer.service';

describe('Sanitizer Service', () => {
  it('should redact password values', () => {
    const input = { password: 'supersecret123' };
    const result = sanitize(input);
    expect(result.password).toBe('[REDACTED]');
  });

  it('should redact API key values', () => {
    const input = { apiKey: 'AIzaSyAbc123', api_key: 'key456' };
    const result = sanitize(input);
    expect(result.apiKey).toBe('[REDACTED]');
    expect(result.api_key).toBe('[REDACTED]');
  });

  it('should redact token values', () => {
    const input = { token: 'eyJhbGciOiJIUzI1NiJ9.test.sig', secret_key: 'mysecret' };
    const result = sanitize(input);
    expect(result.token).toBe('[REDACTED]');
    expect(result.secret_key).toBe('[REDACTED]');
  });

  it('should redact Bearer tokens in strings', () => {
    const input = { logs: 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature' };
    const result = sanitize(input);
    expect(result.logs).not.toContain('eyJhbGci');
    expect(result.logs).toContain('[REDACTED');
  });

  it('should redact connection strings', () => {
    const input = { env: 'MONGO_URI=mongodb://admin:pass@host:27017/db' };
    const result = sanitize(input);
    expect(result.env).not.toContain('admin:pass');
    expect(result.env).toContain('[REDACTED');
  });

  it('should redact private keys', () => {
    const input = { cert: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBA\n-----END PRIVATE KEY-----' };
    const result = sanitize(input);
    expect(result.cert).not.toContain('MIIEvgIBA');
    expect(result.cert).toContain('[REDACTED');
  });

  it('should redact JWTs in log strings', () => {
    const input = { log: 'token=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.sig123' };
    const result = sanitize(input);
    expect(result.log).toContain('[REDACTED');
  });

  it('should not redact non-sensitive values', () => {
    const input = {
      name: 'my-pod',
      namespace: 'production',
      phase: 'Running',
      restartCount: 5,
    };
    const result = sanitize(input);
    expect(result.name).toBe('my-pod');
    expect(result.namespace).toBe('production');
    expect(result.phase).toBe('Running');
    expect(result.restartCount).toBe(5);
  });

  it('should handle nested objects', () => {
    const input = {
      container: {
        env: {
          DB_PASSWORD: 'secret123',
          APP_NAME: 'myapp',
        },
      },
    };
    const result = sanitize(input);
    expect(result.container.env.DB_PASSWORD).toBe('[REDACTED]');
    expect(result.container.env.APP_NAME).toBe('myapp');
  });

  it('should handle arrays', () => {
    const input = {
      secrets: [
        { name: 'db-creds', password: 'abc123' },
        { name: 'api-key', token: 'xyz789' },
      ],
    };
    const result = sanitize(input);
    expect(result.secrets[0].password).toBe('[REDACTED]');
    expect(result.secrets[1].token).toBe('[REDACTED]');
    expect(result.secrets[0].name).toBe('db-creds');
  });

  it('should handle null and undefined', () => {
    const input = { password: null, token: undefined, name: 'test' };
    const result = sanitize(input);
    expect(result.password).toBeNull();
    expect(result.token).toBeUndefined();
    expect(result.name).toBe('test');
  });

  it('should redact password= patterns in log strings', () => {
    const input = { log: 'Connecting with password=abc123 to database' };
    const result = sanitize(input);
    expect(result.log).not.toContain('abc123');
    expect(result.log).toContain('[REDACTED]');
  });

  it('should redact secret-related field names', () => {
    const data = {
      client_secret: 'somesecret',
      aws_secret_access_key: 'AKIAIOSFODNN7EXAMPLE',
      connectionstring: 'Server=myserver;Password=mypass',
    };
    const result = sanitize(data);
    expect(result.client_secret).toBe('[REDACTED]');
    expect(result.aws_secret_access_key).toBe('[REDACTED]');
    expect(result.connectionstring).toBe('[REDACTED]');
  });
});
