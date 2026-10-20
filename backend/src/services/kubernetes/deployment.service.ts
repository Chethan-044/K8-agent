import * as k8s from '@kubernetes/client-node';
import { getApiClient } from './cluster.service';
import { logger } from '../../utils/logger';

export async function getDeployments(namespace?: string): Promise<k8s.V1Deployment[]> {
  const appsApi = getApiClient(k8s.AppsV1Api);
  try {
    if (namespace) {
      const result: any = await appsApi.listNamespacedDeployment(namespace);
      return result?.body?.items || result?.items || [];
    }
    const result: any = await appsApi.listDeploymentForAllNamespaces();
    return result?.body?.items || result?.items || [];
  } catch (err: any) {
    logger.error(`Failed to list deployments: ${err.message}`);
    return [];
  }
}

export async function getDeployment(name: string, namespace: string): Promise<k8s.V1Deployment | null> {
  const appsApi = getApiClient(k8s.AppsV1Api);
  try {
    const result: any = await appsApi.readNamespacedDeployment(name, namespace);
    return result?.body || result || null;
  } catch (err: any) {
    logger.warn(`Failed to get deployment ${namespace}/${name}: ${err.message}`);
    return null;
  }
}

export async function getReplicaSets(namespace: string, labelSelector?: string): Promise<k8s.V1ReplicaSet[]> {
  const appsApi = getApiClient(k8s.AppsV1Api);
  try {
    const result: any = await appsApi.listNamespacedReplicaSet(
      namespace,
      undefined,
      undefined,
      undefined,
      undefined,
      labelSelector
    );
    return result?.body?.items || result?.items || [];
  } catch (err: any) {
    logger.warn(`Failed to list replicasets in ${namespace}: ${err.message}`);
    return [];
  }
}

