import * as k8s from '@kubernetes/client-node';
import { getApiClient } from './cluster.service';
import { logger } from '../../utils/logger';

export async function getPVCs(namespace?: string): Promise<k8s.V1PersistentVolumeClaim[]> {
  const coreApi = getApiClient(k8s.CoreV1Api);
  try {
    if (namespace) {
      const result: any = await coreApi.listNamespacedPersistentVolumeClaim(namespace);
      return result?.body?.items || result?.items || [];
    }
    const result: any = await coreApi.listPersistentVolumeClaimForAllNamespaces();
    return result?.body?.items || result?.items || [];
  } catch (err: any) {
    logger.warn(`Failed to list PVCs: ${err.message}`);
    return [];
  }
}

export async function getPVs(): Promise<k8s.V1PersistentVolume[]> {
  const coreApi = getApiClient(k8s.CoreV1Api);
  try {
    const result: any = await coreApi.listPersistentVolume();
    return result?.body?.items || result?.items || [];
  } catch (err: any) {
    logger.warn(`Failed to list PVs: ${err.message}`);
    return [];
  }
}

