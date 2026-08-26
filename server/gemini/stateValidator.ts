export interface GeminiStateChange {
  operation: 'SET' | 'ADD' | 'REMOVE' | 'COMPLETE' | 'UNLOCK' | 'UPDATE';
  path: string;
  value?: any;
  id?: string;
}

export interface ImportantMemoryProposal {
  text: string;
  reason?: string;
}

export interface GeminiProcessResult {
  success: boolean;
  summary: string;
  stateChanges: GeminiStateChange[];
  itemDefinitions?: Array<{
    itemName: string;
    itemId?: string;
    description?: string;
    rank?: string;
    type?: string;
    rarity?: string;
    maximumStack?: number;
    sellValue?: number | string;
    buyValue?: number | string;
    usage?: string;
    effects?: string;
    requirements?: string;
    keyType?: string;
    boxType?: string;
    craftingInformation?: string;
    specialProperties?: string;
    notes?: string;
    icon?: string;
    [key: string]: any;
  }>;
  importantMemory?: ImportantMemoryProposal[];
  warnings?: string[];
  confidence?: number;
}

export interface ValidationReport {
  valid: boolean;
  sanitizedResult: GeminiProcessResult;
  errors: string[];
  warnings: string[];
}

const ALLOWED_OPERATIONS = new Set(['SET', 'ADD', 'REMOVE', 'COMPLETE', 'UNLOCK', 'UPDATE']);

export function normalizeValidationPath(rawPath: string): string {
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

  // If path starts with prefix variations
  if (lower.startsWith('attribute.')) return 'attributes.' + p.substring(10);
  if (lower.startsWith('attributes.')) return 'attributes.' + p.substring(11);
  if (lower.startsWith('skill.')) return 'skills.' + p.substring(6);
  if (lower.startsWith('skills.')) return 'skills.' + p.substring(7);
  if (lower.startsWith('quest.')) return 'quests.' + p.substring(6);
  if (lower.startsWith('quests.')) return 'quests.' + p.substring(7);
  if (lower.startsWith('item.') || lower.startsWith('items.')) return 'inventory.' + p.substring(p.indexOf('.') + 1);

  // If bare stat name (e.g. Strength, Agility, HP, MP, Vitality)
  const commonAttrs = ['strength', 'agility', 'vitality', 'intelligence', 'perception', 'dexterity', 'endurance', 'wisdom', 'charisma', 'luck', 'speed', 'defense', 'attack', 'mana', 'health', 'hp', 'mp', 'stamina'];
  if (commonAttrs.includes(lower) || (!p.includes('.') && !['skills', 'quests', 'achievements', 'titles', 'inventory', 'worldstate', 'systemvariables', 'importantmemory', 'progression'].includes(lower))) {
    const formatted = p.charAt(0).toUpperCase() + p.slice(1);
    return `attributes.${formatted}`;
  }

  return p;
}

const ALLOWED_PATH_PREFIXES = [
  'progression',
  'progression.level',
  'progression.xp',
  'progression.currentXP',
  'progression.requiredXp',
  'progression.requiredXP',
  'progression.maxXp',
  'progression.overflowXp',
  'progression.rank',
  'progression.statPoints',
  'progression.skillPoints',
  'level',
  'xp',
  'status',
  'playerId',
  'attributes',
  'skills',
  'quests',
  'achievements',
  'titles',
  'inventory',
  'worldState',
  'systemVariables',
  'importantMemory',
];

/**
 * Validates Gemini extraction payload against safety and sanity rules.
 */
export function validateGeminiProcessResult(rawResult: any): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!rawResult || typeof rawResult !== 'object') {
    return {
      valid: false,
      sanitizedResult: {
        success: false,
        summary: 'Invalid processing payload',
        stateChanges: [],
        warnings: ['Payload was not an object'],
        confidence: 0,
      },
      errors: ['Gemini response is not a valid JSON object'],
      warnings,
    };
  }

  const summary = typeof rawResult.summary === 'string' && rawResult.summary.trim().length > 0
    ? rawResult.summary.trim()
    : 'System event processed.';

  const confidence = typeof rawResult.confidence === 'number'
    ? Math.max(0, Math.min(1, rawResult.confidence))
    : 0.95;

  if (Array.isArray(rawResult.warnings)) {
    for (const w of rawResult.warnings) {
      if (typeof w === 'string' && w.trim().length > 0) {
        warnings.push(w.trim());
      }
    }
  }

  const sanitizedChanges: GeminiStateChange[] = [];

  if (Array.isArray(rawResult.stateChanges)) {
    for (const change of rawResult.stateChanges) {
      if (!change || typeof change !== 'object') continue;

      const op = String(change.operation || '').toUpperCase() as GeminiStateChange['operation'];
      const path = normalizeValidationPath(String(change.path || ''));

      if (!ALLOWED_OPERATIONS.has(op)) {
        warnings.push(`Ignored unsupported operation: ${op}`);
        continue;
      }

      if (!path) {
        warnings.push(`Ignored change with empty path for operation ${op}`);
        continue;
      }

      // Check path safety
      const isAllowedPath = ALLOWED_PATH_PREFIXES.some(
        (prefix) => path === prefix || path.startsWith(prefix + '.')
      );

      if (!isAllowedPath) {
        warnings.push(`Ignored modification to restricted/unknown path: ${path}`);
        continue;
      }

      // Numeric safety for ADD operation on numeric paths
      if (op === 'ADD') {
        if (
          path.startsWith('progression.') ||
          path.startsWith('attributes.') ||
          path === 'level' ||
          path === 'xp'
        ) {
          const numVal = typeof change.value === 'number'
            ? change.value
            : parseFloat(String(change.value).replace(/[^0-9.-]/g, ''));

          if (isNaN(numVal)) {
            warnings.push(`ADD operation on '${path}' requires a numeric value, got '${change.value}'`);
            continue;
          }
          sanitizedChanges.push({
            operation: 'ADD',
            path,
            value: numVal,
            id: change.id ? String(change.id) : undefined,
          });
          continue;
        }
      }

      sanitizedChanges.push({
        operation: op,
        path,
        value: change.value,
        id: change.id ? String(change.id) : undefined,
      });
    }
  }

  const sanitizedImportantMemories: ImportantMemoryProposal[] = [];
  if (Array.isArray(rawResult.importantMemory)) {
    for (const imp of rawResult.importantMemory) {
      if (!imp) continue;
      const text = typeof imp === 'string' ? imp.trim() : (imp.text ? String(imp.text).trim() : '');
      const reason = typeof imp === 'object' && imp.reason ? String(imp.reason).trim() : undefined;
      if (text) {
        sanitizedImportantMemories.push({ text, reason });
      }
    }
  }

  const sanitizedItemDefinitions: any[] = [];
  if (Array.isArray(rawResult.itemDefinitions)) {
    for (const rawItem of rawResult.itemDefinitions) {
      if (!rawItem || typeof rawItem !== 'object') continue;
      const itemName = String(rawItem.itemName || rawItem.name || '').trim();
      if (!itemName) continue;
      
      const cleanItem: Record<string, any> = { itemName };
      if (rawItem.itemId && String(rawItem.itemId).trim()) cleanItem.itemId = String(rawItem.itemId).trim();
      if (rawItem.description && String(rawItem.description).trim()) cleanItem.description = String(rawItem.description).trim();
      if (rawItem.rank && String(rawItem.rank).trim()) cleanItem.rank = String(rawItem.rank).trim();
      if (rawItem.type && String(rawItem.type).trim()) cleanItem.type = String(rawItem.type).trim();
      if (rawItem.rarity && String(rawItem.rarity).trim()) cleanItem.rarity = String(rawItem.rarity).trim();
      if (typeof rawItem.maximumStack === 'number' && !isNaN(rawItem.maximumStack)) cleanItem.maximumStack = rawItem.maximumStack;
      if (rawItem.sellValue !== undefined && rawItem.sellValue !== '') cleanItem.sellValue = rawItem.sellValue;
      if (rawItem.buyValue !== undefined && rawItem.buyValue !== '') cleanItem.buyValue = rawItem.buyValue;
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
      confidence,
    },
    errors,
    warnings,
  };
}
