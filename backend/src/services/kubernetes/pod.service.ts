import * as k8s from '@kubernetes/client-node';
import { getApiClient } from './cluster.service';
import { logger } from '../../utils/logger';

export async function getPods(namespace?: string): Promise<k8s.V1Pod[]> {
  const coreApi = getApiClient(k8s.CoreV1Api);
  try {
    if (namespace) {
      const result: any = await coreApi.listNamespacedPod(namespace);
      return result?.body?.items || result?.items || [];
    }
    const result: any = await coreApi.listPodForAllNamespaces();
    return result?.body?.items || result?.items || [];
  } catch (err: any) {
    logger.error(`Failed to list pods: ${err.message}`);
    return [];
  }
}

export async function getPod(name: string, namespace: string): Promise<k8s.V1Pod | null> {
  const coreApi = getApiClient(k8s.CoreV1Api);
  try {
    const result: any = await coreApi.readNamespacedPod(name, namespace);
    return result?.body || result || null;
  } catch (err: any) {
    logger.warn(`Failed to get pod ${namespace}/${name}: ${err.message}`);
    return null;
  }
}

export async function getPodLogs(
  name: string,
  namespace: string,
  container?: string,
  previous: boolean = false,
  tailLines: number = 300
): Promise<{ logs: string; truncated: boolean; available: boolean; reason?: string }> {
  const coreApi = getApiClient(k8s.CoreV1Api);
  try {
    const result: any = await coreApi.readNamespacedPodLog(
      name,
      namespace,
      container,
      undefined,
      undefined,
      undefined,
      undefined,
      previous,
      undefined,
      tailLines,
      true
    );
    const raw = result?.body !== undefined ? result.body : result;
    const logStr = typeof raw === 'string' ? raw : String(raw || '');
    return {
      logs: logStr,
      truncated: logStr.split('\n').length >= tailLines,
      available: true,
    };
  } catch (err: any) {
    const reason = previous
      ? 'Previous container logs not available'
      : `Failed to retrieve logs: ${err.message}`;
    return { logs: '', truncated: false, available: false, reason };
  }
}

