import { PlayerState, QuestItem, QuestTimingType, QuestStatus, SystemEvent, QuestRewards, QuestPenalty, QuestStatEffect, QuestCurrencyEffect } from '../types';

export const QUEST_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 Real-World Hours in Milliseconds

/**
 * Standard Canonical Stats Metadata
 */
export const CANONICAL_STATS = ['STR', 'INT', 'SKL', 'DISC', 'STA'] as const;
export type CanonicalStat = typeof CANONICAL_STATS[number];

export const CANONICAL_STATS_INFO = [
  { key: 'STR', name: 'Strength', icon: '📊' },
  { key: 'INT', name: 'Intelligence', icon: '🧠' },
  { key: 'SKL', name: 'Skill', icon: '🎯' },
  { key: 'DISC', name: 'Discipline', icon: '🔥' },
  { key: 'STA', name: 'Stamina', icon: '⚡' },
] as const;

export interface AuthoritativeStatInfo {
  /** Exact canonical name defined in Player State (e.g. "Strength", "Intelligence") */
  name: string;
  /** Normalized identifier key (e.g. "STR", "INT") */
  key: string;
  /** Thematic visual icon */
  icon: string;
}

/**
 * AUTHORITATIVE SINGLE SOURCE OF TRUTH:
 * Extracts the exact existing stats list from the player state.
 * Returns stats in the canonical order defined in player.attributes or player.stats.
 * Does NOT invent or hardcode nonexistent stats.
 * If stats are temporarily unavailable, returns an empty array.
 */
export function getAuthoritativePlayerStats(player?: PlayerState | null): AuthoritativeStatInfo[] {
  if (!player) return [];

  const statsContainer =
    player.attributes && typeof player.attributes === 'object' && Object.keys(player.attributes).length > 0
      ? player.attributes
      : (player.stats && typeof player.stats === 'object' && Object.keys(player.stats).length > 0
          ? player.stats
          : undefined);

  if (!statsContainer) {
    return [];
  }

  return Object.keys(statsContainer).map((statName) => {
    const norm = normalizeStatKey(statName);
    return {
      name: statName,
      key: norm,
      icon: getStatIcon(statName),
    };
  });
}

/**
 * AUTOMATED VALIDATION ASSERTION:
 * Validates that availableRewardStats == availablePenaltyStats == authoritativePlayerStats.
 * Reports any mismatch in count, elements, or ordering.
 */
export function validateAuthoritativeStatsConsistency(
  playerStats: string[],
  rewardStats: string[],
  penaltyStats: string[]
): { isConsistent: boolean; error?: string } {
  if (playerStats.length !== rewardStats.length || playerStats.length !== penaltyStats.length) {
    return {
      isConsistent: false,
      error: `Stats count mismatch: Player (${playerStats.length}) vs Reward (${rewardStats.length}) vs Penalty (${penaltyStats.length})`,
    };
  }

  for (let i = 0; i < playerStats.length; i++) {
    const pStat = playerStats[i];
    const rStat = rewardStats[i];
    const penStat = penaltyStats[i];

    if (rStat !== pStat || penStat !== pStat) {
      return {
        isConsistent: false,
        error: `Stat mismatch at index ${i}: Player ("${pStat}") vs Reward ("${rStat}") vs Penalty ("${penStat}")`,
      };
    }
  }

  return { isConsistent: true };
}

/**
 * Returns full name for canonical stats (e.g. STR -> Strength)
 */
export function getStatFullName(rawStat: string): string {
  if (!rawStat) return 'Strength';
  const norm = normalizeStatKey(rawStat);
  switch (norm) {
    case 'STR':
      return 'Strength';
    case 'INT':
      return 'Intelligence';
    case 'SKL':
      return 'Skill';
    case 'DISC':
      return 'Discipline';
    case 'STA':
      return 'Stamina';
    default:
      return rawStat.charAt(0).toUpperCase() + rawStat.slice(1);
  }
}

/**
 * Strict Mapping dictionary for stats
 * Strength -> STR, Intelligence -> INT, Skill -> SKL, Discipline -> DISC, Stamina -> STA
 */
export const STAT_NAME_MAP: Record<string, string> = {
  strength: 'STR',
  str: 'STR',
  intelligence: 'INT',
  int: 'INT',
  skill: 'SKL',
  skl: 'SKL',
  discipline: 'DISC',
  disc: 'DISC',
  stamina: 'STA',
  sta: 'STA',
};

/**
 * Normalizes any stat string representation into its canonical key (STR, INT, SKL, DISC, STA)
 */
export function normalizeStatKey(rawStat: string): string {
  if (!rawStat) return 'STR';
  const clean = rawStat.trim().toLowerCase();
  if (STAT_NAME_MAP[clean]) {
    return STAT_NAME_MAP[clean];
  }
  return rawStat.trim().toUpperCase();
}

/**
 * Resolves the appropriate attribute key in player.attributes for a given stat name.
 * Prevents creating duplicate keys like Strength alongside STR.
 */
export function resolvePlayerStatKey(attributes: Record<string, any> | undefined, rawStat: string): string {
  const norm = normalizeStatKey(rawStat);
  if (!attributes) return norm;
  if (attributes[norm] !== undefined) {
    return norm;
  }
  const existingKey = Object.keys(attributes).find(
    (k) => k.toLowerCase() === norm.toLowerCase() || k.toLowerCase() === rawStat.trim().toLowerCase()
  );
  if (existingKey) {
    return existingKey;
  }
  return norm;
}

/**
 * Returns the theme icon for a canonical stat
 */
export function getStatIcon(stat: string): string {
  const norm = normalizeStatKey(stat);
  switch (norm) {
    case 'STR':
      return '📊';
    case 'INT':
      return '🧠';
    case 'SKL':
      return '🎯';
    case 'DISC':
      return '🔥';
    case 'STA':
      return '⚡';
    default:
      return '📊';
  }
}

/**
 * Strictly parses explicit stat effects from text (e.g., "-1 Strength", "+1 STR", "Strength -1", "+3 INT", "-2 STA", "-1 DISC").
 * IMPORTANT: Does NOT blindly interpret arbitrary numbers in text (e.g. "Run 5 km" or "Do 20 push-ups" returns empty).
 * STAT ≠ CURRENCY: Never matches Coins or Gold as a stat!
 */
export function parseExplicitStatEffects(text: string): QuestStatEffect[] {
  if (!text || typeof text !== 'string') return [];
  const results: QuestStatEffect[] = [];
  const trimmed = text.trim();
  if (!trimmed) return [];

  // 1. Prefix sign format: "-1 Strength", "+1 Strength", "-2 STR", "+3 INT", "+5 STA", "-1 DISC"
  const prefixRegex = /([+-])\s*(\d+(?:\.\d+)?)\s*(?:points?\s+(?:in|of)\s+|pts?\s+(?:in|of)\s+)?(Strength|STR|Intelligence|INT|Skill|SKL|Discipline|DISC|Stamina|STA)\b/gi;
  let match: RegExpExecArray | null;
  while ((match = prefixRegex.exec(trimmed)) !== null) {
    const sign = match[1];
    const amount = parseFloat(match[2]);
    const rawStat = match[3];
    if (!isNaN(amount) && amount > 0) {
      const norm = normalizeStatKey(rawStat);
      if (!results.some((r) => r.stat === norm)) {
        results.push({
          type: 'stat',
          stat: norm,
          statName: getStatFullName(norm),
          operation: sign === '-' ? 'decrease' : 'increase',
          amount: Math.round(amount),
        });
      }
    }
  }

  // 2. Postfix sign format: "Strength -1", "Strength +1", "STR -1", "INT +2", "STA -2", "DISC +1"
  const postfixRegex = /\b(Strength|STR|Intelligence|INT|Skill|SKL|Discipline|DISC|Stamina|STA)\s*([+-])\s*(\d+(?:\.\d+)?)\b/gi;
  while ((match = postfixRegex.exec(trimmed)) !== null) {
    const rawStat = match[1];
    const sign = match[2];
    const amount = parseFloat(match[3]);
    if (!isNaN(amount) && amount > 0) {
      const norm = normalizeStatKey(rawStat);
      if (!results.some((r) => r.stat === norm)) {
        results.push({
          type: 'stat',
          stat: norm,
          statName: getStatFullName(norm),
          operation: sign === '-' ? 'decrease' : 'increase',
          amount: Math.round(amount),
        });
      }
    }
  }

  // 3. Explicit decrease words: "Lose 1 Strength", "Deduct 2 STR", "Strength decreased by 1"
  const lossRegex = /(?:lose|lost|deduct|decrease|reduce|penalty\s*of)\s*(\d+(?:\.\d+)?)\s*(?:points?\s+(?:in|of)\s+|pts?\s+(?:in|of)\s+)?(Strength|STR|Intelligence|INT|Skill|SKL|Discipline|DISC|Stamina|STA)\b/gi;
  while ((match = lossRegex.exec(trimmed)) !== null) {
    const amount = parseFloat(match[1]);
    const rawStat = match[2];
    if (!isNaN(amount) && amount > 0) {
      const norm = normalizeStatKey(rawStat);
      if (!results.some((r) => r.stat === norm)) {
        results.push({
          type: 'stat',
          stat: norm,
          statName: getStatFullName(norm),
          operation: 'decrease',
          amount: Math.round(amount),
        });
      }
    }
  }

  // 4. Explicit increase words: "Gain 1 Strength", "Increase 2 STR", "Strength increased by 1"
  const gainRegex = /(?:gain|gained|increase|boost|reward\s*of)\s*(\d+(?:\.\d+)?)\s*(?:points?\s+(?:in|of)\s+|pts?\s+(?:in|of)\s+)?(Strength|STR|Intelligence|INT|Skill|SKL|Discipline|DISC|Stamina|STA)\b/gi;
  while ((match = gainRegex.exec(trimmed)) !== null) {
    const amount = parseFloat(match[1]);
    const rawStat = match[2];
    if (!isNaN(amount) && amount > 0) {
      const norm = normalizeStatKey(rawStat);
      if (!results.some((r) => r.stat === norm)) {
        results.push({
          type: 'stat',
          stat: norm,
          statName: getStatFullName(norm),
          operation: 'increase',
          amount: Math.round(amount),
        });
      }
    }
  }

  return results;
}

/**
 * Strictly parses explicit currency effects from text (e.g. "-100 Coins", "Coins -100", "Lose 100 Coins", "Deduct 50 Coins", "Coins: -100").
 * STAT ≠ CURRENCY: Separates currency completely from player stats.
 */
export function parseExplicitCurrencyEffects(text: string): QuestCurrencyEffect[] {
  if (!text || typeof text !== 'string') return [];
  const results: QuestCurrencyEffect[] = [];
  const trimmed = text.trim();
  if (!trimmed) return [];

  // 1. Prefix sign: "-100 Coins", "+50 Coins", "- 100 Coins"
  const prefixRegex = /([+-])\s*(\d+)\s*(?:coins?|gold|credits?)\b/gi;
  let match: RegExpExecArray | null;
  while ((match = prefixRegex.exec(trimmed)) !== null) {
    const sign = match[1];
    const amount = parseInt(match[2], 10);
    if (!isNaN(amount) && amount > 0) {
      if (!results.some((r) => r.currencyName === 'Coins')) {
        results.push({
          type: 'currency',
          currencyName: 'Coins',
          currency: 'Coins',
          operation: sign === '-' ? 'decrease' : 'increase',
          amount,
        });
      }
    }
  }

  // 2. Postfix sign: "Coins -100", "Coins - 100", "Coins +50"
  const postfixRegex = /\b(?:coins?|gold|credits?)\s*([+-])\s*(\d+)\b/gi;
  while ((match = postfixRegex.exec(trimmed)) !== null) {
    const sign = match[1];
    const amount = parseInt(match[2], 10);
    if (!isNaN(amount) && amount > 0) {
      if (!results.some((r) => r.currencyName === 'Coins')) {
        results.push({
          type: 'currency',
          currencyName: 'Coins',
          currency: 'Coins',
          operation: sign === '-' ? 'decrease' : 'increase',
          amount,
        });
      }
    }
  }

  // 3. Loss words: "Lose 100 Coins", "Deduct 50 Coins", "Penalty of 100 Coins", "Deduct 100 Coins"
  const lossRegex = /(?:lose|lost|deduct|decrease|reduce|penalty\s*(?:of)?)\s*(\d+)\s*(?:coins?|gold|credits?)\b/gi;
  while ((match = lossRegex.exec(trimmed)) !== null) {
    const amount = parseInt(match[1], 10);
    if (!isNaN(amount) && amount > 0) {
      if (!results.some((r) => r.currencyName === 'Coins')) {
        results.push({
          type: 'currency',
          currencyName: 'Coins',
          currency: 'Coins',
          operation: 'decrease',
          amount,
        });
      }
    }
  }

  // 4. Gain / Reward words: "Gain 100 Coins", "Reward 100 Coins", "Earn 100 Coins", "Receive 50 Coins"
  const gainRegex = /(?:gain|gained|reward\s*(?:of)?|earn|earned|receive|add)\s*(\d+)\s*(?:coins?|gold|credits?)\b/gi;
  while ((match = gainRegex.exec(trimmed)) !== null) {
    const amount = parseInt(match[1], 10);
    if (!isNaN(amount) && amount > 0) {
      if (!results.some((r) => r.currencyName === 'Coins')) {
        results.push({
          type: 'currency',
          currencyName: 'Coins',
          currency: 'Coins',
          operation: 'increase',
          amount,
        });
      }
    }
  }

  // 5. Colon format: "Coins: 100", "Coins: +100", "Coins: -100"
  if (results.length === 0) {
    const colonRegex = /\b(?:coins?|gold|credits?)\s*:\s*([+-]?\s*\d+)\b/gi;
    while ((match = colonRegex.exec(trimmed)) !== null) {
      const raw = match[1].replace(/\s+/g, '');
      const amount = Math.abs(parseInt(raw, 10));
      const isNeg = raw.startsWith('-');
      if (!isNaN(amount) && amount > 0) {
        if (!results.some((r) => r.currencyName === 'Coins')) {
          results.push({
            type: 'currency',
            currencyName: 'Coins',
            currency: 'Coins',
            operation: isNeg ? 'decrease' : 'increase',
            amount,
          });
        }
      }
    }
  }

  // 6. Direct numeric format: e.g. "100 Coins", "50 Gold"
  if (results.length === 0) {
    const directRegex = /\b(\d+)\s*(?:coins?|gold|credits?)\b/gi;
    while ((match = directRegex.exec(trimmed)) !== null) {
      const amount = parseInt(match[1], 10);
      if (!isNaN(amount) && amount > 0) {
        if (!results.some((r) => r.currencyName === 'Coins')) {
          results.push({
            type: 'currency',
            currencyName: 'Coins',
            currency: 'Coins',
            operation: 'increase',
            amount,
          });
        }
      }
    }
  }

  return results;
}

/**
 * Extracts and aggregates all structured currency reward effects from a quest's rewards.
 * STAT ≠ CURRENCY: Separate data structure and handling.
 */
export function extractQuestRewardCurrencyEffects(
  rewards?: QuestRewards | string | Record<string, any>,
  quest?: QuestItem
): QuestCurrencyEffect[] {
  const effects: QuestCurrencyEffect[] = [];
  if (!rewards && !quest) return effects;

  const rObj = typeof rewards === 'object' && rewards !== null ? (rewards as QuestRewards) : undefined;

  // 1. Structured currencyEffects on rewards
  if (rObj?.currencyEffects && Array.isArray(rObj.currencyEffects)) {
    for (const eff of rObj.currencyEffects) {
      if (eff && (eff.currencyName || eff.currency)) {
        const cName = eff.currencyName || eff.currency || 'Coins';
        const op = eff.operation === 'decrease' || eff.operation === 'subtract' ? 'decrease' : 'increase';
        const amt = Math.max(1, Math.round(Math.abs(eff.amount ?? 1)));
        if (!effects.some((e) => (e.currencyName || e.currency) === cName)) {
          effects.push({
            type: 'currency',
            currencyName: 'Coins',
            currency: 'Coins',
            operation: op,
            amount: amt,
          });
        }
      }
    }
  }

  // 2. Structured currencyEffects on quest item directly
  if (quest && (quest as any).currencyEffects && Array.isArray((quest as any).currencyEffects)) {
    for (const eff of (quest as any).currencyEffects) {
      if (eff && (eff.currencyName || eff.currency)) {
        const cName = eff.currencyName || eff.currency || 'Coins';
        const op = eff.operation === 'decrease' || eff.operation === 'subtract' ? 'decrease' : 'increase';
        const amt = Math.max(1, Math.round(Math.abs(eff.amount ?? 1)));
        if (!effects.some((e) => (e.currencyName || e.currency) === cName)) {
          effects.push({
            type: 'currency',
            currencyName: 'Coins',
            currency: 'Coins',
            operation: op,
            amount: amt,
          });
        }
      }
    }
  }

  // 3. Direct coins property on rewards or quest
  const directCoins = rObj?.coins ?? (quest && typeof quest.rewards === 'object' ? quest.rewards.coins : (quest && typeof quest.reward === 'object' ? (quest.reward as any).coins : undefined));
  if (directCoins !== undefined && typeof directCoins === 'number' && directCoins > 0) {
    if (!effects.some((e) => e.currencyName === 'Coins')) {
      effects.push({
        type: 'currency',
        currencyName: 'Coins',
        currency: 'Coins',
        operation: 'increase',
        amount: Math.max(1, Math.round(directCoins)),
      });
    }
  }

  // 4. Parse from custom/string reward if no structured effects found
  if (effects.length === 0) {
    const textToParse = [
      rObj?.custom || '',
      typeof rewards === 'string' ? rewards : '',
      typeof quest?.reward === 'string' ? quest.reward : '',
    ].filter(Boolean).join(' ');
    if (textToParse) {
      const parsed = parseExplicitCurrencyEffects(textToParse);
      for (const p of parsed) {
        if (!effects.some((e) => e.currencyName === p.currencyName)) {
          effects.push(p);
        }
      }
    }
  }

  return effects;
}

/**
 * Extracts and aggregates all structured stat effects from a quest's rewards
 */
export function extractQuestRewardStatEffects(
  rewards?: QuestRewards | string | Record<string, any>,
  quest?: QuestItem
): QuestStatEffect[] {
  const effects: QuestStatEffect[] = [];
  if (!rewards && !quest) return effects;

  const rObj = typeof rewards === 'object' && rewards !== null ? (rewards as QuestRewards) : undefined;

  // 1. Structured statEffects on rewards
  if (rObj?.statEffects && Array.isArray(rObj.statEffects)) {
    for (const eff of rObj.statEffects) {
      if (eff && eff.stat) {
        const norm = normalizeStatKey(eff.stat);
        const op = eff.operation === 'decrease' || eff.operation === 'subtract' ? 'decrease' : 'increase';
        const amt = Math.round(Math.abs(eff.amount ?? 1));
        if (!effects.some((e) => e.stat === norm)) {
          effects.push({ type: 'stat', stat: norm, statName: getStatFullName(norm), operation: op, amount: Math.max(1, amt) });
        }
      }
    }
  }

  // 2. Structured statEffects on quest item directly
  if (quest?.statEffects && Array.isArray(quest.statEffects)) {
    for (const eff of quest.statEffects) {
      if (eff && eff.stat) {
        const norm = normalizeStatKey(eff.stat);
        const op = eff.operation === 'decrease' || eff.operation === 'subtract' ? 'decrease' : 'increase';
        const amt = Math.round(Math.abs(eff.amount ?? 1));
        if (!effects.some((e) => e.stat === norm)) {
          effects.push({ type: 'stat', stat: norm, statName: getStatFullName(norm), operation: op, amount: Math.max(1, amt) });
        }
      }
    }
  }

  // 3. stats map on rewards (e.g. { STR: 1, STA: 1 } or { STR: -1 })
  if (rObj?.stats && typeof rObj.stats === 'object') {
    for (const [k, v] of Object.entries(rObj.stats)) {
      const num = typeof v === 'number' ? v : parseFloat(String(v));
      if (!isNaN(num) && num !== 0) {
        const norm = normalizeStatKey(k);
        if (!effects.some((e) => e.stat === norm)) {
          effects.push({
            type: 'stat',
            stat: norm,
            statName: getStatFullName(norm),
            operation: num < 0 ? 'decrease' : 'increase',
            amount: Math.max(1, Math.round(Math.abs(num))),
          });
        }
      }
    }
  }

  // 4. Parse from rewards.custom or reward string if no structured effects were found
  if (effects.length === 0) {
    const textToParse = [
      rObj?.custom || '',
      typeof rewards === 'string' ? rewards : '',
      typeof quest?.reward === 'string' ? quest.reward : '',
    ].filter(Boolean).join(' ');
    if (textToParse) {
      const parsed = parseExplicitStatEffects(textToParse);
      for (const p of parsed) {
        if (!effects.some((e) => e.stat === p.stat)) {
          effects.push(p);
        }
      }
    }
  }

  return effects;
}

/**
 * Extracts and aggregates all structured stat effects from a quest's penalty definition
 */
export function extractQuestPenaltyStatEffects(
  penaltyInfo?: {
    type?: string;
    value?: number | string;
    description?: string;
    stat?: string;
    statName?: string;
    statOperation?: 'increase' | 'decrease';
    stats?: Record<string, any>;
    statEffects?: QuestStatEffect[];
  },
  quest?: QuestItem
): QuestStatEffect[] {
  const effects: QuestStatEffect[] = [];

  const rawPenaltyObj = typeof quest?.penalty === 'object' && quest.penalty !== null ? (quest.penalty as any) : undefined;

  // 1. Structured statEffects array on penalty
  const candidateArrays = [
    penaltyInfo?.statEffects,
    rawPenaltyObj?.statEffects,
    quest?.penaltyStatEffects,
  ];
  for (const arr of candidateArrays) {
    if (arr && Array.isArray(arr)) {
      for (const eff of arr) {
        if (eff && eff.stat) {
          const norm = normalizeStatKey(eff.stat);
          const op = eff.operation === 'increase' || eff.operation === 'add' ? 'increase' : 'decrease';
          const amt = Math.max(1, Math.round(Math.abs(eff.amount ?? 1)));
          if (!effects.some((e) => e.stat === norm)) {
            effects.push({
              type: 'stat',
              stat: norm,
              statName: getStatFullName(norm),
              operation: op,
              amount: amt,
            });
          }
        }
      }
    }
  }

  // 2. penalty stats map (e.g. { STR: -1, DISC: -2 })
  const candidateMaps = [
    penaltyInfo?.stats,
    rawPenaltyObj?.stats,
    quest?.penaltyStats,
  ];
  for (const map of candidateMaps) {
    if (map && typeof map === 'object') {
      for (const [k, v] of Object.entries(map)) {
        const num = typeof v === 'number' ? v : parseFloat(String(v));
        if (!isNaN(num) && num !== 0) {
          const norm = normalizeStatKey(k);
          if (!effects.some((e) => e.stat === norm)) {
            effects.push({
              type: 'stat',
              stat: norm,
              statName: getStatFullName(norm),
              operation: num > 0 ? 'increase' : 'decrease',
              amount: Math.max(1, Math.round(Math.abs(num))),
            });
          }
        }
      }
    }
  }

  // 3. STAT penalty type with specific stat name and amount
  const pType = (penaltyInfo?.type || rawPenaltyObj?.type || quest?.penaltyType || '').toUpperCase();
  if (pType === 'STAT') {
    const rawStat = penaltyInfo?.stat || rawPenaltyObj?.stat || (typeof penaltyInfo?.description === 'string' ? penaltyInfo.description : undefined);
    const op = penaltyInfo?.statOperation || rawPenaltyObj?.statOperation || 'decrease';
    const val = typeof penaltyInfo?.value === 'number' ? penaltyInfo.value : parseFloat(String(penaltyInfo?.value || rawPenaltyObj?.value || '1'));
    if (rawStat) {
      const norm = normalizeStatKey(rawStat);
      if (!effects.some((e) => e.stat === norm)) {
        effects.push({
          type: 'stat',
          stat: norm,
          statName: getStatFullName(norm),
          operation: op === 'increase' || op === 'add' ? 'increase' : 'decrease',
          amount: Math.max(1, Math.round(Math.abs(!isNaN(val) && val > 0 ? val : 1))),
        });
      }
    }
  }

  // 4. Parse from description or penalty string if no structured effects were found
  if (effects.length === 0) {
    const textToParse = [
      penaltyInfo?.description || '',
      rawPenaltyObj?.description || '',
      quest?.penaltyDescription || '',
      typeof quest?.penalty === 'string' ? quest.penalty : '',
    ].filter(Boolean).join(' ');
    if (textToParse) {
      const parsed = parseExplicitStatEffects(textToParse);
      for (const p of parsed) {
        if (!effects.some((e) => e.stat === p.stat)) {
          effects.push(p);
        }
      }
    }
  }

  return effects;
}

/**
 * Extracts and aggregates all structured currency penalty effects from a quest definition.
 * STAT ≠ CURRENCY: Separate data structure and handling.
 */
export function extractQuestPenaltyCurrencyEffects(
  penaltyInfo?: {
    type?: string;
    value?: number | string;
    description?: string;
    currencyEffects?: QuestCurrencyEffect[];
    coins?: number;
  },
  quest?: QuestItem
): QuestCurrencyEffect[] {
  const effects: QuestCurrencyEffect[] = [];
  const rawPenaltyObj = typeof quest?.penalty === 'object' && quest.penalty !== null ? (quest.penalty as any) : undefined;

  // 1. Structured currencyEffects array
  const candidateArrays = [
    penaltyInfo?.currencyEffects,
    rawPenaltyObj?.currencyEffects,
    quest?.penaltyCurrencyEffects,
  ];
  for (const arr of candidateArrays) {
    if (arr && Array.isArray(arr)) {
      for (const eff of arr) {
        if (eff && (eff.currencyName || eff.currency)) {
          const cName = eff.currencyName || eff.currency || 'Coins';
          const op = eff.operation === 'increase' || eff.operation === 'add' ? 'increase' : 'decrease';
          const amt = Math.max(1, Math.round(Math.abs(eff.amount ?? 1)));
          if (!effects.some((e) => (e.currencyName || e.currency) === cName)) {
            effects.push({
              type: 'currency',
              currencyName: 'Coins',
              currency: 'Coins',
              operation: op,
              amount: amt,
            });
          }
        }
      }
    }
  }

  // 2. Direct coins / penaltyCoins numeric property
  const directCoinAmounts = [
    penaltyInfo?.coins,
    rawPenaltyObj?.coins,
    quest?.penaltyCoins,
  ];
  for (const cAmt of directCoinAmounts) {
    if (cAmt !== undefined && typeof cAmt === 'number' && cAmt > 0) {
      if (!effects.some((e) => e.currencyName === 'Coins')) {
        effects.push({
          type: 'currency',
          currencyName: 'Coins',
          currency: 'Coins',
          operation: 'decrease',
          amount: Math.max(1, Math.round(cAmt)),
        });
      }
    }
  }

  // 3. COIN / GOLD penalty type with value
  const pType = (penaltyInfo?.type || rawPenaltyObj?.type || quest?.penaltyType || '').toUpperCase();
  if (pType === 'COIN' || pType === 'GOLD') {
    const val = typeof penaltyInfo?.value === 'number'
      ? penaltyInfo.value
      : parseFloat(String(penaltyInfo?.value || rawPenaltyObj?.value || quest?.penaltyValue || '0'));
    if (!isNaN(val) && val > 0) {
      if (!effects.some((e) => e.currencyName === 'Coins')) {
        effects.push({
          type: 'currency',
          currencyName: 'Coins',
          currency: 'Coins',
          operation: 'decrease',
          amount: Math.max(1, Math.round(val)),
        });
      }
    }
  }

  // 4. Parse from description or penalty string if no structured currency effects found
  if (effects.length === 0) {
    const textToParse = [
      penaltyInfo?.description || '',
      rawPenaltyObj?.description || '',
      quest?.penaltyDescription || '',
      typeof quest?.penalty === 'string' ? quest.penalty : '',
    ].filter(Boolean).join(' ');
    if (textToParse) {
      const parsed = parseExplicitCurrencyEffects(textToParse);
      for (const p of parsed) {
        if (!effects.some((e) => e.currencyName === p.currencyName)) {
          effects.push(p);
        }
      }
    }
  }

  return effects;
}

/**
 * Validates whether an ISO string represents a valid timestamp
 */
export function isValidTimestamp(ts?: string | null): boolean {
  if (!ts || typeof ts !== 'string') return false;
  const time = Date.parse(ts);
  return !isNaN(time) && time > 0;
}

/**
 * Categorizes a quest into its timing type:
 * A) DAILY - 24-hour recurring cycle
 * B) CUSTOM - Defined by specific createdAt and expiresAt timer
 * C) MANUAL - System Controller manual resolution, no automatic timer
 * D) PERMANENT - Never expires, persistent milestones / special trials
 */
export function getQuestTimingType(quest: string | QuestItem): 'DAILY' | 'CUSTOM' | 'MANUAL' | 'PERMANENT' {
  if (typeof quest === 'string') {
    const lower = quest.toLowerCase();
    if (lower.includes('permanent') || lower.includes('passive') || lower.includes('title')) return 'PERMANENT';
    if (lower.includes('manual') || lower.includes('system controlled')) return 'MANUAL';
    if (lower.includes('custom') || lower.includes('timer')) return 'CUSTOM';
    if (lower.includes('hidden') || lower.includes('boss') || lower.includes('emergency')) return 'PERMANENT';
    return 'DAILY';
  }

  const rawType = (quest.type || '').toUpperCase();
  if (rawType === 'DAILY') return 'DAILY';
  if (rawType === 'CUSTOM' || rawType === 'CUSTOM_TIMER' || rawType === 'TIMER') return 'CUSTOM';
  if (rawType === 'MANUAL' || rawType === 'SYSTEM_CONTROLLED') return 'MANUAL';
  if (rawType === 'PERMANENT' || rawType === 'PASSIVE') return 'PERMANENT';

  // Check category or isDaily flag
  if (quest.isDaily === true) return 'DAILY';
  if (quest.isDaily === false) {
    if (isValidTimestamp(quest.expiresAt)) return 'CUSTOM';
    return 'PERMANENT';
  }

  if (quest.category) {
    const cat = quest.category.toLowerCase();
    if (cat === 'daily') return 'DAILY';
    if (cat === 'custom' || cat === 'timer') return 'CUSTOM';
    if (cat === 'manual') return 'MANUAL';
    if (['hidden', 'boss_chain', 'boss', 'emergency', 'special_event', 'special', 'permanent'].includes(cat)) {
      return isValidTimestamp(quest.expiresAt) ? 'CUSTOM' : 'PERMANENT';
    }
  }

  // If it has a specific expiration timestamp different from daily, treat as CUSTOM
  if (isValidTimestamp(quest.expiresAt)) {
    return 'CUSTOM';
  }

  // Check title markers
  const titleLower = (quest.title || '').toLowerCase();
  if (titleLower.includes('[daily]')) return 'DAILY';
  if (titleLower.includes('[custom]') || titleLower.includes('[timer]')) return 'CUSTOM';
  if (titleLower.includes('[permanent]')) return 'PERMANENT';
  if (titleLower.includes('[manual]')) return 'MANUAL';
  if (titleLower.includes('[hidden]') || titleLower.includes('[boss]') || titleLower.includes('[emergency]')) {
    return 'PERMANENT';
  }

  return 'DAILY';
}

/**
 * Checks if a quest is a special/persistent quest that must NOT be cleared by 24h daily refresh
 */
export function isSpecialQuest(quest: string | QuestItem): boolean {
  const timingType = getQuestTimingType(quest);
  if (timingType === 'CUSTOM' || timingType === 'MANUAL' || timingType === 'PERMANENT') {
    return true;
  }

  if (typeof quest === 'string') {
    const lower = quest.toLowerCase();
    return (
      lower.includes('hidden') ||
      lower.includes('boss') ||
      lower.includes('chain') ||
      lower.includes('emergency') ||
      lower.includes('special') ||
      lower.includes('penalty') ||
      lower.includes('dungeon')
    );
  }

  return false;
}

/**
 * Checks if a quest is a recurring daily quest eligible for 24h cycle tracking
 */
export function isDailyQuest(quest: string | QuestItem): boolean {
  return getQuestTimingType(quest) === 'DAILY' && !isSpecialQuest(quest);
}

/**
 * Dynamic countdown formatter from an ISO target timestamp:
 * Returns string like: "⏳ 02:31:45", "⏳ 1d 04h 20m", or "EXPIRED"
 */
export function formatDynamicTimer(expiresAt?: string | null, now: Date = new Date()): string {
  if (!isValidTimestamp(expiresAt)) {
    return 'NO TIMER';
  }

  const target = new Date(expiresAt!).getTime();
  const current = now.getTime();
  const diffMs = target - current;

  if (diffMs <= 0) {
    return 'EXPIRED';
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `⏳ ${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
  }

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  return `⏳ ${hh}:${mm}:${ss}`;
}

export interface QuestCountdownInfo {
  formatted: string;
  hours: number;
  minutes: number;
  seconds: number;
  totalSecondsRemaining: number;
  isReady: boolean;
  isRequested: boolean;
  dailyRefreshRequired: boolean;
  status: 'COUNTDOWN' | 'DAILY_REFRESH_REQUIRED' | 'REFRESH_AVAILABLE' | 'REFRESH_REQUESTED' | 'NOT_INITIALIZED';
  nextQuestRefreshAt?: string;
  questCycleStartedAt?: string;
  questGeneratedAt?: string;
  questRefreshRequestedAt?: string;
}

/**
 * Dynamic calculation of countdown timer for the 24-Hour Daily Quest Cycle.
 */
export function calculateQuestCountdown(
  nextRefreshAt?: string | null,
  cycleStartedAt?: string | null,
  now: Date = new Date(),
  questRefreshRequested: boolean = false,
  questRefreshAvailable: boolean = false,
  questRefreshRequestedAt?: string | null,
  dailyQuestRefreshRequired: boolean = false
): QuestCountdownInfo {
  if (questRefreshRequested) {
    return {
      formatted: 'REFRESH REQUESTED (Awaiting System Controller)',
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalSecondsRemaining: 0,
      isReady: false,
      isRequested: true,
      dailyRefreshRequired: false,
      status: 'REFRESH_REQUESTED',
      nextQuestRefreshAt: nextRefreshAt || undefined,
      questCycleStartedAt: cycleStartedAt || undefined,
      questGeneratedAt: cycleStartedAt || undefined,
      questRefreshRequestedAt: questRefreshRequestedAt || undefined,
    };
  }

  if (dailyQuestRefreshRequired) {
    return {
      formatted: '⚔️ NEW QUEST CYCLE READY',
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalSecondsRemaining: 0,
      isReady: true,
      isRequested: false,
      dailyRefreshRequired: true,
      status: 'DAILY_REFRESH_REQUIRED',
      nextQuestRefreshAt: nextRefreshAt || undefined,
      questCycleStartedAt: cycleStartedAt || undefined,
      questGeneratedAt: cycleStartedAt || undefined,
    };
  }

  if (!isValidTimestamp(nextRefreshAt)) {
    return {
      formatted: 'AWAITING SYSTEM INITIALIZATION',
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalSecondsRemaining: 0,
      isReady: false,
      isRequested: false,
      dailyRefreshRequired: false,
      status: 'NOT_INITIALIZED',
      nextQuestRefreshAt: nextRefreshAt || undefined,
      questCycleStartedAt: cycleStartedAt || undefined,
      questGeneratedAt: cycleStartedAt || undefined,
    };
  }

  const targetTime = new Date(nextRefreshAt!).getTime();
  const currentTime = now.getTime();
  const diffMs = targetTime - currentTime;

  if (diffMs <= 0 || questRefreshAvailable) {
    return {
      formatted: '⚔️ NEW QUEST CYCLE READY',
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalSecondsRemaining: 0,
      isReady: true,
      isRequested: false,
      dailyRefreshRequired: true,
      status: 'DAILY_REFRESH_REQUIRED',
      nextQuestRefreshAt: nextRefreshAt!,
      questCycleStartedAt: cycleStartedAt || undefined,
      questGeneratedAt: cycleStartedAt || undefined,
    };
  }

  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  return {
    formatted: `${hh}:${mm}:${ss}`,
    hours,
    minutes,
    seconds,
    totalSecondsRemaining: totalSeconds,
    isReady: false,
    isRequested: false,
    dailyRefreshRequired: false,
    status: 'COUNTDOWN',
    nextQuestRefreshAt: nextRefreshAt!,
    questCycleStartedAt: cycleStartedAt || undefined,
    questGeneratedAt: cycleStartedAt || undefined,
  };
}

/**
 * Parses and extracts explicitly defined penalty details from a QuestItem.
 * Returns { enabled, isExplicit, type, value, description, statEffects, currencyEffects, stat, statOperation }
 */
export function parseQuestPenalty(quest: QuestItem | string): {
  enabled: boolean;
  isExplicit: boolean;
  type?: string;
  value?: number | string;
  description?: string;
  statEffects?: QuestStatEffect[];
  currencyEffects?: QuestCurrencyEffect[];
  stat?: string;
  statOperation?: 'increase' | 'decrease';
} {
  if (typeof quest === 'string' || !quest) {
    if (typeof quest === 'string' && quest.trim()) {
      const parsedStats = parseExplicitStatEffects(quest);
      const parsedCurrencies = parseExplicitCurrencyEffects(quest);
      if (parsedStats.length > 0 || parsedCurrencies.length > 0) {
        const parts: string[] = [];
        if (parsedStats.length > 0) {
          parts.push(...parsedStats.map((e) => `${getStatIcon(e.stat)} ${e.statName || getStatFullName(e.stat)} ${e.operation === 'increase' ? `+${e.amount}` : `-${e.amount}`}`));
        }
        if (parsedCurrencies.length > 0) {
          parts.push(...parsedCurrencies.map((c) => `🪙 ${c.currencyName || 'Coins'} ${c.operation === 'increase' ? `+${c.amount}` : `-${c.amount}`}`));
        }
        return {
          enabled: true,
          isExplicit: true,
          type: parsedStats.length > 0 && parsedCurrencies.length > 0 ? 'STAT_AND_CURRENCY' : (parsedStats.length > 0 ? 'STAT' : 'COIN'),
          statEffects: parsedStats.length > 0 ? parsedStats : undefined,
          currencyEffects: parsedCurrencies.length > 0 ? parsedCurrencies : undefined,
          description: parts.join(', '),
        };
      }
    }
    return {
      enabled: false,
      isExplicit: false,
    };
  }

  // Check per-quest penalty switch
  const enabled = quest.penaltyEnabled === true || (typeof quest.penalty === 'object' && quest.penalty?.enabled === true);

  let rawDesc: string | undefined = quest.penaltyDescription;
  let rawType: string | undefined = quest.penaltyType;
  let rawVal: number | string | undefined = quest.penaltyValue;
  let statEffects: QuestStatEffect[] = [];
  let currencyEffects: QuestCurrencyEffect[] = [];
  let stat: string | undefined;
  let statOperation: 'increase' | 'decrease' | undefined;

  if (typeof quest.penalty === 'string' && quest.penalty.trim()) {
    rawDesc = quest.penalty.trim();
  } else if (typeof quest.penalty === 'object' && quest.penalty !== null) {
    if (quest.penalty.description) rawDesc = String(quest.penalty.description);
    if (quest.penalty.type) rawType = String(quest.penalty.type);
    if (quest.penalty.value !== undefined) rawVal = quest.penalty.value;
    if (quest.penalty.stat) stat = String(quest.penalty.stat);
    if (quest.penalty.statOperation) statOperation = quest.penalty.statOperation;
    if (Array.isArray(quest.penalty.statEffects)) statEffects = [...quest.penalty.statEffects];
    if (Array.isArray(quest.penalty.currencyEffects)) currencyEffects = [...quest.penalty.currencyEffects];
  }

  if (Array.isArray(quest.penaltyStatEffects)) {
    for (const eff of quest.penaltyStatEffects) {
      if (!statEffects.some((e) => e.stat === normalizeStatKey(eff.stat))) {
        statEffects.push({ ...eff, statName: eff.statName || getStatFullName(eff.stat) });
      }
    }
  }

  if (Array.isArray(quest.penaltyCurrencyEffects)) {
    for (const eff of quest.penaltyCurrencyEffects) {
      if (!currencyEffects.some((e) => e.currencyName === (eff.currencyName || 'Coins'))) {
        currencyEffects.push(eff);
      }
    }
  }

  // Check for explicit stat effects in description or string
  if (statEffects.length === 0 && rawDesc) {
    const parsed = parseExplicitStatEffects(rawDesc);
    if (parsed.length > 0) {
      statEffects = parsed;
    }
  }

  // Check for explicit currency effects in description or string
  if (currencyEffects.length === 0 && rawDesc) {
    const parsedCurrs = parseExplicitCurrencyEffects(rawDesc);
    if (parsedCurrs.length > 0) {
      currencyEffects = parsedCurrs;
    }
  }

  // Handle direct coins field
  if (currencyEffects.length === 0 && typeof (quest as any).penaltyCoins === 'number' && (quest as any).penaltyCoins > 0) {
    currencyEffects.push({
      type: 'currency',
      currencyName: 'Coins',
      currency: 'Coins',
      operation: 'decrease',
      amount: Math.round((quest as any).penaltyCoins),
    });
  }

  if (statEffects.length > 0 || currencyEffects.length > 0) {
    const parts: string[] = [];
    if (statEffects.length > 0) {
      parts.push(...statEffects.map((e) => `${getStatIcon(e.stat)} ${e.statName || getStatFullName(e.stat)} ${e.operation === 'increase' ? `+${e.amount}` : `-${e.amount}`}`));
    }
    if (currencyEffects.length > 0) {
      parts.push(...currencyEffects.map((c) => `🪙 ${c.currencyName || 'Coins'} ${c.operation === 'increase' ? `+${c.amount}` : `-${c.amount}`}`));
    }
    rawDesc = parts.join(', ');
    if (statEffects.length > 0 && currencyEffects.length > 0) {
      rawType = 'STAT_AND_CURRENCY';
    } else if (statEffects.length > 0) {
      rawType = 'STAT';
    } else {
      rawType = 'COIN';
    }
  }

  const isExplicit = Boolean(rawDesc || rawType || rawVal !== undefined || statEffects.length > 0 || currencyEffects.length > 0);

  // If type not specified, infer from description
  if (!rawType && rawDesc) {
    const dLower = rawDesc.toLowerCase();
    if (dLower.includes('xp') || dLower.includes('exp')) rawType = 'XP';
    else if (dLower.includes('coin') || dLower.includes('gold') || dLower.includes('credit')) rawType = 'COIN';
    else if (dLower.includes('fatigue')) rawType = 'FATIGUE';
    else if (dLower.includes('streak')) rawType = 'STREAK';
    else if (dLower.includes('item')) rawType = 'ITEM';
    else if (statEffects.length > 0 || dLower.includes('str') || dLower.includes('strength') || dLower.includes('int') || dLower.includes('skl') || dLower.includes('disc') || dLower.includes('sta')) rawType = 'STAT';
    else rawType = 'SYSTEM';
  }

  // If numeric value not specified, extract from description if possible
  if (rawVal === undefined && rawDesc && statEffects.length === 0 && currencyEffects.length === 0) {
    const numMatch = rawDesc.match(/-?(\d+(?:\.\d+)?)/);
    if (numMatch) {
      rawVal = parseFloat(numMatch[1]);
    }
  }

  return {
    enabled,
    isExplicit,
    type: rawType || 'SYSTEM',
    value: rawVal,
    description: rawDesc || (rawVal !== undefined && rawType ? `-${rawVal} ${rawType}` : undefined),
    statEffects: statEffects.length > 0 ? statEffects : undefined,
    currencyEffects: currencyEffects.length > 0 ? currencyEffects : undefined,
    stat,
    statOperation,
  };
}

/**
 * Applies an explicitly defined quest incompletion penalty to the player state.
 * Strictly adheres to:
 * 1. penaltyEnabled on quest must be true
 * 2. globalPenaltiesEnabled must be true
 * 3. penalty must be explicitly defined by System Controller (no invented penalties)
 * 4. penaltyApplied must NOT be true (no double penalty)
 * 5. Executes both Stat Penalties and Currency Penalties cleanly and atomically
 */
export function applyQuestIncompletionPenalty(
  player: PlayerState,
  quest: QuestItem,
  globalPenaltiesEnabled: boolean,
  now: Date = new Date()
): {
  updatedPlayer: PlayerState;
  penaltyApplied: boolean;
  penaltyEvent?: SystemEvent;
  penaltySummary?: string;
} {
  // If already applied, do nothing
  if (quest.penaltyApplied) {
    return { updatedPlayer: player, penaltyApplied: false };
  }

  const penaltyInfo = parseQuestPenalty(quest);

  // If penalty is disabled or not explicitly defined or global penalties disabled -> no penalty
  if (!globalPenaltiesEnabled || !penaltyInfo.enabled || !penaltyInfo.isExplicit) {
    return { updatedPlayer: player, penaltyApplied: false };
  }

  let nextPlayer: PlayerState = {
    ...player,
    progression: {
      level: player.progression?.level ?? player.level ?? '1',
      xp: player.progression?.xp ?? player.xp ?? '0',
      ...(player.progression || {}),
    },
    systemVariables: { ...(player.systemVariables || {}) },
    attributes: { ...(player.attributes || {}) },
    quests: Array.isArray(player.quests) ? [...player.quests] : [],
  };

  const penaltyType = (penaltyInfo.type || 'SYSTEM').toUpperCase();
  const numVal = typeof penaltyInfo.value === 'number' ? penaltyInfo.value : parseFloat(String(penaltyInfo.value || '0'));
  
  const summaryParts: string[] = [];
  const statAppliedParts: string[] = [];
  const currencyAppliedParts: string[] = [];

  // Extract all structured stat penalty effects
  const statEffects = extractQuestPenaltyStatEffects(penaltyInfo, quest);
  // Extract all structured currency penalty effects
  const currencyEffects = extractQuestPenaltyCurrencyEffects(penaltyInfo, quest);

  // 1. Execute Stat Penalties (e.g. Strength -1, Discipline -2)
  if (statEffects.length > 0) {
    for (const eff of statEffects) {
      const statKey = resolvePlayerStatKey(nextPlayer.attributes, eff.stat);
      const rawCurrent = nextPlayer.attributes[statKey];
      const curVal = typeof rawCurrent === 'number'
        ? rawCurrent
        : (parseFloat(String(rawCurrent || 0)) || 0);
      const delta = eff.operation === 'increase' ? Math.abs(eff.amount) : -Math.abs(eff.amount);
      const newVal = curVal + delta;
      nextPlayer.attributes[statKey] = newVal;

      const icon = getStatIcon(eff.stat);
      const fullName = eff.statName || getStatFullName(eff.stat);
      statAppliedParts.push(`${icon} ${fullName} ${delta >= 0 ? `+${delta}` : delta}`);
    }
    if (statAppliedParts.length > 0) {
      summaryParts.push(statAppliedParts.join(', '));
    }
  }

  // 2. Execute Currency Penalties (e.g. Coins -100)
  if (currencyEffects.length > 0) {
    for (const curEff of currencyEffects) {
      const currentCoins = typeof nextPlayer.systemVariables.coins === 'number'
        ? nextPlayer.systemVariables.coins
        : (parseInt(String(nextPlayer.systemVariables.coins || '0'), 10) || 0);
      const delta = curEff.operation === 'increase' ? Math.abs(curEff.amount) : -Math.abs(curEff.amount);
      const newCoins = Math.max(0, currentCoins + delta);
      nextPlayer.systemVariables.coins = newCoins;

      currencyAppliedParts.push(`🪙 ${curEff.currencyName || 'Coins'} ${delta >= 0 ? `+${delta}` : delta} (${currentCoins} → ${newCoins})`);
    }
    if (currencyAppliedParts.length > 0) {
      summaryParts.push(currencyAppliedParts.join(', '));
    }
  }

  // 3. Execute other explicit penalties (XP, Fatigue, Streak, or legacy Coin type if not in currencyEffects)
  if (penaltyType === 'XP' && !isNaN(numVal) && numVal > 0) {
    const currentXp = typeof nextPlayer.progression.xp === 'number'
      ? nextPlayer.progression.xp
      : (parseInt(String(nextPlayer.xp || '0'), 10) || 0);
    const newXp = Math.max(0, currentXp - numVal);
    nextPlayer.progression.xp = newXp;
    nextPlayer.xp = String(newXp);
    summaryParts.push(`XP -${numVal} (${currentXp} → ${newXp})`);
  } else if ((penaltyType === 'COIN' || penaltyType === 'GOLD') && currencyEffects.length === 0 && !isNaN(numVal) && numVal > 0) {
    const currentCoins = typeof nextPlayer.systemVariables.coins === 'number'
      ? nextPlayer.systemVariables.coins
      : (parseInt(String(nextPlayer.systemVariables.coins || '0'), 10) || 0);
    const newCoins = Math.max(0, currentCoins - numVal);
    nextPlayer.systemVariables.coins = newCoins;
    summaryParts.push(`Coins -${numVal} (${currentCoins} → ${newCoins})`);
  } else if (penaltyType === 'FATIGUE' && !isNaN(numVal) && numVal > 0) {
    const currentFatigue = typeof nextPlayer.systemVariables.fatigue === 'number'
      ? nextPlayer.systemVariables.fatigue
      : 0;
    nextPlayer.systemVariables.fatigue = currentFatigue + numVal;
    summaryParts.push(`Fatigue +${numVal} (${currentFatigue} → ${currentFatigue + numVal})`);
  } else if (penaltyType === 'STREAK') {
    const prevStreak = nextPlayer.systemVariables.questStreak || 0;
    nextPlayer.systemVariables.questStreak = 0;
    summaryParts.push(`Quest streak reset to 0 (was ${prevStreak})`);
  } else if (statEffects.length === 0 && currencyEffects.length === 0 && summaryParts.length === 0) {
    // Custom / System defined penalty
    nextPlayer.systemVariables.lastAppliedPenalty = {
      questTitle: quest.title,
      penalty: penaltyInfo.description || 'System penalty applied',
      appliedAt: now.toISOString(),
    };
    summaryParts.push(penaltyInfo.description || 'System penalty applied');
  }

  const penaltyAppliedSummary = summaryParts.length > 0 ? summaryParts.join(' | ') : (penaltyInfo.description || `Penalty: ${penaltyType}`);

  // Mark quest as penalty applied in nextPlayer.quests
  const targetId = quest.questId || quest.id;
  nextPlayer.quests = nextPlayer.quests.map((q) => {
    if (typeof q === 'object' && q !== null) {
      const qId = q.questId || q.id;
      if ((targetId && qId === targetId) || (q.title && q.title.toLowerCase() === quest.title.toLowerCase())) {
        return {
          ...q,
          penaltyApplied: true,
        };
      }
    }
    return q;
  });

  // Create audit system event
  const nowIso = now.toISOString();
  const eventId = `evt_penalty_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  
  const rawMessageLines = [
    `[SYSTEM EVENT] ⚠️ QUEST INCOMPLETION PENALTY APPLIED`,
    `Quest: "${quest.title}"`,
    `Penalty Details: ${penaltyAppliedSummary}`,
  ];
  if (statAppliedParts.length > 0) {
    rawMessageLines.push(`STAT PENALTY: ${statAppliedParts.join(', ')}`);
  }
  if (currencyAppliedParts.length > 0) {
    rawMessageLines.push(`CURRENCY PENALTY: ${currencyAppliedParts.join(', ')}`);
  }
  rawMessageLines.push(`Source: Custom Quest — ${quest.title}`);
  rawMessageLines.push(`Timestamp: ${nowIso}`);
  rawMessageLines.push(`Status: FAILED / PENALTY APPLIED`);
  rawMessageLines.push(`State Version: v${(nextPlayer.stateVersion ?? 0) + 1}`);

  let eventSummary = `⚠️ Quest Incompletion Penalty Applied: "${quest.title}" (${penaltyAppliedSummary})`;
  if (statAppliedParts.length > 0 && currencyAppliedParts.length > 0) {
    eventSummary = `⚠️ PENALTY APPLIED: ${statAppliedParts.join(', ')} | ${currencyAppliedParts.join(', ')} (Source: "${quest.title}")`;
  } else if (statAppliedParts.length > 0) {
    eventSummary = `📊 STAT PENALTY: ${statAppliedParts.join(', ')} (Source: "${quest.title}")`;
  } else if (currencyAppliedParts.length > 0) {
    eventSummary = `🪙 CURRENCY PENALTY: ${currencyAppliedParts.join(', ')} (Source: "${quest.title}")`;
  }

  const penaltyEvent: SystemEvent = {
    id: eventId,
    timestamp: nowIso,
    formattedDate: now.toLocaleString(),
    source: 'SYSTEM CORE // PENALTY ENGINE',
    type: 'quest_incompletion_penalty',
    rawMessage: rawMessageLines.join('\n'),
    summary: eventSummary,
    read: false,
    importance: 'HIGH',
    category: 'penalty',
    processed: true,
    processedAt: nowIso,
    stateChangesApplied: true,
  };

  nextPlayer.stateVersion = (nextPlayer.stateVersion ?? 0) + 1;

  return {
    updatedPlayer: nextPlayer,
    penaltyApplied: true,
    penaltyEvent,
    penaltySummary: penaltyAppliedSummary,
  };
}

/**
 * Processes expired custom-timer quests independently from the daily cycle.
 */
export function processExpiredCustomQuests(
  player: PlayerState,
  globalPenaltiesEnabled: boolean,
  now: Date = new Date()
): {
  updatedPlayer: PlayerState;
  events: SystemEvent[];
  expiredCount: number;
} {
  const quests = Array.isArray(player.quests) ? [...player.quests] : [];
  const events: SystemEvent[] = [];
  let expiredCount = 0;
  let currentPlayer = { ...player };
  let didChange = false;

  const nowTime = now.getTime();
  const nowIso = now.toISOString();

  const updatedQuests = quests.map((q) => {
    if (typeof q === 'string') return q;

    const timingType = getQuestTimingType(q);
    // Custom quests have a specific expiresAt timestamp and operate independently
    if (timingType === 'CUSTOM' && q.expiresAt && q.status === 'ACTIVE') {
      const expiryTime = new Date(q.expiresAt).getTime();
      if (!isNaN(expiryTime) && nowTime >= expiryTime) {
        expiredCount++;
        didChange = true;

        // Process penalty if configured
        let penaltyApplied = q.penaltyApplied || false;
        if (!penaltyApplied) {
          const penaltyResult = applyQuestIncompletionPenalty(currentPlayer, q, globalPenaltiesEnabled, now);
          if (penaltyResult.penaltyApplied) {
            currentPlayer = penaltyResult.updatedPlayer;
            if (penaltyResult.penaltyEvent) {
              events.push(penaltyResult.penaltyEvent);
            }
            penaltyApplied = true;
          }
        }

        // Emit expiration event
        const expireEventId = `evt_expire_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
        const expireEvent: SystemEvent = {
          id: expireEventId,
          timestamp: nowIso,
          formattedDate: now.toLocaleString(),
          source: 'SYSTEM CORE // QUEST ENGINE',
          type: 'quest_expired',
          rawMessage: [
            `[SYSTEM EVENT] ⏰ CUSTOM QUEST EXPIRED`,
            `Quest: "${q.title}"`,
            `Created At: ${q.createdAt || 'N/A'}`,
            `Expired At: ${q.expiresAt}`,
            `Final Status: FAILED`,
            `Penalty Status: ${penaltyApplied ? 'Applied' : 'None / Disabled'}`,
          ].join('\n'),
          summary: `⏰ Quest Expired: "${q.title}" (Custom timer reached zero)`,
          read: false,
          importance: 'MEDIUM',
          category: 'quest',
          processed: true,
          processedAt: nowIso,
          stateChangesApplied: true,
        };
        events.push(expireEvent);

        const updatedQuest: QuestItem = {
          ...q,
          status: 'FAILED',
          penaltyApplied,
          archivedAt: nowIso,
        };

        return updatedQuest;
      }
    }
    return q;
  });

  if (didChange) {
    currentPlayer = {
      ...currentPlayer,
      quests: updatedQuests,
      stateVersion: (currentPlayer.stateVersion ?? 0) + 1,
    };
  }

  return {
    updatedPlayer: currentPlayer,
    events,
    expiredCount,
  };
}

export interface QuestCycleStatusResult {
  updatedPlayer: PlayerState;
  events: SystemEvent[];
  completedDailyCount: number;
  totalDailyCount: number;
  failedDailyCount: number;
  refreshed: boolean;
}

/**
 * Automatic 24-Hour Daily Quest Cycle Refresh.
 * Executes automatically when currentTime >= nextQuestRefreshAt.
 * NO confirmation required!
 * Archives old daily quests, processes incompletion penalties, and sets dailyQuestRefreshRequired = true.
 */
export function executeAutomaticDailyCycleRefresh(
  currentState: PlayerState,
  globalPenaltiesEnabled: boolean,
  now: Date = new Date()
): QuestCycleStatusResult {
  const nowIso = now.toISOString();
  const nextRefreshIso = new Date(now.getTime() + QUEST_REFRESH_INTERVAL_MS).toISOString();
  const existingQuests = Array.isArray(currentState.quests) ? currentState.quests : [];
  const events: SystemEvent[] = [];

  let currentPlayer = { ...currentState };

  // 1. Separate Special / Custom / Permanent Quests from Daily Quests
  const preservedSpecialQuests: (string | QuestItem)[] = [];
  const oldDailyQuests: (string | QuestItem)[] = [];

  for (const q of existingQuests) {
    if (isSpecialQuest(q)) {
      preservedSpecialQuests.push(q);
    } else {
      oldDailyQuests.push(q);
    }
  }

  // 2. Evaluate completion and apply penalties to uncompleted daily quests
  let completedDailyCount = 0;
  let failedDailyCount = 0;
  const totalDailyCount = oldDailyQuests.length;

  const evaluatedDailyQuests = oldDailyQuests.map((q) => {
    if (typeof q === 'string') {
      const isComp = /\[completed\]/i.test(q);
      if (isComp) {
        completedDailyCount++;
        return {
          title: q,
          status: 'COMPLETED' as const,
          archivedAt: nowIso,
          cycleGeneratedAt: currentState.questCycleStartedAt || currentState.questGeneratedAt || nowIso,
        };
      } else {
        failedDailyCount++;
        return {
          title: q,
          status: 'FAILED' as const,
          archivedAt: nowIso,
          cycleGeneratedAt: currentState.questCycleStartedAt || currentState.questGeneratedAt || nowIso,
        };
      }
    }

    if (q.status === 'COMPLETED') {
      completedDailyCount++;
      return {
        ...q,
        archivedAt: nowIso,
        cycleGeneratedAt: currentState.questCycleStartedAt || currentState.questGeneratedAt || nowIso,
      };
    }

    // Incomplete daily quest -> apply penalty if configured
    failedDailyCount++;
    let penaltyApplied = q.penaltyApplied || false;

    if (!penaltyApplied) {
      const penaltyResult = applyQuestIncompletionPenalty(currentPlayer, q, globalPenaltiesEnabled, now);
      if (penaltyResult.penaltyApplied) {
        currentPlayer = penaltyResult.updatedPlayer;
        if (penaltyResult.penaltyEvent) {
          events.push(penaltyResult.penaltyEvent);
        }
        penaltyApplied = true;
      }
    }

    return {
      ...q,
      status: 'FAILED' as const,
      penaltyApplied,
      archivedAt: nowIso,
      cycleGeneratedAt: currentState.questCycleStartedAt || currentState.questGeneratedAt || nowIso,
    };
  });

  // 3. Archive old daily quests into history
  const existingArchive = Array.isArray(currentPlayer.archivedQuests) ? currentPlayer.archivedQuests : [];
  const updatedArchive = [...existingArchive, ...evaluatedDailyQuests];

  // 4. Update Player State with new cycle timestamps and mark dailyQuestRefreshRequired = true
  const updatedPlayer: PlayerState = {
    ...currentPlayer,
    questCycleStartedAt: nowIso,
    questGeneratedAt: nowIso,
    nextQuestRefreshAt: nextRefreshIso,
    dailyQuestRefreshRequired: true,
    questRefreshAvailable: false,
    questRefreshRequested: false,
    questRefreshRequestedAt: undefined,
    quests: preservedSpecialQuests, // No invented quests! Only preserved persistent / special quests
    archivedQuests: updatedArchive,
    systemVariables: {
      ...(currentPlayer.systemVariables || {}),
      questCycleStartedAt: nowIso,
      questGeneratedAt: nowIso,
      nextQuestRefreshAt: nextRefreshIso,
      dailyQuestRefreshRequired: true,
      lastQuestRefreshCycle: nowIso,
      lastDailyCompletionRatio: `${completedDailyCount}/${totalDailyCount}`,
      questStatus: 'NEW_CYCLE_READY',
    },
    stateVersion: (currentPlayer.stateVersion ?? 0) + 1,
  };

  // 5. System Event Record: 🔄 Daily Quest Cycle Refreshed
  const refreshEventId = `evt_daily_refresh_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  const refreshEvent: SystemEvent = {
    id: refreshEventId,
    timestamp: nowIso,
    formattedDate: now.toLocaleString(),
    source: 'SYSTEM CORE // QUEST ENGINE',
    type: 'quest_refresh',
    rawMessage: [
      `[SYSTEM EVENT] 🔄 DAILY QUEST CYCLE REFRESHED`,
      `Cycle Started At: ${nowIso}`,
      `Next Refresh Scheduled: ${nextRefreshIso}`,
      `Completed Dailies: ${completedDailyCount}/${totalDailyCount}`,
      `Failed/Expired Dailies: ${failedDailyCount}/${totalDailyCount}`,
      `Special/Persistent Quests Preserved: ${preservedSpecialQuests.length}`,
      `Status: ⚔️ NEW QUEST CYCLE READY (Awaiting System Controller directives)`,
      `State Version: v${updatedPlayer.stateVersion}`,
    ].join('\n'),
    summary: `🔄 Daily Quest Cycle Refreshed (${completedDailyCount}/${totalDailyCount} completed). ⚔️ NEW QUEST CYCLE READY.`,
    read: false,
    importance: 'normal',
    category: 'quest',
    processed: true,
    processedAt: nowIso,
    stateChangesApplied: true,
  };

  events.unshift(refreshEvent);

  return {
    updatedPlayer,
    events,
    completedDailyCount,
    totalDailyCount,
    failedDailyCount,
    refreshed: true,
  };
}

/**
 * Initializes quest timestamps if missing on app boot/load.
 * Strictly preserves existing quests without inventing starter quests.
 */
export function ensureQuestTimestamps(player: PlayerState, now: Date = new Date()): PlayerState {
  const hasGen = isValidTimestamp(player.questCycleStartedAt || player.questGeneratedAt);
  const hasNext = isValidTimestamp(player.nextQuestRefreshAt);

  if (hasGen && hasNext) {
    return player;
  }

  const nowIso = now.toISOString();
  const nextIso = new Date(now.getTime() + QUEST_REFRESH_INTERVAL_MS).toISOString();

  const cycleStartedAt = hasGen ? (player.questCycleStartedAt || player.questGeneratedAt!) : nowIso;
  const nextRefreshAt = hasNext ? player.nextQuestRefreshAt! : nextIso;

  return {
    ...player,
    questCycleStartedAt: cycleStartedAt,
    questGeneratedAt: cycleStartedAt,
    nextQuestRefreshAt: nextRefreshAt,
    systemVariables: {
      ...(player.systemVariables || {}),
      questCycleStartedAt: cycleStartedAt,
      questGeneratedAt: cycleStartedAt,
      nextQuestRefreshAt: nextRefreshAt,
    },
    quests: Array.isArray(player.quests) ? player.quests : [],
  };
}

/**
 * Complete check and execution of all quest expirations:
 * 1. Checks and processes independent custom-timer quest expirations
 * 2. Checks and processes 24-hour daily quest cycle refresh if expired
 */
export function checkAndExecuteAllQuestExpirations(
  player: PlayerState,
  globalPenaltiesEnabled: boolean,
  now: Date = new Date()
): {
  updatedPlayer: PlayerState;
  events: SystemEvent[];
  hasChanges: boolean;
} {
  let currentPlayer = { ...player };
  const allEvents: SystemEvent[] = [];
  let hasChanges = false;

  // 1. Process custom-timer quests
  const customResult = processExpiredCustomQuests(currentPlayer, globalPenaltiesEnabled, now);
  if (customResult.expiredCount > 0) {
    currentPlayer = customResult.updatedPlayer;
    allEvents.push(...customResult.events);
    hasChanges = true;
  }

  // 2. Process daily cycle refresh if expired
  if (isValidTimestamp(currentPlayer.nextQuestRefreshAt)) {
    const nextRefreshTime = new Date(currentPlayer.nextQuestRefreshAt!).getTime();
    if (now.getTime() >= nextRefreshTime) {
      const dailyResult = executeAutomaticDailyCycleRefresh(currentPlayer, globalPenaltiesEnabled, now);
      if (dailyResult.refreshed) {
        currentPlayer = dailyResult.updatedPlayer;
        allEvents.push(...dailyResult.events);
        hasChanges = true;
      }
    }
  }

  return {
    updatedPlayer: currentPlayer,
    events: allEvents,
    hasChanges,
  };
}

/**
 * Creates a Quest Refresh Request manually without creating or modifying quests.
 */
export function createQuestRefreshRequest(
  currentState: PlayerState,
  now: Date = new Date()
): { updatedPlayer: PlayerState; systemEvent: SystemEvent; alreadyRequested: boolean } {
  if (currentState.questRefreshRequested) {
    return {
      updatedPlayer: currentState,
      systemEvent: {
        id: `evt_quest_req_${Date.now().toString(36)}`,
        timestamp: now.toISOString(),
        formattedDate: now.toLocaleString(),
        source: 'SYSTEM CORE // QUEST ENGINE',
        type: 'quest_refresh_request',
        rawMessage: 'Quest refresh already requested. Awaiting System Controller.',
        summary: 'Quest refresh already requested.',
        read: true,
        category: 'system',
        processed: true,
        processedAt: now.toISOString(),
        stateChangesApplied: false,
      },
      alreadyRequested: true,
    };
  }

  const nowIso = now.toISOString();
  const updatedPlayer: PlayerState = {
    ...currentState,
    questRefreshRequested: true,
    questRefreshRequestedAt: nowIso,
    questRefreshAvailable: false,
    systemVariables: {
      ...(currentState.systemVariables || {}),
      questRefreshRequested: true,
      questRefreshRequestedAt: nowIso,
      questRefreshAvailable: false,
      questStatus: 'REFRESH_REQUESTED',
    },
  };

  const systemEvent: SystemEvent = {
    id: `evt_quest_req_${Date.now().toString(36)}`,
    timestamp: nowIso,
    formattedDate: now.toLocaleString(),
    source: 'SYSTEM CORE // QUEST ENGINE',
    type: 'quest_refresh_request',
    rawMessage: [
      `[SYSTEM EVENT] QUEST REFRESH REQUESTED BY PLAYER`,
      `Request Timestamp: ${nowIso}`,
      `Status: REFRESH REQUESTED (Awaiting new quest directives from System Controller)`,
      `Note: The app does not generate quests autonomously. Only the System Controller can supply replacement quests.`,
    ].join('\n'),
    summary: '⚔️ Quest refresh requested. Awaiting System Controller.',
    read: true,
    category: 'system',
    processed: true,
    processedAt: nowIso,
    stateChangesApplied: true,
  };

  return {
    updatedPlayer,
    systemEvent,
    alreadyRequested: false,
  };
}

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * CUSTOM QUEST CREATOR & LIFECYCLE ENGINE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

/**
 * Generates an immutable, unique quest ID for custom player quests.
 * Format: "custom_quest_<timestamp>_<random>"
 */
export function generateCustomQuestId(): string {
  const timestamp = Date.now().toString(36);
  const rand = Math.random().toString(36).substring(2, 7);
  return `custom_quest_${timestamp}_${rand}`;
}

/**
 * Formats a clean reward summary string from structured QuestRewards
 */
export function formatQuestRewardSummary(rewards?: QuestRewards | string | Record<string, any>): string {
  if (!rewards) return '';
  if (typeof rewards === 'string') return rewards;

  const parts: string[] = [];
  if (rewards.xp && rewards.xp > 0) parts.push(`+${rewards.xp} XP`);

  // Currency rewards
  const currencyEffects = extractQuestRewardCurrencyEffects(rewards);
  if (currencyEffects.length > 0) {
    for (const c of currencyEffects) {
      const sign = c.operation === 'decrease' ? '-' : '+';
      parts.push(`🪙 ${c.currencyName || 'Coins'} ${sign}${c.amount}`);
    }
  } else if (rewards.coins && rewards.coins > 0) {
    parts.push(`🪙 Coins +${rewards.coins}`);
  }

  // Stat rewards
  const statEffects = extractQuestRewardStatEffects(rewards);
  for (const eff of statEffects) {
    const icon = getStatIcon(eff.stat);
    const sign = eff.operation === 'decrease' ? '-' : '+';
    parts.push(`${icon} ${eff.statName || getStatFullName(eff.stat)} ${sign}${eff.amount}`);
  }

  // Item rewards
  if (rewards.items && Array.isArray(rewards.items)) {
    for (const item of rewards.items) {
      if (item && item.name) {
        parts.push(`${item.quantity > 1 ? `×${item.quantity} ` : ''}${item.name}`);
      }
    }
  }

  if (rewards.title) parts.push(`Title: "${rewards.title}"`);
  if (rewards.custom && statEffects.length === 0 && currencyEffects.length === 0) parts.push(rewards.custom);

  return parts.join(', ');
}

/**
 * Formats a clean penalty summary string from structured QuestPenalty.
 * Displays both 📊 STAT PENALTIES and 🪙 CURRENCY PENALTIES clearly.
 */
export function formatQuestPenaltySummary(penalty?: QuestPenalty | string | QuestItem | Record<string, any>): string {
  if (!penalty) return '';
  if (typeof penalty === 'string') {
    const parsedStats = parseExplicitStatEffects(penalty);
    const parsedCurrencies = parseExplicitCurrencyEffects(penalty);
    const parts: string[] = [];
    if (parsedStats.length > 0) {
      parts.push(...parsedStats.map((e) => `${getStatIcon(e.stat)} ${e.statName || getStatFullName(e.stat)} ${e.operation === 'increase' ? `+${e.amount}` : `-${e.amount}`}`));
    }
    if (parsedCurrencies.length > 0) {
      parts.push(...parsedCurrencies.map((c) => `🪙 ${c.currencyName || 'Coins'} ${c.operation === 'increase' ? `+${c.amount}` : `-${c.amount}`}`));
    }
    if (parts.length > 0) return parts.join(', ');
    return penalty;
  }

  const penaltyInfo = parseQuestPenalty(penalty as any);
  if (!penaltyInfo.isExplicit) return '';

  const statEffects = extractQuestPenaltyStatEffects(penaltyInfo, typeof penalty === 'object' ? (penalty as QuestItem) : undefined);
  const currencyEffects = extractQuestPenaltyCurrencyEffects(penaltyInfo, typeof penalty === 'object' ? (penalty as QuestItem) : undefined);

  const parts: string[] = [];
  if (statEffects.length > 0) {
    parts.push(...statEffects.map((eff) => {
      const icon = getStatIcon(eff.stat);
      const sign = eff.operation === 'increase' ? '+' : '-';
      return `${icon} ${eff.statName || getStatFullName(eff.stat)} ${sign}${eff.amount}`;
    }));
  }
  if (currencyEffects.length > 0) {
    parts.push(...currencyEffects.map((eff) => {
      const sign = eff.operation === 'increase' ? '+' : '-';
      return `🪙 ${eff.currencyName || 'Coins'} ${sign}${eff.amount}`;
    }));
  }

  if (parts.length > 0) {
    return parts.join(', ');
  }

  return penaltyInfo.description || `${penaltyInfo.type || 'PENALTY'}${penaltyInfo.value !== undefined ? ` (${penaltyInfo.value})` : ''}`;
}

/**
 * Creates a fully validated, normalized QuestItem instance from partial input
 */
export function createCustomQuestItem(input: Partial<QuestItem> & { title: string }): QuestItem {
  const questId = input.questId || input.id || generateCustomQuestId();
  const now = new Date();
  const nowIso = now.toISOString();
  const createdAt = input.createdAt || nowIso;

  // Calculate expiration timestamp if duration is specified and expiresAt is not provided
  let expiresAt = input.expiresAt;
  if (!expiresAt) {
    const durHours = input.durationHours ?? 0;
    const durMins = input.durationMinutes ?? 0;
    const durDays = input.durationDays ?? 0;
    const totalMs = (durDays * 24 * 60 * 60 + durHours * 60 * 60 + durMins * 60) * 1000;

    if (totalMs > 0) {
      const startMs = input.startTime ? new Date(input.startTime).getTime() : now.getTime();
      expiresAt = new Date(startMs + totalMs).toISOString();
    }
  }

  // Format requirement list
  const rawReqs = input.requirements || [];
  const normalizedReqs: Array<{ id: string; text: string; completed?: boolean }> = rawReqs.map((r, idx) => {
    if (typeof r === 'string') {
      return { id: `req_${idx + 1}`, text: r, completed: false };
    }
    return {
      id: r.id || `req_${idx + 1}`,
      text: r.text || '',
      completed: !!r.completed,
    };
  });

  // Calculate formatted progress string
  let progressStr = input.progress;
  if (input.progressType === 'NUMERIC' && input.targetValue !== undefined) {
    const cur = input.currentValue ?? 0;
    const unitStr = input.unit ? ` ${input.unit}` : '';
    progressStr = `${cur} / ${input.targetValue}${unitStr}`;
  } else if (input.progressType === 'PERCENTAGE') {
    const cur = input.currentValue ?? 0;
    progressStr = `${cur}%`;
  } else if (input.progressType === 'STAGES' || input.progressType === 'CHECKBOX') {
    const total = normalizedReqs.length;
    const done = normalizedReqs.filter((r) => r.completed).length;
    if (total > 0) {
      progressStr = `${done} / ${total} completed`;
    }
  }

  // Extract structured reward stat effects & currency effects
  const rewardStatEffects = extractQuestRewardStatEffects(input.rewards, input as QuestItem);
  const rewardCurrencyEffects = extractQuestRewardCurrencyEffects(input.rewards, input as QuestItem);
  const structuredRewards: QuestRewards = {
    ...(typeof input.rewards === 'object' ? input.rewards : {}),
    statEffects: rewardStatEffects.length > 0 ? rewardStatEffects : input.rewards?.statEffects,
    currencyEffects: rewardCurrencyEffects.length > 0 ? rewardCurrencyEffects : input.rewards?.currencyEffects,
    coins: rewardCurrencyEffects.length > 0 ? rewardCurrencyEffects[0].amount : input.rewards?.coins,
  };

  // Build reward summary
  const rewardSummary = formatQuestRewardSummary(structuredRewards) || (typeof input.reward === 'string' ? input.reward : '');

  // Normalized penalty object & structured penalty stat effects + currency effects
  const penaltyStatEffects = extractQuestPenaltyStatEffects(
    typeof input.penalty === 'object' ? (input.penalty as any) : undefined,
    input as QuestItem
  );
  const penaltyCurrencyEffects = extractQuestPenaltyCurrencyEffects(
    typeof input.penalty === 'object' ? (input.penalty as any) : undefined,
    input as QuestItem
  );

  const penaltyEnabled = input.penaltyEnabled ?? (typeof input.penalty === 'object' ? (input.penalty as any)?.enabled !== false : !!input.penalty);
  let penaltyType = input.penaltyType || (typeof input.penalty === 'object' ? (input.penalty as any)?.type : undefined);
  if (!penaltyType) {
    if (penaltyStatEffects.length > 0 && penaltyCurrencyEffects.length > 0) {
      penaltyType = 'STAT_AND_CURRENCY';
    } else if (penaltyStatEffects.length > 0) {
      penaltyType = 'STAT';
    } else if (penaltyCurrencyEffects.length > 0) {
      penaltyType = 'COIN';
    } else {
      penaltyType = 'XP';
    }
  }

  let penaltyVal = input.penaltyValue ?? (typeof input.penalty === 'object' ? (input.penalty as any)?.value : undefined);
  let penaltyDesc = input.penaltyDescription || (typeof input.penalty === 'object' ? (input.penalty as any)?.description : undefined);

  if (penaltyStatEffects.length > 0 || penaltyCurrencyEffects.length > 0) {
    const parts: string[] = [];
    if (penaltyStatEffects.length > 0) {
      parts.push(...penaltyStatEffects.map((e) => `${getStatIcon(e.stat)} ${e.statName || getStatFullName(e.stat)} ${e.operation === 'increase' ? `+${e.amount}` : `-${e.amount}`}`));
    }
    if (penaltyCurrencyEffects.length > 0) {
      parts.push(...penaltyCurrencyEffects.map((c) => `🪙 ${c.currencyName || 'Coins'} ${c.operation === 'increase' ? `+${c.amount}` : `-${c.amount}`}`));
    }
    penaltyDesc = parts.join(', ');
  } else if (!penaltyDesc && penaltyVal !== undefined && penaltyEnabled) {
    penaltyDesc = `Lose ${penaltyVal} ${penaltyType} if failed`;
  }

  const normalizedPenalty: QuestPenalty = {
    enabled: penaltyEnabled,
    type: penaltyType,
    value: penaltyVal,
    description: penaltyDesc,
    statEffects: penaltyStatEffects.length > 0 ? penaltyStatEffects : undefined,
    currencyEffects: penaltyCurrencyEffects.length > 0 ? penaltyCurrencyEffects : undefined,
    coins: penaltyCurrencyEffects.length > 0 ? penaltyCurrencyEffects[0].amount : undefined,
  };

  const questItem: QuestItem = {
    id: questId,
    questId,
    title: input.title.trim(),
    description: input.description?.trim() || undefined,
    type: input.type || (expiresAt ? 'CUSTOM' : 'MANUAL'),
    difficulty: input.difficulty || 'Medium',
    rank: input.rank || 'C',
    requirements: normalizedReqs,
    requirementLogic: input.requirementLogic || 'ALL',
    progressType: input.progressType || 'CHECKBOX',
    targetValue: input.targetValue,
    currentValue: input.currentValue ?? 0,
    unit: input.unit?.trim() || undefined,
    startTime: input.startTime || createdAt,
    createdAt,
    expiresAt: expiresAt || undefined,
    durationHours: input.durationHours,
    durationMinutes: input.durationMinutes,
    durationDays: input.durationDays,
    status: input.status || 'ACTIVE',
    progress: progressStr,
    completionRequirement: input.completionRequirement || (normalizedReqs.length > 0 ? normalizedReqs.map(r => r.text).join('; ') : undefined),
    rewards: structuredRewards,
    reward: rewardSummary || input.reward,
    rewardApplied: !!input.rewardApplied,
    statEffects: rewardStatEffects.length > 0 ? rewardStatEffects : undefined,
    penalty: normalizedPenalty,
    penaltyEnabled,
    penaltyType,
    penaltyValue: penaltyVal,
    penaltyDescription: penaltyDesc,
    penaltyApplied: !!input.penaltyApplied,
    penaltyStatEffects: penaltyStatEffects.length > 0 ? penaltyStatEffects : undefined,
    penaltyCurrencyEffects: penaltyCurrencyEffects.length > 0 ? penaltyCurrencyEffects : undefined,
    penaltyCoins: penaltyCurrencyEffects.length > 0 ? penaltyCurrencyEffects[0].amount : undefined,
    category: input.category || 'custom',
    priority: input.priority || 'MEDIUM',
    tags: input.tags || [],
    notes: input.notes?.trim() || undefined,
    icon: input.icon || '⚔️',
    maxAttempts: input.maxAttempts,
    currentAttempts: input.currentAttempts ?? 0,
    cooldown: input.cooldown,
    isDaily: input.type === 'DAILY' || input.isDaily === true,
    isCustom: true,
    enabled: input.enabled !== false,
    author: input.author || 'PLAYER',
  };

  return questItem;
}

/**
 * Executes quest completion or reactivation with atomic state updates,
 * granting rewards (XP, Coins, Items, Stats, Titles) when completed.
 */
export function executeQuestCompletion(
  currentState: PlayerState,
  questIdOrTitle: string,
  now: Date = new Date()
): {
  updatedPlayer: PlayerState;
  systemEvent?: SystemEvent;
  isCompleted: boolean;
  rewardSummary?: string;
} {
  const existingQuests = [...(currentState.quests || [])];
  const nowIso = now.toISOString();
  let foundQuest: QuestItem | null = null;
  let targetIndex = -1;

  for (let i = 0; i < existingQuests.length; i++) {
    const q = existingQuests[i];
    const qId = typeof q === 'object' ? (q.questId || q.id) : undefined;
    const qTitle = typeof q === 'string' ? q : q.title;
    if (
      (qId && qId === questIdOrTitle) ||
      (qTitle && qTitle.toLowerCase() === questIdOrTitle.toLowerCase())
    ) {
      targetIndex = i;
      if (typeof q === 'object') {
        foundQuest = { ...q };
      } else {
        foundQuest = {
          id: `quest_${Date.now()}`,
          title: q,
          status: /\[completed\]/i.test(q) ? 'COMPLETED' : 'ACTIVE',
        };
      }
      break;
    }
  }

  if (!foundQuest || targetIndex === -1) {
    return { updatedPlayer: currentState, isCompleted: false };
  }

  const wasCompleted = foundQuest.status === 'COMPLETED' || (typeof existingQuests[targetIndex] === 'string' && /\[completed\]/i.test(existingQuests[targetIndex] as string));
  const newStatus: QuestStatus = wasCompleted ? 'ACTIVE' : 'COMPLETED';

  let nextPlayer: PlayerState = {
    ...currentState,
    progression: {
      level: currentState.progression?.level ?? currentState.level ?? '1',
      xp: currentState.progression?.xp ?? currentState.xp ?? '0',
      ...(currentState.progression || {}),
    },
    systemVariables: { ...(currentState.systemVariables || {}) },
    attributes: { ...(currentState.attributes || {}) },
    inventory: [...(currentState.inventory || [])],
    titles: [...(currentState.titles || [])],
  };

  let rewardSummary = '';
  const rewardGrantedParts: string[] = [];
  const statChangeParts: string[] = [];

  // When completing (and rewards not yet applied), grant rewards atomically
  if (!wasCompleted && !foundQuest.rewardApplied) {
    const rewards = foundQuest.rewards;

    // 1. XP Reward
    const xpReward = rewards?.xp ?? (typeof foundQuest.reward === 'object' ? (foundQuest.reward as any)?.xp : undefined);
    if (xpReward && typeof xpReward === 'number' && xpReward > 0) {
      const curXp = typeof nextPlayer.progression.xp === 'number'
        ? nextPlayer.progression.xp
        : (parseInt(String(nextPlayer.xp || '0'), 10) || 0);
      const newXp = curXp + xpReward;
      nextPlayer.progression.xp = newXp;
      nextPlayer.xp = String(newXp);
      rewardGrantedParts.push(`+${xpReward} XP`);
    }

    // 2. Currency Rewards (Coins)
    const currencyEffects = extractQuestRewardCurrencyEffects(rewards, foundQuest);
    if (currencyEffects.length > 0) {
      for (const curEff of currencyEffects) {
        const curCoins = typeof nextPlayer.systemVariables.coins === 'number'
          ? nextPlayer.systemVariables.coins
          : (parseInt(String(nextPlayer.systemVariables.coins || '0'), 10) || 0);
        const delta = curEff.operation === 'decrease' || curEff.operation === 'subtract' ? -Math.abs(curEff.amount) : Math.abs(curEff.amount);
        const newCoins = Math.max(0, curCoins + delta);
        nextPlayer.systemVariables.coins = newCoins;
        rewardGrantedParts.push(`🪙 ${curEff.currencyName || 'Coins'} ${delta >= 0 ? `+${delta}` : delta}`);
      }
    } else {
      const coinReward = rewards?.coins ?? (typeof foundQuest.reward === 'object' ? (foundQuest.reward as any)?.coins : undefined);
      if (coinReward && typeof coinReward === 'number' && coinReward > 0) {
        const curCoins = typeof nextPlayer.systemVariables.coins === 'number'
          ? nextPlayer.systemVariables.coins
          : (parseInt(String(nextPlayer.systemVariables.coins || '0'), 10) || 0);
        nextPlayer.systemVariables.coins = curCoins + coinReward;
        rewardGrantedParts.push(`🪙 Coins +${coinReward}`);
      }
    }

    // 3. Item Rewards
    const itemRewards = rewards?.items;
    if (itemRewards && Array.isArray(itemRewards)) {
      for (const item of itemRewards) {
        if (item && item.name) {
          const qty = Math.max(1, item.quantity || 1);
          const cleanName = item.name.trim();
          const existIdx = nextPlayer.inventory.findIndex(
            (inv) => (typeof inv === 'string' ? inv : inv.name).toLowerCase() === cleanName.toLowerCase()
          );

          if (existIdx >= 0) {
            const curInv = nextPlayer.inventory[existIdx];
            if (typeof curInv === 'object') {
              nextPlayer.inventory[existIdx] = {
                ...curInv,
                quantity: (curInv.quantity || 1) + qty,
              };
            } else {
              nextPlayer.inventory[existIdx] = {
                name: cleanName,
                quantity: 1 + qty,
              };
            }
          } else {
            nextPlayer.inventory.push({
              name: cleanName,
              quantity: qty,
              rank: item.rank,
              rarity: item.rarity,
            });
          }
          rewardGrantedParts.push(`${qty > 1 ? `×${qty} ` : ''}${cleanName}`);
        }
      }
    }

    // 4. Stat Rewards (Atomic execution)
    const statEffects = extractQuestRewardStatEffects(rewards, foundQuest);
    if (statEffects.length > 0) {
      for (const eff of statEffects) {
        const statKey = resolvePlayerStatKey(nextPlayer.attributes, eff.stat);
        const rawCurrent = nextPlayer.attributes[statKey];
        const curVal = typeof rawCurrent === 'number'
          ? rawCurrent
          : (parseFloat(String(rawCurrent || 0)) || 0);
        const delta = eff.operation === 'decrease' || eff.operation === 'subtract' ? -Math.abs(eff.amount) : Math.abs(eff.amount);
        const newVal = curVal + delta;
        nextPlayer.attributes[statKey] = newVal;

        const icon = getStatIcon(eff.stat);
        const partStr = `${icon} ${statKey} ${delta >= 0 ? `+${delta}` : delta}`;
        rewardGrantedParts.push(partStr);
        statChangeParts.push(partStr);
      }
    }

    // 5. Title Reward
    if (rewards?.title && !nextPlayer.titles.includes(rewards.title)) {
      nextPlayer.titles.push(rewards.title);
      rewardGrantedParts.push(`Title: "${rewards.title}"`);
    }

    if (rewardGrantedParts.length > 0) {
      rewardSummary = rewardGrantedParts.join(', ');
    }
  }

  // Update the quest in the list
  const updatedQuestObj: QuestItem = {
    ...foundQuest,
    status: newStatus,
    rewardApplied: newStatus === 'COMPLETED' ? true : foundQuest.rewardApplied,
    completedAt: newStatus === 'COMPLETED' ? nowIso : undefined,
  };

  existingQuests[targetIndex] = updatedQuestObj;
  nextPlayer.quests = existingQuests;
  nextPlayer.stateVersion = (nextPlayer.stateVersion ?? 0) + 1;

  // System Event creation
  let systemEvent: SystemEvent | undefined;
  if (newStatus === 'COMPLETED') {
    const eventId = `evt_quest_comp_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const rawLines = [
      `[QUEST COMPLETED] "${foundQuest.title}"`,
      `Type: ${foundQuest.type || 'CUSTOM'}`,
      `Completed At: ${nowIso}`,
    ];
    if (rewardSummary) {
      rawLines.push(`Rewards Granted: ${rewardSummary}`);
    }
    if (statChangeParts.length > 0) {
      rawLines.push(`STAT CHANGE: ${statChangeParts.join(', ')}`);
      rawLines.push(`Source: Custom Quest — ${foundQuest.title}`);
    }
    rawLines.push(`State Version: v${nextPlayer.stateVersion}`);

    systemEvent = {
      id: eventId,
      timestamp: nowIso,
      formattedDate: now.toLocaleString(),
      source: 'SYSTEM CORE // QUEST ENGINE',
      type: 'quest_completed',
      category: 'quest',
      rawMessage: rawLines.join('\n'),
      summary: `🏆 Quest Completed: "${foundQuest.title}"${rewardSummary ? ` (${rewardSummary})` : ''}`,
      read: true,
      importance: 'HIGH',
      processed: true,
      processedAt: nowIso,
      stateChangesApplied: true,
    };
  }

  return {
    updatedPlayer: nextPlayer,
    systemEvent,
    isCompleted: newStatus === 'COMPLETED',
    rewardSummary,
  };
}

/**
 * Updates progress for a numeric/percentage or checklist custom quest
 */
export function executeQuestProgressUpdate(
  currentState: PlayerState,
  questIdOrTitle: string,
  deltaOrValue: number,
  isAbsolute: boolean = false
): {
  updatedPlayer: PlayerState;
  completedNow: boolean;
  message: string;
} {
  const existingQuests = [...(currentState.quests || [])];
  let targetIdx = -1;
  let targetQuest: QuestItem | null = null;

  for (let i = 0; i < existingQuests.length; i++) {
    const q = existingQuests[i];
    if (typeof q === 'object') {
      const qId = q.questId || q.id;
      if (qId === questIdOrTitle || q.title?.toLowerCase() === questIdOrTitle.toLowerCase()) {
        targetIdx = i;
        targetQuest = { ...q };
        break;
      }
    }
  }

  if (!targetQuest || targetIdx === -1) {
    return { updatedPlayer: currentState, completedNow: false, message: 'Quest not found' };
  }

  const curVal = targetQuest.currentValue ?? 0;
  const targetVal = targetQuest.targetValue ?? 100;
  const nextVal = isAbsolute ? deltaOrValue : Math.max(0, curVal + deltaOrValue);

  targetQuest.currentValue = nextVal;

  if (targetQuest.progressType === 'NUMERIC') {
    const unitStr = targetQuest.unit ? ` ${targetQuest.unit}` : '';
    targetQuest.progress = `${nextVal} / ${targetVal}${unitStr}`;
  } else if (targetQuest.progressType === 'PERCENTAGE') {
    targetQuest.progress = `${nextVal}%`;
  }

  let completedNow = false;
  // Auto-complete if reached target value and wasn't already completed
  if (nextVal >= targetVal && targetQuest.status !== 'COMPLETED' && targetVal > 0) {
    const compResult = executeQuestCompletion(
      { ...currentState, quests: existingQuests },
      targetQuest.questId || targetQuest.id || targetQuest.title
    );
    return {
      updatedPlayer: compResult.updatedPlayer,
      completedNow: true,
      message: `Quest "${targetQuest.title}" completed! ${compResult.rewardSummary || ''}`,
    };
  }

  existingQuests[targetIdx] = targetQuest;
  const updatedPlayer: PlayerState = {
    ...currentState,
    quests: existingQuests,
    stateVersion: (currentState.stateVersion ?? 0) + 1,
  };

  return {
    updatedPlayer,
    completedNow: false,
    message: `Progress updated: ${targetQuest.progress}`,
  };
}
