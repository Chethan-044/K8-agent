import * as k8s from '@kubernetes/client-node';
import { logger } from '../../utils/logger';
import { KubernetesError } from '../../utils/errors';

export interface ClusterInfo {
  contextName: string;
  clusterName: string;
  userName: string;
  namespace: string;
  server: string;
  connected: boolean;
  error?: string;
}

let kc: k8s.KubeConfig | null = null;
let activeContext: string | null = null;

function normalizeClusters(kubeConfig: k8s.KubeConfig): void {
  const hostOverride = process.env.K8S_HOST_OVERRIDE || 'host.docker.internal';
  const shouldOverride = Boolean(
    process.env.K8S_HOST_OVERRIDE ||
    process.env.NODE_ENV === 'production' ||
    process.env.DOCKER === 'true'
  );

  for (const cluster of kubeConfig.clusters as any[]) {
    if (cluster.server) {
      if (cluster.server.includes('localhost') || cluster.server.includes('127.0.0.1') || cluster.server.includes('0.0.0.0')) {
        if (shouldOverride) {
          logger.info(`Rewriting cluster "${cluster.name}" server from ${cluster.server} to use ${hostOverride}`);
          cluster.server = cluster.server
            .replace('//localhost', `//${hostOverride}`)
            .replace('//127.0.0.1', `//${hostOverride}`)
            .replace('//0.0.0.0', `//${hostOverride}`);
          cluster.skipTLSVerify = true;
        }
      }
    }
  }
}

export function loadKubeConfig(): k8s.KubeConfig {
  const kubeConfig = new k8s.KubeConfig();
  try {
    kubeConfig.loadFromDefault();
    normalizeClusters(kubeConfig);
    logger.info(`Kubeconfig loaded successfully. Found ${kubeConfig.contexts.length} context(s).`);
  } catch (err: any) {
    logger.error(`Failed to load kubeconfig: ${err.message}`);
    throw new KubernetesError('Failed to load kubeconfig. Ensure kubeconfig is mounted correctly.');
  }
  kc = kubeConfig;
  return kubeConfig;
}

export function getKubeConfig(): k8s.KubeConfig {
  if (!kc) {
    return loadKubeConfig();
  }
  return kc;
}

export function getActiveContext(): string | null {
  return activeContext;
}

export function setActiveContext(contextName: string): void {
  const kubeConfig = getKubeConfig();
  const contexts = kubeConfig.getContexts();
  const found = contexts.find((c) => c.name === contextName);
  if (!found) {
    throw new KubernetesError(`Context "${contextName}" not found in kubeconfig`, 404);
  }
  kubeConfig.setCurrentContext(contextName);
  activeContext = contextName;
  logger.info(`Active context set to: ${contextName}`);
}

export function getContexts(): k8s.Context[] {
  const kubeConfig = getKubeConfig();
  return kubeConfig.getContexts();
}

export async function discoverClusters(): Promise<ClusterInfo[]> {
  // Always refresh kubeconfig on discovery to pick up mounted changes
  const kubeConfig = loadKubeConfig();
  const contexts = kubeConfig.getContexts();
  const clusters: ClusterInfo[] = [];

  // Check if we only got the fallback dummy context (when no ~/.kube/config was mounted)
  const isDummyContext =
    contexts.length === 1 &&
    contexts[0].name === 'loaded-context' &&
    (kubeConfig.getCluster('loaded-context')?.server?.includes('8080') ?? false);

  if (isDummyContext) {
    logger.warn('No valid kubeconfig found. Only default fallback loaded-context is present.');
    return [
      {
        contextName: 'No Kubeconfig Detected',
        clusterName: 'none',
        userName: 'none',
        namespace: 'none',
        server: 'No ~/.kube/config found in container',
        connected: false,
        error: 'No kubeconfig file detected. Please verify that your ~/.kube directory contains a config file and is mounted.',
      },
    ];
  }

  for (const ctx of contexts) {
    const cluster = kubeConfig.getCluster(ctx.cluster);
    const user = kubeConfig.getUser(ctx.user);

    const info: ClusterInfo = {
      contextName: ctx.name,
      clusterName: ctx.cluster,
      userName: ctx.user,
      namespace: ctx.namespace || 'default',
      server: cluster?.server || 'unknown',
      connected: false,
    };

    // Test connection
    try {
      const prevContext = kubeConfig.currentContext;
      kubeConfig.setCurrentContext(ctx.name);
      const versionApi = kubeConfig.makeApiClient(k8s.VersionApi);
      await versionApi.getCode();
      info.connected = true;
      if (prevContext && prevContext !== ctx.name) {
        kubeConfig.setCurrentContext(prevContext);
      }
    } catch (err: any) {
      info.connected = false;
      info.error = err.message || 'Connection failed';
    }

    clusters.push(info);
  }

  return clusters;
}

export async function testConnection(contextName: string): Promise<{ connected: boolean; version?: string; error?: string }> {
  try {
    const kubeConfig = getKubeConfig();
    const prevContext = kubeConfig.currentContext;
    kubeConfig.setCurrentContext(contextName);
    const versionApi = kubeConfig.makeApiClient(k8s.VersionApi);
    const result: any = await versionApi.getCode();
    const body = result?.body || result;
    if (prevContext && prevContext !== contextName) {
      kubeConfig.setCurrentContext(prevContext);
    }
    return {
      connected: true,
      version: `${body.major}.${body.minor}`,
    };
  } catch (err: any) {
    return {
      connected: false,
      error: err.message || 'Connection failed',
    };
  }
}

export function getApiClient<T>(clientClass: new (server: string) => T): T {
  if (!activeContext) {
    throw new KubernetesError('No active cluster context selected', 400);
  }
  const kubeConfig = getKubeConfig();
  return kubeConfig.makeApiClient(clientClass as any) as T;
}

export async function getNamespaces(): Promise<string[]> {
  const coreApi = getApiClient(k8s.CoreV1Api);
  try {
    const result: any = await coreApi.listNamespace();
    const items = result?.body?.items || result?.items || [];
    return items.map((ns: any) => ns.metadata?.name || '').filter(Boolean);
  } catch (err: any) {
    logger.warn(`Failed to list namespaces: ${err.message}`);
    throw new KubernetesError('Failed to list namespaces. Check cluster permissions.');
  }
}

export async function getClusterInfo(): Promise<any> {
  const versionApi = getApiClient(k8s.VersionApi);
  try {
    const result: any = await versionApi.getCode();
    const version = result?.body || result;
    return {
      context: activeContext,
      version: `${version.major}.${version.minor}`,
      platform: version.platform,
      gitVersion: version.gitVersion,
    };
  } catch (err: any) {
    throw new KubernetesError('Failed to get cluster info');
  }
}

