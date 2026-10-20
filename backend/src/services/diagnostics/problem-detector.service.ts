import * as k8s from '@kubernetes/client-node';
import { v4 as uuidv4 } from 'uuid';
import { Problem, Severity } from '../../models/problem.model';
import { getPods } from '../kubernetes/pod.service';
import { getDeployments } from '../kubernetes/deployment.service';
import { getServices, getEndpoints } from '../kubernetes/service.service';
import { getEvents } from '../kubernetes/event.service';
import { getNodes, getNodeConditions } from '../kubernetes/node.service';
import { getPVCs } from '../kubernetes/storage.service';
import { getHPAs } from '../kubernetes/hpa.service';
import { logger } from '../../utils/logger';

const PROBLEM_REASONS: Record<string, Severity> = {
  CrashLoopBackOff: 'critical',
  ImagePullBackOff: 'error',
  ErrImagePull: 'error',
  OOMKilled: 'warning',
  CreateContainerError: 'error',
  CreateContainerConfigError: 'error',
  InvalidImageName: 'error',
  RunContainerError: 'error',
};

export async function detectProblems(namespace?: string): Promise<Problem[]> {
  const problems: Problem[] = [];

  const [pods, deployments, services, events, nodes, pvcs, hpas] = await Promise.all([
    getPods(namespace),
    getDeployments(namespace),
    getServices(namespace),
    getEvents(namespace),
    getNodes(),
    getPVCs(namespace),
    getHPAs(namespace),
  ]);

  // Pod problems
  for (const pod of pods) {
    const podProblems = detectPodProblems(pod);
    problems.push(...podProblems);
  }

  // Deployment problems
  for (const dep of deployments) {
    const depProblems = detectDeploymentProblems(dep);
    problems.push(...depProblems);
  }

  // Service problems
  for (const svc of services) {
    const ns = svc.metadata?.namespace || 'default';
    const svcEndpoints = await getEndpoints(ns, svc.metadata?.name);
    const svcProblems = detectServiceProblems(svc, svcEndpoints);
    problems.push(...svcProblems);
  }

  // Node problems
  for (const node of nodes) {
    const nodeProblems = detectNodeProblems(node);
    problems.push(...nodeProblems);
  }

  // PVC problems
  for (const pvc of pvcs) {
    const pvcProblems = detectPVCProblems(pvc);
    problems.push(...pvcProblems);
  }

  // HPA problems
  for (const hpa of hpas) {
    const hpaProblems = detectHPAProblems(hpa, events);
    problems.push(...hpaProblems);
  }

  // Event-based problems
  const eventProblems = detectEventProblems(events, problems);
  problems.push(...eventProblems);

  // Deduplicate
  const seen = new Set<string>();
  const deduped: Problem[] = [];
  for (const p of problems) {
    const key = `${p.kind}/${p.namespace}/${p.name}/${p.reason}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(p);
    }
  }

  logger.info(`Detected ${deduped.length} problems`);
  return deduped.sort((a, b) => {
    const order: Record<Severity, number> = { critical: 0, error: 1, warning: 2, info: 3 };
    return order[a.severity] - order[b.severity];
  });
}

function detectPodProblems(pod: k8s.V1Pod): Problem[] {
  const problems: Problem[] = [];
  const name = pod.metadata?.name || '';
  const namespace = pod.metadata?.namespace || 'default';
  const phase = pod.status?.phase;

  // Phase-based
  if (phase === 'Failed') {
    problems.push(createProblem('critical', 'Pod', name, namespace, 'Failed',
      pod.status?.reason || 'Pod has entered Failed phase'));
  }

  if (phase === 'Unknown') {
    problems.push(createProblem('warning', 'Pod', name, namespace, 'Unknown',
      'Pod status is Unknown — node may be unreachable'));
  }

  if (phase === 'Pending') {
    // Check if it's been pending for more than 60 seconds
    const created = pod.metadata?.creationTimestamp;
    if (created) {
      const age = Date.now() - new Date(created as any).getTime();
      if (age > 60000) {
        problems.push(createProblem('warning', 'Pod', name, namespace, 'Pending',
          'Pod has been Pending for over 60 seconds'));
      }
    }
  }

  // Evicted
  if (pod.status?.reason === 'Evicted') {
    problems.push(createProblem('warning', 'Pod', name, namespace, 'Evicted',
      pod.status.message || 'Pod was evicted'));
  }

  // Container statuses
  const allContainerStatuses = [
    ...(pod.status?.containerStatuses || []),
    ...(pod.status?.initContainerStatuses || []),
  ];

  for (const cs of allContainerStatuses) {
    const waiting = cs.state?.waiting;
    const terminated = cs.state?.terminated;

    if (waiting?.reason) {
      const severity = PROBLEM_REASONS[waiting.reason] || 'warning';
      problems.push(createProblem(severity, 'Pod', name, namespace, waiting.reason,
        waiting.message || `Container ${cs.name} is waiting: ${waiting.reason}`,
        undefined, undefined, undefined, cs.name, cs.image));
    }

    if (terminated?.reason === 'OOMKilled') {
      problems.push(createProblem('warning', 'Pod', name, namespace, 'OOMKilled',
        `Container ${cs.name} was OOMKilled`,
        undefined, cs.restartCount || 0, terminated.exitCode || undefined, cs.name, cs.image));
    }

    if (terminated?.exitCode && terminated.exitCode !== 0 && terminated.reason !== 'OOMKilled') {
      const lastState = cs.lastState?.terminated;
      if (lastState && cs.state?.waiting?.reason === 'CrashLoopBackOff') {
        // Already captured
        continue;
      }
      if ((cs.restartCount || 0) > 0) {
        // If restarting with non-zero exit, it might already be caught as CrashLoopBackOff
        continue;
      }
    }

    // Excessive restarts (not already CrashLoopBackOff)
    if ((cs.restartCount || 0) >= 5 && !cs.state?.waiting?.reason) {
      problems.push(createProblem('warning', 'Pod', name, namespace, 'ExcessiveRestarts',
        `Container ${cs.name} has restarted ${cs.restartCount} times`,
        undefined, cs.restartCount || 0, undefined, cs.name, cs.image));
    }
  }

  // Readiness/liveness probe issues via conditions
  const conditions = pod.status?.conditions || [];
  for (const cond of conditions) {
    if (cond.type === 'Ready' && cond.status === 'False' && phase === 'Running') {
      const msg = cond.message || 'Pod is not ready';
      if (msg.toLowerCase().includes('readiness probe') || msg.toLowerCase().includes('not ready')) {
        problems.push(createProblem('warning', 'Pod', name, namespace, 'NotReady', msg));
      }
    }
    if (cond.type === 'ContainersReady' && cond.status === 'False' && phase === 'Running') {
      // Only add if we haven't already captured container-level issues
      if (problems.filter(p => p.name === name).length === 0) {
        problems.push(createProblem('warning', 'Pod', name, namespace, 'ContainersNotReady',
          cond.message || 'Containers are not ready'));
      }
    }
  }

  return problems;
}

function detectDeploymentProblems(dep: k8s.V1Deployment): Problem[] {
  const problems: Problem[] = [];
  const name = dep.metadata?.name || '';
  const namespace = dep.metadata?.namespace || 'default';

  const desired = dep.spec?.replicas ?? 1;
  const available = dep.status?.availableReplicas ?? 0;
  const unavailable = dep.status?.unavailableReplicas ?? 0;

  if (unavailable > 0) {
    problems.push(createProblem('error', 'Deployment', name, namespace, 'UnavailableReplicas',
      `${unavailable} of ${desired} replicas are unavailable`));
  }

  if (desired > 0 && available === 0) {
    problems.push(createProblem('critical', 'Deployment', name, namespace, 'NoAvailableReplicas',
      `Deployment has 0 available replicas out of ${desired} desired`));
  }

  // Check conditions
  const conditions = dep.status?.conditions || [];
  for (const cond of conditions) {
    if (cond.type === 'Available' && cond.status === 'False') {
      problems.push(createProblem('error', 'Deployment', name, namespace, 'DeploymentUnavailable',
        cond.message || 'Deployment is unavailable'));
    }
    if (cond.type === 'Progressing' && cond.status === 'False') {
      problems.push(createProblem('error', 'Deployment', name, namespace, 'RolloutStalled',
        cond.message || 'Deployment rollout is not progressing'));
    }
  }

  return problems;
}

function detectServiceProblems(svc: k8s.V1Service, endpoints: k8s.V1Endpoints[]): Problem[] {
  const problems: Problem[] = [];
  const name = svc.metadata?.name || '';
  const namespace = svc.metadata?.namespace || 'default';

  // Skip headless and kubernetes service
  if (name === 'kubernetes' || svc.spec?.clusterIP === 'None') {
    return problems;
  }

  // Check for services with selectors but no endpoints
  if (svc.spec?.selector && Object.keys(svc.spec.selector).length > 0) {
    const hasEndpoints = endpoints.some(ep => {
      const subsets = ep.subsets || [];
      return subsets.some(s => (s.addresses || []).length > 0);
    });

    if (!hasEndpoints) {
      problems.push(createProblem('warning', 'Service', name, namespace, 'NoEndpoints',
        'Service has selectors but no active endpoints'));
    }
  }

  return problems;
}

function detectNodeProblems(node: k8s.V1Node): Problem[] {
  const problems: Problem[] = [];
  const name = node.metadata?.name || '';

  const conditions = node.status?.conditions || [];
  for (const cond of conditions) {
    if (cond.type === 'Ready' && cond.status !== 'True') {
      problems.push(createProblem('critical', 'Node', name, '', 'NotReady',
        cond.message || 'Node is not ready'));
    }
    if (cond.type === 'MemoryPressure' && cond.status === 'True') {
      problems.push(createProblem('warning', 'Node', name, '', 'MemoryPressure',
        cond.message || 'Node is under memory pressure'));
    }
    if (cond.type === 'DiskPressure' && cond.status === 'True') {
      problems.push(createProblem('warning', 'Node', name, '', 'DiskPressure',
        cond.message || 'Node is under disk pressure'));
    }
    if (cond.type === 'PIDPressure' && cond.status === 'True') {
      problems.push(createProblem('warning', 'Node', name, '', 'PIDPressure',
        cond.message || 'Node is under PID pressure'));
    }
    if (cond.type === 'NetworkUnavailable' && cond.status === 'True') {
      problems.push(createProblem('error', 'Node', name, '', 'NetworkUnavailable',
        cond.message || 'Node network is unavailable'));
    }
  }

  return problems;
}

function detectPVCProblems(pvc: k8s.V1PersistentVolumeClaim): Problem[] {
  const problems: Problem[] = [];
  const name = pvc.metadata?.name || '';
  const namespace = pvc.metadata?.namespace || 'default';
  const phase = pvc.status?.phase;

  if (phase === 'Pending') {
    const created = pvc.metadata?.creationTimestamp;
    if (created) {
      const age = Date.now() - new Date(created as any).getTime();
      if (age > 60000) {
        problems.push(createProblem('warning', 'PersistentVolumeClaim', name, namespace, 'PVCPending',
          'PVC has been Pending for over 60 seconds'));
      }
    }
  }

  if (phase === 'Lost') {
    problems.push(createProblem('error', 'PersistentVolumeClaim', name, namespace, 'PVCLost',
      'PVC has lost its bound PersistentVolume'));
  }

  return problems;
}

function detectHPAProblems(hpa: k8s.V2HorizontalPodAutoscaler, events: k8s.CoreV1Event[]): Problem[] {
  const problems: Problem[] = [];
  const name = hpa.metadata?.name || '';
  const namespace = hpa.metadata?.namespace || 'default';

  const conditions = hpa.status?.conditions || [];
  for (const cond of conditions) {
    if (cond.type === 'ScalingActive' && cond.status === 'False') {
      problems.push(createProblem('warning', 'HorizontalPodAutoscaler', name, namespace, 'ScalingInactive',
        cond.message || 'HPA scaling is not active'));
    }
    if (cond.type === 'AbleToScale' && cond.status === 'False') {
      problems.push(createProblem('warning', 'HorizontalPodAutoscaler', name, namespace, 'UnableToScale',
        cond.message || 'HPA is unable to scale'));
    }
  }

  return problems;
}

function detectEventProblems(events: k8s.CoreV1Event[], existingProblems: Problem[]): Problem[] {
  const problems: Problem[] = [];
  const existingKeys = new Set(existingProblems.map(p => `${p.kind}/${p.namespace}/${p.name}`));

  const warningEvents = events.filter(e => e.type === 'Warning');

  // Recent scheduling failures
  const schedulingEvents = warningEvents.filter(e =>
    e.reason === 'FailedScheduling' &&
    e.lastTimestamp &&
    Date.now() - new Date(e.lastTimestamp as any).getTime() < 600000
  );

  for (const event of schedulingEvents) {
    const name = event.involvedObject?.name || '';
    const namespace = event.involvedObject?.namespace || 'default';
    const key = `Pod/${namespace}/${name}`;

    if (!existingKeys.has(key)) {
      let severity: Severity = 'warning';
      let reason = 'FailedScheduling';

      const msg = event.message || '';
      if (msg.includes('Insufficient cpu')) reason = 'InsufficientCPU';
      if (msg.includes('Insufficient memory')) reason = 'InsufficientMemory';
      if (msg.includes('node(s) had taint')) reason = 'TaintToleration';
      if (msg.includes('node(s) didn\'t match')) reason = 'NodeSelectorMismatch';

      problems.push(createProblem(severity, 'Pod', name, namespace, reason, msg));
      existingKeys.add(key);
    }
  }

  // FailedMount events
  const mountEvents = warningEvents.filter(e =>
    (e.reason === 'FailedMount' || e.reason === 'FailedAttachVolume') &&
    e.lastTimestamp &&
    Date.now() - new Date(e.lastTimestamp as any).getTime() < 600000
  );

  for (const event of mountEvents) {
    const name = event.involvedObject?.name || '';
    const namespace = event.involvedObject?.namespace || 'default';
    problems.push(createProblem('warning', 'Pod', name, namespace, event.reason || 'FailedMount',
      event.message || 'Volume mount failed'));
  }

  return problems;
}

function createProblem(
  severity: Severity, kind: string, name: string, namespace: string,
  reason: string, message: string, node?: string, restartCount?: number,
  exitCode?: number, containerName?: string, image?: string
): Problem {
  return {
    id: uuidv4(),
    severity,
    kind,
    name,
    namespace,
    reason,
    message,
    detectedAt: new Date().toISOString(),
    node,
    restartCount,
    exitCode,
    containerName,
    image,
  };
}
