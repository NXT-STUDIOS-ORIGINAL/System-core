import { GoogleGenAI } from '@google/genai';

let defaultAiClient: GoogleGenAI | null = null;

/**
 * Lazy initialization of GoogleGenAI client on the server.
 * Uses customApiKey if provided, otherwise falls back to GEMINI_API_KEY from environment.
 * Sets 'User-Agent': 'aistudio-build' in httpOptions for telemetry.
 */
export function getGeminiClient(customApiKey?: string): GoogleGenAI {
  const effectiveKey = (customApiKey && typeof customApiKey === 'string' && customApiKey.trim().length > 0)
    ? customApiKey.trim()
    : process.env.GEMINI_API_KEY;

  if (!effectiveKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  // If a custom API key is supplied, instantiate a dedicated client instance
  if (customApiKey && customApiKey.trim().length > 0) {
    return new GoogleGenAI({
      apiKey: customApiKey.trim(),
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  if (!defaultAiClient) {
    defaultAiClient = new GoogleGenAI({
      apiKey: effectiveKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return defaultAiClient;
}

export function isGeminiConfigured(customApiKey?: string): boolean {
  if (customApiKey && typeof customApiKey === 'string' && customApiKey.trim().length > 0) {
    return true;
  }
  return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
}
