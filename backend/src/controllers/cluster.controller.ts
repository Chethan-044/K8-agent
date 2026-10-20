import { Request, Response, NextFunction } from 'express';
import {
  discoverClusters,
  setActiveContext,
  getActiveContext,
  testConnection,
  getNamespaces,
  getClusterInfo,
} from '../services/kubernetes/cluster.service';
import { logger } from '../utils/logger';
import { logSecurityEvent } from '../services/auth/auth.service';

export async function getClusters(req: Request, res: Response, next: NextFunction) {
  try {
    const clusters = await discoverClusters();
    res.json({ clusters });
  } catch (err) {
    next(err);
  }
}

export async function selectCluster(req: Request, res: Response, next: NextFunction) {
  try {
    const { contextName } = req.body;
    if (!contextName) {
      res.status(400).json({ error: { message: 'contextName is required' } });
      return;
    }

    setActiveContext(contextName);
    const connection = await testConnection(contextName);

    if (!connection.connected) {
      res.status(502).json({ error: { message: `Failed to connect to cluster: ${connection.error}` } });
      return;
    }

    const clusterInfo = await getClusterInfo();
    logSecurityEvent('cluster.select', {
      userId: (req as any).user?.id,
      username: (req as any).user?.username,
      info: contextName,
    });
    logger.info(`Connected to cluster: ${contextName}`);

    res.json({
      connected: true,
      context: contextName,
      clusterInfo,
    });
  } catch (err) {
    next(err);
  }
}

export async function testClusterConnection(req: Request, res: Response, next: NextFunction) {
  try {
    const { contextName } = req.body;
    if (!contextName) {
      res.status(400).json({ error: { message: 'contextName is required' } });
      return;
    }
    const result = await testConnection(contextName);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function listNamespaces(req: Request, res: Response, next: NextFunction) {
  try {
    const namespaces = await getNamespaces();
    res.json({ namespaces });
  } catch (err) {
    next(err);
  }
}

export async function getCurrentCluster(req: Request, res: Response, next: NextFunction) {
  try {
    const context = getActiveContext();
    if (!context) {
      res.json({ selected: false });
      return;
    }
    const clusterInfo = await getClusterInfo();
    res.json({ selected: true, context, clusterInfo });
  } catch (err) {
    next(err);
  }
}
