import { useState } from 'react';
import { setAiKey, testAiConnection } from '../services/api';

interface SetupProps {
  onConfigured: () => void;
}

interface ProviderPreset {
  id: string;
  name: string;
  defaultUrl: string;
  defaultModel: string;
  placeholderKey: string;
  description: string;
}

const PRESETS: ProviderPreset[] = [
  {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    defaultUrl: 'https://integrate.api.nvidia.com/v1',
    defaultModel: 'meta/llama-3.1-70b-instruct',
    placeholderKey: 'nvapi-...',
    description: 'NVIDIA API Catalog / NIM OpenAI-compatible endpoint',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    defaultUrl: 'https://generativelanguage.googleapis.com',
    defaultModel: 'gemini-2.5-flash',
    placeholderKey: 'AIzaSy...',
    description: 'Google AI Studio / Generative Language API',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    defaultUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o-mini',
    placeholderKey: 'sk-proj-...',
    description: 'Official OpenAI Chat Completions API',
  },
  {
    id: 'groq',
    name: 'Groq',
    defaultUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.3-70b-versatile',
    placeholderKey: 'gsk_...',
    description: 'Ultra-fast LPU inference endpoint',
  },
  {
    id: 'ollama',
    name: 'Ollama / Local',
    defaultUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3.2',
    placeholderKey: 'Optional (e.g. ollama)',
    description: 'Local or self-hosted OpenAI-compatible server',
  },
  {
    id: 'custom',
    name: 'Custom / Other',
    defaultUrl: '',
    defaultModel: '',
    placeholderKey: 'API key / token',
    description: 'Any OpenAI-compatible or custom base URL',
  },
];

export default function Setup({ onConfigured }: SetupProps) {
  const [selectedPreset, setSelectedPreset] = useState<string>('nvidia');
  const [apiUrl, setApiUrl] = useState('https://integrate.api.nvidia.com/v1');
  const [modelName, setModelName] = useState('meta/llama-3.1-70b-instruct');
  const [apiKey, setApiKeyVal] = useState('');
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [testResult, setTestResult] = useState<string>('');

  function handleSelectPreset(preset: ProviderPreset) {
    setSelectedPreset(preset.id);
    if (preset.id !== 'custom') {
      setApiUrl(preset.defaultUrl);
      setModelName(preset.defaultModel);
    }
    setError('');
    setTestResult('');
  }

  function handleUrlChange(newUrl: string) {
    setApiUrl(newUrl);
    setError('');
    setTestResult('');

    const trimmed = newUrl.trim();
    // Auto-detect model if user pastes full Gemini URL
    if (trimmed.includes('generativelanguage.googleapis.com')) {
      setSelectedPreset('gemini');
      const match = trimmed.match(/\/models\/([^/:]+)/);
      if (match) {
        setModelName(match[1]);
      }
    } else if (trimmed.includes('nvidia.com')) {
      setSelectedPreset('nvidia');
      if (!modelName || modelName === 'gemini-flash-latest' || modelName === 'gpt-4o-mini') {
        setModelName('meta/llama-3.1-70b-instruct');
      }
    } else if (trimmed.includes('openai.com')) {
      setSelectedPreset('openai');
      if (!modelName || modelName.includes('llama')) {
        setModelName('gpt-4o-mini');
      }
    } else if (trimmed.includes('groq.com')) {
      setSelectedPreset('groq');
      if (!modelName || modelName.includes('gpt')) {
        setModelName('llama-3.3-70b-versatile');
      }
    }
  }

  const effectiveUrl = apiUrl.trim() || undefined;
  const effectiveModel = modelName.trim() || undefined;
  const currentPreset = PRESETS.find((p) => p.id === selectedPreset) || PRESETS[0];

  async function handleTest() {
    if (!apiKey.trim() && selectedPreset !== 'ollama') return;
    setTesting(true);
    setError('');
    setTestResult('');
    try {
      const result = await testAiConnection(apiKey.trim(), effectiveUrl, effectiveModel);
      if (result.valid) {
        setTestResult(`Connected (${result.provider || 'AI Provider'}) — Model: ${result.model}`);
      } else {
        setError(result.error || 'Connection failed');
      }
    } catch (err: any) {
      setError(err.message || 'Connection test failed');
    }
    setTesting(false);
  }

  async function handleContinue() {
    if (!apiKey.trim() && selectedPreset !== 'ollama') return;
    setSaving(true);
    setError('');
    try {
      await setAiKey(apiKey.trim(), effectiveUrl, effectiveModel);
      onConfigured();
    } catch (err: any) {
      setError(err.message || 'Failed to configure AI provider');
    }
    setSaving(false);
  }

  return (
    <div className="setup-page">
      <div className="setup-container" style={{ maxWidth: 520 }}>
        <div className="setup-title">K8s Agent</div>
        <div className="setup-subtitle">Connect AI Diagnostic Engine</div>

        <div style={{ marginBottom: 16 }}>
          <label className="setup-label" style={{ marginBottom: 8, display: 'block' }}>Provider Preset</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`btn btn-sm ${selectedPreset === p.id ? 'btn-primary' : ''}`}
                style={{
                  padding: '6px 8px',
                  fontSize: 11,
                  textAlign: 'center',
                  background: selectedPreset === p.id ? 'var(--bg-elevated, #2a2a2a)' : 'var(--bg-surface, #1e1e1e)',
                  borderColor: selectedPreset === p.id ? 'var(--border-focus, #666)' : 'var(--border, #333)',
                  color: selectedPreset === p.id ? '#fff' : 'var(--text-secondary, #aaa)',
                }}
                onClick={() => handleSelectPreset(p)}
              >
                {p.name}
              </button>
            ))}
          </div>
          <div className="setup-hint" style={{ marginTop: 6, fontSize: 11 }}>
            {currentPreset.description}
          </div>
        </div>

        <label className="setup-label">API Base URL / Endpoint</label>
        <input
          className="input"
          type="text"
          placeholder="https://integrate.api.nvidia.com/v1 or https://api.openai.com/v1"
          value={apiUrl}
          onChange={(e) => handleUrlChange(e.target.value)}
          style={{ marginBottom: 4 }}
        />
        <div className="setup-hint" style={{ marginBottom: 12 }}>
          Accepts any base URL (e.g. OpenAI/NVIDIA/Ollama) or full Gemini endpoint.
        </div>

        <label className="setup-label">Model Name</label>
        <input
          className="input"
          type="text"
          placeholder="e.g. meta/llama-3.1-70b-instruct, gpt-4o-mini, gemini-flash-latest"
          value={modelName}
          onChange={(e) => {
            setModelName(e.target.value);
            setError('');
            setTestResult('');
          }}
          style={{ marginBottom: 4 }}
        />
        <div className="setup-hint" style={{ marginBottom: 12 }}>
          Target model for generating Kubernetes root-cause diagnostics.
        </div>

        <label className="setup-label">API Key</label>
        <input
          className="input"
          type="password"
          placeholder={currentPreset.placeholderKey}
          value={apiKey}
          onChange={(e) => {
            setApiKeyVal(e.target.value);
            setError('');
            setTestResult('');
          }}
          onKeyDown={(e) => e.key === 'Enter' && handleContinue()}
        />

        <div className="setup-hint">
          Your key is held strictly in memory in your local container and never persisted to disk.
        </div>

        {error && <div className="setup-error" style={{ wordBreak: 'break-word' }}>✗ {error}</div>}
        {testResult && <div className="setup-success">✓ {testResult}</div>}

        <div className="setup-actions">
          <button
            type="button"
            className="btn"
            onClick={handleTest}
            disabled={(!apiKey.trim() && selectedPreset !== 'ollama') || testing}
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleContinue}
            disabled={(!apiKey.trim() && selectedPreset !== 'ollama') || saving}
          >
            {saving ? 'Connecting...' : 'Continue →'}
          </button>
        </div>
      </div>
    </div>
  );
}

