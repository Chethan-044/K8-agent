import * as k8s from '@kubernetes/client-node';
import { getApiClient } from './cluster.service';
import { logger } from '../../utils/logger';

export async function getHPAs(namespace?: string): Promise<k8s.V2HorizontalPodAutoscaler[]> {
  const autoscalingApi = getApiClient(k8s.AutoscalingV2Api);
  try {
    if (namespace) {
      const result: any = await autoscalingApi.listNamespacedHorizontalPodAutoscaler(namespace);
      return result?.body?.items || result?.items || [];
    }
    const result: any = await autoscalingApi.listHorizontalPodAutoscalerForAllNamespaces();
    return result?.body?.items || result?.items || [];
  } catch (err: any) {
    logger.warn(`Failed to list HPAs: ${err.message}`);
    return [];
  }
}

