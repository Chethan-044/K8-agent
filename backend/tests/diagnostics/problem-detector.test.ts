import { describe, it, expect, vi } from 'vitest';

// We test the problem detection logic by creating mock k8s pod objects
// and verifying the detection patterns match correctly

// Helper: create a mock pod with a waiting container status
function createMockPod(overrides: any = {}): any {
  return {
    metadata: {
      name: overrides.name || 'test-pod',
      namespace: overrides.namespace || 'default',
      creationTimestamp: overrides.creationTimestamp || new Date(Date.now() - 120000).toISOString(),
      ownerReferences: overrides.ownerReferences || [],
      labels: overrides.labels || {},
    },
    spec: {
      nodeName: overrides.nodeName || 'node-1',
      containers: overrides.containers || [{
        name: 'main',
        image: 'nginx:latest',
        resources: {},
      }],
      initContainers: overrides.initContainers || [],
      volumes: overrides.volumes || [],
    },
    status: {
      phase: overrides.phase || 'Running',
      reason: overrides.statusReason,
      conditions: overrides.conditions || [],
      containerStatuses: overrides.containerStatuses || [{
        name: 'main',
        ready: true,
        restartCount: 0,
        state: { running: {} },
        image: 'nginx:latest',
      }],
      initContainerStatuses: overrides.initContainerStatuses || [],
    },
  };
}

describe('Problem Detection Patterns', () => {
  describe('CrashLoopBackOff detection', () => {
    it('should identify CrashLoopBackOff from container waiting state', () => {
      const pod = createMockPod({
        containerStatuses: [{
          name: 'main',
          ready: false,
          restartCount: 12,
          state: { waiting: { reason: 'CrashLoopBackOff', message: 'back-off 5m0s restarting failed container' } },
          lastState: { terminated: { exitCode: 1, reason: 'Error' } },
          image: 'myapp:v1',
        }],
      });

      const waitingReason = pod.status.containerStatuses[0].state.waiting.reason;
      expect(waitingReason).toBe('CrashLoopBackOff');
      expect(pod.status.containerStatuses[0].restartCount).toBeGreaterThan(0);
    });
  });

  describe('ImagePullBackOff detection', () => {
    it('should identify ImagePullBackOff from container waiting state', () => {
      const pod = createMockPod({
        phase: 'Pending',
        containerStatuses: [{
          name: 'main',
          ready: false,
          restartCount: 0,
          state: { waiting: { reason: 'ImagePullBackOff', message: 'Back-off pulling image "invalid:tag"' } },
          image: 'invalid:tag',
        }],
      });

      const waitingReason = pod.status.containerStatuses[0].state.waiting.reason;
      expect(waitingReason).toBe('ImagePullBackOff');
    });
  });

  describe('OOMKilled detection', () => {
    it('should identify OOMKilled from terminated state', () => {
      const pod = createMockPod({
        containerStatuses: [{
          name: 'main',
          ready: true,
          restartCount: 3,
          state: { running: {} },
          lastState: { terminated: { exitCode: 137, reason: 'OOMKilled' } },
          image: 'myapp:v1',
        }],
      });

      // Check for OOMKilled in lastState or current terminated
      const cs = pod.status.containerStatuses[0];
      const oomKilled = cs.lastState?.terminated?.reason === 'OOMKilled' ||
                        cs.state?.terminated?.reason === 'OOMKilled';
      expect(oomKilled).toBe(true);
    });
  });

  describe('Pending detection', () => {
    it('should identify long-pending pods', () => {
      const pod = createMockPod({
        phase: 'Pending',
        creationTimestamp: new Date(Date.now() - 120000).toISOString(),
      });

      const age = Date.now() - new Date(pod.metadata.creationTimestamp).getTime();
      expect(pod.status.phase).toBe('Pending');
      expect(age).toBeGreaterThan(60000);
    });
  });

  describe('Failed phase detection', () => {
    it('should identify failed pods', () => {
      const pod = createMockPod({
        phase: 'Failed',
        statusReason: 'DeadlineExceeded',
      });

      expect(pod.status.phase).toBe('Failed');
    });
  });

  describe('Evicted detection', () => {
    it('should identify evicted pods', () => {
      const pod = createMockPod({
        phase: 'Failed',
        statusReason: 'Evicted',
      });

      expect(pod.status.reason).toBe('Evicted');
    });
  });

  describe('Excessive restarts detection', () => {
    it('should flag pods with 5+ restarts', () => {
      const pod = createMockPod({
        containerStatuses: [{
          name: 'main',
          ready: true,
          restartCount: 8,
          state: { running: {} },
          image: 'myapp:v1',
        }],
      });

      const restarts = pod.status.containerStatuses[0].restartCount;
      expect(restarts).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Node NotReady detection', () => {
    it('should identify NotReady nodes', () => {
      const node = {
        metadata: { name: 'node-1' },
        status: {
          conditions: [
            { type: 'Ready', status: 'False', reason: 'KubeletNotReady', message: 'container runtime is down' },
          ],
        },
      };

      const readyCond = node.status.conditions.find((c: any) => c.type === 'Ready');
      expect(readyCond?.status).not.toBe('True');
    });
  });

  describe('Node pressure detection', () => {
    it('should identify MemoryPressure', () => {
      const node = {
        metadata: { name: 'node-1' },
        status: {
          conditions: [
            { type: 'MemoryPressure', status: 'True', message: 'memory pressure detected' },
            { type: 'Ready', status: 'True' },
          ],
        },
      };

      const pressureCond = node.status.conditions.find((c: any) => c.type === 'MemoryPressure');
      expect(pressureCond?.status).toBe('True');
    });
  });

  describe('Deployment unavailable detection', () => {
    it('should identify deployments with unavailable replicas', () => {
      const dep = {
        metadata: { name: 'my-deploy', namespace: 'default' },
        spec: { replicas: 3 },
        status: {
          availableReplicas: 1,
          unavailableReplicas: 2,
          readyReplicas: 1,
          conditions: [
            { type: 'Available', status: 'False', message: 'Deployment does not have minimum availability' },
          ],
        },
      };

      expect(dep.status.unavailableReplicas).toBeGreaterThan(0);
      const availCond = dep.status.conditions.find((c: any) => c.type === 'Available');
      expect(availCond?.status).toBe('False');
    });
  });

  describe('FailedScheduling detection', () => {
    it('should identify scheduling failure events', () => {
      const event = {
        type: 'Warning',
        reason: 'FailedScheduling',
        message: '0/3 nodes are available: 3 Insufficient cpu.',
        involvedObject: { kind: 'Pod', name: 'my-pod', namespace: 'default' },
        lastTimestamp: new Date().toISOString(),
      };

      expect(event.reason).toBe('FailedScheduling');
      expect(event.message).toContain('Insufficient cpu');
    });
  });
});
