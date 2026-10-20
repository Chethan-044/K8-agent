import * as k8s from '@kubernetes/client-node';
import { getApiClient } from './cluster.service';
import { logger } from '../../utils/logger';

export async function getNodes(): Promise<k8s.V1Node[]> {
  const coreApi = getApiClient(k8s.CoreV1Api);
  try {
    const result: any = await coreApi.listNode();
    return result?.body?.items || result?.items || [];
  } catch (err: any) {
    logger.error(`Failed to list nodes: ${err.message}`);
    return [];
  }
}

export async function getNode(name: string): Promise<k8s.V1Node | null> {
  const coreApi = getApiClient(k8s.CoreV1Api);
  try {
    const result: any = await coreApi.readNode(name);
    return result?.body || result || null;
  } catch (err: any) {
    logger.warn(`Failed to get node ${name}: ${err.message}`);
    return null;
  }
}

export function getNodeConditions(node: k8s.V1Node): any[] {
  return (node.status?.conditions || []).map((c) => ({
    type: c.type,
    status: c.status,
    reason: c.reason,
    message: c.message,
    lastTransitionTime: c.lastTransitionTime,
  }));
}

export function getNodeCapacity(node: k8s.V1Node): any {
  return {
    capacity: node.status?.capacity,
    allocatable: node.status?.allocatable,
  };
}

