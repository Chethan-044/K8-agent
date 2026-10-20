import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  clusterContext: string;
  onDisconnect: () => void;
  onResetAi: () => void;
}

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: '◫' },
  { path: '/problems', label: 'Problems', icon: '⚠' },
  { path: '/workloads', label: 'Workloads', icon: '▦' },
  { path: '/events', label: 'Events', icon: '↯' },
  { path: '/nodes', label: 'Nodes', icon: '⊞' },
];

export default function Sidebar({ clusterContext, onDisconnect }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  return (
    <nav className="sidebar">
      <div className="sidebar-brand">
        <h1>K8s Agent</h1>
        <span>diagnostics</span>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-title">Navigation</div>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.path}
            className={`sidebar-item ${location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path)) ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span className="sidebar-item-icon">{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-title">System</div>
        <button
          className={`sidebar-item ${location.pathname === '/settings' ? 'active' : ''}`}
          onClick={() => navigate('/settings')}
        >
          <span className="sidebar-item-icon">⚙</span>
          Settings
        </button>
      </div>

      <div className="sidebar-cluster-info">
        <div style={{ marginBottom: 12 }}>
          <label>Cluster</label>
          <p>{clusterContext || 'None'}</p>
          <button
            className="btn btn-sm"
            style={{ marginTop: 6, width: '100%', justifyContent: 'center' }}
            onClick={onDisconnect}
          >
            Switch Cluster
          </button>
        </div>

        {user && (
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <label style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>
              Signed in as
            </label>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, margin: '2px 0 8px 0', color: 'var(--text-primary)' }}>
              {user.username}
            </p>
            <button
              className="btn btn-sm"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={async () => {
                await logout();
                navigate('/login');
              }}
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

