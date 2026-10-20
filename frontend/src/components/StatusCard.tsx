interface StatusCardProps {
  label: string;
  value: string | number;
  sub?: string;
  severity?: 'critical' | 'error' | 'warning' | 'success' | 'info';
}

export default function StatusCard({ label, value, sub, severity }: StatusCardProps) {
  const valueColor = severity
    ? `var(--status-${severity})`
    : 'var(--text-primary)';

  return (
    <div className="status-card">
      <div className="status-card-label">{label}</div>
      <div className="status-card-value" style={{ color: valueColor }}>{value}</div>
      {sub && <div className="status-card-sub">{sub}</div>}
    </div>
  );
}
