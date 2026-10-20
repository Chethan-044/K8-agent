import { Router } from 'express';
import { setAiKey, deleteAiKey, getAiStatus, testAiConnection } from '../controllers/ai.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { aiTestRateLimiter } from '../middleware/rate-limiter';

const router = Router();

router.use(requireAuth);

router.get('/ai/status', getAiStatus);
router.post('/ai/key', setAiKey);
router.delete('/ai/key', deleteAiKey);
router.post('/ai/test', aiTestRateLimiter, testAiConnection);

export default router;

