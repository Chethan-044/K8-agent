import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanUsername || cleanUsername.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(cleanUsername)) {
      setError('Username can only contain alphanumeric characters, underscores, and hyphens.');
      return;
    }

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setError('Please provide a valid email address.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Password confirmation does not match.');
      return;
    }

    setLoading(true);

    try {
      await register(cleanUsername, cleanEmail, password, confirmPassword);
      setSuccess('Account created successfully! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="setup-page">
      <div className="setup-container" style={{ maxWidth: 420 }}>
        <div className="setup-title">K8s Agent</div>
        <div className="setup-subtitle">Create persistent account</div>

        <form onSubmit={handleSubmit}>
          <label className="setup-label">Username</label>
          <input
            className="input"
            type="text"
            placeholder="e.g. sreadmin"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setError('');
            }}
            required
            autoFocus
            style={{ marginBottom: 12 }}
          />

          <label className="setup-label">Email</label>
          <input
            className="input"
            type="email"
            placeholder="sre@company.internal"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError('');
            }}
            required
            style={{ marginBottom: 12 }}
          />

          <label className="setup-label">Password</label>
          <input
            className="input"
            type="password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError('');
            }}
            required
            minLength={8}
            style={{ marginBottom: 12 }}
          />

          <label className="setup-label">Confirm Password</label>
          <input
            className="input"
            type="password"
            placeholder="Re-enter password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setError('');
            }}
            required
            minLength={8}
            style={{ marginBottom: 16 }}
          />

          {error && (
            <div className="setup-error" style={{ marginBottom: 16 }}>
              ✗ {error}
            </div>
          )}

          {success && (
            <div className="setup-success" style={{ marginBottom: 16 }}>
              ✓ {success}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '9px 16px' }}
              disabled={loading || !username.trim() || !email.trim() || !password || !confirmPassword}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
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
          <span>Already have an account?</span>
          <Link
            to="/login"
            style={{
              color: 'var(--text-primary)',
              textDecoration: 'underline',
              fontFamily: 'var(--font-mono)',
            }}
          >
            Login →
          </Link>
        </div>
      </div>
    </div>
  );
}
