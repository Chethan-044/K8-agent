import { Router } from 'express';
import { getProblems, getProblemById, analyzeProblem } from '../controllers/problem.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { analyzeRateLimiter } from '../middleware/rate-limiter';

const router = Router();

router.use(requireAuth);

router.get('/problems', getProblems);
router.get('/problems/:id', getProblemById);
router.post('/problems/:id/analyze', analyzeRateLimiter, analyzeProblem);

export default router;

