import { Problem } from '../../models/problem.model';
import { DiagnosticContext } from '../../models/diagnosis.model';
import { getPod, getPodLogs } from '../kubernetes/pod.service';
import { getDeployment, getReplicaSets } from '../kubernetes/deployment.service';
import { getServices, getEndpoints } from '../kubernetes/service.service';
import { getEventsForResource } from '../kubernetes/event.service';
import { getNode, getNodeConditions, getNodeCapacity } from '../kubernetes/node.service';
import { getPVCs } from '../kubernetes/storage.service';
import { getHPAs } from '../kubernetes/hpa.service';
import { getActiveContext } from '../kubernetes/cluster.service';
import { sanitize } from './sanitizer.service';
import { config } from '../../config/config';
import { logger } from '../../utils/logger';

export interface CollectionProgress {
  step: string;
  completed: boolean;
}

export async function collectEvidence(
  problem: Problem,
  onProgress?: (progress: CollectionProgress) => void
): Promise<DiagnosticContext> {
  const progress = (step: string) => {
    if (onProgress) onProgress({ step, completed: true });
  };

  const context: DiagnosticContext = {
    cluster: {
      context: getActiveContext() || 'unknown',
    },
    resource: {
      kind: problem.kind,
      namespace: problem.namespace,
      name: problem.name,
    },
    problem: {
      reason: problem.reason,
      severity: problem.severity,
      restartCount: problem.restartCount,
      exitCode: problem.exitCode,
      message: problem.message,
    },
  };

  try {
    if (problem.kind === 'Pod') {
      await collectPodEvidence(context, problem, progress);
    } else if (problem.kind === 'Deployment') {
      await collectDeploymentEvidence(context, problem, progress);
    } else if (problem.kind === 'Service') {
      await collectServiceEvidence(context, problem, progress);
    } else if (problem.kind === 'Node') {
      await collectNodeEvidence(context, problem, progress);
    } else if (problem.kind === 'PersistentVolumeClaim') {
      await collectPVCEvidence(context, problem, progress);
    } else if (problem.kind === 'HorizontalPodAutoscaler') {
      await collectHPAEvidence(context, problem, progress);
    }
  } catch (err: any) {
    logger.error(`Error collecting evidence for ${problem.kind}/${problem.name}: ${err.message}`);
  }

  // Sanitize the entire context
  const sanitized = sanitize(context);
  progress('Sanitization');
  return sanitized;
}

async function collectPodEvidence(
  context: DiagnosticContext,
  problem: Problem,
  progress: (step: string) => void
): Promise<void> {
  const { name, namespace } = problem;

  // Pod details
  const pod = await getPod(name, namespace);
  progress('Pod status');

  if (!pod) {
    logger.warn(`Pod ${namespace}/${name} not found during evidence collection`);
    return;
  }

  context.pod = {
    metadata: {
      name: pod.metadata?.name,
      namespace: pod.metadata?.namespace,
      labels: pod.metadata?.labels,
      annotations: pod.metadata?.annotations,
      creationTimestamp: pod.metadata?.creationTimestamp,
      ownerReferences: pod.metadata?.ownerReferences?.map(o => ({
        kind: o.kind,
        name: o.name,
      })),
    },
    spec: {
      nodeName: pod.spec?.nodeName,
      serviceAccountName: pod.spec?.serviceAccountName,
      nodeSelector: pod.spec?.nodeSelector,
      tolerations: pod.spec?.tolerations,
      affinity: pod.spec?.affinity ? 'configured' : undefined,
      restartPolicy: pod.spec?.restartPolicy,
      schedulerName: pod.spec?.schedulerName,
      priority: pod.spec?.priority,
      priorityClassName: pod.spec?.priorityClassName,
    },
    status: {
      phase: pod.status?.phase,
      reason: pod.status?.reason,
      message: pod.status?.message,
      conditions: pod.status?.conditions,
      startTime: pod.status?.startTime,
      qosClass: pod.status?.qosClass,
      hostIP: pod.status?.hostIP,
      podIP: pod.status?.podIP,
    },
  };

  // Container statuses
  context.containerStatuses = [
    ...(pod.status?.containerStatuses || []),
    ...(pod.status?.initContainerStatuses || []),
  ].map(cs => ({
    name: cs.name,
    ready: cs.ready,
    restartCount: cs.restartCount,
    state: cs.state,
    lastState: cs.lastState,
    image: cs.image,
    imageID: cs.imageID,
    started: cs.started,
  }));
  progress('Container state');

  // Resources and probes from containers
  const containers = [
    ...(pod.spec?.containers || []),
    ...(pod.spec?.initContainers || []),
  ];

  context.resources = containers.map(c => ({
    name: c.name,
    requests: c.resources?.requests,
    limits: c.resources?.limits,
  }));

  context.probes = containers.map(c => ({
    name: c.name,
    livenessProbe: c.livenessProbe ? summarizeProbe(c.livenessProbe) : undefined,
    readinessProbe: c.readinessProbe ? summarizeProbe(c.readinessProbe) : undefined,
    startupProbe: c.startupProbe ? summarizeProbe(c.startupProbe) : undefined,
  }));

  // Environment variable NAMES and references only
  const envInfo = containers.map(c => ({
    name: c.name,
    env: (c.env || []).map(e => ({
      name: e.name,
      source: e.valueFrom ? describeEnvSource(e.valueFrom) : 'literal',
    })),
    envFrom: (c.envFrom || []).map(ef => ({
      configMapRef: ef.configMapRef?.name,
      secretRef: ef.secretRef?.name,
      prefix: ef.prefix,
    })),
  }));

  // Volume info
  const volumeInfo = (pod.spec?.volumes || []).map(v => ({
    name: v.name,
    type: getVolumeType(v),
    source: getVolumeSource(v),
  }));

  const volumeMounts = containers.flatMap(c =>
    (c.volumeMounts || []).map(vm => ({
      container: c.name,
      name: vm.name,
      mountPath: vm.mountPath,
      readOnly: vm.readOnly,
    }))
  );

  context.storage = { volumes: volumeInfo, mounts: volumeMounts, envInfo };

  // Logs
  const containerName = problem.containerName || containers[0]?.name;
  if (containerName) {
    const tailLines = shouldPrioritizeLogs(problem.reason)
      ? config.logTailLines * 2
      : config.logTailLines;

    const [currentLogs, previousLogs] = await Promise.all([
      getPodLogs(name, namespace, containerName, false, tailLines),
      getPodLogs(name, namespace, containerName, true, tailLines),
    ]);
    progress('Logs');

    context.logs = {
      current: currentLogs.logs,
      previous: previousLogs.logs,
      truncated: currentLogs.truncated || previousLogs.truncated,
      lines: tailLines,
      available: currentLogs.available,
      reason: currentLogs.available ? undefined : currentLogs.reason,
    };
  }

  // Events
  const events = await getEventsForResource(namespace, name, 'Pod');
  context.events = events.map(e => ({
    type: e.type,
    reason: e.reason,
    message: e.message,
    count: e.count,
    firstTimestamp: e.firstTimestamp,
    lastTimestamp: e.lastTimestamp,
    source: e.source?.component,
  }));
  progress('Events');

  // Owner - Deployment/ReplicaSet
  const ownerRefs = pod.metadata?.ownerReferences || [];
  const rsOwner = ownerRefs.find(o => o.kind === 'ReplicaSet');
  if (rsOwner) {
    const replicaSets = await getReplicaSets(namespace);
    const rs = replicaSets.find(r => r.metadata?.name === rsOwner.name);
    if (rs) {
      context.replicaSet = {
        name: rs.metadata?.name,
        replicas: rs.status?.replicas,
        readyReplicas: rs.status?.readyReplicas,
        availableReplicas: rs.status?.availableReplicas,
      };

      const depOwner = rs.metadata?.ownerReferences?.find(o => o.kind === 'Deployment');
      if (depOwner) {
        const dep = await getDeployment(depOwner.name, namespace);
        if (dep) {
          context.deployment = {
            name: dep.metadata?.name,
            replicas: dep.spec?.replicas,
            availableReplicas: dep.status?.availableReplicas,
            unavailableReplicas: dep.status?.unavailableReplicas,
            conditions: dep.status?.conditions,
            strategy: dep.spec?.strategy?.type,
          };
        }
      }
    }
    progress('Deployment');
  }

  // Related services
  const podLabels = pod.metadata?.labels || {};
  const allServices = await getServices(namespace);
  const relatedServices = allServices.filter(svc => {
    const selector = svc.spec?.selector || {};
    return Object.entries(selector).every(
      ([key, val]) => podLabels[key] === val
    );
  });

  if (relatedServices.length > 0) {
    context.services = relatedServices.map(svc => ({
      name: svc.metadata?.name,
      type: svc.spec?.type,
      clusterIP: svc.spec?.clusterIP,
      ports: svc.spec?.ports,
      selector: svc.spec?.selector,
    }));

    // Endpoints for related services
    const eps: any[] = [];
    for (const svc of relatedServices) {
      const svcEndpoints = await getEndpoints(namespace, svc.metadata?.name);
      for (const ep of svcEndpoints) {
        eps.push({
          name: ep.metadata?.name,
          subsets: (ep.subsets || []).map(s => ({
            addresses: (s.addresses || []).length,
            notReadyAddresses: (s.notReadyAddresses || []).length,
            ports: s.ports,
          })),
        });
      }
    }
    context.endpoints = eps;
    progress('Service');
  }

  // Node
  const nodeName = pod.spec?.nodeName;
  if (nodeName) {
    const node = await getNode(nodeName);
    if (node) {
      context.node = {
        name: node.metadata?.name,
        conditions: getNodeConditions(node),
        capacity: getNodeCapacity(node),
        labels: node.metadata?.labels,
        taints: node.spec?.taints,
      };
    }
    progress('Node');
  }

  // PVCs referenced by pod
  const pvcNames = (pod.spec?.volumes || [])
    .filter(v => v.persistentVolumeClaim)
    .map(v => v.persistentVolumeClaim!.claimName);

  if (pvcNames.length > 0) {
    const pvcs = await getPVCs(namespace);
    const relatedPvcs = pvcs.filter(p => pvcNames.includes(p.metadata?.name || ''));
    if (relatedPvcs.length > 0) {
      context.storage = {
        ...context.storage,
        pvcs: relatedPvcs.map(p => ({
          name: p.metadata?.name,
          phase: p.status?.phase,
          storageClassName: p.spec?.storageClassName,
          accessModes: p.spec?.accessModes,
          capacity: p.status?.capacity,
          volumeName: p.spec?.volumeName,
        })),
      };
    }
  }

  // HPA
  const hpas = await getHPAs(namespace);
  const relatedHpa = hpas.find(h => {
    const targetRef = h.spec?.scaleTargetRef;
    if (!targetRef) return false;
    const depName = context.deployment?.name;
    return targetRef.name === depName || targetRef.name === name;
  });

  if (relatedHpa) {
    context.hpa = {
      name: relatedHpa.metadata?.name,
      minReplicas: relatedHpa.spec?.minReplicas,
      maxReplicas: relatedHpa.spec?.maxReplicas,
      currentReplicas: relatedHpa.status?.currentReplicas,
      desiredReplicas: relatedHpa.status?.desiredReplicas,
      conditions: relatedHpa.status?.conditions,
      metrics: relatedHpa.spec?.metrics?.map(m => ({
        type: m.type,
        resource: m.resource?.name,
      })),
    };
  }
}

async function collectDeploymentEvidence(
  context: DiagnosticContext,
  problem: Problem,
  progress: (step: string) => void
): Promise<void> {
  const { name, namespace } = problem;
  const dep = await getDeployment(name, namespace);
  progress('Deployment');

  if (dep) {
    context.deployment = {
      name: dep.metadata?.name,
      replicas: dep.spec?.replicas,
      availableReplicas: dep.status?.availableReplicas,
      unavailableReplicas: dep.status?.unavailableReplicas,
      readyReplicas: dep.status?.readyReplicas,
      updatedReplicas: dep.status?.updatedReplicas,
      conditions: dep.status?.conditions,
      strategy: dep.spec?.strategy,
      selector: dep.spec?.selector,
    };

    const replicaSets = await getReplicaSets(namespace);
    const ownedRS = replicaSets.filter(rs =>
      rs.metadata?.ownerReferences?.some(o => o.name === name && o.kind === 'Deployment')
    );
    context.replicaSet = ownedRS.map(rs => ({
      name: rs.metadata?.name,
      replicas: rs.status?.replicas,
      readyReplicas: rs.status?.readyReplicas,
    }));
  }

  const events = await getEventsForResource(namespace, name, 'Deployment');
  context.events = events.map(e => ({
    type: e.type,
    reason: e.reason,
    message: e.message,
    count: e.count,
    lastTimestamp: e.lastTimestamp,
  }));
  progress('Events');
}

async function collectServiceEvidence(
  context: DiagnosticContext,
  problem: Problem,
  progress: (step: string) => void
): Promise<void> {
  const { name, namespace } = problem;
  const svcModule = await import('../kubernetes/service.service');
  const svc = await svcModule.getService(name, namespace);
  progress('Service');

  if (svc) {
    context.services = [{
      name: svc.metadata?.name,
      type: svc.spec?.type,
      clusterIP: svc.spec?.clusterIP,
      ports: svc.spec?.ports,
      selector: svc.spec?.selector,
    }];

    const eps = await svcModule.getEndpoints(namespace, name);
    context.endpoints = eps.map(ep => ({
      name: ep.metadata?.name,
      subsets: ep.subsets,
    }));
    progress('Endpoints');
  }

  const events = await getEventsForResource(namespace, name, 'Service');
  context.events = events.map(e => ({
    type: e.type,
    reason: e.reason,
    message: e.message,
    lastTimestamp: e.lastTimestamp,
  }));
  progress('Events');
}

async function collectNodeEvidence(
  context: DiagnosticContext,
  problem: Problem,
  progress: (step: string) => void
): Promise<void> {
  const node = await getNode(problem.name);
  progress('Node');

  if (node) {
    context.node = {
      name: node.metadata?.name,
      conditions: getNodeConditions(node),
      capacity: getNodeCapacity(node),
      labels: node.metadata?.labels,
      taints: node.spec?.taints,
      addresses: node.status?.addresses,
      nodeInfo: node.status?.nodeInfo,
    };
  }

  const events = await getEventsForResource('', problem.name, 'Node');
  context.events = events.map(e => ({
    type: e.type,
    reason: e.reason,
    message: e.message,
    lastTimestamp: e.lastTimestamp,
  }));
  progress('Events');
}

async function collectPVCEvidence(
  context: DiagnosticContext,
  problem: Problem,
  progress: (step: string) => void
): Promise<void> {
  const pvcs = await getPVCs(problem.namespace);
  const pvc = pvcs.find(p => p.metadata?.name === problem.name);
  progress('Storage');

  if (pvc) {
    context.storage = {
      pvcs: [{
        name: pvc.metadata?.name,
        phase: pvc.status?.phase,
        storageClassName: pvc.spec?.storageClassName,
        accessModes: pvc.spec?.accessModes,
        capacity: pvc.status?.capacity,
        volumeName: pvc.spec?.volumeName,
      }],
    };
  }

  const events = await getEventsForResource(problem.namespace, problem.name, 'PersistentVolumeClaim');
  context.events = events.map(e => ({
    type: e.type,
    reason: e.reason,
    message: e.message,
    lastTimestamp: e.lastTimestamp,
  }));
  progress('Events');
}

async function collectHPAEvidence(
  context: DiagnosticContext,
  problem: Problem,
  progress: (step: string) => void
): Promise<void> {
  const hpas = await getHPAs(problem.namespace);
  const hpa = hpas.find(h => h.metadata?.name === problem.name);
  progress('HPA');

  if (hpa) {
    context.hpa = {
      name: hpa.metadata?.name,
      minReplicas: hpa.spec?.minReplicas,
      maxReplicas: hpa.spec?.maxReplicas,
      currentReplicas: hpa.status?.currentReplicas,
      desiredReplicas: hpa.status?.desiredReplicas,
      conditions: hpa.status?.conditions,
      metrics: hpa.spec?.metrics,
    };
  }

  const events = await getEventsForResource(problem.namespace, problem.name, 'HorizontalPodAutoscaler');
  context.events = events.map(e => ({
    type: e.type,
    reason: e.reason,
    message: e.message,
    lastTimestamp: e.lastTimestamp,
  }));
  progress('Events');
}

function summarizeProbe(probe: any): any {
  return {
    type: probe.httpGet ? 'httpGet' : probe.tcpSocket ? 'tcpSocket' : probe.exec ? 'exec' : 'unknown',
    path: probe.httpGet?.path,
    port: probe.httpGet?.port || probe.tcpSocket?.port,
    initialDelaySeconds: probe.initialDelaySeconds,
    periodSeconds: probe.periodSeconds,
    timeoutSeconds: probe.timeoutSeconds,
    failureThreshold: probe.failureThreshold,
    successThreshold: probe.successThreshold,
  };
}

function describeEnvSource(valueFrom: any): string {
  if (valueFrom.configMapKeyRef) return `configMap:${valueFrom.configMapKeyRef.name}`;
  if (valueFrom.secretKeyRef) return `secret:${valueFrom.secretKeyRef.name}`;
  if (valueFrom.fieldRef) return `fieldRef:${valueFrom.fieldRef.fieldPath}`;
  if (valueFrom.resourceFieldRef) return `resourceField:${valueFrom.resourceFieldRef.resource}`;
  return 'unknown';
}

function getVolumeType(vol: any): string {
  if (vol.configMap) return 'configMap';
  if (vol.secret) return 'secret';
  if (vol.persistentVolumeClaim) return 'pvc';
  if (vol.emptyDir) return 'emptyDir';
  if (vol.hostPath) return 'hostPath';
  if (vol.projected) return 'projected';
  if (vol.downwardAPI) return 'downwardAPI';
  if (vol.csi) return 'csi';
  return 'unknown';
}

function getVolumeSource(vol: any): string {
  if (vol.configMap) return vol.configMap.name;
  if (vol.secret) return vol.secret.secretName;
  if (vol.persistentVolumeClaim) return vol.persistentVolumeClaim.claimName;
  return '';
}

function shouldPrioritizeLogs(reason: string): boolean {
  return ['CrashLoopBackOff', 'OOMKilled', 'Error', 'Failed'].includes(reason);
}
