interface HeaderProps {
  clusterContext: string;
  clusterInfo: any;
}

export default function Header({ clusterContext, clusterInfo }: HeaderProps) {
  return (
    <header className="header">
      <div className="header-title">
        <span style={{ color: 'var(--text-tertiary)', marginRight: 8 }}>⊘</span>
        {clusterContext}
        {clusterInfo?.version && (
          <span style={{ color: 'var(--text-tertiary)', marginLeft: 8, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
            v{clusterInfo.version}
          </span>
        )}
      </div>
      <div className="header-actions">
        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
          read-only
        </span>
      </div>
    </header>
  );
}
