import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProblems, getPods, getNodes } from '../services/api';
import { Problem, ProblemSummary } from '../types/problem';
import StatusCard from '../components/StatusCard';
import ProblemTable from '../components/ProblemTable';

export default function Dashboard() {
  const navigate = useNavigate();
  const [problems, setProblems] = useState<Problem[]>([]);
  const [summary, setSummary] = useState<ProblemSummary>({ total: 0, critical: 0, error: 0, warning: 0, info: 0 });
  const [podStats, setPodStats] = useState({ total: 0, healthy: 0 });
  const [nodeStats, setNodeStats] = useState({ total: 0, ready: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    setError('');
    try {
      const [problemsRes, podsRes, nodesRes] = await Promise.all([
        getProblems(),
        getPods(),
        getNodes(),
      ]);

      setProblems(problemsRes.problems);
      setSummary(problemsRes.summary);

      const pods = podsRes.pods || [];
      const runningPods = pods.filter((p: any) => p.phase === 'Running' || p.phase === 'Succeeded');
      setPodStats({ total: pods.length, healthy: runningPods.length });

      const nodes = nodesRes.nodes || [];
      const readyNodes = nodes.filter((n: any) =>
        n.conditions?.some((c: any) => c.type === 'Ready' && c.status === 'True')
      );
      setNodeStats({ total: nodes.length, ready: readyNodes.length });
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard');
    }
    setLoading(false);
  }

  function handleSelectProblem(problem: Problem) {
    navigate(`/problems/${problem.id}`);
  }

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-title">Loading cluster data...</div>
        <div className="spinner" style={{ width: 20, height: 20, border: '2px solid var(--border-primary)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  if (error) {
    return <div className="error-msg">{error}</div>;
  }

  const clusterHealthy = summary.critical === 0 && summary.error === 0;

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Dashboard</h2>
        <button className="btn btn-sm" onClick={loadDashboard}>Refresh</button>
      </div>

      <div className="card-grid">
        <StatusCard
          label="Cluster Status"
          value={clusterHealthy ? 'HEALTHY' : 'DEGRADED'}
          sub="API reachable"
          severity={clusterHealthy ? 'success' : 'warning'}
        />
        <StatusCard
          label="Problem Resources"
          value={summary.total}
          sub={summary.critical > 0 ? `${summary.critical} critical` : summary.total === 0 ? 'All clear' : `${summary.warning} warning`}
          severity={summary.critical > 0 ? 'critical' : summary.total > 0 ? 'warning' : 'success'}
        />
        <StatusCard
          label="Pods"
          value={`${podStats.healthy} / ${podStats.total}`}
          sub={podStats.total - podStats.healthy > 0 ? `${podStats.total - podStats.healthy} unhealthy` : 'All running'}
          severity={podStats.total - podStats.healthy > 0 ? 'warning' : 'success'}
        />
        <StatusCard
          label="Nodes"
          value={nodeStats.total.toString()}
          sub={`${nodeStats.ready} ready`}
          severity={nodeStats.ready < nodeStats.total ? 'warning' : 'success'}
        />
      </div>

      {problems.length > 0 && (
        <div className="section">
          <div className="section-title">Detected Problems</div>
          <ProblemTable problems={problems.slice(0, 10)} onSelect={handleSelectProblem} />
          {problems.length > 10 && (
            <div style={{ marginTop: 8 }}>
              <button className="btn btn-sm" onClick={() => navigate('/problems')}>
                View all {problems.length} problems →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
