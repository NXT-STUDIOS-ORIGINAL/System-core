import { getGeminiClient } from './client';
import { executeWithGeminiResilience, GEMINI_PRIMARY_MODEL, GEMINI_FALLBACK_MODELS } from './retry';

export interface TestHealthOptions {
  customApiKey?: string;
  selectedModel?: string;
}

export interface TestHealthResult {
  ok: boolean;
  model: string;
  latencyMs: number;
  message?: string;
  category?: 'Invalid API key' | 'Model unavailable' | 'Quota exceeded' | 'Network error' | 'Permission error' | 'Request rejected';
}

/**
 * Categorizes an error for clear user feedback
 */
export function categorizeGeminiError(err: any): 'Invalid API key' | 'Model unavailable' | 'Quota exceeded' | 'Network error' | 'Permission error' | 'Request rejected' {
  if (!err) return 'Request rejected';
  const status = err.status || err.statusCode || err.code || err.error?.code || err.error?.status;
  const msg = String(err.message || err.error?.message || err.toString() || '').toLowerCase();

  if (
    status === 401 ||
    status === 'UNAUTHENTICATED' ||
    msg.includes('api_key_invalid') ||
    msg.includes('api key not valid') ||
    msg.includes('invalid api key') ||
    msg.includes('api key expired')
  ) {
    return 'Invalid API key';
  }

  if (
    status === 404 ||
    status === 'NOT_FOUND' ||
    status === 503 ||
    status === 'UNAVAILABLE' ||
    msg.includes('503') ||
    msg.includes('high demand') ||
    msg.includes('unavailable') ||
    msg.includes('not found') ||
    msg.includes('no longer available') ||
    msg.includes('is not found') ||
    msg.includes('spikes in demand')
  ) {
    return 'Model unavailable';
  }

  if (
    status === 429 ||
    status === 'RESOURCE_EXHAUSTED' ||
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('resource exhausted') ||
    msg.includes('too many requests')
  ) {
    return 'Quota exceeded';
  }

  if (
    status === 403 ||
    status === 'PERMISSION_DENIED' ||
    msg.includes('permission denied') ||
    msg.includes('forbidden')
  ) {
    return 'Permission error';
  }

  if (
    msg.includes('fetch failed') ||
    msg.includes('econnreset') ||
    msg.includes('timeout') ||
    msg.includes('socket hang up') ||
    msg.includes('network') ||
    msg.includes('enotfound')
  ) {
    return 'Network error';
  }

  return 'Request rejected';
}

/**
 * Server-side helper to test Gemini connectivity with resilient retry & model fallback
 */
export async function testGeminiHealth(options: TestHealthOptions = {}): Promise<TestHealthResult> {
  const start = Date.now();
  const targetModel = options.selectedModel?.trim() || GEMINI_PRIMARY_MODEL;

  try {
    const ai = getGeminiClient(options.customApiKey);
    
    // If user specified a specific model, test that exact model first
    const modelsToTry = [targetModel, ...GEMINI_FALLBACK_MODELS.filter(m => m !== targetModel)];
    
    const { result, usedModel } = await executeWithGeminiResilience(
      async (modelName) => {
        const res = await ai.models.generateContent({
          model: modelName,
          contents: 'Respond with the single word: READY',
        });
        return res.text?.trim() || 'READY';
      },
      { models: modelsToTry, maxRetriesPerModel: 1, initialDelayMs: 300 }
    );

    const latencyMs = Date.now() - start;

    return {
      ok: true,
      model: usedModel,
      latencyMs,
      message: result,
    };
  } catch (err: any) {
    const category = categorizeGeminiError(err);
    const latencyMs = Date.now() - start;
    const safeErrorMsg = err?.message || 'Connection test failed';

    return {
      ok: false,
      model: targetModel,
      latencyMs,
      category,
      message: `${category}: ${safeErrorMsg}`,
    };
  }
}

export interface ModelListItem {
  id: string;
  name: string;
  description?: string;
  isRecommended?: boolean;
}

/**
 * Returns available compatible Gemini models for text extraction and generation
 */
export async function listAvailableGeminiModels(customApiKey?: string): Promise<ModelListItem[]> {
  const defaultCuratedList: ModelListItem[] = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Recommended - High availability, multimodal with rapid structured JSON analysis', isRecommended: true },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite', description: 'High throughput, ultra-low latency lightweight model', isRecommended: false },
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Fast multimodal generation and robust structured reasoning', isRecommended: false },
    { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', description: 'Multimodal model with advanced reasoning capabilities', isRecommended: false },
    { id: 'gemini-flash-latest', name: 'Gemini Flash (Auto-updated)', description: 'Always points to latest stable Flash version', isRecommended: false },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Complex reasoning and deep narrative state logic', isRecommended: false },
  ];

  try {
    const ai = getGeminiClient(customApiKey);
    const response = await ai.models.list();
    const modelsList: ModelListItem[] = [];

    // Iterate through retrieved models
    if (response) {
      for await (const m of response as any) {
        const rawName = m.name || '';
        const cleanId = rawName.replace(/^models\//, '');
        
        // Filter only text generation / multimodal Gemini models
        if (
          cleanId.startsWith('gemini-') &&
          !cleanId.includes('embedding') &&
          !cleanId.includes('aqa') &&
          !cleanId.includes('imagen') &&
          !cleanId.includes('veo')
        ) {
          modelsList.push({
            id: cleanId,
            name: m.displayName || cleanId,
            description: m.description || undefined,
            isRecommended: cleanId === 'gemini-2.5-flash',
          });
        }
      }
    }

    if (modelsList.length > 0) {
      // Ensure recommended is at top
      modelsList.sort((a, b) => {
        if (a.isRecommended) return -1;
        if (b.isRecommended) return 1;
        return a.id.localeCompare(b.id);
      });
      return modelsList;
    }
  } catch (err: any) {
    console.warn('[GEMINI MODELS] Could not query models list dynamically, returning curated set:', err?.message);
  }

  return defaultCuratedList;
}
