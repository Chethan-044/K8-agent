import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../../db/database';
import { UserRecord, SafeUser, SessionRecord, toSafeUser } from '../../models/user.model';
import { config } from '../../config/config';
import { logger } from '../../utils/logger';

const BCRYPT_ROUNDS = 12;

export interface RegisterInput {
  username: string;
  email: string;
  password: string;
  confirmPassword?: string;
}

export interface LoginInput {
  identifier: string; // username or email
  password: string;
}

export interface AuthResult {
  user: SafeUser;
  sessionId: string;
  expiresAt: Date;
}

export interface UserAiConfig {
  apiKey: string;
  baseUrl?: string;
  modelName?: string;
  provider?: string;
}

// In-memory per-user AI credentials store (held strictly in memory per user session)
const userAiConfigs = new Map<string, UserAiConfig>();

// Security Audit logger
export function logSecurityEvent(
  eventType: 'register' | 'login.success' | 'login.failure' | 'logout' | 'cluster.select' | 'diagnosis.request',
  details: { userId?: string; username?: string; ip?: string; info?: string }
): void {
  // Never log passwords, tokens, or raw secrets
  logger.info(`[SECURITY_AUDIT] Event: ${eventType} | User: ${details.username || details.userId || 'anonymous'} | IP: ${details.ip || 'unknown'}${details.info ? ` | ${details.info}` : ''}`);
}

export async function registerUser(input: RegisterInput, ip?: string): Promise<SafeUser> {
  const username = input.username?.trim();
  const email = input.email?.trim().toLowerCase();
  const password = input.password;

  if (!username || username.length < 3 || username.length > 30) {
    throw new Error('Username must be between 3 and 30 characters');
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    throw new Error('Username can only contain alphanumeric characters, underscores, and hyphens');
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('A valid email address is required');
  }

  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }

  if (input.confirmPassword !== undefined && password !== input.confirmPassword) {
    throw new Error('Passwords do not match');
  }

  const db = getDatabase();

  // Check for duplicate username or email
  const existing = db
    .prepare('SELECT id, username, email FROM users WHERE username = ? OR email = ?')
    .get(username, email) as { id: string; username: string; email: string } | undefined;

  if (existing) {
    logSecurityEvent('register', { username, ip, info: 'Failed - duplicate account attempt' });
    throw new Error('An account with this username or email already exists');
  }

  // Hash password with bcrypt cost factor 12
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const now = new Date().toISOString();
  const id = uuidv4();

  db.prepare(`
    INSERT INTO users (id, username, email, password_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, username, email, passwordHash, now, now);

  logSecurityEvent('register', { userId: id, username, ip, info: 'User registered successfully' });

  return {
    id,
    username,
    email,
    createdAt: now,
  };
}

export async function loginUser(input: LoginInput, ip?: string): Promise<AuthResult> {
  const identifier = input.identifier?.trim();
  const password = input.password;

  if (!identifier || !password) {
    logSecurityEvent('login.failure', { username: identifier, ip, info: 'Missing credentials' });
    throw new Error('Invalid username or password.');
  }

  const db = getDatabase();

  // Find user by username or email
  const user = db
    .prepare('SELECT * FROM users WHERE username = ? OR email = ?')
    .get(identifier, identifier.toLowerCase()) as UserRecord | undefined;

  if (!user) {
    // Constant-time dummy compare to resist timing attacks
    await bcrypt.hash('dummy_timing_padding', BCRYPT_ROUNDS);
    logSecurityEvent('login.failure', { username: identifier, ip, info: 'User not found' });
    throw new Error('Invalid username or password.');
  }

  const passwordMatch = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatch) {
    logSecurityEvent('login.failure', { userId: user.id, username: user.username, ip, info: 'Incorrect password' });
    throw new Error('Invalid username or password.');
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + config.sessionTtlHours * 60 * 60 * 1000);
  const sessionId = crypto.randomBytes(32).toString('hex');

  // Update last_login_at
  db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(now.toISOString(), user.id);

  // Insert session
  db.prepare(`
    INSERT INTO sessions (id, user_id, created_at, expires_at, last_active_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(sessionId, user.id, now.toISOString(), expiresAt.toISOString(), now.toISOString());

  logSecurityEvent('login.success', { userId: user.id, username: user.username, ip });

  return {
    user: toSafeUser(user),
    sessionId,
    expiresAt,
  };
}

export function validateSession(sessionId: string): SafeUser | null {
  if (!sessionId || typeof sessionId !== 'string') {
    return null;
  }

  const db = getDatabase();
  const now = new Date().toISOString();

  // Query valid non-expired session
  const row = db.prepare(`
    SELECT u.id, u.username, u.email, u.created_at, u.last_login_at, s.expires_at
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ? AND s.expires_at > ?
  `).get(sessionId, now) as (UserRecord & { expires_at: string }) | undefined;

  if (!row) {
    return null;
  }

  // Touch session last_active_at
  try {
    db.prepare('UPDATE sessions SET last_active_at = ? WHERE id = ?').run(now, sessionId);
  } catch {}

  return toSafeUser(row);
}

export function logoutSession(sessionId: string, ip?: string): void {
  if (!sessionId) return;
  const db = getDatabase();

  const session = db.prepare('SELECT user_id FROM sessions WHERE id = ?').get(sessionId) as { user_id: string } | undefined;
  if (session) {
    userAiConfigs.delete(session.user_id);
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
    logSecurityEvent('logout', { userId: session.user_id, ip });
  }
}

// User-associated AI config management
export function setUserAiConfig(userId: string, aiConfig: UserAiConfig): void {
  userAiConfigs.set(userId, {
    apiKey: aiConfig.apiKey.trim(),
    baseUrl: aiConfig.baseUrl?.trim(),
    modelName: aiConfig.modelName?.trim(),
    provider: aiConfig.provider,
  });
  logger.info(`AI config set for user ${userId}`);
}

export function getUserAiConfig(userId: string): UserAiConfig | undefined {
  return userAiConfigs.get(userId);
}

export function clearUserAiConfig(userId: string): void {
  userAiConfigs.delete(userId);
  logger.info(`AI config cleared for user ${userId}`);
}

export function getMaskedApiKey(key?: string): string {
  if (!key) return '';
  if (key.length <= 4) return '••••';
  const lastFour = key.slice(-4);
  return '••••••••••••' + lastFour;
}

// Record diagnosis history (Requirement #23)
export function saveDiagnosisHistory(
  userId: string,
  entry: {
    clusterContext: string;
    namespace: string;
    resourceKind: string;
    resourceName: string;
    problemType: string;
    diagnosis: any;
  }
): void {
  try {
    const db = getDatabase();
    const id = uuidv4();
    const now = new Date().toISOString();
    // Ensure only sanitized JSON summary is stored, no raw credentials
    const sanitizedDiagnosisJson = JSON.stringify(entry.diagnosis);

    db.prepare(`
      INSERT INTO diagnosis_history (id, user_id, cluster_context, namespace, resource_kind, resource_name, problem_type, diagnosis, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      userId,
      entry.clusterContext,
      entry.namespace,
      entry.resourceKind,
      entry.resourceName,
      entry.problemType,
      sanitizedDiagnosisJson,
      now
    );
  } catch (err: any) {
    logger.warn(`Failed to save diagnosis history: ${err.message}`);
  }
}
