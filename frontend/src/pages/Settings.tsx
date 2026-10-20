import { useState, useEffect } from 'react';
import { deleteAiKey, getAiStatus, setAiKey, getCurrentCluster } from '../services/api';

interface SettingsProps {
  onResetAi: () => void;
  onDisconnect: () => void;
}

export default function Settings({ onResetAi, onDisconnect }: SettingsProps) {
  const [clearing, setClearing] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [keyError, setKeyError] = useState('');
  const [clusterInfo, setClusterInfo] = useState<{ context?: string } | null>(null);
  const [aiStatus, setAiStatus] = useState<{
    configured: boolean;
    model?: string;
    baseUrl?: string;
    provider?: string;
    maskedKey?: string;
  } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const [ai, cluster] = await Promise.all([
        getAiStatus().catch(() => null),
        getCurrentCluster().catch(() => null),
      ]);
      if (ai) setAiStatus(ai);
      if (cluster) setClusterInfo(cluster);
    } catch {}
  }

  async function handleRemoveKey() {
    if (!confirm('Are you sure you want to remove the configured AI API key?')) return;
    setClearing(true);
    try {
      await deleteAiKey();
      onResetAi();
    } catch {}
    setClearing(false);
  }

  async function handleSaveNewKey() {
    if (!newKey.trim()) {
      setKeyError('API key cannot be empty');
      return;
    }
    setSavingKey(true);
    setKeyError('');
    try {
      const res = await setAiKey(newKey.trim(), aiStatus?.baseUrl, aiStatus?.model);
      setAiStatus(res);
      setReplacing(false);
      setNewKey('');
    } catch (err: any) {
      setKeyError(err.message || 'Failed to update key');
    } finally {
      setSavingKey(false);
    }
  }

  return (
    <div>
      <h2 className="page-title" style={{ marginBottom: 20 }}>Settings</h2>

      {/* 1. AI Provider & Gemini API Key */}
      <div className="section">
        <div className="section-title">AI Provider & API Key</div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>
                {aiStatus?.provider || 'Gemini / AI Diagnostic Provider'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 8 }}>
                Gemini API Key
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary)',
                  letterSpacing: '0.1em',
                  background: 'var(--bg-secondary)',
                  padding: '4px 10px',
                  borderRadius: 'var(--radius-sm)',
                  display: 'inline-block',
                  border: '1px solid var(--border)',
                }}
              >
                {aiStatus?.maskedKey || '●●●●●●●●●●●●'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              {!replacing ? (
                <>
                  <button
                    className="btn btn-sm"
                    onClick={() => {
                      setReplacing(true);
                      setKeyError('');
                    }}
                  >
                    Replace Key
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={handleRemoveKey}
                    disabled={clearing}
                  >
                    {clearing ? 'Removing...' : 'Remove Key'}
                  </button>
                </>
              ) : null}
            </div>
          </div>

          {replacing && (
            <div
              style={{
                marginTop: 12,
                padding: 12,
                border: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 8 }}>
                Enter new API Key:
              </div>
              <input
                type="password"
                className="input"
                placeholder="Paste new API key..."
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                style={{ width: '100%', marginBottom: 8 }}
                autoFocus
              />
              {keyError && (
                <div style={{ fontSize: 11.5, color: 'var(--accent-red)', marginBottom: 8 }}>
                  {keyError}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => {
                    setReplacing(false);
                    setNewKey('');
                    setKeyError('');
                  }}
                  disabled={savingKey}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={handleSaveNewKey}
                  disabled={savingKey}
                >
                  {savingKey ? 'Saving...' : 'Save Key'}
                </button>
              </div>
            </div>
          )}

          <div
            style={{
              fontSize: 11.5,
              color: 'var(--text-secondary)',
              display: 'grid',
              gridTemplateColumns: '120px 1fr',
              gap: '6px 12px',
              borderTop: '1px solid var(--border)',
              paddingTop: 12,
              marginTop: 12,
            }}
          >
            <span style={{ color: 'var(--text-tertiary)' }}>Model:</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
              {aiStatus?.model || '—'}
            </span>
            <span style={{ color: 'var(--text-tertiary)' }}>Endpoint:</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
              {aiStatus?.baseUrl || '—'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Cluster Connection */}
      <div className="section">
        <div className="section-title">Cluster Connection</div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12.5, color: 'var(--text-primary)', marginBottom: 2 }}>
                Current Context
              </div>
              <div style={{ fontSize: 11.5, fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                {clusterInfo?.context || 'No cluster context connected'}
              </div>
            </div>
            <button className="btn btn-sm" onClick={onDisconnect}>
              Switch Cluster
            </button>
          </div>
        </div>
      </div>

      {/* 3. Security Status UI (Requirement 30) */}
      <div className="section">
        <div className="section-title">Security</div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
            <div style={{ border: '1px solid var(--border)', padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                Kubernetes access
              </div>
              <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent-green)', fontWeight: 600 }}>
                READ ONLY
              </div>
            </div>

            <div style={{ border: '1px solid var(--border)', padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                Secrets
              </div>
              <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent-green)', fontWeight: 600 }}>
                NOT ACCESSIBLE
              </div>
            </div>

            <div style={{ border: '1px solid var(--border)', padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                ConfigMap data
              </div>
              <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent-green)', fontWeight: 600 }}>
                NOT SENT TO AI
              </div>
            </div>

            <div style={{ border: '1px solid var(--border)', padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                AI access
              </div>
              <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--accent-green)', fontWeight: 600 }}>
                SANITIZED DATA ONLY
              </div>
            </div>
          </div>

          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.6, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            Diagnostic evidence passes through an automated sanitization boundary before reaching AI reasoning models.
            Sensitive environment values, credentials, tokens, and raw Secret/ConfigMap payloads are strictly redacted.
          </div>
        </div>
      </div>

      {/* 4. About */}
      <div className="section">
        <div className="section-title">About</div>
        <div className="card">
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            <div><span style={{ color: 'var(--text-tertiary)', width: 80, display: 'inline-block' }}>Version</span> 1.0.0</div>
            <div><span style={{ color: 'var(--text-tertiary)', width: 80, display: 'inline-block' }}>Mode</span> Read-only RBAC Hardened</div>
            <div><span style={{ color: 'var(--text-tertiary)', width: 80, display: 'inline-block' }}>Engine</span> Universal AI Diagnostics (Gemini & OpenAI-compatible)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
