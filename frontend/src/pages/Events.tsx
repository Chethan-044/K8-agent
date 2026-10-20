import { useState, useEffect } from 'react';
import { getEvents } from '../services/api';

export default function Events() {
  const [events, setEventsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'Warning' | 'Normal'>('all');

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    setLoading(true);
    try {
      const res = await getEvents();
      setEventsData(res.events);
    } catch {}
    setLoading(false);
  }

  const filtered = filter === 'all' ? events : events.filter(e => e.type === filter);

  function timeAgo(ts: string): string {
    if (!ts) return '—';
    const diff = Date.now() - new Date(ts).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 className="page-title">Events</h2>
          <span className="page-count">{filtered.length} events</span>
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          {(['all', 'Warning', 'Normal'] as const).map(f => (
            <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : ''}`} onClick={() => setFilter(f)}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="spinner" style={{ width: 20, height: 20, border: '2px solid var(--border-primary)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>Type</th><th>Reason</th><th>Object</th><th>Message</th><th>Count</th><th>Last Seen</th></tr></thead>
            <tbody>
              {filtered.map((e, i) => (
                <tr key={i}>
                  <td>
                    <span className={`badge ${e.type === 'Warning' ? 'badge-warning' : 'badge-info'}`}>
                      {e.type}
                    </span>
                  </td>
                  <td className="mono">{e.reason}</td>
                  <td className="mono">{e.involvedObject?.kind}/{e.involvedObject?.name}</td>
                  <td style={{ maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.message}</td>
                  <td className="mono">{e.count}</td>
                  <td className="mono">{timeAgo(e.lastTimestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <div className="empty-state"><div className="empty-state-text">No events</div></div>}
        </div>
      )}
    </div>
  );
}
