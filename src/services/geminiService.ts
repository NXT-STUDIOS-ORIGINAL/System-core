import {
  GeminiConnectionStatus,
  GeminiModelOption,
  GeminiTestResult,
  GeminiStatusInfo,
  GeminiProcessResult,
} from '../types';

export const GEMINI_API_KEY_STORAGE_KEY = 'system_core_gemini_api_key';
export const GEMINI_MODEL_STORAGE_KEY = 'system_core_gemini_selected_model';
export const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

export const FALLBACK_GEMINI_MODELS: GeminiModelOption[] = [
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Recommended: High availability, multimodal with rapid structured JSON analysis',
    isRecommended: true,
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    description: 'High throughput, ultra-low latency lightweight model',
    isRecommended: false,
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    description: 'Fast multimodal generation and robust structured reasoning',
    isRecommended: false,
  },
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    description: 'Multimodal model with advanced reasoning capabilities',
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
    description: 'Complex reasoning and deep narrative state analysis',
    isRecommended: false,
  },
];

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
   * Gets the currently selected model ID.
   */
  public getSelectedModel(preferredFromSettings?: string): string {
    if (preferredFromSettings && preferredFromSettings.trim()) {
      return preferredFromSettings.trim();
    }
    try {
      const stored = localStorage.getItem(GEMINI_MODEL_STORAGE_KEY);
      if (stored && stored.trim()) {
        return stored.trim();
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
      const sanitized = (modelId || '').trim() || DEFAULT_GEMINI_MODEL;
      localStorage.setItem(GEMINI_MODEL_STORAGE_KEY, sanitized);
    } catch (err) {
      console.error('Failed to store model selection:', err);
    }
  }

  /**
   * Queries the server for current Gemini configuration & health status.
   */
  public async getStatus(): Promise<GeminiStatusInfo> {
    const customKey = this.getApiKey();
    try {
      const headers: Record<string, string> = {};
      if (customKey) {
        headers['x-gemini-api-key'] = customKey;
      }

      const res = await fetch('/api/gemini/status', {
        method: 'GET',
        headers,
      });

      if (res.ok) {
        const data = await res.json();
        return {
          configured: data.configured,
          status: data.status,
          model: this.getSelectedModel(),
          hasServerEnvKey: data.hasServerEnvKey,
          hasCustomKey: Boolean(customKey),
          message: data.message,
        };
      }
    } catch (err: any) {
      console.warn('Gemini status check failed:', err?.message);
    }

    return {
      configured: Boolean(customKey),
      status: customKey ? 'CONFIGURED' : 'NOT CONFIGURED',
      model: this.getSelectedModel(),
      hasCustomKey: Boolean(customKey),
      message: customKey ? 'Custom API key stored locally' : 'No API key configured',
    };
  }

  /**
   * Discovers and retrieves available Gemini models from the server.
   * If remote discovery fails, returns the guaranteed fallback list.
   */
  public async getAvailableModels(apiKeyOverride?: string): Promise<GeminiModelOption[]> {
    const key = apiKeyOverride !== undefined ? apiKeyOverride.trim() : this.getApiKey();
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (key) {
        headers['x-gemini-api-key'] = key;
      }

      const res = await fetch('/api/gemini/models', {
        method: 'POST',
        headers,
        body: JSON.stringify({ apiKey: key || undefined }),
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.models) && data.models.length > 0) {
          return data.models;
        }
      }
    } catch (err: any) {
      console.warn('Failed to retrieve model list from server, using fallback list:', err?.message);
    }

    return FALLBACK_GEMINI_MODELS;
  }

  /**
   * Tests the connection with the given API key and model (or currently configured defaults).
   */
  public async testConnection(
    apiKeyOverride?: string,
    modelOverride?: string
  ): Promise<GeminiTestResult> {
    const key = apiKeyOverride !== undefined ? apiKeyOverride.trim() : this.getApiKey();
    const model = (modelOverride && modelOverride.trim()) || this.getSelectedModel();

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (key) {
        headers['x-gemini-api-key'] = key;
      }

      const res = await fetch('/api/gemini/test-connection', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          apiKey: key || undefined,
          model,
        }),
      });

      const data = await res.json();

      if (data.connected) {
        return {
          connected: true,
          model: data.model || model,
          latencyMs: data.latencyMs,
          message: data.message || 'Gemini Connection ✓',
        };
      } else {
        return {
          connected: false,
          model: data.model || model,
          latencyMs: data.latencyMs,
          category: data.category || 'Request rejected',
          error: data.error || 'Connection failed',
        };
      }
    } catch (err: any) {
      return {
        connected: false,
        model,
        category: 'Network error',
        error: err?.message || 'Network communication error',
      };
    }
  }

  /**
   * Submits incoming System Message to Gemini for structured JSON extraction and analysis.
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
    category?: string;
    isQuotaExceeded?: boolean;
    error?: string;
  }> {
    const key = payload.apiKeyOverride !== undefined ? payload.apiKeyOverride.trim() : this.getApiKey();
    const model = (payload.model && payload.model.trim()) || this.getSelectedModel();

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (key) {
        headers['x-gemini-api-key'] = key;
      }

      const res = await fetch('/api/gemini/process-system-input', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          rawMessage: payload.rawMessage,
          playerState: payload.playerState,
          recentMemories: payload.recentMemories,
          importantMemories: payload.importantMemories,
          stateVersion: payload.stateVersion,
          systemVersion: payload.systemVersion,
          model,
          apiKey: key || undefined,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        return {
          success: true,
          data: data.data,
          model: data.model || model,
        };
      }

      const isQuota = res.status === 429 || data.isQuotaExceeded || data.category === 'Quota exceeded';

      return {
        success: false,
        category: data.category || (isQuota ? 'Quota exceeded' : 'Request rejected'),
        isQuotaExceeded: isQuota,
        error: data.error || (isQuota ? 'Gemini Quota Exceeded' : 'Processing failed'),
        model: data.model || model,
      };
    } catch (err: any) {
      return {
        success: false,
        category: 'Network error',
        error: err?.message || 'Failed to communicate with server',
        model,
      };
    }
  }
}

export const geminiService = new GeminiService();
