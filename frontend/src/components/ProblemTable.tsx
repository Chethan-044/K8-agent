import { Problem } from '../types/problem';

interface ProblemTableProps {
  problems: Problem[];
  onSelect: (problem: Problem) => void;
}

function getSeverityClass(severity: string): string {
  switch (severity) {
    case 'critical': return 'badge-critical';
    case 'error': return 'badge-error';
    case 'warning': return 'badge-warning';
    case 'info': return 'badge-info';
    default: return 'badge-info';
  }
}

export default function ProblemTable({ problems, onSelect }: ProblemTableProps) {
  if (problems.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">No problems detected</div>
        <div className="empty-state-text">All resources appear healthy</div>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            <th>Status</th>
            <th>Resource</th>
            <th>Kind</th>
            <th>Namespace</th>
            <th>Problem</th>
            <th>Message</th>
          </tr>
        </thead>
        <tbody>
          {problems.map((p) => (
            <tr key={p.id} className="clickable" onClick={() => onSelect(p)}>
              <td>
                <span className={`badge ${getSeverityClass(p.severity)}`}>
                  {p.severity}
                </span>
              </td>
              <td className="mono">{p.name}</td>
              <td className="mono">{p.kind}</td>
              <td className="mono">{p.namespace || '—'}</td>
              <td className="mono">{p.reason}</td>
              <td style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.message}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
