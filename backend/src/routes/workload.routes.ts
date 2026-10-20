import { Router } from 'express';
import { getPods } from '../services/kubernetes/pod.service';
import { getDeployments } from '../services/kubernetes/deployment.service';
import { getServices } from '../services/kubernetes/service.service';
import { getEvents } from '../services/kubernetes/event.service';
import { getNodes } from '../services/kubernetes/node.service';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);


router.get('/pods', async (req, res, next) => {
  try {
    const namespace = req.query.namespace as string | undefined;
    const pods = await getPods(namespace === 'all' ? undefined : namespace);
    res.json({
      pods: pods.map(p => ({
        name: p.metadata?.name,
        namespace: p.metadata?.namespace,
        phase: p.status?.phase,
        nodeName: p.spec?.nodeName,
        restarts: (p.status?.containerStatuses || []).reduce((sum, cs) => sum + (cs.restartCount || 0), 0),
        ready: (p.status?.containerStatuses || []).filter(cs => cs.ready).length,
        total: (p.status?.containerStatuses || []).length + (p.status?.initContainerStatuses || []).length,
        createdAt: p.metadata?.creationTimestamp,
        containers: (p.status?.containerStatuses || []).map(cs => ({
          name: cs.name,
          ready: cs.ready,
          restartCount: cs.restartCount,
          state: cs.state,
          image: cs.image,
        })),
      })),
    });
  } catch (err) { next(err); }
});

router.get('/deployments', async (req, res, next) => {
  try {
    const namespace = req.query.namespace as string | undefined;
    const deployments = await getDeployments(namespace === 'all' ? undefined : namespace);
    res.json({
      deployments: deployments.map(d => ({
        name: d.metadata?.name,
        namespace: d.metadata?.namespace,
        replicas: d.spec?.replicas,
        available: d.status?.availableReplicas || 0,
        ready: d.status?.readyReplicas || 0,
        updated: d.status?.updatedReplicas || 0,
        conditions: d.status?.conditions?.map(c => ({
          type: c.type,
          status: c.status,
          reason: c.reason,
        })),
        createdAt: d.metadata?.creationTimestamp,
      })),
    });
  } catch (err) { next(err); }
});

router.get('/services', async (req, res, next) => {
  try {
    const namespace = req.query.namespace as string | undefined;
    const services = await getServices(namespace === 'all' ? undefined : namespace);
    res.json({
      services: services.map(s => ({
        name: s.metadata?.name,
        namespace: s.metadata?.namespace,
        type: s.spec?.type,
        clusterIP: s.spec?.clusterIP,
        ports: s.spec?.ports?.map(p => ({
          port: p.port,
          targetPort: p.targetPort,
          protocol: p.protocol,
          name: p.name,
        })),
        selector: s.spec?.selector,
        createdAt: s.metadata?.creationTimestamp,
      })),
    });
  } catch (err) { next(err); }
});

router.get('/events', async (req, res, next) => {
  try {
    const namespace = req.query.namespace as string | undefined;
    const events = await getEvents(namespace === 'all' ? undefined : namespace);
    // Sort by last timestamp descending
    const sorted = events
      .sort((a, b) => {
        const aTime = new Date(a.lastTimestamp as any || 0).getTime();
        const bTime = new Date(b.lastTimestamp as any || 0).getTime();
        return bTime - aTime;
      })
      .slice(0, 200); // Limit

    res.json({
      events: sorted.map(e => ({
        type: e.type,
        reason: e.reason,
        message: e.message,
        involvedObject: {
          kind: e.involvedObject?.kind,
          name: e.involvedObject?.name,
          namespace: e.involvedObject?.namespace,
        },
        count: e.count,
        firstTimestamp: e.firstTimestamp,
        lastTimestamp: e.lastTimestamp,
        source: e.source?.component,
      })),
    });
  } catch (err) { next(err); }
});

router.get('/nodes', async (req, res, next) => {
  try {
    const nodes = await getNodes();
    res.json({
      nodes: nodes.map(n => ({
        name: n.metadata?.name,
        conditions: (n.status?.conditions || []).map(c => ({
          type: c.type,
          status: c.status,
          reason: c.reason,
          message: c.message,
        })),
        capacity: n.status?.capacity,
        allocatable: n.status?.allocatable,
        nodeInfo: {
          kubeletVersion: n.status?.nodeInfo?.kubeletVersion,
          osImage: n.status?.nodeInfo?.osImage,
          containerRuntimeVersion: n.status?.nodeInfo?.containerRuntimeVersion,
          architecture: n.status?.nodeInfo?.architecture,
        },
        taints: n.spec?.taints,
        labels: n.metadata?.labels,
        createdAt: n.metadata?.creationTimestamp,
      })),
    });
  } catch (err) { next(err); }
});

export default router;
