import { Router } from 'express';
import {
  getClusters,
  selectCluster,
  testClusterConnection,
  listNamespaces,
  getCurrentCluster,
} from '../controllers/cluster.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/clusters', getClusters);
router.get('/clusters/current', getCurrentCluster);
router.post('/clusters/select', selectCluster);
router.post('/clusters/test', testClusterConnection);
router.get('/namespaces', listNamespaces);

export default router;

