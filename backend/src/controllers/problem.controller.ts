import { Response, NextFunction } from 'express';
import { detectProblems } from '../services/diagnostics/problem-detector.service';
import { collectEvidence } from '../services/diagnostics/evidence-collector.service';
import { diagnose } from '../services/ai/gemini.service';
import { Problem } from '../models/problem.model';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { logSecurityEvent, saveDiagnosisHistory } from '../services/auth/auth.service';
import { logger } from '../utils/logger';

// In-memory problem cache (refreshed on each scan)
let cachedProblems: Problem[] = [];

export async function getProblems(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const namespace = req.query.namespace as string | undefined;
    cachedProblems = await detectProblems(namespace === 'all' ? undefined : namespace);

    const summary = {
      total: cachedProblems.length,
      critical: cachedProblems.filter(p => p.severity === 'critical').length,
      error: cachedProblems.filter(p => p.severity === 'error').length,
      warning: cachedProblems.filter(p => p.severity === 'warning').length,
      info: cachedProblems.filter(p => p.severity === 'info').length,
    };

    res.json({ problems: cachedProblems, summary });
  } catch (err) {
    next(err);
  }
}

export async function getProblemById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const problem = cachedProblems.find(p => p.id === id);
    if (!problem) {
      res.status(404).json({ error: { message: 'Problem not found. Try refreshing the problems list.' } });
      return;
    }
    res.json({ problem });
  } catch (err) {
    next(err);
  }
}

export async function analyzeProblem(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const problem = cachedProblems.find(p => p.id === id);
    if (!problem) {
      res.status(404).json({ error: { message: 'Problem not found. Try refreshing the problems list.' } });
      return;
    }

    const userId = req.user?.id || 'default';
    logSecurityEvent('diagnosis.request', {
      userId,
      username: req.user?.username,
      info: `${problem.kind}/${problem.name} (${problem.reason})`,
    });

    logger.info(`Starting analysis for ${problem.kind}/${problem.name} (${problem.reason}) by user ${userId}`);

    // Collect evidence through strict sanitization pipeline
    const progressSteps: string[] = [];
    const context = await collectEvidence(problem, (progress) => {
      progressSteps.push(progress.step);
    });

    // Get diagnosis from AI using authenticated user's credentials
    const diagnosis = await diagnose(context, userId);

    // Save diagnosis history if user is authenticated (Requirement #23)
    if (req.user?.id) {
      saveDiagnosisHistory(req.user.id, {
        clusterContext: context.cluster.context,
        namespace: problem.namespace,
        resourceKind: problem.kind,
        resourceName: problem.name,
        problemType: problem.reason,
        diagnosis,
      });
    }

    logger.info(`Analysis complete for ${problem.kind}/${problem.name}`);

    res.json({
      problem,
      diagnosis,
      diagnosticContext: context,
      collectionSteps: progressSteps,
    });
  } catch (err) {
    next(err);
  }
}

