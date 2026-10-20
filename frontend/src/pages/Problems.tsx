import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProblems, getNamespaces } from '../services/api';
import { Problem, ProblemSummary } from '../types/problem';
import ProblemTable from '../components/ProblemTable';

export default function Problems() {
  const navigate = useNavigate();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [summary, setSummary] = useState<ProblemSummary>({ total: 0, critical: 0, error: 0, warning: 0, info: 0 });
  const [namespaces, setNamespaces] = useState<string[]>([]);
  const [selectedNs, setSelectedNs] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadNamespaces();
    loadProblems();
  }, []);

  async function loadNamespaces() {
    try {
      const res = await getNamespaces();
      setNamespaces(res.namespaces);
    } catch {}
  }

  async function loadProblems(ns?: string) {
    setLoading(true);
    setError('');
    try {
      const res = await getProblems(ns || undefined);
      setProblems(res.problems);
      setSummary(res.summary);
    } catch (err: any) {
      setError(err.message || 'Failed to load problems');
    }
    setLoading(false);
  }

  function handleNsChange(ns: string) {
    setSelectedNs(ns);
    loadProblems(ns || undefined);
  }

  function handleSelectProblem(problem: Problem) {
    navigate(`/problems/${problem.id}`);
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 className="page-title">Problems</h2>
          <span className="page-count">{summary.total} detected</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            className="input"
            style={{ width: 160, padding: '4px 8px' }}
            value={selectedNs}
            onChange={(e) => handleNsChange(e.target.value)}
          >
            <option value="">All namespaces</option>
            {namespaces.map(ns => (
              <option key={ns} value={ns}>{ns}</option>
            ))}
          </select>
          <button className="btn btn-sm" onClick={() => loadProblems(selectedNs)}>
            Scan
          </button>
        </div>
      </div>

      {summary.total > 0 && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, fontSize: 11, fontFamily: 'var(--font-mono)' }}>
          {summary.critical > 0 && <span style={{ color: 'var(--status-critical)' }}>{summary.critical} critical</span>}
          {summary.error > 0 && <span style={{ color: 'var(--status-error)' }}>{summary.error} error</span>}
          {summary.warning > 0 && <span style={{ color: 'var(--status-warning)' }}>{summary.warning} warning</span>}
          {summary.info > 0 && <span style={{ color: 'var(--status-info)' }}>{summary.info} info</span>}
        </div>
      )}

      {error && <div className="error-msg" style={{ marginBottom: 12 }}>{error}</div>}

      {loading ? (
        <div className="loading-container">
          <div className="loading-title">Scanning for problems...</div>
          <div className="spinner" style={{ width: 20, height: 20, border: '2px solid var(--border-primary)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : (
        <ProblemTable problems={problems} onSelect={handleSelectProblem} />
      )}
    </div>
  );
}
