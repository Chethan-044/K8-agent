export type Severity = 'critical' | 'error' | 'warning' | 'info';

export interface Problem {
  id: string;
  severity: Severity;
  kind: string;
  name: string;
  namespace: string;
  reason: string;
  message: string;
  detectedAt: string;
  node?: string;
  restartCount?: number;
  exitCode?: number;
  containerName?: string;
  image?: string;
}

export interface ProblemSummary {
  total: number;
  critical: number;
  error: number;
  warning: number;
  info: number;
}
