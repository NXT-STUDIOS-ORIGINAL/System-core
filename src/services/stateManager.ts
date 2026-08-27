import {
  PlayerState,
  StateChangeSummary,
  MemoryEntry,
  QuestItem,
  SkillItem,
  AchievementItem,
  InventoryItem,
  GeminiProcessResult,
  GeminiStateChange,
} from '../types';
import { sanitizeInventory, normalizeItemName, getItemQuantity } from './inventoryManager';
import { getPlayerCoins, setPlayerCoins, transactPlayerCurrency } from './currencyManager';

/**
 * Parses numeric value from state string or number
 */
export function extractNumeric(val: any, fallback: number = 0): number {
  if (typeof val === 'number' && !isNaN(val)) return val;
  if (typeof val === 'string') {
    // If it's a ratio like "600 / 1500", extract the first number
    const match = val.match(/^([+-]?\d+(?:\.\d+)?)/);
    if (match) {
      const parsed = parseFloat(match[1]);
      if (!isNaN(parsed)) return parsed;
    }
    const parsed = parseFloat(val.replace(/[^0-9.-]/g, ''));
    if (!isNaN(parsed)) return parsed;
  }
  return fallback;
}

/**
 * Extracts current XP and required XP from an XP value or progression object
 */
export function extractXpComponents(
  xpVal: any,
  progression: Record<string, any> = {}
): { currentXp: number; requiredXp?: number; isRatio: boolean } {
  let curr = 0;
  let req: number | undefined = undefined;
  let isRatio = false;

  // 1. If xpVal is string ratio e.g. "600 / 1500" or "50/2400"
  if (typeof xpVal === 'string' && xpVal.includes('/')) {
    const parts = xpVal.split('/');
    curr = extractNumeric(parts[0], 0);
    const parsedReq = extractNumeric(parts[1], 0);
    if (parsedReq > 0) {
      req = parsedReq;
      isRatio = true;
    }
  } else if (xpVal !== undefined && xpVal !== null && xpVal !== '') {
    curr = extractNumeric(xpVal, 0);
  } else if (progression.currentXP !== undefined && progression.currentXP !== null) {
    curr = extractNumeric(progression.currentXP, 0);
  } else if (progression.xp !== undefined && progression.xp !== null) {
    if (typeof progression.xp === 'string' && progression.xp.includes('/')) {
      const parts = progression.xp.split('/');
      curr = extractNumeric(parts[0], 0);
      const parsedReq = extractNumeric(parts[1], 0);
      if (parsedReq > 0) {
        req = parsedReq;
        isRatio = true;
      }
    } else {
      curr = extractNumeric(progression.xp, 0);
    }
  }

  // 2. Check for requiredXP in progression
  if (req === undefined) {
    const explicitReq = progression.requiredXP ?? progression.requiredXp ?? progression.maxXp;
    if (explicitReq !== undefined && explicitReq !== null) {
      const parsedReq = extractNumeric(explicitReq, 0);
      if (parsedReq > 0) {
        req = parsedReq;
        isRatio = true;
      }
    }
  }

  return {
    currentXp: curr,
    requiredXp: req,
    isRatio,
  };
}

/**
 * Formats XP display string from current and optional required XP
 */
export function formatXpDisplay(currentXp: number | string, requiredXp?: number | string): string {
  if (requiredXp !== undefined && requiredXp !== null && String(requiredXp).trim() !== '') {
    return `${currentXp} / ${requiredXp}`;
  }
  return String(currentXp);
}

/**
 * Normalizes state mutation paths
 */
export function normalizePath(rawPath: string): string {
  let p = (rawPath || '').trim();
  if (p.startsWith('player.')) {
    p = p.substring(7);
  }
  const lower = p.toLowerCase();
  if (lower === 'level' || lower === 'lvl') return 'progression.level';
  if (lower === 'xp' || lower === 'exp' || lower === 'currentxp' || lower === 'current_xp') return 'progression.currentXP';
  if (lower === 'requiredxp' || lower === 'required_xp' || lower === 'max_xp' || lower === 'maxxp') return 'progression.requiredXp';
  if (lower === 'statpoints' || lower === 'stat_points') return 'progression.statPoints';
  if (lower === 'skillpoints' || lower === 'skill_points') return 'progression.skillPoints';
  if (lower === 'rank') return 'progression.rank';
  if (lower === 'status') return 'status';
  if (lower === 'playerid' || lower === 'player_id') return 'playerId';
  if (lower === 'currency.coins' || lower === 'coins' || lower === 'currency' || lower === 'gold') return 'currency.coins';

  if (lower.startsWith('attribute.')) return 'attributes.' + p.substring(10);
  if (lower.startsWith('attributes.')) return 'attributes.' + p.substring(11);
  if (lower.startsWith('skill.')) return 'skills.' + p.substring(6);
  if (lower.startsWith('skills.')) return 'skills.' + p.substring(7);
  if (lower.startsWith('quest.')) return 'quests.' + p.substring(6);
  if (lower.startsWith('quests.')) return 'quests.' + p.substring(7);
  if (lower.startsWith('item.') || lower.startsWith('items.')) return 'inventory.' + p.substring(p.indexOf('.') + 1);

  const commonAttrs = ['strength', 'agility', 'vitality', 'intelligence', 'perception', 'dexterity', 'endurance', 'wisdom', 'charisma', 'luck', 'speed', 'defense', 'attack', 'mana', 'health', 'hp', 'mp', 'stamina'];
  if (commonAttrs.includes(lower) || (!p.includes('.') && !['skills', 'quests', 'achievements', 'titles', 'inventory', 'worldstate', 'systemvariables', 'importantmemory', 'progression'].includes(lower))) {
    const formatted = p.charAt(0).toUpperCase() + p.slice(1);
    return `attributes.${formatted}`;
  }

  return p;
}

/**
 * Applies structured state changes returned by Gemini with strict safety & validation.
 */
export function applyStructuredGeminiChanges(
  currentState: PlayerState,
  geminiResult: GeminiProcessResult,
  options: {
    eventId?: string;
    maxRecentMemory?: number;
    incrementVersion?: boolean;
  } = {}
): { updatedState: PlayerState; didChange: boolean } {
  const maxMemory = options.maxRecentMemory ?? 50;
  const nowIso = new Date().toISOString();
  let didChange = false;

  // Deep clone to ensure pure immutability
  const next: PlayerState = {
    ...currentState,
    currency: { ...(currentState.currency || { coins: getPlayerCoins(currentState) }) },
    coins: getPlayerCoins(currentState),
    progression: { ...(currentState.progression || { level: currentState.level || 1, xp: currentState.xp || 0 }) },
    attributes: { ...(currentState.attributes || {}) },
    skills: [...(currentState.skills || [])],
    quests: [...(currentState.quests || [])],
    achievements: [...(currentState.achievements || [])],
    titles: [...(currentState.titles || [])],
    inventory: [...(currentState.inventory || [])],
    worldState: { ...(currentState.worldState || {}) },
    systemVariables: { ...(currentState.systemVariables || {}) },
    importantMemory: [...(currentState.importantMemory || [])],
    recentMemory: [...(currentState.recentMemory || [])],
  };

  // Process all stateChanges from Gemini
  const changes = geminiResult.stateChanges || [];

  for (const change of changes) {
    if (!change || !change.operation || !change.path) continue;

    const op = change.operation;
    const path = normalizePath(change.path);
    const val = change.value;

    // 1. PROGRESSION & XP OPERATIONS
    if (
      path === 'progression.currentXP' ||
      path === 'progression.xp' ||
      path === 'xp'
    ) {
      const xpInfo = extractXpComponents(next.xp, next.progression);

      if (op === 'ADD') {
        const delta = extractNumeric(val, 0);
        const newCurr = Math.max(0, xpInfo.currentXp + delta);
        next.progression.currentXP = newCurr;
        if (xpInfo.requiredXp !== undefined) {
          next.progression.requiredXp = xpInfo.requiredXp;
          next.xp = formatXpDisplay(newCurr, xpInfo.requiredXp);
          next.progression.xp = formatXpDisplay(newCurr, xpInfo.requiredXp);
        } else {
          next.xp = String(newCurr);
          next.progression.xp = newCurr;
        }
        didChange = true;
      } else if (op === 'SET') {
        if (typeof val === 'string' && val.includes('/')) {
          // Setting full ratio like "0 / 2400"
          const parsed = extractXpComponents(val);
          next.progression.currentXP = parsed.currentXp;
          if (parsed.requiredXp !== undefined) {
            next.progression.requiredXp = parsed.requiredXp;
          }
          next.xp = val;
          next.progression.xp = val;
        } else {
          const num = extractNumeric(val, 0);
          next.progression.currentXP = num;
          if (xpInfo.requiredXp !== undefined) {
            next.xp = formatXpDisplay(num, xpInfo.requiredXp);
            next.progression.xp = formatXpDisplay(num, xpInfo.requiredXp);
          } else {
            next.xp = String(num);
            next.progression.xp = num;
          }
        }
        didChange = true;
      }
    } else if (
      path === 'progression.requiredXp' ||
      path === 'progression.requiredXP' ||
      path === 'progression.maxXp'
    ) {
      if (op === 'SET' || op === 'ADD') {
        const num = extractNumeric(val);
        next.progression.requiredXp = num;
        const xpInfo = extractXpComponents(next.xp, next.progression);
        next.xp = formatXpDisplay(xpInfo.currentXp, num);
        next.progression.xp = formatXpDisplay(xpInfo.currentXp, num);
        didChange = true;
      }
    } else if (path === 'progression.level' || path === 'level') {
      if (op === 'SET') {
        const lvl = typeof val === 'number' ? val : extractNumeric(val, 1);
        next.level = String(lvl);
        next.progression.level = lvl;
        didChange = true;
      } else if (op === 'ADD') {
        const delta = extractNumeric(val, 0);
        const currLvl = extractNumeric(next.level, 1);
        const newLvl = Math.max(1, currLvl + delta);
        next.level = String(newLvl);
        next.progression.level = newLvl;
        didChange = true;
      }
    } else if (path.startsWith('progression.')) {
      const prop = path.replace('progression.', '');
      if (op === 'ADD') {
        const curr = extractNumeric(next.progression[prop], 0);
        next.progression[prop] = curr + extractNumeric(val, 0);
        didChange = true;
      } else if (op === 'SET') {
        next.progression[prop] = val;
        didChange = true;
      }
    } else if (path === 'status') {
      if (op === 'SET') {
        next.status = String(val);
        didChange = true;
      }
    } else if (path === 'playerId') {
      if (op === 'SET') {
        next.playerId = String(val);
        didChange = true;
      }
    }
    // 2. ATTRIBUTES
    else if (path.startsWith('attributes.')) {
      const rawAttrName = path.replace('attributes.', '').trim();
      if (rawAttrName) {
        const existingKey = Object.keys(next.attributes).find(
          (k) => k.toLowerCase() === rawAttrName.toLowerCase()
        ) || rawAttrName;

        if (op === 'ADD') {
          const curr = extractNumeric(next.attributes[existingKey], 0);
          next.attributes[existingKey] = curr + extractNumeric(val, 0);
          didChange = true;
        } else if (op === 'SET') {
          next.attributes[existingKey] = val;
          didChange = true;
        }
      }
    } else if (path === 'attributes') {
      if (op === 'SET' || op === 'UPDATE') {
        if (typeof val === 'object' && val !== null) {
          next.attributes = { ...next.attributes, ...val };
          didChange = true;
        }
      }
    }
    // 3. SKILLS
    else if (path === 'skills' || path.startsWith('skills.')) {
      if (op === 'UNLOCK' || op === 'ADD') {
        const skillName = typeof val === 'string' ? val.trim() : (val?.name ? String(val.name).trim() : '');
        if (skillName) {
          const exists = next.skills.some((s) => {
            const name = typeof s === 'string' ? s.trim() : s.name?.trim();
            return name?.toLowerCase() === skillName.toLowerCase();
          });
          if (!exists) {
            next.skills.push(typeof val === 'object' ? val : skillName);
            didChange = true;
          }
        }
      } else if (op === 'REMOVE') {
        const skillName = typeof val === 'string' ? val.trim() : (val?.name ? String(val.name).trim() : '');
        if (skillName) {
          next.skills = next.skills.filter((s) => {
            const name = typeof s === 'string' ? s.trim() : s.name?.trim();
            return name?.toLowerCase() !== skillName.toLowerCase();
          });
          didChange = true;
        }
      }
    }
    // 4. QUESTS
    else if (path === 'quests' || path.startsWith('quests.')) {
      const questTitle = typeof val === 'string'
        ? val.trim()
        : (val?.title ? String(val.title).trim() : (change.id || ''));

      if (questTitle) {
        const existingIdx = next.quests.findIndex((q) => {
          const t = typeof q === 'string' ? q.trim() : q.title?.trim();
          const id = typeof q === 'object' ? q.id : undefined;
          return (
            (t && t.toLowerCase() === questTitle.toLowerCase()) ||
            (id && change.id && id.toLowerCase() === change.id.toLowerCase())
          );
        });

        if (op === 'COMPLETE') {
          if (existingIdx >= 0) {
            const existing = next.quests[existingIdx];
            if (typeof existing === 'object') {
              next.quests[existingIdx] = {
                ...existing,
                status: 'COMPLETED',
                completedAt: nowIso,
              };
            } else {
              next.quests[existingIdx] = {
                title: existing,
                status: 'COMPLETED',
                completedAt: nowIso,
              };
            }
          } else {
            next.quests.push({
              id: change.id,
              title: questTitle,
              status: 'COMPLETED',
              completedAt: nowIso,
            });
          }
          didChange = true;
        } else if (op === 'ADD' || op === 'UNLOCK') {
          if (existingIdx === -1) {
            const newQuest: QuestItem = typeof val === 'object'
              ? { status: 'ACTIVE', ...val, title: questTitle }
              : { title: questTitle, status: 'ACTIVE' };
            next.quests.push(newQuest);
            didChange = true;
          }
          // Clear pending refresh request when new quests are supplied by System Controller
          next.dailyQuestRefreshRequired = false;
          next.questRefreshRequested = false;
          next.questRefreshRequestedAt = undefined;
          next.questRefreshAvailable = false;
        } else if (op === 'UPDATE' || op === 'SET') {
          if (existingIdx >= 0) {
            const existing = next.quests[existingIdx];
            const updated = typeof val === 'object'
              ? { ...(typeof existing === 'object' ? existing : { title: existing }), ...val }
              : { title: questTitle, status: 'ACTIVE' };
            next.quests[existingIdx] = updated;
          } else {
            const newQuest: QuestItem = typeof val === 'object'
              ? { status: 'ACTIVE', ...val, title: questTitle }
              : { title: questTitle, status: 'ACTIVE' };
            next.quests.push(newQuest);
          }
          didChange = true;
          // Clear pending refresh request when quests are supplied/updated by System Controller
          next.dailyQuestRefreshRequired = false;
          next.questRefreshRequested = false;
          next.questRefreshRequestedAt = undefined;
          next.questRefreshAvailable = false;
        } else if (op === 'REMOVE') {
          if (existingIdx >= 0) {
            next.quests.splice(existingIdx, 1);
            didChange = true;
          }
        }
      }
    }
    // 5. ACHIEVEMENTS & TITLES
    else if (path === 'achievements' || path.startsWith('achievements.')) {
      if (op === 'UNLOCK' || op === 'ADD') {
        const title = typeof val === 'string' ? val.trim() : (val?.title ? String(val.title).trim() : '');
        if (title) {
          const exists = next.achievements.some((a) => {
            const t = typeof a === 'string' ? a.trim() : a.title?.trim();
            return t?.toLowerCase() === title.toLowerCase();
          });
          if (!exists) {
            next.achievements.push(
              typeof val === 'object' ? { unlockedAt: nowIso, ...val } : { title, unlockedAt: nowIso }
            );
            didChange = true;
          }
        }
      }
    } else if (path === 'titles' || path.startsWith('titles.')) {
      if (op === 'UNLOCK' || op === 'ADD') {
        const title = typeof val === 'string' ? val.trim() : String(val).trim();
        if (title && !next.titles.some((t) => t.toLowerCase() === title.toLowerCase())) {
          next.titles.push(title);
          didChange = true;
        }
      }
    }
    // 6. INVENTORY
    else if (path === 'inventory' || path.startsWith('inventory.')) {
      const itemName = typeof val === 'string'
        ? val.trim()
        : (val?.name ? String(val.name).trim() : (change.id || ''));

      if (itemName) {
        const cleanTarget = normalizeItemName(itemName).toLowerCase();
        const existingIdx = next.inventory.findIndex((i) => {
          return normalizeItemName(i).toLowerCase() === cleanTarget;
        });

        if (op === 'ADD' || op === 'UPDATE') {
          const addQty = typeof val === 'object' && val.quantity ? Math.max(1, val.quantity) : 1;
          if (existingIdx >= 0) {
            const existing = next.inventory[existingIdx];
            const currentQty = getItemQuantity(existing);
            const newQty = currentQty + addQty;
            next.inventory[existingIdx] = typeof existing === 'object'
              ? { ...existing, quantity: newQty }
              : { name: normalizeItemName(existing), quantity: newQty };
          } else {
            next.inventory.push(typeof val === 'object' ? { ...val, name: normalizeItemName(itemName), quantity: addQty } : { name: normalizeItemName(itemName), quantity: addQty });
          }
          next.inventory = sanitizeInventory(next.inventory);
          didChange = true;
        } else if (op === 'REMOVE') {
          if (existingIdx >= 0) {
            const existing = next.inventory[existingIdx];
            const currentQty = getItemQuantity(existing);
            const removeQty = typeof val === 'object' && val.quantity ? Math.max(1, val.quantity) : 1;
            const remaining = currentQty - removeQty;
            if (remaining <= 0) {
              next.inventory.splice(existingIdx, 1);
            } else {
              next.inventory[existingIdx] = typeof existing === 'object'
                ? { ...existing, quantity: remaining }
                : { name: normalizeItemName(existing), quantity: remaining };
            }
            next.inventory = sanitizeInventory(next.inventory);
            didChange = true;
          }
        }
      }
    }
    // 7. WORLD STATE & SYSTEM VARIABLES
    else if (path.startsWith('worldState.')) {
      const key = path.replace('worldState.', '');
      next.worldState[key] = val;
      didChange = true;
    } else if (path.startsWith('systemVariables.')) {
      const key = path.replace('systemVariables.', '');
      next.systemVariables[key] = val;
      didChange = true;
    }
  }

  // 8. IMPORTANT MEMORY
  if (Array.isArray(geminiResult.importantMemory) && geminiResult.importantMemory.length > 0) {
    for (const imp of geminiResult.importantMemory as any[]) {
      const text = typeof imp === 'string' ? imp.trim() : (imp && typeof imp === 'object' && imp.text ? String(imp.text).trim() : '');
      if (!text) continue;

      const alreadyExists = next.importantMemory.some((m) => {
        const s = typeof m === 'string' ? m : m.summary;
        return s?.toLowerCase() === text.toLowerCase();
      });

      if (!alreadyExists) {
        const memEntry: MemoryEntry = {
          id: `mem_imp_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
          timestamp: nowIso,
          summary: text,
          sourceEventId: options.eventId,
          importance: 'high',
          category: 'milestone',
        };
        next.importantMemory.push(memEntry);
        didChange = true;
      }
    }
  }

  // 9. RECENT MEMORY (Rolling memory pool governed by limit)
  if (geminiResult.summary && geminiResult.summary.trim()) {
    const recentEntry: MemoryEntry = {
      id: `mem_rec_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: nowIso,
      summary: geminiResult.summary.trim(),
      sourceEventId: options.eventId,
      importance: 'normal',
    };

    const updatedRecent = [...next.recentMemory, recentEntry];
    if (updatedRecent.length > maxMemory) {
      next.recentMemory = updatedRecent.slice(updatedRecent.length - maxMemory);
    } else {
      next.recentMemory = updatedRecent;
    }
    didChange = true;
  }

  // 10. Increment stateVersion if state was modified
  if (didChange && options.incrementVersion !== false) {
    next.stateVersion = (currentState.stateVersion ?? 0) + 1;
  }

  return { updatedState: next, didChange };
}

/**
 * Pure function to apply state changes to PlayerState (fallback parser mode).
 */
export function applyStateChanges(
  currentState: PlayerState,
  changes: StateChangeSummary,
  options: {
    maxRecentMemory?: number;
    incrementVersion?: boolean;
    eventId?: string;
  } = {}
): { updatedState: PlayerState; didChange: boolean } {
  const maxMemory = options.maxRecentMemory ?? 50;
  let didChange = false;

  // Deep clone to ensure immutability
  const next: PlayerState = {
    ...currentState,
    progression: { ...(currentState.progression || { level: currentState.level || 1, xp: currentState.xp || 0 }) },
    attributes: { ...(currentState.attributes || {}) },
    skills: [...(currentState.skills || [])],
    quests: [...(currentState.quests || [])],
    achievements: [...(currentState.achievements || [])],
    titles: [...(currentState.titles || [])],
    inventory: [...(currentState.inventory || [])],
    worldState: { ...(currentState.worldState || {}) },
    systemVariables: { ...(currentState.systemVariables || {}) },
    importantMemory: [...(currentState.importantMemory || [])],
    recentMemory: [...(currentState.recentMemory || [])],
  };

  // Progression Updates (XP & Level)
  if (changes.progressionUpdates) {
    if (changes.progressionUpdates.xpDelta !== undefined) {
      const xpInfo = extractXpComponents(currentState.xp, currentState.progression);
      const newXp = Math.max(0, xpInfo.currentXp + changes.progressionUpdates.xpDelta);
      const req = changes.progressionUpdates.requiredXp ?? changes.progressionUpdates.requiredXP ?? changes.progressionUpdates.maxXp ?? xpInfo.requiredXp;
      next.progression.currentXP = newXp;
      if (req !== undefined) {
        next.progression.requiredXp = req;
        next.progression.requiredXP = req;
        next.xp = formatXpDisplay(newXp, req);
        next.progression.xp = formatXpDisplay(newXp, req);
      } else {
        next.xp = String(newXp);
        next.progression.xp = newXp;
      }
      didChange = true;
    } else if (changes.progressionUpdates.xp !== undefined) {
      const newXp = changes.progressionUpdates.xp;
      const xpInfo = extractXpComponents(newXp, currentState.progression);
      const req = changes.progressionUpdates.requiredXp ?? changes.progressionUpdates.requiredXP ?? changes.progressionUpdates.maxXp ?? xpInfo.requiredXp;
      next.progression.currentXP = xpInfo.currentXp;
      if (req !== undefined) {
        next.progression.requiredXp = req;
        next.progression.requiredXP = req;
        next.xp = formatXpDisplay(xpInfo.currentXp, req);
        next.progression.xp = formatXpDisplay(xpInfo.currentXp, req);
      } else {
        next.xp = String(xpInfo.currentXp);
        next.progression.xp = xpInfo.currentXp;
      }
      didChange = true;
    } else if (
      changes.progressionUpdates.requiredXp !== undefined ||
      changes.progressionUpdates.requiredXP !== undefined ||
      changes.progressionUpdates.maxXp !== undefined
    ) {
      const req = extractNumeric(
        changes.progressionUpdates.requiredXp ??
        changes.progressionUpdates.requiredXP ??
        changes.progressionUpdates.maxXp
      );
      const xpInfo = extractXpComponents(currentState.xp, currentState.progression);
      next.progression.requiredXp = req;
      next.progression.requiredXP = req;
      next.xp = formatXpDisplay(xpInfo.currentXp, req);
      next.progression.xp = formatXpDisplay(xpInfo.currentXp, req);
      didChange = true;
    }

    if (changes.progressionUpdates.levelDelta !== undefined) {
      const currentLevel = extractNumeric(currentState.level, 1);
      const newLevel = Math.max(1, currentLevel + changes.progressionUpdates.levelDelta);
      next.level = String(newLevel);
      next.progression.level = newLevel;
      didChange = true;
    } else if (changes.progressionUpdates.level !== undefined) {
      const newLevel = changes.progressionUpdates.level;
      next.level = String(newLevel);
      next.progression.level = newLevel;
      didChange = true;
    }

    for (const [k, v] of Object.entries(changes.progressionUpdates)) {
      if (k !== 'xp' && k !== 'xpDelta' && k !== 'level' && k !== 'levelDelta') {
        next.progression[k] = v;
        didChange = true;
      }
    }
  }

  // Attributes
  if (changes.attributesUpdated && Object.keys(changes.attributesUpdated).length > 0) {
    for (const [attrName, valObj] of Object.entries(changes.attributesUpdated)) {
      if (valObj && typeof valObj === 'object' && 'isDelta' in valObj) {
        if (valObj.isDelta) {
          const currentVal = extractNumeric(next.attributes[attrName], 0);
          next.attributes[attrName] = currentVal + valObj.value;
        } else {
          next.attributes[attrName] = valObj.value;
        }
      } else {
        next.attributes[attrName] = valObj;
      }
      didChange = true;
    }
  }

  // Skills
  if (changes.skillsAdded && changes.skillsAdded.length > 0) {
    for (const newSkill of changes.skillsAdded) {
      const skillName = typeof newSkill === 'string' ? newSkill.trim() : newSkill.name?.trim();
      if (!skillName) continue;

      const exists = next.skills.some((s) => {
        const existingName = typeof s === 'string' ? s.trim() : s.name?.trim();
        return existingName?.toLowerCase() === skillName.toLowerCase();
      });

      if (!exists) {
        next.skills.push(newSkill);
        didChange = true;
      }
    }
  }

  // Quests
  if (changes.questsUpdated && changes.questsUpdated.length > 0) {
    for (const questUpdate of changes.questsUpdated) {
      const qTitle = typeof questUpdate === 'string' ? questUpdate.trim() : questUpdate.title?.trim();
      if (!qTitle) continue;

      const existingIndex = next.quests.findIndex((q) => {
        const title = typeof q === 'string' ? q.trim() : q.title?.trim();
        return title?.toLowerCase() === qTitle.toLowerCase();
      });

      if (existingIndex >= 0) {
        const existing = next.quests[existingIndex];
        if (typeof questUpdate === 'object') {
          next.quests[existingIndex] = typeof existing === 'object'
            ? { ...existing, ...questUpdate }
            : questUpdate;
        } else {
          next.quests[existingIndex] = questUpdate;
        }
        didChange = true;
      } else {
        next.quests.push(questUpdate);
        didChange = true;
      }
    }
    // Clear pending refresh request when new quests are supplied by System Controller
    next.dailyQuestRefreshRequired = false;
    next.questRefreshRequested = false;
    next.questRefreshRequestedAt = undefined;
    next.questRefreshAvailable = false;
  }

  // Achievements
  if (changes.achievementsAdded && changes.achievementsAdded.length > 0) {
    for (const ach of changes.achievementsAdded) {
      const title = typeof ach === 'string' ? ach.trim() : ach.title?.trim();
      if (!title) continue;

      const exists = next.achievements.some((a) => {
        const existingTitle = typeof a === 'string' ? a.trim() : a.title?.trim();
        return existingTitle?.toLowerCase() === title.toLowerCase();
      });

      if (!exists) {
        next.achievements.push(ach);
        didChange = true;
      }
    }
  }

  // Titles
  if (changes.titlesAdded && changes.titlesAdded.length > 0) {
    for (const title of changes.titlesAdded) {
      const trimmed = title.trim();
      if (!trimmed) continue;

      const exists = next.titles.some((t) => t.toLowerCase() === trimmed.toLowerCase());
      if (!exists) {
        next.titles.push(trimmed);
        didChange = true;
      }
    }
  }

  // Inventory Additions / Updates
  if (changes.inventoryUpdated && changes.inventoryUpdated.length > 0) {
    for (const item of changes.inventoryUpdated) {
      const cleanName = normalizeItemName(item);
      if (!cleanName) continue;

      const addQty = getItemQuantity(item) || 1;
      const existingIndex = next.inventory.findIndex((i) => {
        return normalizeItemName(i).toLowerCase() === cleanName.toLowerCase();
      });

      if (existingIndex >= 0) {
        const existing = next.inventory[existingIndex];
        const currentQty = getItemQuantity(existing);
        const newQty = currentQty + addQty;
        next.inventory[existingIndex] = typeof existing === 'object'
          ? { ...existing, name: cleanName, quantity: newQty }
          : { name: cleanName, quantity: newQty };
      } else {
        next.inventory.push(typeof item === 'object' ? { ...item, name: cleanName, quantity: addQty } : { name: cleanName, quantity: addQty });
      }
      next.inventory = sanitizeInventory(next.inventory);
      didChange = true;
    }
  }

  // Inventory Removals / Consumptions
  if (changes.inventoryRemoved && changes.inventoryRemoved.length > 0) {
    for (const item of changes.inventoryRemoved) {
      const cleanName = normalizeItemName(item);
      if (!cleanName) continue;

      const removeQty = getItemQuantity(item) || 1;
      const existingIndex = next.inventory.findIndex((i) => {
        return normalizeItemName(i).toLowerCase() === cleanName.toLowerCase();
      });

      if (existingIndex >= 0) {
        const existing = next.inventory[existingIndex];
        const currentQty = getItemQuantity(existing);
        const remaining = currentQty - removeQty;
        if (remaining <= 0) {
          next.inventory.splice(existingIndex, 1);
        } else {
          next.inventory[existingIndex] = typeof existing === 'object'
            ? { ...existing, name: cleanName, quantity: remaining }
            : { name: cleanName, quantity: remaining };
        }
        next.inventory = sanitizeInventory(next.inventory);
        didChange = true;
      }
    }
  }

  // World State & System Variables
  if (changes.worldStateUpdated && Object.keys(changes.worldStateUpdated).length > 0) {
    next.worldState = { ...next.worldState, ...changes.worldStateUpdated };
    didChange = true;
  }

  if (changes.systemVariablesUpdated && Object.keys(changes.systemVariablesUpdated).length > 0) {
    next.systemVariables = { ...next.systemVariables, ...changes.systemVariablesUpdated };
    didChange = true;
  }

  // Important Memory
  if (changes.importantMemoriesAdded && changes.importantMemoriesAdded.length > 0) {
    for (const imp of changes.importantMemoriesAdded) {
      next.importantMemory.push(imp);
      didChange = true;
    }
  }

  // Recent Memory
  if (changes.memoryEntry) {
    const updatedRecent = [...next.recentMemory, changes.memoryEntry];
    if (updatedRecent.length > maxMemory) {
      next.recentMemory = updatedRecent.slice(updatedRecent.length - maxMemory);
    } else {
      next.recentMemory = updatedRecent;
    }
    didChange = true;
  }

  // Version Increment
  if (didChange && options.incrementVersion !== false) {
    next.stateVersion = (currentState.stateVersion ?? 0) + 1;
  }

  return { updatedState: next, didChange };
}
