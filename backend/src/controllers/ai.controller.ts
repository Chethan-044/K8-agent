import { Response, NextFunction } from 'express';
import {
  setApiKey,
  clearApiKey,
  hasApiKey,
  testApiKey,
  getBaseUrl,
  getEffectiveModel,
  getProvider,
  getMaskedKey,
} from '../services/ai/gemini.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export async function setAiKey(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { apiKey, baseUrl, modelName } = req.body;
    if (!apiKey || typeof apiKey !== 'string') {
      res.status(400).json({ error: { message: 'apiKey is required' } });
      return;
    }

    const userId = req.user?.id || 'default';

    // Test the key first (with optional custom URL and model name)
    const testResult = await testApiKey(apiKey, baseUrl || undefined, modelName || undefined);
    if (!testResult.valid) {
      res.status(401).json({ error: { message: testResult.error || 'Invalid API key or connection failed' } });
      return;
    }

    setApiKey(apiKey, baseUrl || undefined, modelName || undefined, userId);
    res.json({
      configured: true,
      model: getEffectiveModel(userId),
      provider: getProvider(userId),
      baseUrl: getBaseUrl(userId),
      maskedKey: getMaskedKey(userId),
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteAiKey(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id || 'default';
    clearApiKey(userId);
    res.json({ configured: false });
  } catch (err) {
    next(err);
  }
}

export async function getAiStatus(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.id || 'default';
    res.json({
      configured: hasApiKey(userId),
      model: getEffectiveModel(userId),
      baseUrl: getBaseUrl(userId),
      provider: getProvider(userId),
      maskedKey: getMaskedKey(userId),
    });
  } catch (err) {
    next(err);
  }
}

export async function testAiConnection(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { apiKey, baseUrl, modelName } = req.body;
    if (!apiKey || typeof apiKey !== 'string') {
      res.status(400).json({ error: { message: 'apiKey is required' } });
      return;
    }
    const result = await testApiKey(apiKey, baseUrl || undefined, modelName || undefined);
    res.json(result);
  } catch (err) {
    next(err);
  }
}


