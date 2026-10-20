const API_BASE = '/api';

export interface User {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(body.error?.message || `Request failed: ${res.status}`);
  }

  return res.json();
}

// Health
export const getHealth = () => request<{ status: string }>('/health');

// Auth
export const apiRegister = (data: { username: string; email: string; password: string; confirmPassword?: string }) =>
  request<{ success: boolean; message: string; user: User }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const apiLogin = (data: { identifier: string; password: string }) =>
  request<{ authenticated: boolean; user: User; sessionId?: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const apiLogout = () =>
  request<{ authenticated: boolean }>('/auth/logout', { method: 'POST' });

export const apiGetMe = () =>
  request<{ authenticated: boolean; user?: User }>('/auth/me');

// AI
export const getAiStatus = () =>
  request<{ configured: boolean; model?: string; baseUrl?: string; provider?: string; maskedKey?: string }>('/ai/status');
export const setAiKey = (apiKey: string, baseUrl?: string, modelName?: string) =>
  request<{ configured: boolean; model?: string; baseUrl?: string; provider?: string; maskedKey?: string }>('/ai/key', {
    method: 'POST',
    body: JSON.stringify({ apiKey, baseUrl, modelName }),
  });
export const deleteAiKey = () =>
  request<{ configured: boolean }>('/ai/key', { method: 'DELETE' });
export const testAiConnection = (apiKey: string, baseUrl?: string, modelName?: string) =>
  request<{ valid: boolean; model: string; provider?: string; error?: string }>('/ai/test', {
    method: 'POST',
    body: JSON.stringify({ apiKey, baseUrl, modelName }),
  });



// Clusters
export const getClusters = () =>
  request<{ clusters: import('../types/cluster').ClusterInfo[] }>('/clusters');
export const getCurrentCluster = () =>
  request<{ selected: boolean; context?: string; clusterInfo?: any }>('/clusters/current');
export const selectCluster = (contextName: string) =>
  request<{ connected: boolean; context: string; clusterInfo: any }>('/clusters/select', {
    method: 'POST',
    body: JSON.stringify({ contextName }),
  });
export const testCluster = (contextName: string) =>
  request<{ connected: boolean; version?: string; error?: string }>('/clusters/test', {
    method: 'POST',
    body: JSON.stringify({ contextName }),
  });

// Namespaces
export const getNamespaces = () =>
  request<{ namespaces: string[] }>('/namespaces');

// Problems
export const getProblems = (namespace?: string) =>
  request<{
    problems: import('../types/problem').Problem[];
    summary: import('../types/problem').ProblemSummary;
  }>(`/problems${namespace ? `?namespace=${namespace}` : ''}`);

export const getProblem = (id: string) =>
  request<{ problem: import('../types/problem').Problem }>(`/problems/${id}`);

export const analyzeProblem = (id: string) =>
  request<import('../types/diagnosis').AnalysisResult>(`/problems/${id}/analyze`, {
    method: 'POST',
  });

// Workloads
export const getPods = (namespace?: string) =>
  request<{ pods: any[] }>(`/pods${namespace ? `?namespace=${namespace}` : ''}`);
export const getDeployments = (namespace?: string) =>
  request<{ deployments: any[] }>(`/deployments${namespace ? `?namespace=${namespace}` : ''}`);
export const getServices = (namespace?: string) =>
  request<{ services: any[] }>(`/services${namespace ? `?namespace=${namespace}` : ''}`);
export const getEvents = (namespace?: string) =>
  request<{ events: any[] }>(`/events${namespace ? `?namespace=${namespace}` : ''}`);
export const getNodes = () =>
  request<{ nodes: any[] }>('/nodes');
