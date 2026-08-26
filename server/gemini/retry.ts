/**
 * Resilient Retry & Fallback Mechanism for Gemini API calls.
 * Handles 503 (high demand / unavailable), 429 (rate limits), and transient network errors
 * with exponential backoff, jitter, and automatic model fallback.
 */

export const GEMINI_PRIMARY_MODEL = 'gemini-2.5-flash';
export const GEMINI_FALLBACK_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-3.7-flash',
  'gemini-flash-latest',
  'gemini-1.5-flash',
  'gemini-3.1-flash-lite',
];

export function parseErrorDetails(err: any): { code?: number | string; status?: string; message: string } {
  if (!err) return { message: '' };

  let rawMessage = String(err.message || err.error?.message || err.toString() || '');
  let code = err.status || err.statusCode || err.code || err.error?.code || err.error?.status;
  let status = err.error?.status || err.status;

  // Try parsing JSON error strings if message contains JSON format
  if (rawMessage.startsWith('{') && rawMessage.endsWith('}')) {
    try {
      const parsed = JSON.parse(rawMessage);
      if (parsed.error) {
        code = parsed.error.code || code;
        status = parsed.error.status || status;
        rawMessage = parsed.error.message || rawMessage;
      }
    } catch {
      // Keep original
    }
  }

  return { code, status, message: rawMessage.toLowerCase() };
}

export function isHighDemandError(err: any): boolean {
  if (!err) return false;
  const { code, status, message } = parseErrorDetails(err);

  return (
    code === 503 ||
    code === '503' ||
    status === 'UNAVAILABLE' ||
    message.includes('high demand') ||
    message.includes('unavailable') ||
    message.includes('spikes in demand') ||
    message.includes('503') ||
    message.includes('try again later') ||
    message.includes('overloaded') ||
    message.includes('temporarily unavailable')
  );
}

export function isRetryableError(err: any): boolean {
  if (!err) return false;
  
  const { code, status, message } = parseErrorDetails(err);

  if (
    code === 503 ||
    code === '503' ||
    status === 'UNAVAILABLE' ||
    code === 429 ||
    code === '429' ||
    status === 'RESOURCE_EXHAUSTED' ||
    code === 500 ||
    code === 502 ||
    code === 504 ||
    code === 404 ||
    status === 'NOT_FOUND'
  ) {
    return true;
  }

  if (
    message.includes('high demand') ||
    message.includes('unavailable') ||
    message.includes('try again later') ||
    message.includes('resource has been exhausted') ||
    message.includes('quota') ||
    message.includes('rate limit') ||
    message.includes('rate_limit') ||
    message.includes('timeout') ||
    message.includes('econnreset') ||
    message.includes('fetch failed') ||
    message.includes('socket hang up') ||
    message.includes('no longer available') ||
    message.includes('503') ||
    message.includes('429') ||
    message.includes('404')
  ) {
    return true;
  }

  return false;
}

export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface RetryOptions {
  maxRetriesPerModel?: number;
  models?: string[];
  initialDelayMs?: number;
  maxDelayMs?: number;
}

export async function executeWithGeminiResilience<T>(
  operation: (modelName: string) => Promise<T>,
  options: RetryOptions = {}
): Promise<{ result: T; usedModel: string }> {
  const models = options.models && options.models.length > 0 ? options.models : GEMINI_FALLBACK_MODELS;
  const maxRetriesPerModel = options.maxRetriesPerModel ?? 1;
  const initialDelayMs = options.initialDelayMs ?? 250;
  const maxDelayMs = options.maxDelayMs ?? 1000;

  let lastError: any = null;

  for (let mIndex = 0; mIndex < models.length; mIndex++) {
    const currentModel = models[mIndex];

    for (let attempt = 0; attempt <= maxRetriesPerModel; attempt++) {
      try {
        if (attempt > 0) {
          const jitter = Math.random() * 100;
          const backoff = Math.min(initialDelayMs * Math.pow(1.5, attempt - 1) + jitter, maxDelayMs);
          console.warn(`[GEMINI RETRY] Retrying on model ${currentModel} (attempt ${attempt + 1}/${maxRetriesPerModel + 1}) after ${Math.round(backoff)}ms...`);
          await delay(backoff);
        }

        const result = await operation(currentModel);
        if (mIndex > 0 || attempt > 0) {
          console.log(`[GEMINI RECOVERY] Operation succeeded with model: ${currentModel} on attempt ${attempt + 1}`);
        }
        return { result, usedModel: currentModel };
      } catch (err: any) {
        lastError = err;
        const { message: errSummary, code } = parseErrorDetails(err);

        console.warn(`[GEMINI ATTEMPT FAILED] Model ${currentModel} attempt ${attempt + 1}: code=${code || 'unknown'} msg=${errSummary}`);

        // If 404 (model not found), fail over to next model immediately without burning retries
        if (code === 404 || code === '404' || errSummary.includes('not found')) {
          if (mIndex < models.length - 1) {
            console.warn(`[GEMINI MODEL NOT FOUND] Model ${currentModel} unavailable. Switching to ${models[mIndex + 1]}`);
            break;
          }
        }

        // On 503 high demand or transient server error: allow 1 quick backoff retry, then fail over to next model
        if (isHighDemandError(err)) {
          if (attempt >= maxRetriesPerModel && mIndex < models.length - 1) {
            console.warn(`[GEMINI HIGH-DEMAND FAILOVER] Model ${currentModel} high demand spike detected. Failing over to next model: ${models[mIndex + 1]}`);
            break;
          }
        }

        // If quota exceeded (429), switch to next model immediately
        if ((code === 429 || code === '429' || errSummary.includes('quota') || errSummary.includes('resource_exhausted')) && mIndex < models.length - 1) {
          console.warn(`[GEMINI QUOTA FAILOVER] Model ${currentModel} quota reached. Switching to ${models[mIndex + 1]}`);
          break;
        }

        if (attempt === maxRetriesPerModel && mIndex < models.length - 1) {
          console.warn(`[GEMINI MODEL EXHAUSTED] Exhausted attempts for ${currentModel}. Switching to fallback model: ${models[mIndex + 1]}`);
        }
      }
    }
  }

  throw lastError || new Error('All Gemini retry attempts and fallback models exhausted');
}
