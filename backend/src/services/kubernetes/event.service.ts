import * as k8s from '@kubernetes/client-node';
import { getApiClient } from './cluster.service';
import { logger } from '../../utils/logger';

export async function getEvents(namespace?: string): Promise<k8s.CoreV1Event[]> {
  const coreApi = getApiClient(k8s.CoreV1Api);
  try {
    if (namespace) {
      const result: any = await coreApi.listNamespacedEvent(namespace);
      return result?.body?.items || result?.items || [];
    }
    const result: any = await coreApi.listEventForAllNamespaces();
    return result?.body?.items || result?.items || [];
  } catch (err: any) {
    logger.error(`Failed to list events: ${err.message}`);
    return [];
  }
}

export async function getEventsForResource(
  namespace: string,
  resourceName: string,
  resourceKind?: string
): Promise<k8s.CoreV1Event[]> {
  const coreApi = getApiClient(k8s.CoreV1Api);
  try {
    const fieldSelector = `involvedObject.name=${resourceName}`;
    const result: any = await coreApi.listNamespacedEvent(
      namespace,
      undefined,
      undefined,
      undefined,
      fieldSelector
    );
    let events: k8s.CoreV1Event[] = result?.body?.items || result?.items || [];
    if (resourceKind) {
      events = events.filter(
        (e: any) => e.involvedObject?.kind === resourceKind
      );
    }
    return events;
  } catch (err: any) {
    logger.warn(`Failed to get events for ${namespace}/${resourceName}: ${err.message}`);
    return [];
  }
}

