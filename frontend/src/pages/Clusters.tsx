import { useState, useEffect } from 'react';
import { getClusters, selectCluster } from '../services/api';
import { ClusterInfo } from '../types/cluster';

interface ClustersProps {
  onSelected: (ctx: string, info: any) => void;
  onBack: () => void;
}

export default function Clusters({ onSelected, onBack }: ClustersProps) {
  const [clusters, setClusters] = useState<ClusterInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    loadClusters();
  }, []);

  async function loadClusters() {
    setLoading(true);
    setError('');
    try {
      const result = await getClusters();
      setClusters(result.clusters);
    } catch (err: any) {
      setError(err.message || 'Failed to discover clusters');
    }
    setLoading(false);
  }

  async function handleSelect(ctx: string) {
    setConnecting(ctx);
    setError('');
    try {
      const result = await selectCluster(ctx);
      if (result.connected) {
        onSelected(result.context, result.clusterInfo);
      } else {
        setError('Failed to connect to cluster');
      }
    } catch (err: any) {
      setError(err.message || 'Connection failed');
    }
    setConnecting(null);
  }

  return (
    <div className="setup-page">
      <div className="setup-container" style={{ maxWidth: 500 }}>
        <div className="setup-title">K8s Agent</div>
        <div className="setup-subtitle">Select Kubernetes Cluster</div>

        {loading && (
          <div style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 12, padding: '20px 0' }}>
            Discovering clusters...
          </div>
        )}

        {error && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}

        {!loading && clusters.length === 0 && !error && (
          <div className="empty-state">
            <div className="empty-state-title">No clusters found</div>
            <div className="empty-state-text">
              Ensure your kubeconfig is mounted correctly.
            </div>
          </div>
        )}

        <div className="cluster-list">
          {clusters.map((c) => (
            <div
              key={c.contextName}
              className={`cluster-item ${connecting === c.contextName ? 'selected' : ''}`}
              onClick={() => !connecting && handleSelect(c.contextName)}
            >
              <div>
                <div className="cluster-item-name">{c.contextName}</div>
                <div className="cluster-item-server">{c.server}</div>
              </div>
              <div className="cluster-item-status">
                {connecting === c.contextName ? (
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
                    Connecting...
                  </span>
                ) : (
                  <>
                    <span className={`cluster-status-dot ${c.connected ? 'connected' : 'disconnected'}`} />
                    <span style={{ color: c.connected ? 'var(--status-success)' : 'var(--text-tertiary)', fontSize: 11 }}>
                      {c.connected ? 'Reachable' : 'Unreachable'}
                    </span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
          <button className="btn" onClick={onBack}>← Back</button>
          <button className="btn" onClick={loadClusters} disabled={loading}>Refresh</button>
        </div>
      </div>
    </div>
  );
}
