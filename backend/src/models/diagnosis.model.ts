export interface DiagnosticContext {
  cluster: {
    context: string;
    server?: string;
  };
  resource: {
    kind: string;
    namespace: string;
    name: string;
  };
  problem: {
    reason: string;
    severity: string;
    restartCount?: number;
    exitCode?: number;
    message?: string;
  };
  pod?: any;
  containerStatuses?: any[];
  logs?: {
    current?: string;
    previous?: string;
    truncated?: boolean;
    lines?: number;
    available?: boolean;
    reason?: string;
  };
  events?: any[];
  deployment?: any;
  replicaSet?: any;
  services?: any[];
  endpoints?: any[];
  node?: any;
  resources?: any;
  probes?: any;
  storage?: any;
  hpa?: any;
}

export interface EvidenceItem {
  fact: string;
  importance: 'high' | 'medium' | 'low';
}

export interface PossibleCause {
  cause: string;
  likelihood: 'high' | 'medium' | 'low';
}

export interface CommandInfo {
  command: string;
  purpose: string;
}

export interface RemediationCommand extends CommandInfo {
  risk: 'low' | 'medium' | 'high';
}

export interface Diagnosis {
  severity: string;
  title: string;
  rootCause: string;
  confidence: number;
  summary: string;
  evidence: EvidenceItem[];
  possibleCauses: PossibleCause[];
  solution: {
    explanation: string;
    steps: string[];
  };
  verificationCommands: CommandInfo[];
  remediationCommands: RemediationCommand[];
  warnings: string[];
  additionalInvestigation: string[];
}
