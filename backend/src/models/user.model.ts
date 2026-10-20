export interface UserRecord {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
  last_login_at?: string | null;
}

export interface SafeUser {
  id: string;
  username: string;
  email: string;
  createdAt: string;
  lastLoginAt?: string | null;
}

export interface SessionRecord {
  id: string;
  user_id: string;
  created_at: string;
  expires_at: string;
  last_active_at: string;
}

export function toSafeUser(user: UserRecord): SafeUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    createdAt: user.created_at,
    lastLoginAt: user.last_login_at,
  };
}
