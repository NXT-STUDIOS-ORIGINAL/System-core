import { GoogleGenAI } from '@google/genai';
import {
  GeminiConnectionStatus,
  GeminiErrorCategory,
  GeminiModelOption,
  GeminiTestResult,
  GeminiStatusInfo,
  GeminiProcessResult,
  GeminiDiagnosticInfo,
} from '../types';

export const GEMINI_API_KEY_STORAGE_KEY = 'system_core_gemini_api_key';
export const GEMINI_MODEL_STORAGE_KEY = 'system_core_gemini_selected_model';
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export const FALLBACK_GEMINI_MODELS: GeminiModelOption[] = [
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Recommended: High throughput, fast multimodal and reliable JSON state extraction',
    isRecommended: true,
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    description: 'Ultra-low latency lightweight model for rapid processing',
    isRecommended: false,
  },
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    description: 'Advanced reasoning and deep context comprehension',
    isRecommended: false,
  },
  {
    id: 'gemini-flash-latest',
    name: 'Gemini Flash (Auto-updated)',
    description: 'Points to the latest stable Flash release',
    isRecommended: false,
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    description: 'Complex reasoning and comprehensive narrative state analysis',
    isRecommended: false,
  },
];

export const RESILIENT_FALLBACK_MODEL_IDS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3.7-flash',
  'gemini-flash-latest',
];

export const GEMINI_SYSTEM_PROCESSOR_INSTRUCTION = `You are the data processing engine for an external progression system (SYSTEM CORE).
Your role is strictly data extraction, summarization, validation, and structured state mutation.

CRITICAL ARCHITECTURAL DIRECTIVE — STRICT DATA-ONLY MODE:
1. The external ChatGPT / System Controller is the SOLE authority that creates or changes RPG content.
2. The app and processor are strictly a PERSISTENCE + DISPLAY + DATA PROCESSING layer.
3. You must NEVER invent, assume, simulate, or generate RPG content on your own:
   - NEVER invent quests, daily quests, hidden quests, boss chains, emergency events, or penalties.
   - NEVER invent items, loot boxes, keys, equipment, or shop items.
   - NEVER invent rewards, loot drops, XP amounts, coin amounts, or stat increases.
   - NEVER invent skills, titles, or achievements.
   - NEVER invent XP requirements or level formulas.
4. You do NOT automatically trigger a level-up simply because XP exceeds a threshold unless the System message explicitly states a level transition.
5. ONLY extract and structure information that is EXPLICITLY stated in the incoming System Controller message.
6. Preserve all existing player state unless the new message explicitly changes it.
7. If a state change is ambiguous or values are missing, do not invent values; emit a warning in the 'warnings' array.

ITEM DEFINITION EXTRACTION:
- When the message explicitly introduces an item with description, rank, type, effects, requirements, sell value, etc. (e.g. "Obtained Crimson Crystal. Rare crystal that can be used for..."), extract those explicitly stated properties into the 'itemDefinitions' array.
- NEVER invent missing properties for an item. If only "Void Key" is mentioned with no description or rank, do NOT invent a rank or description. Only extract itemName: "Void Key".

OPERATIONS SUPPORTED:
- "SET": Overwrite a specific field or path with a specified value.
  Example: path: "progression.level", value: 2
  Example: path: "progression.xp", value: "0 / 2400"
  Example: path: "progression.requiredXp", value: 2400
- "ADD": Add a numeric delta or append an item to a list.
  Example: path: "progression.currentXP", value: 500
  Example: path: "progression.xp", value: 500
  Example: path: "attributes.Strength", value: 1
- "REMOVE": Remove an item from a list or collection.
  Example: path: "inventory", value: "temporary_item"
- "COMPLETE": Mark a quest or objective as completed.
  Example: path: "quests", value: "Morning Training", id: "morning_training"
- "UNLOCK": Unlock a new skill, title, or achievement.
  Example: path: "skills", value: "Sprint"
  Example: path: "achievements", value: "First Step"
- "UPDATE": Update specific properties of an existing entity.
  Example: path: "quests", value: { title: "The Iron Path", status: "ACTIVE" }

XP RULES:
- If current state has Level 1, 600 / 1500 XP and input is "+500 XP" or "You earned +500 XP":
  operation: "ADD", path: "progression.currentXP", value: 500
- If input says "Level 2 reached. XP is now 0 / 2400":
  stateChanges: [
    { operation: "SET", path: "progression.level", value: 2 },
    { operation: "SET", path: "progression.currentXP", value: 0 },
    { operation: "SET", path: "progression.requiredXp", value: 2400 }
  ]

SUMMARIES:
- Generate a clear, concise event summary (1-2 short sentences) describing what actually occurred.
- Example: "Completed training. Gained 500 XP."
- Example: "Discovered hidden quest: The Iron Path."

IMPORTANT MEMORY:
- Only recommend an item for 'importantMemory' if the information is genuinely persistent, momentous, or a major milestone (e.g. key story milestone, permanent title gained, major world event). Normal routine training/XP gains belong ONLY in the general summary.
- If recommending important memory, provide the text and a concise reason.`;

/**
 * Normalizes model names before passing to the @google/genai SDK.
 * Strips leading "models/" prefix (one or more times) to avoid "models/models/..." errors.
 */
export function normalizeModelName(modelName?: string): string {
  if (!modelName || typeof modelName !== 'string' || !modelName.trim()) {
    return DEFAULT_GEMINI_MODEL;
  }
  let normalized = modelName.trim();
  while (normalized.startsWith('models/')) {
    normalized = normalized.slice(7);
  }
  return normalized || DEFAULT_GEMINI_MODEL;
}

/**
 * Detects whether the current runtime environment is Android (Capacitor APK) or Web.
 */
export function detectEnvironment(): 'Web' | 'Android' {
  if (typeof window === 'undefined') return 'Web';

  const cap = (window as any).Capacitor;
  if (cap) {
    if (typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) {
      return 'Android';
    }
    if (typeof cap.getPlatform === 'function' && cap.getPlatform() === 'android') {
      return 'Android';
    }
  }

  if (
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'ionic:' ||
    (window.location.hostname === 'localhost' && cap !== undefined)
  ) {
    return 'Android';
  }

  if (
    typeof navigator !== 'undefined' &&
    /android/i.test(navigator.userAgent) &&
    (window.location.protocol === 'http:' || window.location.protocol === 'https:') &&
    (!window.location.port || window.location.hostname === 'localhost')
  ) {
    if (cap) return 'Android';
  }

  return 'Web';
}

/**
 * Categorizes errors thrown by the official @google/genai SDK into specific categories.
 * Never defaults to a generic "Network error" for everything.
 */
export function categorizeGeminiError(err: any): GeminiErrorCategory {
  if (!err) return 'Unknown error';

  const msg = (err.message || (typeof err === 'string' ? err : JSON.stringify(err))).toLowerCase();
  const status = err.status || err.statusCode || err.code;

  // API Key Errors
  if (
    status === 400 &&
    (msg.includes('api_key') || msg.includes('api key') || msg.includes('key not valid') || msg.includes('invalid api key'))
  ) {
    return 'API key error';
  }
  if (
    msg.includes('api_key_invalid') ||
    msg.includes('api key not valid') ||
    msg.includes('invalid api key') ||
    msg.includes('unregistered caller') ||
    msg.includes('api key is required') ||
    msg.includes('no gemini api key') ||
    msg.includes('missing api key')
  ) {
    return 'API key error';
  }

  // Permission Errors
  if (
    status === 403 ||
    msg.includes('permission_denied') ||
    msg.includes('permission denied') ||
    msg.includes('access denied') ||
    msg.includes('forbidden')
  ) {
    return 'Permission error';
  }

  // Model Errors
  if (
    status === 404 ||
    msg.includes('is not found') ||
    msg.includes('model not found') ||
    msg.includes('unsupported model') ||
    msg.includes('invalid model') ||
    msg.includes('not supported for generatecontent')
  ) {
    return 'Model error';
  }

  // Quota & Rate Limit Errors
  if (
    status === 429 ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota exceeded') ||
    msg.includes('rate limit') ||
    msg.includes('too many requests') ||
    msg.includes('exhausted')
  ) {
    return 'Quota error';
  }

  // Network Errors
  if (
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('offline') ||
    msg.includes('enotfound') ||
    msg.includes('econnrefused') ||
    msg.includes('etimedout') ||
    msg.includes('timeout') ||
    msg.includes('socket')
  ) {
    return 'Network error';
  }

  return 'Unknown error';
}

export class GeminiService {
  /**
   * Retrieves the locally saved custom API key from isolated storage.
   * Never mixed with Player Data or RPG DB backup state.
   */
  public getApiKey(): string {
    try {
      return (localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY) || '').trim();
    } catch {
      return '';
    }
  }

  /**
   * Saves custom API key to isolated storage.
   */
  public setApiKey(key: string): void {
    try {
      const sanitized = (key || '').trim();
      if (sanitized) {
        localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, sanitized);
      } else {
        this.clearApiKey();
      }
    } catch (err) {
      console.error('Failed to store API key in local storage:', err);
    }
  }

  /**
   * Clears custom API key from isolated storage.
   */
  public clearApiKey(): void {
    try {
      localStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
    } catch (err) {
      console.error('Failed to clear API key:', err);
    }
  }

  /**
   * Returns whether a custom client API key is saved.
   */
  public hasApiKey(): boolean {
    return Boolean(this.getApiKey().length > 0);
  }

  /**
   * Safely masks the API key (e.g. ••••••••••••1234), never exposing the full key.
   */
  public getMaskedApiKey(keyOverride?: string): string {
    const key = keyOverride !== undefined ? keyOverride.trim() : this.getApiKey();
    if (!key) return '';
    if (key.length <= 6) return '••••••••';
    const last4 = key.slice(-4);
    const bullets = '•'.repeat(Math.min(16, Math.max(8, key.length - 4)));
    return `${bullets}${last4}`;
  }

  /**
   * Gets the currently selected model ID (normalized).
   */
  public getSelectedModel(preferredFromSettings?: string): string {
    if (preferredFromSettings && preferredFromSettings.trim()) {
      return normalizeModelName(preferredFromSettings.trim());
    }
    try {
      const stored = localStorage.getItem(GEMINI_MODEL_STORAGE_KEY);
      if (stored && stored.trim()) {
        return normalizeModelName(stored.trim());
      }
    } catch {
      // ignore
    }
    return DEFAULT_GEMINI_MODEL;
  }

  /**
   * Saves the selected model ID.
   */
  public setSelectedModel(modelId: string): void {
    try {
      const normalized = normalizeModelName(modelId || DEFAULT_GEMINI_MODEL);
      localStorage.setItem(GEMINI_MODEL_STORAGE_KEY, normalized);
    } catch (err) {
      console.error('Failed to store model selection:', err);
    }
  }

  /**
   * Queries configuration & health status.
   */
  public async getStatus(): Promise<GeminiStatusInfo> {
    const customKey = this.getApiKey();
    const env = detectEnvironment();
    const isConfigured = Boolean(customKey.length > 0);

    return {
      configured: isConfigured,
      status: isConfigured ? 'CONFIGURED' : 'NOT CONFIGURED',
      model: this.getSelectedModel(),
      hasCustomKey: isConfigured,
      message: isConfigured
        ? `Gemini API key configured (${env} Mode)`
        : 'Please enter your Gemini API key in Settings',
    };
  }

  /**
   * Discovers and retrieves available Gemini models via the official @google/genai SDK.
   * If discovery is not available or fails, returns the guaranteed fallback list.
   */
  public async getAvailableModels(apiKeyOverride?: string): Promise<GeminiModelOption[]> {
    const key = apiKeyOverride !== undefined ? apiKeyOverride.trim() : this.getApiKey();
    if (key) {
      try {
        const ai = new GoogleGenAI({ apiKey: key });
        const listResponse = await ai.models.list();
        const models: GeminiModelOption[] = [];

        for await (const m of listResponse) {
          const rawId = m.name || '';
          const id = normalizeModelName(rawId);
          const supportedMethods = (m as any).supportedGenerationMethods || (m as any).supportedActions;
          if (id.includes('gemini') && (!supportedMethods || supportedMethods.includes('generateContent'))) {
            models.push({
              id,
              name: m.displayName || id,
              description: m.description || `Gemini model ${id}`,
              isRecommended: id === DEFAULT_GEMINI_MODEL,
            });
          }
        }

        if (models.length > 0) {
          return models;
        }
      } catch (err) {
        console.warn('Discovery via SDK failed, using curated model list:', err);
      }
    }
    return FALLBACK_GEMINI_MODELS;
  }

  /**
   * Tests the connection with the given API key and model using the official @google/genai SDK.
   * Performs a real minimal generateContent request.
   * Works identically across Web and Android/Capacitor APK environments.
   */
  public async testConnection(
    apiKeyOverride?: string,
    modelOverride?: string
  ): Promise<GeminiTestResult> {
    const key = apiKeyOverride !== undefined ? apiKeyOverride.trim() : this.getApiKey();
    const model = normalizeModelName(modelOverride || this.getSelectedModel());
    const env = detectEnvironment();

    if (!key) {
      const diag: GeminiDiagnosticInfo = {
        environment: env,
        model,
        status: 'NO_KEY',
        details: 'Gemini API Key is not configured. Please paste your Gemini API Key in Settings.',
      };
      return {
        connected: false,
        model,
        category: 'API key error',
        error: 'No Gemini API Key provided. Please paste your Gemini API Key in Settings.',
        diagnostics: diag,
      };
    }

    const startTime = Date.now();
    try {
      const ai = new GoogleGenAI({ apiKey: key });
      const response = await ai.models.generateContent({
        model,
        contents: 'Reply with exactly: SYSTEM CORE ONLINE',
      });

      const latencyMs = Date.now() - startTime;
      const responseText = (response.text || '').trim();

      const diag: GeminiDiagnosticInfo = {
        environment: env,
        model,
        status: 'CONNECTED',
        details: `SDK response: "${responseText || 'SYSTEM CORE ONLINE'}"`,
      };

      return {
        connected: true,
        model,
        latencyMs,
        message: `🟢 GEMINI ONLINE\nModel: ${model}`,
        diagnostics: diag,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      const category = categorizeGeminiError(err);
      const errorMsg = err?.message || String(err) || 'Failed to communicate with Gemini API';

      const diag: GeminiDiagnosticInfo = {
        environment: env,
        model,
        status: 'ERROR',
        details: `Error [${category}]: ${errorMsg}`,
      };

      return {
        connected: false,
        model,
        latencyMs,
        category,
        error: errorMsg,
        diagnostics: diag,
      };
    }
  }

  /**
   * Submits incoming System Message to Gemini for structured JSON extraction and analysis
   * using the official @google/genai SDK.
   */
  public async processSystemInput(payload: {
    rawMessage: string;
    playerState: any;
    recentMemories: any[];
    importantMemories: any[];
    stateVersion: number;
    systemVersion: string;
    model?: string;
    apiKeyOverride?: string;
  }): Promise<{
    success: boolean;
    data?: GeminiProcessResult;
    model?: string;
    category?: GeminiErrorCategory;
    isQuotaExceeded?: boolean;
    error?: string;
  }> {
    const key = payload.apiKeyOverride !== undefined ? payload.apiKeyOverride.trim() : this.getApiKey();
    const primaryModel = normalizeModelName(payload.model || this.getSelectedModel());

    if (!key) {
      return {
        success: false,
        category: 'API key error',
        error: 'No Gemini API Key provided. Please configure your API key in Settings.',
        model: primaryModel,
      };
    }

    // Prepare focused context summary
    const playerState = payload.playerState || {};
    const contextSummary = {
      systemVersion: payload.systemVersion || '1.0.0',
      stateVersion: payload.stateVersion || 0,
      currentPlayerState: {
        level: playerState.level ?? playerState.progression?.level ?? 1,
        xp: playerState.xp ?? playerState.progression?.xp ?? 0,
        progression: playerState.progression || {},
        attributes: playerState.attributes || {},
        currency: playerState.currency || { coins: playerState.coins ?? 0 },
        skills: (playerState.skills || []).map((s: any) => (typeof s === 'string' ? s : s.name || s.title)),
        activeQuests: (playerState.quests || []).map((q: any) =>
          typeof q === 'string' ? q : `${q.title} [${q.status || 'ACTIVE'}]`
        ),
        inventory: (playerState.inventory || []).map((i: any) =>
          typeof i === 'string' ? i : `${i.name}${i.quantity ? ` x${i.quantity}` : ''}`
        ),
      },
      recentEventSummaries: (payload.recentMemories || []).slice(-5).map((m) => (typeof m === 'string' ? m : m.summary)),
      importantMemories: (payload.importantMemories || []).slice(-5).map((m: any) => (typeof m === 'string' ? m : m.summary || m.text)),
    };

    const userPrompt = `
CURRENT SYSTEM STATE:
${JSON.stringify(contextSummary, null, 2)}

NEW INCOMING SYSTEM MESSAGE:
"""
${payload.rawMessage}
"""

Extract the exact state updates, concise event summary, and any warnings. Remember: NEVER invent XP requirements or levels not stated in the message.`;

    // Candidate models to try in order of resilience
    const modelsToTry = [
      primaryModel,
      ...RESILIENT_FALLBACK_MODEL_IDS.map(normalizeModelName).filter((m) => m !== primaryModel),
    ];

    let lastError = '';
    let isQuota = false;
    let errorCategory: GeminiErrorCategory = 'Unknown error';

    const ai = new GoogleGenAI({ apiKey: key });

    for (const modelToTry of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: modelToTry,
          contents: userPrompt,
          config: {
            systemInstruction: GEMINI_SYSTEM_PROCESSOR_INSTRUCTION,
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        });

        const rawContentText = (response.text || '').trim();
        if (!rawContentText) {
          lastError = 'Empty response content received from Gemini';
          continue;
        }

        let structured: any;
        try {
          let cleaned = rawContentText;
          if (cleaned.startsWith('```json')) {
            cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
          } else if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
          }
          structured = JSON.parse(cleaned);
        } catch (jsonErr: any) {
          lastError = `JSON parse failed on Gemini response: ${jsonErr.message}`;
          continue;
        }

        const sanitizedResult: GeminiProcessResult = {
          success: structured.success !== false,
          summary: structured.summary || 'System event processed.',
          stateChanges: Array.isArray(structured.stateChanges) ? structured.stateChanges : [],
          itemDefinitions: Array.isArray(structured.itemDefinitions) ? structured.itemDefinitions : [],
          importantMemory: Array.isArray(structured.importantMemory) ? structured.importantMemory : [],
          warnings: Array.isArray(structured.warnings) ? structured.warnings : [],
          confidence: typeof structured.confidence === 'number' ? structured.confidence : 0.95,
        };

        return {
          success: true,
          data: sanitizedResult,
          model: modelToTry,
        };
      } catch (err: any) {
        const cat = categorizeGeminiError(err);
        errorCategory = cat;
        if (cat === 'Quota error') {
          isQuota = true;
          lastError = err?.message || 'Quota exceeded';
          continue;
        }
        if (cat === 'Model error') {
          lastError = err?.message || `Model ${modelToTry} not found`;
          continue;
        }
        lastError = err?.message || 'Gemini SDK call failed';
        if (cat === 'API key error') {
          break; // No need to retry with other models if key is invalid
        }
      }
    }

    return {
      success: false,
      category: isQuota ? 'Quota error' : errorCategory,
      isQuotaExceeded: isQuota,
      error: isQuota
        ? 'Gemini API quota exceeded or rate limit reached.'
        : (lastError || 'Processing failed with all attempted models'),
      model: primaryModel,
    };
  }
}

export const geminiService = new GeminiService();
