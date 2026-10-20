export interface ClusterInfo {
  contextName: string;
  clusterName: string;
  userName: string;
  namespace: string;
  server: string;
  connected: boolean;
  error?: string;
}

export interface ClusterDetails {
  context: string;
  version: string;
  platform?: string;
  gitVersion?: string;
}
