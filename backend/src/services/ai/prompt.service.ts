import { DiagnosticContext } from '../../models/diagnosis.model';

export function compactDiagnosticContext(context: DiagnosticContext): any {
  const problem = {
    clusterContext: context.cluster?.context,
    resource: context.resource,
    problem: context.problem,
  };

  const containerStatuses = (context.containerStatuses || []).map((cs: any) => ({
    name: cs.name,
    ready: cs.ready,
    restartCount: cs.restartCount,
    state: cs.state,
    lastState: cs.lastState,
    image: cs.image,
  }));

  const trimLogs = (text?: string, maxLines = 20) => {
    if (!text) return undefined;
    const lines = text.trim().split('\n');
    const tail = lines.slice(-maxLines);
    return tail.map(l => (l.length > 200 ? l.slice(0, 200) + '...' : l)).join('\n');
  };

  const logs = context.logs
    ? {
        current: trimLogs(context.logs.current, 20),
        previous: trimLogs(context.logs.previous, 10),
      }
    : undefined;

  const events = (context.events || []).slice(-6).map((e: any) => ({
    type: e.type,
    reason: e.reason,
    message: typeof e.message === 'string' && e.message.length > 200 ? e.message.slice(0, 200) + '...' : e.message,
    count: e.count,
  }));

  return {
    ...problem,
    containerStatuses: containerStatuses.length > 0 ? containerStatuses : undefined,
    logs,
    events: events.length > 0 ? events : undefined,
    resources: context.resources,
    probes: context.probes,
    storage: context.storage,
  };
}

export function buildDiagnosticPrompt(context: DiagnosticContext): string {
  const compactContext = compactDiagnosticContext(context);
  return `You are an expert Kubernetes SRE/DevOps engineer performing a diagnostic analysis.

SECURITY & ACCESS RULES:
1. You are analyzing sanitized Kubernetes diagnostic evidence.
2. Never request Secret values or raw Secret data.
3. Never request ConfigMap values or confidential ConfigMap contents.
4. Never attempt to access Kubernetes or ask for credentials.
5. Never assume access to the Kubernetes cluster or execute commands directly.
6. Never ask the application to retrieve Secret data or ConfigMap data.
7. Use only the supplied sanitized evidence below.
8. If the evidence is insufficient, state what non-sensitive diagnostic information is needed.
9. Do not invent information or claim certainty when evidence is insufficient.
10. Clearly distinguish between confirmed facts, strong inference, and possible causes.
11. Never expose, reproduce, or guess secret values.
12. Never recommend destructive commands (delete, force-delete) as the first solution.
13. Explain WHY each kubectl verification or remediation command is being recommended.
14. Always include the namespace in kubectl commands using the -n flag.

DIAGNOSTIC CONTEXT:
${JSON.stringify(compactContext, null, 2)}


Respond with ONLY a valid JSON object in this exact format (no markdown, no code fences):
{
  "severity": "critical|error|warning|info",
  "title": "Short descriptive title of the root cause",
  "rootCause": "Detailed explanation of the root cause",
  "confidence": 0.0,
  "summary": "Brief 1-2 sentence summary",
  "evidence": [
    {
      "fact": "Observed fact from the diagnostic data",
      "importance": "high|medium|low"
    }
  ],
  "possibleCauses": [
    {
      "cause": "Description of possible cause",
      "likelihood": "high|medium|low"
    }
  ],
  "solution": {
    "explanation": "Detailed explanation of the recommended solution",
    "steps": [
      "Step 1 description",
      "Step 2 description"
    ]
  },
  "verificationCommands": [
    {
      "command": "kubectl command to verify",
      "purpose": "What this command checks"
    }
  ],
  "remediationCommands": [
    {
      "command": "kubectl command to fix",
      "purpose": "What this command does",
      "risk": "low|medium|high"
    }
  ],
  "warnings": [
    "Important warnings about the remediation"
  ],
  "additionalInvestigation": [
    "Suggestions for additional investigation if evidence is insufficient"
  ]
}`;
}
