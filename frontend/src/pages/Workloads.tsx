import { useState, useEffect } from 'react';
import { getPods, getDeployments, getServices, getNamespaces } from '../services/api';

export default function Workloads() {
  const [tab, setTab] = useState<'pods' | 'deployments' | 'services'>('pods');
  const [data, setData] = useState<any[]>([]);
  const [namespaces, setNamespacesList] = useState<string[]>([]);
  const [selectedNs, setSelectedNs] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getNamespaces().then(r => setNamespacesList(r.namespaces)).catch(() => {});
    loadData();
  }, []);

  useEffect(() => {
    loadData();
  }, [tab, selectedNs]);

  async function loadData() {
    setLoading(true);
    try {
      const ns = selectedNs || undefined;
      if (tab === 'pods') {
        const res = await getPods(ns);
        setData(res.pods);
      } else if (tab === 'deployments') {
        const res = await getDeployments(ns);
        setData(res.deployments);
      } else {
        const res = await getServices(ns);
        setData(res.services);
      }
    } catch {}
    setLoading(false);
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 className="page-title">Workloads</h2>
          <div style={{ display: 'flex', gap: 2, marginLeft: 12 }}>
            {(['pods', 'deployments', 'services'] as const).map(t => (
              <button
                key={t}
                className={`btn btn-sm ${tab === t ? 'btn-primary' : ''}`}
                onClick={() => setTab(t)}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <select
          className="input"
          style={{ width: 160, padding: '4px 8px' }}
          value={selectedNs}
          onChange={(e) => setSelectedNs(e.target.value)}
        >
          <option value="">All namespaces</option>
          {namespaces.map(ns => <option key={ns} value={ns}>{ns}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner" style={{ width: 20, height: 20, border: '2px solid var(--border-primary)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : (
        <div className="table-container">
          {tab === 'pods' && (
            <table className="data-table">
              <thead><tr><th>Name</th><th>Namespace</th><th>Phase</th><th>Ready</th><th>Restarts</th><th>Node</th></tr></thead>
              <tbody>
                {data.map((p: any, i: number) => (
                  <tr key={i}>
                    <td className="mono">{p.name}</td>
                    <td className="mono">{p.namespace}</td>
                    <td>
                      <span className={`badge ${p.phase === 'Running' ? 'badge-success' : p.phase === 'Failed' ? 'badge-critical' : 'badge-warning'}`}>
                        {p.phase}
                      </span>
                    </td>
                    <td className="mono">{p.ready}/{p.total}</td>
                    <td className="mono">{p.restarts}</td>
                    <td className="mono">{p.nodeName || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === 'deployments' && (
            <table className="data-table">
              <thead><tr><th>Name</th><th>Namespace</th><th>Ready</th><th>Available</th><th>Updated</th></tr></thead>
              <tbody>
                {data.map((d: any, i: number) => (
                  <tr key={i}>
                    <td className="mono">{d.name}</td>
                    <td className="mono">{d.namespace}</td>
                    <td className="mono">{d.ready}/{d.replicas}</td>
                    <td className="mono">{d.available}</td>
                    <td className="mono">{d.updated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === 'services' && (
            <table className="data-table">
              <thead><tr><th>Name</th><th>Namespace</th><th>Type</th><th>Cluster IP</th><th>Ports</th></tr></thead>
              <tbody>
                {data.map((s: any, i: number) => (
                  <tr key={i}>
                    <td className="mono">{s.name}</td>
                    <td className="mono">{s.namespace}</td>
                    <td>{s.type}</td>
                    <td className="mono">{s.clusterIP}</td>
                    <td className="mono">{s.ports?.map((p: any) => `${p.port}/${p.protocol}`).join(', ') || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {data.length === 0 && (
            <div className="empty-state"><div className="empty-state-text">No resources found</div></div>
          )}
        </div>
      )}
    </div>
  );
}
