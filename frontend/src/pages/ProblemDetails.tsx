import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { analyzeProblem, getProblem } from '../services/api';
import { Problem } from '../types/problem';
import { AnalysisResult } from '../types/diagnosis';
import EvidenceSection from '../components/EvidenceSection';
import ExpandablePanel from '../components/ExpandablePanel';

const ANALYSIS_STEPS = [
  'Pod status', 'Container state', 'Logs', 'Events',
  'Deployment', 'Service', 'Node', 'Sanitization',
];

export default function ProblemDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [problem, setProblem] = useState<Problem | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [currentStep, setCurrentStep] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) loadProblem(id);
  }, [id]);

  async function loadProblem(problemId: string) {
    try {
      const res = await getProblem(problemId);
      setProblem(res.problem);
    } catch (err: any) {
      setError(err.message || 'Problem not found');
    }
  }

  async function handleAnalyze() {
    if (!id) return;
    setAnalyzing(true);
    setError('');
    setCompletedSteps([]);
    setCurrentStep('Connecting to cluster...');

    // Simulate real progress tracking via steps
    const stepInterval = setInterval(() => {
      setCompletedSteps(prev => {
        const nextIdx = prev.length;
        if (nextIdx < ANALYSIS_STEPS.length) {
          setCurrentStep(ANALYSIS_STEPS[nextIdx + 1] ? `Collecting ${ANALYSIS_STEPS[nextIdx + 1].toLowerCase()}...` : 'Analyzing with AI...');
          return [...prev, ANALYSIS_STEPS[nextIdx]];
        }
        return prev;
      });
    }, 1200);

    try {
      const res = await analyzeProblem(id);
      clearInterval(stepInterval);
      setCompletedSteps(ANALYSIS_STEPS);
      setCurrentStep('');
      setResult(res);
    } catch (err: any) {
      clearInterval(stepInterval);
      setCurrentStep('');
      setError(err.message || 'Analysis failed');
    }
    setAnalyzing(false);
  }

  if (error && !problem) {
    return (
      <div>
        <button className="btn btn-sm" onClick={() => navigate('/problems')} style={{ marginBottom: 16 }}>← Back to Problems</button>
        <div className="error-msg">{error}</div>
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="loading-container">
        <div className="loading-title">Loading problem...</div>
      </div>
    );
  }

  return (
    <div>
      <button className="btn btn-sm" onClick={() => navigate('/problems')} style={{ marginBottom: 16 }}>← Back to Problems</button>

      {/* Problem header */}
      <div className="diagnosis-header">
        <div>
          <div className="diagnosis-resource">{problem.name}</div>
          <div className="diagnosis-meta">
            <span className={`badge badge-${problem.severity}`} style={{ marginRight: 8 }}>{problem.severity}</span>
            {problem.reason}
          </div>
          <div className="diagnosis-meta" style={{ marginTop: 4 }}>
            {problem.namespace && `${problem.namespace} / `}{problem.kind}
          </div>
        </div>
        {!result && !analyzing && (
          <button className="btn btn-primary" onClick={handleAnalyze}>
            Analyze with AI
          </button>
        )}
      </div>

      {/* Overview */}
      <div className="overview-grid">
        <div className="overview-item">
          <div className="overview-item-label">Status</div>
          <div className="overview-item-value">{problem.reason}</div>
        </div>
        {problem.restartCount !== undefined && (
          <div className="overview-item">
            <div className="overview-item-label">Restarts</div>
            <div className="overview-item-value">{problem.restartCount}</div>
          </div>
        )}
        {problem.exitCode !== undefined && (
          <div className="overview-item">
            <div className="overview-item-label">Exit Code</div>
            <div className="overview-item-value">{problem.exitCode}</div>
          </div>
        )}
        {problem.node && (
          <div className="overview-item">
            <div className="overview-item-label">Node</div>
            <div className="overview-item-value">{problem.node}</div>
          </div>
        )}
        {problem.containerName && (
          <div className="overview-item">
            <div className="overview-item-label">Container</div>
            <div className="overview-item-value">{problem.containerName}</div>
          </div>
        )}
        {problem.image && (
          <div className="overview-item">
            <div className="overview-item-label">Image</div>
            <div className="overview-item-value" style={{ fontSize: 11, wordBreak: 'break-all', whiteSpace: 'normal' }}>{problem.image}</div>
          </div>
        )}
      </div>

      {/* Loading state */}
      {analyzing && (
        <div className="loading-container">
          <div className="loading-title">Analyzing {problem.name}...</div>
          <div className="loading-steps">
            {ANALYSIS_STEPS.map((step) => {
              const completed = completedSteps.includes(step);
              const isCurrent = !completed && completedSteps.length < ANALYSIS_STEPS.length &&
                ANALYSIS_STEPS[completedSteps.length] === step;
              return (
                <div key={step} className="loading-step">
                  {completed ? (
                    <span className="check">✓</span>
                  ) : isCurrent ? (
                    <span className="spinner" />
                  ) : (
                    <span style={{ width: 12, height: 12, display: 'inline-block' }} />
                  )}
                  <span style={{ color: completed ? 'var(--status-success)' : isCurrent ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                    {step}
                  </span>
                </div>
              );
            })}
            {completedSteps.length >= ANALYSIS_STEPS.length && (
              <div className="loading-step">
                <span className="spinner" />
                <span style={{ color: 'var(--accent)' }}>Sending diagnostic context to AI model...</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {error && <div className="error-msg" style={{ marginBottom: 16 }}>{error}</div>}

      {/* Diagnosis result */}
      {result && result.diagnosis && (
        <div>
          <div className="section">
            <div className="section-title">AI Diagnosis</div>
            <div className="diagnosis-title">{result.diagnosis.title}</div>
            <div className="diagnosis-summary">{result.diagnosis.summary}</div>

            <div className="confidence-bar">
              <span className="confidence-bar-label">Confidence</span>
              <div className="confidence-bar-track">
                <div className="confidence-bar-fill" style={{ width: `${result.diagnosis.confidence * 100}%` }} />
              </div>
              <span className="confidence-bar-value">{Math.round(result.diagnosis.confidence * 100)}%</span>
            </div>
          </div>

          <div className="section">
            <div className="section-title">Root Cause</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              {result.diagnosis.rootCause}
            </div>
          </div>

          <EvidenceSection diagnosis={result.diagnosis} />

          {/* Raw data expandable panels */}
          <div className="section" style={{ marginTop: 24 }}>
            <div className="section-title">Raw Evidence</div>

            {result.diagnosticContext?.events && result.diagnosticContext.events.length > 0 && (
              <ExpandablePanel title={`Events (${result.diagnosticContext.events.length})`}>
                {result.diagnosticContext.events.map((e: any, i: number) => (
                  <div key={i} style={{ marginBottom: 6 }}>
                    <span style={{ color: e.type === 'Warning' ? 'var(--status-warning)' : 'var(--text-tertiary)', marginRight: 6 }}>
                      [{e.type}]
                    </span>
                    <span style={{ color: 'var(--text-tertiary)', marginRight: 6 }}>{e.reason}</span>
                    <span>{e.message}</span>
                  </div>
                ))}
              </ExpandablePanel>
            )}

            {result.diagnosticContext?.logs?.current && (
              <ExpandablePanel title="Current Logs">
                {result.diagnosticContext.logs.current}
              </ExpandablePanel>
            )}

            {result.diagnosticContext?.logs?.previous && (
              <ExpandablePanel title="Previous Logs">
                {result.diagnosticContext.logs.previous}
              </ExpandablePanel>
            )}

            {result.diagnosticContext?.pod && (
              <ExpandablePanel title="Pod Details">
                {JSON.stringify(result.diagnosticContext.pod, null, 2)}
              </ExpandablePanel>
            )}

            {result.diagnosticContext?.containerStatuses && (
              <ExpandablePanel title="Container Statuses">
                {JSON.stringify(result.diagnosticContext.containerStatuses, null, 2)}
              </ExpandablePanel>
            )}

            {result.diagnosticContext?.node && (
              <ExpandablePanel title="Node Details">
                {JSON.stringify(result.diagnosticContext.node, null, 2)}
              </ExpandablePanel>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
