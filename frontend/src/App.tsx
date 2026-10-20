import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getAiStatus, getCurrentCluster } from './services/api';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Setup from './pages/Setup';
import Clusters from './pages/Clusters';
import Dashboard from './pages/Dashboard';
import Problems from './pages/Problems';
import ProblemDetails from './pages/ProblemDetails';
import Workloads from './pages/Workloads';
import Events from './pages/Events';
import Nodes from './pages/Nodes';
import Settings from './pages/Settings';
import Sidebar from './components/Sidebar';
import Header from './components/Header';

export type AppStep = 'setup' | 'clusters' | 'app';

function AppContent() {
  const { user, authenticated, loading: authLoading, logout } = useAuth();
  const [step, setStep] = useState<AppStep>('setup');
  const [clusterContext, setClusterContext] = useState<string>('');
  const [clusterInfo, setClusterInfo] = useState<any>(null);
  const [checkingState, setCheckingState] = useState(true);

  useEffect(() => {
    if (authenticated) {
      checkState();
    } else {
      setCheckingState(false);
    }
  }, [authenticated]);

  async function checkState() {
    setCheckingState(true);
    try {
      const aiStatus = await getAiStatus();
      if (!aiStatus.configured) {
        setStep('setup');
        setCheckingState(false);
        return;
      }

      const cluster = await getCurrentCluster();
      if (!cluster.selected) {
        setStep('clusters');
        setCheckingState(false);
        return;
      }

      setClusterContext(cluster.context || '');
      setClusterInfo(cluster.clusterInfo);
      setStep('app');
    } catch {
      setStep('setup');
    }
    setCheckingState(false);
  }

  function handleAiConfigured() {
    setStep('clusters');
  }

  function handleClusterSelected(ctx: string, info: any) {
    setClusterContext(ctx);
    setClusterInfo(info);
    setStep('app');
  }

  function handleDisconnect() {
    setClusterContext('');
    setClusterInfo(null);
    setStep('clusters');
  }

  function handleResetAi() {
    setStep('setup');
  }

  if (authLoading || (authenticated && checkingState)) {
    return (
      <div className="setup-page">
        <div style={{ color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          Loading...
        </div>
      </div>
    );
  }

  // Unauthenticated routes: any unauthorized access redirects to /login
  if (!authenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Authenticated: AI setup step
  if (step === 'setup') {
    return (
      <>
        <div
          style={{
            position: 'fixed',
            top: 16,
            right: 20,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: 11,
            color: 'var(--text-tertiary)',
            background: 'var(--bg-secondary)',
            padding: '6px 12px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <span>Signed in as: <strong style={{ color: 'var(--text-primary)' }}>{user?.username}</strong></span>
          <button className="btn btn-sm btn-ghost" onClick={logout} style={{ padding: '2px 8px', fontSize: 11 }}>
            Logout
          </button>
        </div>
        <Setup onConfigured={handleAiConfigured} />
      </>
    );
  }

  // Authenticated: Cluster selection step
  if (step === 'clusters') {
    return (
      <>
        <div
          style={{
            position: 'fixed',
            top: 16,
            right: 20,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            fontSize: 11,
            color: 'var(--text-tertiary)',
            background: 'var(--bg-secondary)',
            padding: '6px 12px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <span>Signed in as: <strong style={{ color: 'var(--text-primary)' }}>{user?.username}</strong></span>
          <button className="btn btn-sm btn-ghost" onClick={logout} style={{ padding: '2px 8px', fontSize: 11 }}>
            Logout
          </button>
        </div>
        <Clusters onSelected={handleClusterSelected} onBack={handleResetAi} />
      </>
    );
  }

  // Authenticated & Configured: Main App Layout
  return (
    <div className="app-layout">
      <Sidebar
        clusterContext={clusterContext}
        onDisconnect={handleDisconnect}
        onResetAi={handleResetAi}
      />
      <div className="app-main">
        <Header clusterContext={clusterContext} clusterInfo={clusterInfo} />
        <div className="app-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/problems" element={<Problems />} />
            <Route path="/problems/:id" element={<ProblemDetails />} />
            <Route path="/workloads" element={<Workloads />} />
            <Route path="/events" element={<Events />} />
            <Route path="/nodes" element={<Nodes />} />
            <Route path="/settings" element={<Settings onResetAi={handleResetAi} onDisconnect={handleDisconnect} />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/register" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}
