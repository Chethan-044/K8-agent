import { useState, useEffect } from 'react';
import { getNodes } from '../services/api';

export default function Nodes() {
  const [nodes, setNodesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNodes();
  }, []);

  async function loadNodes() {
    setLoading(true);
    try {
      const res = await getNodes();
      setNodesData(res.nodes);
    } catch {}
    setLoading(false);
  }

  function getReadyStatus(node: any): boolean {
    return node.conditions?.some((c: any) => c.type === 'Ready' && c.status === 'True');
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 className="page-title">Nodes</h2>
          <span className="page-count">{nodes.length} nodes</span>
        </div>
        <button className="btn btn-sm" onClick={loadNodes}>Refresh</button>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner" style={{ width: 20, height: 20, border: '2px solid var(--border-primary)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Version</th>
                <th>OS</th>
                <th>Architecture</th>
                <th>Runtime</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((n, i) => {
                const ready = getReadyStatus(n);
                return (
                  <tr key={i}>
                    <td className="mono">{n.name}</td>
                    <td>
                      <span className={`badge ${ready ? 'badge-success' : 'badge-critical'}`}>
                        {ready ? 'Ready' : 'NotReady'}
                      </span>
                    </td>
                    <td className="mono">{n.nodeInfo?.kubeletVersion || '—'}</td>
                    <td className="mono">{n.nodeInfo?.osImage || '—'}</td>
                    <td className="mono">{n.nodeInfo?.architecture || '—'}</td>
                    <td className="mono">{n.nodeInfo?.containerRuntimeVersion || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {nodes.length === 0 && <div className="empty-state"><div className="empty-state-text">No nodes found</div></div>}
        </div>
      )}
    </div>
  );
}
