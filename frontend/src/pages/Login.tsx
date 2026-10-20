import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError('Please enter your username/email and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await login(identifier.trim(), password);
      navigate('/');
    } catch (err: any) {
      // Generic error message per security requirement
      setError(err.message || 'Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="setup-page">
      <div className="setup-container" style={{ maxWidth: 400 }}>
        <div className="setup-title">K8s Agent</div>
        <div className="setup-subtitle">Sign in to your account</div>

        <form onSubmit={handleSubmit}>
          <label className="setup-label">Email or Username</label>
          <input
            className="input"
            type="text"
            placeholder="admin or user@domain.com"
            value={identifier}
            onChange={(e) => {
              setIdentifier(e.target.value);
              setError('');
            }}
            autoFocus
            required
            style={{ marginBottom: 12 }}
          />

          <label className="setup-label">Password</label>
          <input
            className="input"
            type="password"
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
            required
            style={{ marginBottom: 16 }}
          />

          {error && (
            <div className="setup-error" style={{ marginBottom: 16 }}>
              ✗ {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '9px 16px' }}
              disabled={loading || !identifier.trim() || !password}
            >
              {loading ? 'Authenticating...' : 'Login'}
            </button>
          </div>
        </form>

        <div
          style={{
            marginTop: 20,
            paddingTop: 16,
            borderTop: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 12,
            color: 'var(--text-secondary)',
          }}
        >
          <span>Need an account?</span>
          <Link
            to="/register"
            style={{
              color: 'var(--text-primary)',
              textDecoration: 'underline',
              fontFamily: 'var(--font-mono)',
            }}
          >
            Create Account →
          </Link>
        </div>
      </div>
    </div>
  );
}
