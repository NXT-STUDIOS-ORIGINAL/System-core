import { Type } from '@google/genai';
import { getGeminiClient } from './client';
import { GEMINI_SYSTEM_PROCESSOR_INSTRUCTION } from './prompts';
import { validateGeminiProcessResult, GeminiProcessResult } from './stateValidator';
import {
  executeWithGeminiResilience,
  GEMINI_PRIMARY_MODEL,
  GEMINI_FALLBACK_MODELS,
} from './retry';

export interface ProcessSystemInputPayload {
  rawMessage: string;
  playerState?: any;
  recentMemories?: Array<{ summary: string; timestamp?: string }>;
  importantMemories?: Array<any>;
  stateVersion?: number;
  systemVersion?: string;
  model?: string;
  customApiKey?: string;
}

export interface ProcessSystemOutput {
  result: GeminiProcessResult;
  usedModel: string;
}

/**
 * Executes Gemini extraction and structured state mutation analysis with retry & model fallback resilience.
 */
export async function processSystemInputWithGemini(
  payload: ProcessSystemInputPayload
): Promise<ProcessSystemOutput> {
  const {
    rawMessage,
    playerState = {},
    recentMemories = [],
    importantMemories = [],
    stateVersion = 0,
    systemVersion = '1.0.0',
    model,
    customApiKey,
  } = payload;

  const ai = getGeminiClient(customApiKey);

  // Prepare a focused, non-bloated context package for Gemini
  const contextSummary = {
    systemVersion,
    stateVersion,
    currentPlayerState: {
      level: playerState.level ?? playerState.progression?.level ?? 1,
      xp: playerState.xp ?? playerState.progression?.xp ?? 0,
      progression: playerState.progression || {},
      attributes: playerState.attributes || {},
      skills: (playerState.skills || []).map((s: any) => (typeof s === 'string' ? s : s.name || s.title)),
      activeQuests: (playerState.quests || []).map((q: any) =>
        typeof q === 'string' ? q : `${q.title} [${q.status || 'ACTIVE'}]`
      ),
      inventory: (playerState.inventory || []).map((i: any) =>
        typeof i === 'string' ? i : `${i.name}${i.quantity ? ` x${i.quantity}` : ''}`
      ),
    },
    recentEventSummaries: recentMemories.slice(-5).map((m) => m.summary),
    importantMemories: importantMemories.slice(-5).map((m: any) => (typeof m === 'string' ? m : m.summary || m.text)),
  };

  const userPrompt = `
CURRENT SYSTEM STATE:
${JSON.stringify(contextSummary, null, 2)}

NEW INCOMING SYSTEM MESSAGE:
"""
${rawMessage}
"""

Extract the exact state updates, concise event summary, and any warnings. Remember: NEVER invent XP requirements or levels not stated in the message.`;

  const requestedModel = model?.trim() || GEMINI_PRIMARY_MODEL;
  const modelsToTry = [requestedModel, ...GEMINI_FALLBACK_MODELS.filter((m) => m !== requestedModel)];

  const { result: responseText, usedModel } = await executeWithGeminiResilience(
    async (modelName) => {
      const response = await ai.models.generateContent({
        model: modelName,
        contents: userPrompt,
        config: {
          systemInstruction: GEMINI_SYSTEM_PROCESSOR_INSTRUCTION,
          temperature: 0.1, // Low temperature for high deterministic extraction accuracy
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              success: {
                type: Type.BOOLEAN,
                description: 'Whether the message was successfully analyzed',
              },
              summary: {
                type: Type.STRING,
                description: '1-2 sentence factual summary of what occurred in this event',
              },
              confidence: {
                type: Type.NUMBER,
                description: 'Confidence score between 0.0 and 1.0',
              },
              stateChanges: {
                type: Type.ARRAY,
                description: 'List of atomic state operations',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    operation: {
                      type: Type.STRING,
                      description: 'SET, ADD, REMOVE, COMPLETE, UNLOCK, or UPDATE',
                    },
                    path: {
                      type: Type.STRING,
                      description: 'Target path such as progression.currentXP, progression.level, skills, quests, attributes.Strength',
                    },
                    value: {
                      type: Type.STRING,
                      description: 'The value to apply, add, or set (numbers represented as strings or numbers, objects as JSON strings)',
                    },
                    id: {
                      type: Type.STRING,
                      description: 'Optional identifier for quest, item, or skill',
                    },
                  },
                  required: ['operation', 'path', 'value'],
                },
              },
              importantMemory: {
                type: Type.ARRAY,
                description: 'Important permanent memories recommended only for major milestones',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    text: {
                      type: Type.STRING,
                      description: 'Text of the important memory',
                    },
                    reason: {
                      type: Type.STRING,
                      description: 'Why this is considered a key persistent memory',
                    },
                  },
                  required: ['text'],
                },
              },
              itemDefinitions: {
                type: Type.ARRAY,
                description: 'Explicit item information supplied directly in the system message (name, rank, description, effects, etc.). Never invent missing fields.',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    itemName: {
                      type: Type.STRING,
                      description: 'Exact name of the item',
                    },
                    itemId: {
                      type: Type.STRING,
                      description: 'Optional slug or ID',
                    },
                    description: {
                      type: Type.STRING,
                      description: 'Description explicitly supplied by the system message',
                    },
                    rank: {
                      type: Type.STRING,
                      description: 'Explicit rank (e.g. E, D, C, B, A, S) if provided',
                    },
                    type: {
                      type: Type.STRING,
                      description: 'Explicit type (e.g. Loot Box, Key, Consumable, Material) if provided',
                    },
                    rarity: {
                      type: Type.STRING,
                      description: 'Explicit rarity if provided',
                    },
                    effects: {
                      type: Type.STRING,
                      description: 'Explicit effects or stat changes if provided',
                    },
                    requirements: {
                      type: Type.STRING,
                      description: 'Explicit usage requirements if provided',
                    },
                    sellValue: {
                      type: Type.STRING,
                      description: 'Explicit sell value if provided',
                    },
                    buyValue: {
                      type: Type.STRING,
                      description: 'Explicit buy value if provided',
                    },
                    usage: {
                      type: Type.STRING,
                      description: 'Explicit usage info if provided',
                    },
                    specialProperties: {
                      type: Type.STRING,
                      description: 'Explicit special properties if provided',
                    },
                    notes: {
                      type: Type.STRING,
                      description: 'Explicit notes if provided',
                    },
                  },
                  required: ['itemName'],
                },
              },
              warnings: {
                type: Type.ARRAY,
                description: 'Warnings about ambiguous, incomplete, or missing information in the message',
                items: {
                  type: Type.STRING,
                },
              },
            },
            required: ['success', 'summary', 'stateChanges'],
          },
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error('Empty response received from Gemini engine');
      }
      return text;
    },
    { models: modelsToTry, maxRetriesPerModel: 1, initialDelayMs: 400 }
  );

  let parsedJson: any;
  try {
    parsedJson = JSON.parse(responseText.trim());
  } catch (err: any) {
    throw new Error(`Failed to parse Gemini JSON output: ${err.message}`);
  }

  // Pre-normalize values if they were strings of numbers/booleans/JSON
  if (Array.isArray(parsedJson.stateChanges)) {
    parsedJson.stateChanges = parsedJson.stateChanges.map((change: any) => {
      let val = change.value;
      if (typeof val === 'string') {
        const trimmedVal = val.trim();
        // check numeric
        if (/^[+-]?\d+(\.\d+)?$/.test(trimmedVal)) {
          val = parseFloat(trimmedVal);
        } else if (trimmedVal === 'true') {
          val = true;
        } else if (trimmedVal === 'false') {
          val = false;
        } else if ((trimmedVal.startsWith('{') && trimmedVal.endsWith('}')) || (trimmedVal.startsWith('[') && trimmedVal.endsWith(']'))) {
          try {
            val = JSON.parse(trimmedVal);
          } catch {
            // keep as string
          }
        }
      }
      return {
        ...change,
        value: val,
      };
    });
  }

  // Run through state validator
  const validationReport = validateGeminiProcessResult(parsedJson);
  if (!validationReport.valid) {
    throw new Error(`Validation failed: ${validationReport.errors.join('; ')}`);
  }

  return {
    result: validationReport.sanitizedResult,
    usedModel,
  };
}
