import * as k8s from '@kubernetes/client-node';
import { getApiClient } from './cluster.service';
import { logger } from '../../utils/logger';

export async function getServices(namespace?: string): Promise<k8s.V1Service[]> {
  const coreApi = getApiClient(k8s.CoreV1Api);
  try {
    if (namespace) {
      const result: any = await coreApi.listNamespacedService(namespace);
      return result?.body?.items || result?.items || [];
    }
    const result: any = await coreApi.listServiceForAllNamespaces();
    return result?.body?.items || result?.items || [];
  } catch (err: any) {
    logger.error(`Failed to list services: ${err.message}`);
    return [];
  }
}

export async function getService(name: string, namespace: string): Promise<k8s.V1Service | null> {
  const coreApi = getApiClient(k8s.CoreV1Api);
  try {
    const result: any = await coreApi.readNamespacedService(name, namespace);
    return result?.body || result || null;
  } catch (err: any) {
    logger.warn(`Failed to get service ${namespace}/${name}: ${err.message}`);
    return null;
  }
}

export async function getEndpoints(namespace: string, name?: string): Promise<k8s.V1Endpoints[]> {
  const coreApi = getApiClient(k8s.CoreV1Api);
  try {
    if (name) {
      const result: any = await coreApi.readNamespacedEndpoints(name, namespace);
      const ep = result?.body || result;
      return ep ? [ep] : [];
    }
    const result: any = await coreApi.listNamespacedEndpoints(namespace);
    return result?.body?.items || result?.items || [];
  } catch (err: any) {
    logger.warn(`Failed to list endpoints in ${namespace}: ${err.message}`);
    return [];
  }
}

