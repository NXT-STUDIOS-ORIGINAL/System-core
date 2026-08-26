import {
  SystemCoreDatabase,
  PlayerState,
  SystemEvent,
  MemoryEntry,
  QuestItem,
  SkillItem,
  AchievementItem,
  InventoryItem,
} from '../types';
import { getQuestTimingType, formatDynamicTimer, parseQuestPenalty } from './questManager';

/**
 * Format dynamic progression data
 */
function formatProgressionBlock(
  progression: Record<string, any> = {},
  fallbackLevel: string,
  fallbackXp: string
): string {
  const lines: string[] = [];
  const levelVal = progression.level !== undefined ? String(progression.level) : fallbackLevel;
  const xpVal = progression.xp !== undefined ? String(progression.xp) : fallbackXp;

  lines.push(`Level: ${levelVal}`);
  lines.push(`XP: ${xpVal}`);

  for (const [key, val] of Object.entries(progression)) {
    if (key === 'level' || key === 'xp' || key === 'currentXP' || val === undefined || val === null) continue;
    const formattedKey = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .trim()
      .toUpperCase();
    const valStr = typeof val === 'object' ? JSON.stringify(val) : String(val);
    lines.push(`${formattedKey}: ${valStr}`);
  }
  return lines.join('\n');
}

/**
 * Format collection or return 'NO DATA'
 */
function formatDataBlock(data: any): string {
  if (data === null || data === undefined) {
    return 'NO DATA';
  }
  if (Array.isArray(data)) {
    if (data.length === 0) return 'NO DATA';
    return data
      .map((item) => {
        if (typeof item === 'string') return `- ${item}`;
        if (typeof item === 'object') {
          // Special formatters for structured items
          if ('title' in item && 'status' in item) {
            const catTag = item.category ? `[${String(item.category).toUpperCase()}] ` : '';
            return `- ${catTag}${item.title} [${item.status}]${item.reward ? ` (Reward: ${item.reward})` : ''}`;
          }
          if ('name' in item && 'quantity' in item) {
            return `- ${item.name}${item.quantity && item.quantity > 1 ? ` (x${item.quantity})` : ''}`;
          }
          if ('name' in item) {
            return `- ${item.name}${item.level ? ` (Lv. ${item.level})` : ''}`;
          }
          if ('title' in item) {
            return `- ${item.title}`;
          }
          if ('summary' in item) {
            return `- ${item.summary}`;
          }
          return `- ${JSON.stringify(item)}`;
        }
        return `- ${String(item)}`;
      })
      .join('\n');
  }
  if (typeof data === 'object') {
    const keys = Object.keys(data);
    if (keys.length === 0) return 'NO DATA';
    return keys
      .map((key) => {
        const val = data[key];
        const valStr = typeof val === 'object' ? JSON.stringify(val) : String(val);
        return `${key}: ${valStr}`;
      })
      .join('\n');
  }
  const str = String(data).trim();
  return str.length > 0 ? str : 'NO DATA';
}

/**
 * Formats Quests context block with types, active countdowns, requirements, penalties, and relevant archive history
 */
function formatQuestsContextBlock(player: PlayerState, now: Date = new Date()): string {
  const lines: string[] = [];
  const activeQuests = Array.isArray(player.quests) ? player.quests : [];

  if (activeQuests.length === 0) {
    lines.push('ACTIVE QUESTS: None currently active');
  } else {
    lines.push('ACTIVE QUESTS:');
    for (const q of activeQuests) {
      if (typeof q === 'string') {
        lines.push(`- ${q}`);
        continue;
      }
      const timingType = getQuestTimingType(q);
      const status = q.status || 'ACTIVE';
      const diffRank = [q.difficulty ? `Diff: ${q.difficulty}` : '', q.rank ? `Rank: ${q.rank}` : ''].filter(Boolean).join(', ');
      const diffRankStr = diffRank ? ` [${diffRank}]` : '';
      const timerStr = q.expiresAt
        ? ` | Timer: ${formatDynamicTimer(q.expiresAt, now)} (Expires: ${q.expiresAt})`
        : (timingType === 'DAILY' && player.nextQuestRefreshAt ? ` | Cycle: ${formatDynamicTimer(player.nextQuestRefreshAt, now)}` : '');
      const reqStr = q.completionRequirement ? ` | Req: ${q.completionRequirement}` : (q.requirements && q.requirements.length > 0 ? ` | Req (${q.requirementLogic || 'ALL'}): ${q.requirements.map(r => typeof r === 'string' ? r : `${r.text}${r.completed ? ' [✓]' : ''}`).join('; ')}` : '');
      const progStr = q.progress !== undefined ? ` | Progress: ${q.progress}` : '';
      const rewStr = q.reward ? ` | Reward: ${typeof q.reward === 'object' ? JSON.stringify(q.reward) : q.reward}` : '';

      let penaltyStr = '';
      const penaltyInfo = parseQuestPenalty(q);
      if (penaltyInfo.isExplicit) {
        penaltyStr = ` | Penalty: ${penaltyInfo.description || penaltyInfo.type} [${penaltyInfo.enabled ? 'ENABLED' : 'DISABLED'}]${q.penaltyApplied ? ' (APPLIED)' : ''}`;
      }

      lines.push(`- [${timingType}] ${q.title}${diffRankStr} [${status}]${timerStr}${reqStr}${progStr}${rewStr}${penaltyStr}`);
    }
  }

  // Daily cycle timing status
  if (player.dailyQuestRefreshRequired) {
    lines.push('');
    lines.push('DAILY QUEST CYCLE STATUS: ⚔️ NEW QUEST CYCLE READY (Awaiting System Controller)');
  } else if (player.nextQuestRefreshAt) {
    lines.push('');
    lines.push(`DAILY QUEST CYCLE: Next Refresh in ${formatDynamicTimer(player.nextQuestRefreshAt, now)} (Scheduled: ${player.nextQuestRefreshAt})`);
  }

  // Relevant recent completed & failed quest history from archives (up to 8 to avoid context bloat)
  const archived = Array.isArray(player.archivedQuests) ? player.archivedQuests : [];
  if (archived.length > 0) {
    const recentArchived = archived.slice(-8).reverse();
    lines.push('');
    lines.push('RELEVANT QUEST HISTORY (RECENT COMPLETED / FAILED):');
    for (const aq of recentArchived) {
      if (typeof aq === 'string') {
        lines.push(`- ${aq}`);
      } else {
        const typeTag = aq.type || (aq.category ? String(aq.category).toUpperCase() : 'QUEST');
        const penTag = aq.penaltyApplied ? ' (Penalty Applied)' : '';
        lines.push(`- [${typeTag}] ${aq.title} [${aq.status || 'ARCHIVED'}]${penTag}${aq.archivedAt ? ` (${new Date(aq.archivedAt).toLocaleDateString()})` : ''}`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Format rolling recent memory entries / event summaries up to limit
 */
function formatRecentMemorySummaries(memories: MemoryEntry[] = [], events: SystemEvent[] = [], limit: number = 50): string {
  const summaries: string[] = [];

  if (events && events.length > 0) {
    // Recent events are ordered newest first in db.events, take top `limit`
    const recent = events.slice(0, limit);
    for (const evt of recent) {
      const summaryText = evt.summary || evt.rawMessage.trim().substring(0, 120);
      const sourceTag = evt.source && evt.source !== 'ChatGPT' ? `[${evt.source}] ` : '';
      summaries.push(`${sourceTag}${summaryText}`);
    }
  } else if (memories && memories.length > 0) {
    const slice = memories.slice(Math.max(0, memories.length - limit));
    for (const mem of slice) {
      summaries.push(mem.summary);
    }
  }

  if (summaries.length === 0) {
    return 'NO DATA';
  }

  return summaries
    .map((summary, idx) => `${idx + 1}. ${summary}`)
    .join('\n');
}

/**
 * Formats Item Definitions strictly for items that are relevant (in Inventory or active quests/mechanics).
 * Never dumps the entire database.
 */
function formatRelevantItemDefinitions(db: SystemCoreDatabase): string {
  if (db.settings.itemInformationSystemEnabled === false) {
    return '';
  }

  const defs = db.itemDefinitions || [];
  if (defs.length === 0) return '';

  const activeInventory = db.player?.inventory || [];
  const inventoryItemNames = new Set(
    activeInventory.map((i) => {
      const name = typeof i === 'string' ? i : i.name;
      return name ? name.toLowerCase().replace(/[x×]\s*\d+/g, '').trim() : '';
    }).filter(Boolean)
  );

  const questTitles = (db.player?.quests || []).map((q) => {
    const title = typeof q === 'string' ? q : q.title;
    return title ? title.toLowerCase() : '';
  });

  const relevant = defs.filter((d) => {
    if (!d.enabled) return false;
    const nameLower = d.itemName.toLowerCase();
    const idLower = d.itemId.toLowerCase();

    // Relevant if in current inventory
    if (inventoryItemNames.has(nameLower) || inventoryItemNames.has(idLower)) return true;
    for (const invName of inventoryItemNames) {
      if (invName.includes(nameLower) || nameLower.includes(invName)) return true;
    }

    // Relevant if mentioned in active quests
    for (const q of questTitles) {
      if (q.includes(nameLower) || q.includes(idLower)) return true;
    }

    return false;
  });

  if (relevant.length === 0) return '';

  const lines: string[] = ['RELEVANT ITEM DEFINITIONS:'];
  for (const item of relevant) {
    const details: string[] = [];
    if (item.type) details.push(`Type: ${item.type}`);
    if (item.rank) details.push(`Rank: ${item.rank}`);
    if (item.rarity) details.push(`Rarity: ${item.rarity}`);
    if (item.description) details.push(`Description: ${item.description}`);
    if (item.effects) details.push(`Effects: ${item.effects}`);
    if (item.requirements) details.push(`Requires: ${item.requirements}`);
    if (item.usage) details.push(`Usage: ${item.usage}`);
    if (item.keyType) details.push(`Key: ${item.keyType}`);
    if (item.boxType) details.push(`Box: ${item.boxType}`);
    if (item.sellValue !== undefined) details.push(`Sell: ${item.sellValue}`);
    if (item.specialProperties) details.push(`Special: ${item.specialProperties}`);

    const detailStr = details.length > 0 ? details.join(' | ') : 'No additional properties';
    lines.push(`- ${item.itemName} (v${item.definitionVersion || 1}): ${detailStr}`);
  }

  return lines.join('\n');
}

/**
 * Collects and formats important memories & historical milestones (HIGH / CRITICAL)
 * Preserves critical events (Boss Chain, Titles, Revelations, Milestones) even if very old
 */
function formatImportantMemoryAndMilestones(
  important: (string | MemoryEntry)[] = [],
  events: SystemEvent[] = []
): string {
  const items: Array<{ text: string; importance?: string; date?: string }> = [];
  const seenTexts = new Set<string>();

  // 1. Add explicitly configured player important memories
  for (const item of important) {
    const text = typeof item === 'string' ? item.trim() : item.summary?.trim();
    if (text && !seenTexts.has(text.toLowerCase())) {
      seenTexts.add(text.toLowerCase());
      items.push({
        text,
        importance: typeof item === 'object' ? item.importance : 'HIGH',
        date: typeof item === 'object' && item.timestamp ? new Date(item.timestamp).toLocaleDateString() : undefined,
      });
    }
  }

  // 2. Scan permanent event history for HIGH or CRITICAL importance events or milestones
  for (const evt of events) {
    const imp = (evt.importance || '').toUpperCase();
    const isCriticalOrHigh = imp === 'CRITICAL' || imp === 'HIGH';
    const hasMilestoneKeyword = /(?:boss|stage\s+\d+|unlocked|milestone|title|secret|penalty|resonance|awakened|ruling|decision)/i.test(
      evt.summary || evt.rawMessage
    );

    if (isCriticalOrHigh || hasMilestoneKeyword) {
      const summaryText = evt.summary || evt.rawMessage.trim().substring(0, 120);
      if (summaryText && !seenTexts.has(summaryText.toLowerCase())) {
        seenTexts.add(summaryText.toLowerCase());
        items.push({
          text: summaryText,
          importance: imp || 'HIGH',
          date: evt.timestamp ? new Date(evt.timestamp).toLocaleDateString() : undefined,
        });
      }
    }
  }

  if (items.length === 0) {
    return 'NO DATA';
  }

  return items
    .map((item, idx) => {
      const tag = item.importance ? `[${item.importance}] ` : '';
      const dateStr = item.date ? `(${item.date}) ` : '';
      return `- ${tag}${dateStr}${item.text}`;
    })
    .join('\n');
}

/**
 * Generates the full SYSTEM CONTEXT PACKAGE
 * 100% READ-ONLY with ZERO RPG side effects.
 */
export function generateContextPackage(
  db: SystemCoreDatabase,
  options: { recentEventLimit?: number } = {}
): string {
  const p: PlayerState = db.player || ({} as PlayerState);
  const limit = options.recentEventLimit ?? db.settings.maxRecentMemoryEntries ?? 50;
  const contextVersion = db.settings.contextVersion || '1.0';
  const stateVersion = p.stateVersion ?? 0;
  const sessionVersion = db.settings.sessionVersion ?? 1;
  const generatedAt = new Date().toISOString();

  const levelVal = p.level !== undefined && p.level !== null && p.level !== '--'
    ? p.level
    : (p.progression?.level ?? '1');
  const xpVal = p.xp !== undefined && p.xp !== null && p.xp !== '--'
    ? p.xp
    : (p.progression?.xp ?? '0');

  const parts = [
    '=== SYSTEM CONTEXT PACKAGE ===',
    '',
    `CONTEXT VERSION: ${contextVersion}`,
    `SESSION VERSION: v${sessionVersion}`,
    `PLAYER STATE VERSION: v${stateVersion}`,
    `TOTAL STORED EVENTS: ${db.events.length}`,
    `GENERATED AT: ${generatedAt}`,
    '',
    '=== SECTION 1: PLAYER STATE (CURRENT FACTS) ===',
    '',
    `PLAYER ID: ${p.playerId || db.settings.playerId || 'PLAYER-01'}`,
    `SYSTEM VERSION: ${p.systemVersion || db.settings.systemVersion || '1.0.0'}`,
    '',
    'PROGRESSION:',
    formatProgressionBlock(p.progression, String(levelVal), String(xpVal)),
    '',
    'ATTRIBUTES:',
    formatDataBlock(p.attributes),
    '',
    'SKILLS:',
    formatDataBlock(p.skills),
    '',
    'QUESTS & CURRENT STATUS:',
    formatQuestsContextBlock(p),
    '',
    'ACHIEVEMENTS:',
    formatDataBlock(p.achievements),
    '',
    'TITLES:',
    formatDataBlock(p.titles),
    '',
    'INVENTORY:',
    formatDataBlock(p.inventory),
    ...(formatRelevantItemDefinitions(db) ? ['', formatRelevantItemDefinitions(db)] : []),
    '',
    'SYSTEM VARIABLES:',
    formatDataBlock(p.systemVariables),
    '',
    'WORLD STATE:',
    formatDataBlock(p.worldState),
    '',
    '=== SECTION 2: SYSTEM SESSION & CONTINUITY ===',
    '',
    'IMPORTANT MEMORIES & MILESTONES (HIGH / CRITICAL):',
    formatImportantMemoryAndMilestones(p.importantMemory, db.events),
    '',
    `RECENT EVENT SUMMARIES (LAST ${limit} EVENTS):`,
    formatRecentMemorySummaries(p.recentMemory, db.events, limit),
    '',
    '=== END SYSTEM CONTEXT PACKAGE ===',
  ];

  return parts.join('\n');
}

/**
 * Generates OUTPUT 1 — PLAYER DATA (for Button 3: Change Chat)
 * 100% READ-ONLY with ZERO RPG side effects.
 */
export function generatePlayerData(
  db: SystemCoreDatabase,
  options: { recentEventLimit?: number } = {}
): string {
  const p: PlayerState = db.player || ({} as PlayerState);
  const limit = options.recentEventLimit ?? db.settings.maxRecentMemoryEntries ?? 50;

  const levelVal = p.level !== undefined && p.level !== null && p.level !== '--'
    ? p.level
    : (p.progression?.level ?? '1');
  const xpVal = p.xp !== undefined && p.xp !== null && p.xp !== '--'
    ? p.xp
    : (p.progression?.xp ?? '0');

  const parts = [
    '=== PLAYER DATA ===',
    '',
    `PLAYER ID: ${p.playerId || db.settings.playerId || 'PLAYER-01'}`,
    `SYSTEM VERSION: ${p.systemVersion || db.settings.systemVersion || '1.0.0'}`,
    `STATE VERSION: v${p.stateVersion ?? 0}`,
    `SESSION VERSION: v${db.settings.sessionVersion ?? 1}`,
    '',
    'PROGRESSION:',
    formatProgressionBlock(p.progression, String(levelVal), String(xpVal)),
    '',
    'ATTRIBUTES:',
    formatDataBlock(p.attributes),
    '',
    'SKILLS:',
    formatDataBlock(p.skills),
    '',
    'ACTIVE & PENDING QUESTS:',
    formatQuestsContextBlock(p),
    '',
    'ACHIEVEMENTS:',
    formatDataBlock(p.achievements),
    '',
    'TITLES:',
    formatDataBlock(p.titles),
    '',
    'INVENTORY:',
    formatDataBlock(p.inventory),
    ...(formatRelevantItemDefinitions(db) ? ['', formatRelevantItemDefinitions(db)] : []),
    '',
    'SYSTEM VARIABLES:',
    formatDataBlock(p.systemVariables),
    '',
    'WORLD STATE:',
    formatDataBlock(p.worldState),
    '',
    'IMPORTANT MEMORY & MILESTONES:',
    formatImportantMemoryAndMilestones(p.importantMemory, db.events),
    '',
    `RECENT EVENT SUMMARIES (LIMIT ${limit}):`,
    formatRecentMemorySummaries(p.recentMemory, db.events, limit),
    '',
    '=== END PLAYER DATA ===',
  ];

  return parts.join('\n');
}

/**
 * Generates OUTPUT 2 — CHAT TRANSFER PROMPT (for Button 3: Change Chat)
 * 100% READ-ONLY with ZERO RPG side effects.
 */
export function generateChatTransferPrompt(db: SystemCoreDatabase): string {
  const p: PlayerState = db.player || ({} as PlayerState);
  const activeSession = db.sessions.find((s) => s.id === db.activeSessionId);
  const nextSessionNum = db.sessions.length + 1;
  const nextSessionLabel = `Chat Session ${String(nextSessionNum).padStart(3, '0')}`;
  const stateVersion = p.stateVersion ?? 0;
  const sessionVersion = db.settings.sessionVersion ?? 1;
  const playerId = p.playerId || db.settings.playerId || 'PLAYER-01';

  return [
    'SYSTEM TRANSFER DIRECTIVE: CONTINUATION OF EXISTING SYSTEM STATE',
    '------------------------------------------------------------------',
    'This message initiates a direct continuation of our ongoing System session.',
    `The previous conversation (${activeSession?.label || 'Previous Chat'}) has reached its practical context window limit and has been transferred to this new chat (${nextSessionLabel}).`,
    `CURRENT PLAYER: ${playerId} | STATE VERSION: v${stateVersion} | SESSION VERSION: v${sessionVersion}`,
    '',
    'CRITICAL SYSTEM CONTINUITY RULES:',
    '1. AUTHORITATIVE STATE: The accompanying PLAYER DATA is the single source of truth for the player state, progression, and historical variables.',
    '2. NO RESET: Under no circumstances should player progression, level, XP, inventory, quest status, or attributes reset to default or zero.',
    '3. NO LOSS OF DATA: All existing variables, skills, quests, achievements, and past memory entries must be strictly preserved.',
    '4. NO FABRICATION / INVENTING: Do not invent stats, skills, or items that are not in the record or not earned.',
    '5. SEAMLESS PROGRESSION: Continue operating the System naturally from the exact state provided below.',
    '6. CONTINUITY AWARENESS: Maintain full awareness of ongoing quest chains (including Boss Chains, Special Trials), revealed hidden mechanics, and past System rulings.',
    '',
    'Please acknowledge this state transfer and confirm the System is ready to proceed from this current state and session version.',
  ].join('\n');
}
