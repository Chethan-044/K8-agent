import { GoogleGenerativeAI } from '@google/generative-ai';
import { DiagnosticContext, Diagnosis } from '../../models/diagnosis.model';
import { buildDiagnosticPrompt } from './prompt.service';
import { validateDiagnosis, extractJSON } from './response-validator.service';
import { config } from '../../config/config';
import { GeminiError } from '../../utils/errors';
import { logger } from '../../utils/logger';

// In-memory storage (per MVP spec)
let storedApiKey: string | null = null;
let storedBaseUrl: string | null = null;
let storedApiVersion: string | null = null;
let storedModelName: string | null = null;
let storedProvider: 'gemini' | 'openai-compatible' = 'gemini';

export interface ProviderConfig {
  provider: 'gemini' | 'openai-compatible';
  baseUrl: string;
  chatEndpoint: string;
  apiVersion?: string;
  modelName: string;
}

/**
 * Parses and detects provider type, baseUrl, chatEndpoint, and modelName from input parameters.
 */
export function detectProviderConfig(
  url?: string,
  model?: string,
  apiKey?: string
): ProviderConfig {
  const rawUrl = (url || '').trim().replace(/\/+$/, '');
  const specifiedModel = (model || '').trim();

  // 1. Google Gemini detection
  const isGoogle =
    rawUrl.includes('generativelanguage.googleapis.com') ||
    rawUrl.includes('/v1beta/models') ||
    rawUrl.includes('/v1/models') ||
    (!rawUrl && (!apiKey || apiKey.startsWith('AIza')));

  if (isGoogle || (!rawUrl && !specifiedModel)) {
    let baseUrl = 'https://generativelanguage.googleapis.com';
    let apiVersion: string | undefined = undefined;
    let modelName = specifiedModel || config.geminiModel || 'gemini-flash-latest';

    if (rawUrl) {
      // Pattern: {scheme}://{host}/{apiVersion}/models/{modelName}:{action}
      const match = rawUrl.match(/^(https?:\/\/[^/]+)\/(v[^/]+)\/models\/([^/:]+)/);
      if (match) {
        baseUrl = match[1];
        apiVersion = match[2];
        if (!specifiedModel) modelName = match[3];
      } else {
        const match2 = rawUrl.match(/^(https?:\/\/[^/]+)\/(v[^/]+)\/models\/([^/]+)/);
        if (match2) {
          baseUrl = match2[1];
          apiVersion = match2[2];
          if (!specifiedModel) modelName = match2[3];
        } else {
          baseUrl = rawUrl;
        }
      }
    }

    return {
      provider: 'gemini',
      baseUrl,
      chatEndpoint: `${baseUrl}/v1beta/models/${modelName}:generateContent`,
      apiVersion,
      modelName,
    };
  }

  // 2. OpenAI-compatible provider (NVIDIA NIM, OpenAI, Groq, Ollama, OpenRouter, DeepSeek, etc.)
  let baseUrl = rawUrl;
  let chatEndpoint = rawUrl;

  if (rawUrl.endsWith('/chat/completions')) {
    baseUrl = rawUrl.replace(/\/chat\/completions$/, '');
    chatEndpoint = rawUrl;
  } else {
    chatEndpoint = `${rawUrl}/chat/completions`;
  }

  // Determine appropriate default model for provider if not specified
  let modelName = specifiedModel;
  if (!modelName) {
    if (rawUrl.includes('nvidia.com')) {
      modelName = 'meta/llama-3.1-70b-instruct';
    } else if (rawUrl.includes('groq.com')) {
      modelName = 'llama-3.3-70b-versatile';
    } else if (rawUrl.includes('openrouter.ai')) {
      modelName = 'meta-llama/llama-3.1-8b-instruct';
    } else if (rawUrl.includes('11434') || rawUrl.includes('ollama')) {
      modelName = 'llama3.2';
    } else if (rawUrl.includes('openai.com')) {
      modelName = 'gpt-4o-mini';
    } else {
      modelName = 'gpt-4o-mini';
    }
  }

  return {
    provider: 'openai-compatible',
    baseUrl,
    chatEndpoint,
    modelName,
  };
}

export interface UserAiState {
  apiKey: string;
  baseUrl: string;
  chatEndpoint: string;
  apiVersion?: string;
  modelName: string;
  provider: 'gemini' | 'openai-compatible';
}

// In-memory per-user AI state (per user session, never written to disk or logs)
const userAiStore = new Map<string, UserAiState>();
const DEFAULT_USER_KEY = 'default';

export function setApiKey(
  key: string,
  apiUrl?: string,
  modelName?: string,
  userId: string = DEFAULT_USER_KEY
): void {
  const trimmedKey = key.trim();
  const cfg = detectProviderConfig(apiUrl, modelName, trimmedKey);

  const state: UserAiState = {
    apiKey: trimmedKey,
    baseUrl: cfg.baseUrl,
    chatEndpoint: cfg.chatEndpoint,
    apiVersion: cfg.apiVersion,
    modelName: cfg.modelName,
    provider: cfg.provider,
  };

  userAiStore.set(userId, state);

  logger.info(`AI provider configured for user "${userId}": ${cfg.provider} — endpoint: ${cfg.baseUrl}, model: ${cfg.modelName}`);
}

export function getUserState(userId: string = DEFAULT_USER_KEY): UserAiState | undefined {
  return userAiStore.get(userId);
}

export function getApiKey(userId: string = DEFAULT_USER_KEY): string | null {
  const state = getUserState(userId);
  return state?.apiKey || null;
}

export function getMaskedKey(userId: string = DEFAULT_USER_KEY): string {
  const key = getApiKey(userId);
  if (!key) return '';
  if (key.length <= 4) return '••••';
  return '••••••••••••' + key.slice(-4);
}

export function getEffectiveModel(userId: string = DEFAULT_USER_KEY): string {
  const state = getUserState(userId);
  return state?.modelName || config.geminiModel;
}

export function getBaseUrl(userId: string = DEFAULT_USER_KEY): string {
  const state = getUserState(userId);
  return state?.baseUrl || config.geminiBaseUrl;
}

export function getProvider(userId: string = DEFAULT_USER_KEY): string {
  const state = getUserState(userId);
  return state?.provider || 'gemini';
}

export function clearApiKey(userId: string = DEFAULT_USER_KEY): void {
  userAiStore.delete(userId);
  logger.info(`AI configuration cleared for user: ${userId}`);
}

export function hasApiKey(userId: string = DEFAULT_USER_KEY): boolean {
  const key = getApiKey(userId);
  return key !== null && key.length > 0;
}


/**
 * Call OpenAI-compatible chat completion endpoint.
 */
async function callOpenAiCompatible(
  chatEndpoint: string,
  apiKey: string,
  modelName: string,
  prompt: string,
  useJsonFormat: boolean = true
): Promise<string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const payload: any = {
    model: modelName,
    messages: [
      {
        role: 'system',
        content:
          'You are a senior Kubernetes SRE and DevOps troubleshooting expert. You must analyze the context and output ONLY valid JSON matching the requested diagnosis schema.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.2,
    max_tokens: 4096,
  };

  if (useJsonFormat) {
    payload.response_format = { type: 'json_object' };
  }

  let res = await fetch(chatEndpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  // If response_format causes a 400 error on certain custom proxies, retry without it
  if (!res.ok && useJsonFormat && (res.status === 400 || res.status === 422)) {
    const errBody: any = await res.json().catch(() => null);
    if (
      errBody?.error?.message?.includes('response_format') ||
      errBody?.error?.message?.includes('json_object') ||
      errBody?.message?.includes('response_format')
    ) {
      logger.info('Retrying OpenAI-compatible request without response_format flag...');
      delete payload.response_format;
      res = await fetch(chatEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
    }
  }

  if (!res.ok) {
    const errBody: any = await res.json().catch(() => null);
    const msg =
      errBody?.error?.message ||
      errBody?.message ||
      errBody?.detail ||
      `HTTP ${res.status}: ${res.statusText}`;
    throw new Error(msg);
  }

  const data: any = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('No content returned in AI response');
  }

  return typeof content === 'string' ? content : JSON.stringify(content);
}

export async function testApiKey(
  apiKey: string,
  apiUrl?: string,
  modelNameInput?: string
): Promise<{ valid: boolean; model: string; provider: string; error?: string }> {
  const cfg = detectProviderConfig(apiUrl, modelNameInput, apiKey);

  // 1. Test Google Gemini
  if (cfg.provider === 'gemini') {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const reqOpts: any = {};
      if (cfg.baseUrl !== 'https://generativelanguage.googleapis.com') {
        reqOpts.baseUrl = cfg.baseUrl;
      }
      if (cfg.apiVersion) {
        reqOpts.apiVersion = cfg.apiVersion;
      }
      const model = genAI.getGenerativeModel(
        { model: cfg.modelName },
        Object.keys(reqOpts).length > 0 ? reqOpts : undefined
      );
      await model.generateContent('Respond with exactly: OK');
      return { valid: true, model: cfg.modelName, provider: 'Google Gemini' };
    } catch (err: any) {
      logger.warn(`Gemini API test failed: ${err.message}`);
      let errorMsg = err.message || 'Invalid API key or Gemini service unavailable';
      if (err.message?.includes('API_KEY_INVALID')) {
        errorMsg = 'Invalid Gemini API key';
      } else if (err.message?.includes('RATE_LIMIT')) {
        errorMsg = 'Rate limit exceeded. Please try again later.';
      } else if (err.message?.includes('quota')) {
        errorMsg = 'API quota exceeded';
      } else if (err.message?.includes('not found') || err.message?.includes('404')) {
        errorMsg = `Model "${cfg.modelName}" not found. Check the URL or model name.`;
      }
      return { valid: false, model: cfg.modelName, provider: 'Google Gemini', error: errorMsg };
    }
  }

  // 2. Test OpenAI-compatible provider (NVIDIA NIM, OpenAI, Groq, Ollama, etc.)
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const payload = {
      model: cfg.modelName,
      messages: [{ role: 'user', content: 'Respond with OK' }],
      max_tokens: 10,
    };

    const res = await fetch(cfg.chatEndpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody: any = await res.json().catch(() => null);
      const msg =
        errBody?.error?.message ||
        errBody?.message ||
        errBody?.detail ||
        `HTTP ${res.status}: ${res.statusText}`;
      return {
        valid: false,
        model: cfg.modelName,
        provider: 'OpenAI-compatible',
        error: `Connection failed: ${msg}`,
      };
    }

    const data: any = await res.json();
    if (data.choices && data.choices.length > 0) {
      return { valid: true, model: cfg.modelName, provider: 'OpenAI-compatible' };
    }

    return {
      valid: false,
      model: cfg.modelName,
      provider: 'OpenAI-compatible',
      error: 'Unexpected response format from API endpoint',
    };
  } catch (err: any) {
    logger.warn(`OpenAI-compatible API test failed: ${err.message}`);
    return {
      valid: false,
      model: cfg.modelName,
      provider: 'OpenAI-compatible',
      error: `Connection error: ${err.message}`,
    };
  }
}

export async function diagnose(context: DiagnosticContext, userId: string = DEFAULT_USER_KEY): Promise<Diagnosis> {
  const userState = getUserState(userId);
  if (!userState?.apiKey) {
    throw new GeminiError('AI API key not configured for this user session. Please configure your key in Setup.', 400);
  }

  const modelName = userState.modelName || config.geminiModel;
  const prompt = buildDiagnosticPrompt(context);
  logger.info(`Sending diagnostic request (${userState.provider}, model: ${modelName}, user: ${userId}) for ${context.resource.kind}/${context.resource.name}`);

  try {
    let responseText = '';

    if (userState.provider === 'gemini') {
      const genAI = new GoogleGenerativeAI(userState.apiKey);
      const reqOpts: any = {};
      const url = userState.baseUrl || config.geminiBaseUrl;
      if (url && url !== 'https://generativelanguage.googleapis.com') {
        reqOpts.baseUrl = url;
      }
      if (userState.apiVersion) {
        reqOpts.apiVersion = userState.apiVersion;
      }

      const model = genAI.getGenerativeModel(
        {
          model: modelName,
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json',
          },
        },
        Object.keys(reqOpts).length > 0 ? reqOpts : undefined
      );

      const result = await model.generateContent(prompt);
      responseText = result.response.text();
    } else {
      // OpenAI-compatible endpoint
      const chatEndpoint = userState.chatEndpoint;

      responseText = await callOpenAiCompatible(
        chatEndpoint,
        userState.apiKey,
        modelName,
        prompt,
        true
      );
    }

    logger.info('Received AI response, validating JSON structure...');

    let parsed = extractJSON(responseText);
    if (!parsed) {
      logger.warn('Failed to parse response as JSON, retrying with stricter prompt...');
      const retryPrompt = `The previous response was not valid JSON. Please respond with ONLY a valid JSON object matching the schema without markdown or commentary:\n\n${prompt}`;

      if (userState.provider === 'gemini') {
        const genAI = new GoogleGenerativeAI(userState.apiKey);
        const model = genAI.getGenerativeModel({ model: modelName });
        const retryResult = await model.generateContent(retryPrompt);
        responseText = retryResult.response.text();
      } else {
        responseText = await callOpenAiCompatible(
          userState.chatEndpoint,
          userState.apiKey,
          modelName,
          retryPrompt,
          false
        );
      }

      parsed = extractJSON(responseText);
      if (!parsed) {
        throw new GeminiError('AI provider returned malformed response after retry');
      }
    }

    const validation = validateDiagnosis(parsed);
    if (!validation.valid || !validation.diagnosis) {
      throw new GeminiError(`Diagnosis validation failed: ${validation.errors?.join(', ')}`);
    }

    // Security check: if AI attempted to demand secret extraction commands, filter them out
    if (validation.diagnosis.verificationCommands) {
      validation.diagnosis.verificationCommands = validation.diagnosis.verificationCommands.filter(
        c => !(c.command.toLowerCase().includes('secret') && (c.command.toLowerCase().includes('jsonpath') || c.command.toLowerCase().includes('yaml') || c.command.toLowerCase().includes('base64 -d')))
      );
    }
    if (validation.diagnosis.remediationCommands) {
      validation.diagnosis.remediationCommands = validation.diagnosis.remediationCommands.filter(
        c => !(c.command.toLowerCase().includes('secret') && (c.command.toLowerCase().includes('jsonpath') || c.command.toLowerCase().includes('yaml') || c.command.toLowerCase().includes('base64 -d')))
      );
    }

    logger.info('Diagnosis validated successfully');
    return validation.diagnosis;
  } catch (err: any) {
    if (err instanceof GeminiError) throw err;

    logger.error(`AI API error: ${err.message}`);

    if (err.message?.includes('RATE_LIMIT') || err.message?.includes('429')) {
      throw new GeminiError('AI rate limit exceeded. Please wait and try again.', 429);
    }
    if (err.message?.includes('API_KEY_INVALID') || err.message?.includes('401') || err.message?.includes('Unauthorized')) {
      throw new GeminiError('Invalid API key or unauthorized. Please verify your credentials.', 401);
    }

    throw new GeminiError(`Failed to get diagnosis from AI provider: ${err.message}`);
  }
}

