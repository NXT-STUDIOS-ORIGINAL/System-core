var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");

// server/gemini/client.ts
var import_genai = require("@google/genai");
var defaultAiClient = null;
function getGeminiClient(customApiKey) {
  const effectiveKey = customApiKey && typeof customApiKey === "string" && customApiKey.trim().length > 0 ? customApiKey.trim() : process.env.GEMINI_API_KEY;
  if (!effectiveKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  if (customApiKey && customApiKey.trim().length > 0) {
    return new import_genai.GoogleGenAI({
      apiKey: customApiKey.trim(),
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  if (!defaultAiClient) {
    defaultAiClient = new import_genai.GoogleGenAI({
      apiKey: effectiveKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return defaultAiClient;
}
function isGeminiConfigured(customApiKey) {
  if (customApiKey && typeof customApiKey === "string" && customApiKey.trim().length > 0) {
    return true;
  }
  return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
}

// server/gemini/systemProcessor.ts
var import_genai2 = require("@google/genai");

// server/gemini/prompts.ts
var GEMINI_SYSTEM_PROCESSOR_INSTRUCTION = `You are the data processing engine for an external progression system (SYSTEM CORE).
Your role is strictly data extraction, summarization, validation, and structured state mutation.

CRITICAL ARCHITECTURAL DIRECTIVE \u2014 STRICT DATA-ONLY MODE:
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
- If recommending important memory, provide the text and a concise reason.
`;
var GEMINI_MODEL_NAME = "gemini-2.5-flash";

// server/gemini/stateValidator.ts
var ALLOWED_OPERATIONS = /* @__PURE__ */ new Set(["SET", "ADD", "REMOVE", "COMPLETE", "UNLOCK", "UPDATE"]);
function normalizeValidationPath(rawPath) {
  let p = (rawPath || "").trim();
  if (p.startsWith("player.")) {
    p = p.substring(7);
  }
  const lower = p.toLowerCase();
  if (lower === "level" || lower === "lvl") return "progression.level";
  if (lower === "xp" || lower === "exp" || lower === "currentxp" || lower === "current_xp") return "progression.currentXP";
  if (lower === "requiredxp" || lower === "required_xp" || lower === "max_xp" || lower === "maxxp") return "progression.requiredXp";
  if (lower === "statpoints" || lower === "stat_points") return "progression.statPoints";
  if (lower === "skillpoints" || lower === "skill_points") return "progression.skillPoints";
  if (lower === "rank") return "progression.rank";
  if (lower === "status") return "status";
  if (lower === "playerid" || lower === "player_id") return "playerId";
  if (lower.startsWith("attribute.")) return "attributes." + p.substring(10);
  if (lower.startsWith("attributes.")) return "attributes." + p.substring(11);
  if (lower.startsWith("skill.")) return "skills." + p.substring(6);
  if (lower.startsWith("skills.")) return "skills." + p.substring(7);
  if (lower.startsWith("quest.")) return "quests." + p.substring(6);
  if (lower.startsWith("quests.")) return "quests." + p.substring(7);
  if (lower.startsWith("item.") || lower.startsWith("items.")) return "inventory." + p.substring(p.indexOf(".") + 1);
  const commonAttrs = ["strength", "agility", "vitality", "intelligence", "perception", "dexterity", "endurance", "wisdom", "charisma", "luck", "speed", "defense", "attack", "mana", "health", "hp", "mp", "stamina"];
  if (commonAttrs.includes(lower) || !p.includes(".") && !["skills", "quests", "achievements", "titles", "inventory", "worldstate", "systemvariables", "importantmemory", "progression"].includes(lower)) {
    const formatted = p.charAt(0).toUpperCase() + p.slice(1);
    return `attributes.${formatted}`;
  }
  return p;
}
var ALLOWED_PATH_PREFIXES = [
  "progression",
  "progression.level",
  "progression.xp",
  "progression.currentXP",
  "progression.requiredXp",
  "progression.requiredXP",
  "progression.maxXp",
  "progression.overflowXp",
  "progression.rank",
  "progression.statPoints",
  "progression.skillPoints",
  "level",
  "xp",
  "status",
  "playerId",
  "attributes",
  "skills",
  "quests",
  "achievements",
  "titles",
  "inventory",
  "worldState",
  "systemVariables",
  "importantMemory"
];
function validateGeminiProcessResult(rawResult) {
  const errors = [];
  const warnings = [];
  if (!rawResult || typeof rawResult !== "object") {
    return {
      valid: false,
      sanitizedResult: {
        success: false,
        summary: "Invalid processing payload",
        stateChanges: [],
        warnings: ["Payload was not an object"],
        confidence: 0
      },
      errors: ["Gemini response is not a valid JSON object"],
      warnings
    };
  }
  const summary = typeof rawResult.summary === "string" && rawResult.summary.trim().length > 0 ? rawResult.summary.trim() : "System event processed.";
  const confidence = typeof rawResult.confidence === "number" ? Math.max(0, Math.min(1, rawResult.confidence)) : 0.95;
  if (Array.isArray(rawResult.warnings)) {
    for (const w of rawResult.warnings) {
      if (typeof w === "string" && w.trim().length > 0) {
        warnings.push(w.trim());
      }
    }
  }
  const sanitizedChanges = [];
  if (Array.isArray(rawResult.stateChanges)) {
    for (const change of rawResult.stateChanges) {
      if (!change || typeof change !== "object") continue;
      const op = String(change.operation || "").toUpperCase();
      const path2 = normalizeValidationPath(String(change.path || ""));
      if (!ALLOWED_OPERATIONS.has(op)) {
        warnings.push(`Ignored unsupported operation: ${op}`);
        continue;
      }
      if (!path2) {
        warnings.push(`Ignored change with empty path for operation ${op}`);
        continue;
      }
      const isAllowedPath = ALLOWED_PATH_PREFIXES.some(
        (prefix) => path2 === prefix || path2.startsWith(prefix + ".")
      );
      if (!isAllowedPath) {
        warnings.push(`Ignored modification to restricted/unknown path: ${path2}`);
        continue;
      }
      if (op === "ADD") {
        if (path2.startsWith("progression.") || path2.startsWith("attributes.") || path2 === "level" || path2 === "xp") {
          const numVal = typeof change.value === "number" ? change.value : parseFloat(String(change.value).replace(/[^0-9.-]/g, ""));
          if (isNaN(numVal)) {
            warnings.push(`ADD operation on '${path2}' requires a numeric value, got '${change.value}'`);
            continue;
          }
          sanitizedChanges.push({
            operation: "ADD",
            path: path2,
            value: numVal,
            id: change.id ? String(change.id) : void 0
          });
          continue;
        }
      }
      sanitizedChanges.push({
        operation: op,
        path: path2,
        value: change.value,
        id: change.id ? String(change.id) : void 0
      });
    }
  }
  const sanitizedImportantMemories = [];
  if (Array.isArray(rawResult.importantMemory)) {
    for (const imp of rawResult.importantMemory) {
      if (!imp) continue;
      const text = typeof imp === "string" ? imp.trim() : imp.text ? String(imp.text).trim() : "";
      const reason = typeof imp === "object" && imp.reason ? String(imp.reason).trim() : void 0;
      if (text) {
        sanitizedImportantMemories.push({ text, reason });
      }
    }
  }
  const sanitizedItemDefinitions = [];
  if (Array.isArray(rawResult.itemDefinitions)) {
    for (const rawItem of rawResult.itemDefinitions) {
      if (!rawItem || typeof rawItem !== "object") continue;
      const itemName = String(rawItem.itemName || rawItem.name || "").trim();
      if (!itemName) continue;
      const cleanItem = { itemName };
      if (rawItem.itemId && String(rawItem.itemId).trim()) cleanItem.itemId = String(rawItem.itemId).trim();
      if (rawItem.description && String(rawItem.description).trim()) cleanItem.description = String(rawItem.description).trim();
      if (rawItem.rank && String(rawItem.rank).trim()) cleanItem.rank = String(rawItem.rank).trim();
      if (rawItem.type && String(rawItem.type).trim()) cleanItem.type = String(rawItem.type).trim();
      if (rawItem.rarity && String(rawItem.rarity).trim()) cleanItem.rarity = String(rawItem.rarity).trim();
      if (typeof rawItem.maximumStack === "number" && !isNaN(rawItem.maximumStack)) cleanItem.maximumStack = rawItem.maximumStack;
      if (rawItem.sellValue !== void 0 && rawItem.sellValue !== "") cleanItem.sellValue = rawItem.sellValue;
      if (rawItem.buyValue !== void 0 && rawItem.buyValue !== "") cleanItem.buyValue = rawItem.buyValue;
      if (rawItem.usage && String(rawItem.usage).trim()) cleanItem.usage = String(rawItem.usage).trim();
      if (rawItem.effects && String(rawItem.effects).trim()) cleanItem.effects = String(rawItem.effects).trim();
      if (rawItem.requirements && String(rawItem.requirements).trim()) cleanItem.requirements = String(rawItem.requirements).trim();
      if (rawItem.keyType && String(rawItem.keyType).trim()) cleanItem.keyType = String(rawItem.keyType).trim();
      if (rawItem.boxType && String(rawItem.boxType).trim()) cleanItem.boxType = String(rawItem.boxType).trim();
      if (rawItem.craftingInformation && String(rawItem.craftingInformation).trim()) cleanItem.craftingInformation = String(rawItem.craftingInformation).trim();
      if (rawItem.specialProperties && String(rawItem.specialProperties).trim()) cleanItem.specialProperties = String(rawItem.specialProperties).trim();
      if (rawItem.notes && String(rawItem.notes).trim()) cleanItem.notes = String(rawItem.notes).trim();
      if (rawItem.icon && String(rawItem.icon).trim()) cleanItem.icon = String(rawItem.icon).trim();
      sanitizedItemDefinitions.push(cleanItem);
    }
  }
  return {
    valid: errors.length === 0,
    sanitizedResult: {
      success: errors.length === 0,
      summary,
      stateChanges: sanitizedChanges,
      itemDefinitions: sanitizedItemDefinitions,
      importantMemory: sanitizedImportantMemories,
      warnings,
      confidence
    },
    errors,
    warnings
  };
}

// server/gemini/retry.ts
var GEMINI_PRIMARY_MODEL = "gemini-2.5-flash";
var GEMINI_FALLBACK_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-3.7-flash",
  "gemini-flash-latest",
  "gemini-1.5-flash",
  "gemini-3.1-flash-lite"
];
function parseErrorDetails(err) {
  if (!err) return { message: "" };
  let rawMessage = String(err.message || err.error?.message || err.toString() || "");
  let code = err.status || err.statusCode || err.code || err.error?.code || err.error?.status;
  let status = err.error?.status || err.status;
  if (rawMessage.startsWith("{") && rawMessage.endsWith("}")) {
    try {
      const parsed = JSON.parse(rawMessage);
      if (parsed.error) {
        code = parsed.error.code || code;
        status = parsed.error.status || status;
        rawMessage = parsed.error.message || rawMessage;
      }
    } catch {
    }
  }
  return { code, status, message: rawMessage.toLowerCase() };
}
function isHighDemandError(err) {
  if (!err) return false;
  const { code, status, message } = parseErrorDetails(err);
  return code === 503 || code === "503" || status === "UNAVAILABLE" || message.includes("high demand") || message.includes("unavailable") || message.includes("spikes in demand") || message.includes("503") || message.includes("try again later") || message.includes("overloaded") || message.includes("temporarily unavailable");
}
async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function executeWithGeminiResilience(operation, options = {}) {
  const models = options.models && options.models.length > 0 ? options.models : GEMINI_FALLBACK_MODELS;
  const maxRetriesPerModel = options.maxRetriesPerModel ?? 1;
  const initialDelayMs = options.initialDelayMs ?? 250;
  const maxDelayMs = options.maxDelayMs ?? 1e3;
  let lastError = null;
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
      } catch (err) {
        lastError = err;
        const { message: errSummary, code } = parseErrorDetails(err);
        console.warn(`[GEMINI ATTEMPT FAILED] Model ${currentModel} attempt ${attempt + 1}: code=${code || "unknown"} msg=${errSummary}`);
        if (code === 404 || code === "404" || errSummary.includes("not found")) {
          if (mIndex < models.length - 1) {
            console.warn(`[GEMINI MODEL NOT FOUND] Model ${currentModel} unavailable. Switching to ${models[mIndex + 1]}`);
            break;
          }
        }
        if (isHighDemandError(err)) {
          if (attempt >= maxRetriesPerModel && mIndex < models.length - 1) {
            console.warn(`[GEMINI HIGH-DEMAND FAILOVER] Model ${currentModel} high demand spike detected. Failing over to next model: ${models[mIndex + 1]}`);
            break;
          }
        }
        if ((code === 429 || code === "429" || errSummary.includes("quota") || errSummary.includes("resource_exhausted")) && mIndex < models.length - 1) {
          console.warn(`[GEMINI QUOTA FAILOVER] Model ${currentModel} quota reached. Switching to ${models[mIndex + 1]}`);
          break;
        }
        if (attempt === maxRetriesPerModel && mIndex < models.length - 1) {
          console.warn(`[GEMINI MODEL EXHAUSTED] Exhausted attempts for ${currentModel}. Switching to fallback model: ${models[mIndex + 1]}`);
        }
      }
    }
  }
  throw lastError || new Error("All Gemini retry attempts and fallback models exhausted");
}

// server/gemini/systemProcessor.ts
async function processSystemInputWithGemini(payload) {
  const {
    rawMessage,
    playerState = {},
    recentMemories = [],
    importantMemories = [],
    stateVersion = 0,
    systemVersion = "1.0.0",
    model,
    customApiKey
  } = payload;
  const ai = getGeminiClient(customApiKey);
  const contextSummary = {
    systemVersion,
    stateVersion,
    currentPlayerState: {
      level: playerState.level ?? playerState.progression?.level ?? 1,
      xp: playerState.xp ?? playerState.progression?.xp ?? 0,
      progression: playerState.progression || {},
      attributes: playerState.attributes || {},
      skills: (playerState.skills || []).map((s) => typeof s === "string" ? s : s.name || s.title),
      activeQuests: (playerState.quests || []).map(
        (q) => typeof q === "string" ? q : `${q.title} [${q.status || "ACTIVE"}]`
      ),
      inventory: (playerState.inventory || []).map(
        (i) => typeof i === "string" ? i : `${i.name}${i.quantity ? ` x${i.quantity}` : ""}`
      )
    },
    recentEventSummaries: recentMemories.slice(-5).map((m) => m.summary),
    importantMemories: importantMemories.slice(-5).map((m) => typeof m === "string" ? m : m.summary || m.text)
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
          temperature: 0.1,
          // Low temperature for high deterministic extraction accuracy
          responseMimeType: "application/json",
          responseSchema: {
            type: import_genai2.Type.OBJECT,
            properties: {
              success: {
                type: import_genai2.Type.BOOLEAN,
                description: "Whether the message was successfully analyzed"
              },
              summary: {
                type: import_genai2.Type.STRING,
                description: "1-2 sentence factual summary of what occurred in this event"
              },
              confidence: {
                type: import_genai2.Type.NUMBER,
                description: "Confidence score between 0.0 and 1.0"
              },
              stateChanges: {
                type: import_genai2.Type.ARRAY,
                description: "List of atomic state operations",
                items: {
                  type: import_genai2.Type.OBJECT,
                  properties: {
                    operation: {
                      type: import_genai2.Type.STRING,
                      description: "SET, ADD, REMOVE, COMPLETE, UNLOCK, or UPDATE"
                    },
                    path: {
                      type: import_genai2.Type.STRING,
                      description: "Target path such as progression.currentXP, progression.level, skills, quests, attributes.Strength"
                    },
                    value: {
                      type: import_genai2.Type.STRING,
                      description: "The value to apply, add, or set (numbers represented as strings or numbers, objects as JSON strings)"
                    },
                    id: {
                      type: import_genai2.Type.STRING,
                      description: "Optional identifier for quest, item, or skill"
                    }
                  },
                  required: ["operation", "path", "value"]
                }
              },
              importantMemory: {
                type: import_genai2.Type.ARRAY,
                description: "Important permanent memories recommended only for major milestones",
                items: {
                  type: import_genai2.Type.OBJECT,
                  properties: {
                    text: {
                      type: import_genai2.Type.STRING,
                      description: "Text of the important memory"
                    },
                    reason: {
                      type: import_genai2.Type.STRING,
                      description: "Why this is considered a key persistent memory"
                    }
                  },
                  required: ["text"]
                }
              },
              itemDefinitions: {
                type: import_genai2.Type.ARRAY,
                description: "Explicit item information supplied directly in the system message (name, rank, description, effects, etc.). Never invent missing fields.",
                items: {
                  type: import_genai2.Type.OBJECT,
                  properties: {
                    itemName: {
                      type: import_genai2.Type.STRING,
                      description: "Exact name of the item"
                    },
                    itemId: {
                      type: import_genai2.Type.STRING,
                      description: "Optional slug or ID"
                    },
                    description: {
                      type: import_genai2.Type.STRING,
                      description: "Description explicitly supplied by the system message"
                    },
                    rank: {
                      type: import_genai2.Type.STRING,
                      description: "Explicit rank (e.g. E, D, C, B, A, S) if provided"
                    },
                    type: {
                      type: import_genai2.Type.STRING,
                      description: "Explicit type (e.g. Loot Box, Key, Consumable, Material) if provided"
                    },
                    rarity: {
                      type: import_genai2.Type.STRING,
                      description: "Explicit rarity if provided"
                    },
                    effects: {
                      type: import_genai2.Type.STRING,
                      description: "Explicit effects or stat changes if provided"
                    },
                    requirements: {
                      type: import_genai2.Type.STRING,
                      description: "Explicit usage requirements if provided"
                    },
                    sellValue: {
                      type: import_genai2.Type.STRING,
                      description: "Explicit sell value if provided"
                    },
                    buyValue: {
                      type: import_genai2.Type.STRING,
                      description: "Explicit buy value if provided"
                    },
                    usage: {
                      type: import_genai2.Type.STRING,
                      description: "Explicit usage info if provided"
                    },
                    specialProperties: {
                      type: import_genai2.Type.STRING,
                      description: "Explicit special properties if provided"
                    },
                    notes: {
                      type: import_genai2.Type.STRING,
                      description: "Explicit notes if provided"
                    }
                  },
                  required: ["itemName"]
                }
              },
              warnings: {
                type: import_genai2.Type.ARRAY,
                description: "Warnings about ambiguous, incomplete, or missing information in the message",
                items: {
                  type: import_genai2.Type.STRING
                }
              }
            },
            required: ["success", "summary", "stateChanges"]
          }
        }
      });
      const text = response.text;
      if (!text) {
        throw new Error("Empty response received from Gemini engine");
      }
      return text;
    },
    { models: modelsToTry, maxRetriesPerModel: 1, initialDelayMs: 400 }
  );
  let parsedJson;
  try {
    parsedJson = JSON.parse(responseText.trim());
  } catch (err) {
    throw new Error(`Failed to parse Gemini JSON output: ${err.message}`);
  }
  if (Array.isArray(parsedJson.stateChanges)) {
    parsedJson.stateChanges = parsedJson.stateChanges.map((change) => {
      let val = change.value;
      if (typeof val === "string") {
        const trimmedVal = val.trim();
        if (/^[+-]?\d+(\.\d+)?$/.test(trimmedVal)) {
          val = parseFloat(trimmedVal);
        } else if (trimmedVal === "true") {
          val = true;
        } else if (trimmedVal === "false") {
          val = false;
        } else if (trimmedVal.startsWith("{") && trimmedVal.endsWith("}") || trimmedVal.startsWith("[") && trimmedVal.endsWith("]")) {
          try {
            val = JSON.parse(trimmedVal);
          } catch {
          }
        }
      }
      return {
        ...change,
        value: val
      };
    });
  }
  const validationReport = validateGeminiProcessResult(parsedJson);
  if (!validationReport.valid) {
    throw new Error(`Validation failed: ${validationReport.errors.join("; ")}`);
  }
  return {
    result: validationReport.sanitizedResult,
    usedModel
  };
}

// server/gemini/contextSummarizer.ts
function categorizeGeminiError(err) {
  if (!err) return "Request rejected";
  const status = err.status || err.statusCode || err.code || err.error?.code || err.error?.status;
  const msg = String(err.message || err.error?.message || err.toString() || "").toLowerCase();
  if (status === 401 || status === "UNAUTHENTICATED" || msg.includes("api_key_invalid") || msg.includes("api key not valid") || msg.includes("invalid api key") || msg.includes("api key expired")) {
    return "Invalid API key";
  }
  if (status === 404 || status === "NOT_FOUND" || status === 503 || status === "UNAVAILABLE" || msg.includes("503") || msg.includes("high demand") || msg.includes("unavailable") || msg.includes("not found") || msg.includes("no longer available") || msg.includes("is not found") || msg.includes("spikes in demand")) {
    return "Model unavailable";
  }
  if (status === 429 || status === "RESOURCE_EXHAUSTED" || msg.includes("quota") || msg.includes("rate limit") || msg.includes("resource exhausted") || msg.includes("too many requests")) {
    return "Quota exceeded";
  }
  if (status === 403 || status === "PERMISSION_DENIED" || msg.includes("permission denied") || msg.includes("forbidden")) {
    return "Permission error";
  }
  if (msg.includes("fetch failed") || msg.includes("econnreset") || msg.includes("timeout") || msg.includes("socket hang up") || msg.includes("network") || msg.includes("enotfound")) {
    return "Network error";
  }
  return "Request rejected";
}
async function testGeminiHealth(options = {}) {
  const start = Date.now();
  const targetModel = options.selectedModel?.trim() || GEMINI_PRIMARY_MODEL;
  try {
    const ai = getGeminiClient(options.customApiKey);
    const modelsToTry = [targetModel, ...GEMINI_FALLBACK_MODELS.filter((m) => m !== targetModel)];
    const { result, usedModel } = await executeWithGeminiResilience(
      async (modelName) => {
        const res = await ai.models.generateContent({
          model: modelName,
          contents: "Respond with the single word: READY"
        });
        return res.text?.trim() || "READY";
      },
      { models: modelsToTry, maxRetriesPerModel: 1, initialDelayMs: 300 }
    );
    const latencyMs = Date.now() - start;
    return {
      ok: true,
      model: usedModel,
      latencyMs,
      message: result
    };
  } catch (err) {
    const category = categorizeGeminiError(err);
    const latencyMs = Date.now() - start;
    const safeErrorMsg = err?.message || "Connection test failed";
    return {
      ok: false,
      model: targetModel,
      latencyMs,
      category,
      message: `${category}: ${safeErrorMsg}`
    };
  }
}
async function listAvailableGeminiModels(customApiKey) {
  const defaultCuratedList = [
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", description: "Recommended - High availability, multimodal with rapid structured JSON analysis", isRecommended: true },
    { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite", description: "High throughput, ultra-low latency lightweight model", isRecommended: false },
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", description: "Fast multimodal generation and robust structured reasoning", isRecommended: false },
    { id: "gemini-3.7-flash", name: "Gemini 3.7 Flash", description: "Multimodal model with advanced reasoning capabilities", isRecommended: false },
    { id: "gemini-flash-latest", name: "Gemini Flash (Auto-updated)", description: "Always points to latest stable Flash version", isRecommended: false },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", description: "Complex reasoning and deep narrative state logic", isRecommended: false }
  ];
  try {
    const ai = getGeminiClient(customApiKey);
    const response = await ai.models.list();
    const modelsList = [];
    if (response) {
      for await (const m of response) {
        const rawName = m.name || "";
        const cleanId = rawName.replace(/^models\//, "");
        if (cleanId.startsWith("gemini-") && !cleanId.includes("embedding") && !cleanId.includes("aqa") && !cleanId.includes("imagen") && !cleanId.includes("veo")) {
          modelsList.push({
            id: cleanId,
            name: m.displayName || cleanId,
            description: m.description || void 0,
            isRecommended: cleanId === "gemini-2.5-flash"
          });
        }
      }
    }
    if (modelsList.length > 0) {
      modelsList.sort((a, b) => {
        if (a.isRecommended) return -1;
        if (b.isRecommended) return 1;
        return a.id.localeCompare(b.id);
      });
      return modelsList;
    }
  } catch (err) {
    console.warn("[GEMINI MODELS] Could not query models list dynamically, returning curated set:", err?.message);
  }
  return defaultCuratedList;
}

// server.ts
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json({ limit: "10mb" }));
  app.use(import_express.default.urlencoded({ extended: true, limit: "10mb" }));
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      service: "SYSTEM CORE ENGINE",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      geminiConfigured: isGeminiConfigured(),
      model: GEMINI_MODEL_NAME
    });
  });
  app.get("/api/gemini/status", (req, res) => {
    const customKey = req.headers["x-gemini-api-key"] || void 0;
    const configured = isGeminiConfigured(customKey);
    res.json({
      configured,
      status: configured ? "CONFIGURED" : "NOT CONFIGURED",
      model: GEMINI_MODEL_NAME,
      hasServerEnvKey: isGeminiConfigured(),
      message: configured ? "Gemini API key active." : "No Gemini API key detected."
    });
  });
  app.post("/api/gemini/models", async (req, res) => {
    const customKey = req.headers["x-gemini-api-key"] || req.body?.apiKey || void 0;
    try {
      const models = await listAvailableGeminiModels(customKey);
      res.json({
        success: true,
        models
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message || "Failed to list Gemini models"
      });
    }
  });
  app.get("/api/gemini/models", async (req, res) => {
    const customKey = req.headers["x-gemini-api-key"] || void 0;
    try {
      const models = await listAvailableGeminiModels(customKey);
      res.json({
        success: true,
        models
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message || "Failed to list Gemini models"
      });
    }
  });
  app.post("/api/gemini/test-connection", async (req, res) => {
    const customKey = req.headers["x-gemini-api-key"] || req.body?.apiKey || void 0;
    const selectedModel = req.body?.model || void 0;
    if (!isGeminiConfigured(customKey)) {
      return res.status(400).json({
        connected: false,
        model: selectedModel || GEMINI_MODEL_NAME,
        category: "Invalid API key",
        error: "No Gemini API key provided or found in environment."
      });
    }
    try {
      const health = await testGeminiHealth({
        customApiKey: customKey,
        selectedModel
      });
      if (health.ok) {
        res.json({
          connected: true,
          model: health.model,
          latencyMs: health.latencyMs,
          message: "Gemini Connection \u2713"
        });
      } else {
        res.status(200).json({
          connected: false,
          model: health.model,
          latencyMs: health.latencyMs,
          category: health.category || "Request rejected",
          error: health.message || "Connection test failed"
        });
      }
    } catch (err) {
      const category = categorizeGeminiError(err);
      res.status(200).json({
        connected: false,
        model: selectedModel || GEMINI_MODEL_NAME,
        category,
        error: err.message || "Failed to communicate with Gemini API"
      });
    }
  });
  app.post("/api/gemini/process-system-input", async (req, res) => {
    const customKey = req.headers["x-gemini-api-key"] || req.body?.apiKey || void 0;
    const {
      rawMessage,
      playerState,
      recentMemories,
      importantMemories,
      stateVersion,
      systemVersion,
      model
    } = req.body;
    if (!rawMessage || typeof rawMessage !== "string" || !rawMessage.trim()) {
      return res.status(400).json({
        success: false,
        error: "rawMessage string is required in request body."
      });
    }
    if (!isGeminiConfigured(customKey)) {
      return res.status(503).json({
        success: false,
        error: "GEMINI_API_KEY is not configured.",
        notConfigured: true
      });
    }
    try {
      const { result, usedModel } = await processSystemInputWithGemini({
        rawMessage,
        playerState,
        recentMemories,
        importantMemories,
        stateVersion,
        systemVersion,
        model,
        customApiKey: customKey
      });
      res.json({
        success: true,
        data: result,
        model: usedModel,
        processedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (err) {
      console.error("Gemini System Processing error:", err?.message);
      const category = categorizeGeminiError(err);
      const isQuota = category === "Quota exceeded";
      res.status(isQuota ? 429 : 500).json({
        success: false,
        category,
        isQuotaExceeded: isQuota,
        error: err.message || "Gemini processing failed",
        model: model || GEMINI_MODEL_NAME
      });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SYSTEM CORE] Server running on http://0.0.0.0:${PORT}`);
  });
}
startServer().catch((err) => {
  console.error("Fatal server startup error:", err);
  process.exit(1);
});
//# sourceMappingURL=server.cjs.map
