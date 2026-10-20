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

export interface AnalysisResult {
  problem: import('./problem').Problem;
  diagnosis: Diagnosis;
  diagnosticContext: any;
  collectionSteps: string[];
}
