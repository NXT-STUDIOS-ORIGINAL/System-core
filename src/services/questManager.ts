import { PlayerState, QuestItem, QuestTimingType, QuestStatus, SystemEvent, QuestRewards } from '../types';

export const QUEST_REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 Real-World Hours in Milliseconds

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
 * Returns { enabled, isExplicit, type, value, description }
 */
export function parseQuestPenalty(quest: QuestItem | string): {
  enabled: boolean;
  isExplicit: boolean;
  type?: string;
  value?: number | string;
  description?: string;
} {
  if (typeof quest === 'string' || !quest) {
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

  if (typeof quest.penalty === 'string' && quest.penalty.trim()) {
    rawDesc = quest.penalty.trim();
  } else if (typeof quest.penalty === 'object' && quest.penalty !== null) {
    if (quest.penalty.description) rawDesc = String(quest.penalty.description);
    if (quest.penalty.type) rawType = String(quest.penalty.type);
    if (quest.penalty.value !== undefined) rawVal = quest.penalty.value;
  }

  const isExplicit = Boolean(rawDesc || rawType || rawVal !== undefined);

  // If type not specified, infer from description
  if (!rawType && rawDesc) {
    const dLower = rawDesc.toLowerCase();
    if (dLower.includes('xp') || dLower.includes('exp')) rawType = 'XP';
    else if (dLower.includes('coin') || dLower.includes('gold') || dLower.includes('credit')) rawType = 'COIN';
    else if (dLower.includes('fatigue')) rawType = 'FATIGUE';
    else if (dLower.includes('streak')) rawType = 'STREAK';
    else if (dLower.includes('item')) rawType = 'ITEM';
    else rawType = 'SYSTEM';
  }

  // If numeric value not specified, extract from description if possible
  if (rawVal === undefined && rawDesc) {
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
  };
}

/**
 * Applies an explicitly defined quest incompletion penalty to the player state.
 * Strictly adheres to:
 * 1. penaltyEnabled on quest must be true
 * 2. globalPenaltiesEnabled must be true
 * 3. penalty must be explicitly defined by System Controller (no invented penalties)
 * 4. penaltyApplied must NOT be true (no double penalty)
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
  };

  const penaltyType = (penaltyInfo.type || 'SYSTEM').toUpperCase();
  const numVal = typeof penaltyInfo.value === 'number' ? penaltyInfo.value : parseFloat(String(penaltyInfo.value || '0'));
  let penaltyAppliedSummary = penaltyInfo.description || `Penalty: ${penaltyType}`;

  // Execute explicit penalty on player state
  if (penaltyType === 'XP' && !isNaN(numVal) && numVal > 0) {
    const currentXp = typeof nextPlayer.progression.xp === 'number'
      ? nextPlayer.progression.xp
      : (parseInt(String(nextPlayer.xp || '0'), 10) || 0);
    const newXp = Math.max(0, currentXp - numVal);
    nextPlayer.progression.xp = newXp;
    nextPlayer.xp = String(newXp);
    penaltyAppliedSummary = `XP reduced by ${numVal} (XP: ${currentXp} → ${newXp})`;
  } else if ((penaltyType === 'COIN' || penaltyType === 'GOLD') && !isNaN(numVal) && numVal > 0) {
    const currentCoins = typeof nextPlayer.systemVariables.coins === 'number'
      ? nextPlayer.systemVariables.coins
      : (parseInt(String(nextPlayer.systemVariables.coins || '0'), 10) || 0);
    const newCoins = Math.max(0, currentCoins - numVal);
    nextPlayer.systemVariables.coins = newCoins;
    penaltyAppliedSummary = `Coins reduced by ${numVal} (${currentCoins} → ${newCoins})`;
  } else if (penaltyType === 'FATIGUE' && !isNaN(numVal) && numVal > 0) {
    const currentFatigue = typeof nextPlayer.systemVariables.fatigue === 'number'
      ? nextPlayer.systemVariables.fatigue
      : 0;
    nextPlayer.systemVariables.fatigue = currentFatigue + numVal;
    penaltyAppliedSummary = `Fatigue increased by +${numVal} (${currentFatigue} → ${currentFatigue + numVal})`;
  } else if (penaltyType === 'STREAK') {
    const prevStreak = nextPlayer.systemVariables.questStreak || 0;
    nextPlayer.systemVariables.questStreak = 0;
    penaltyAppliedSummary = `Quest streak reset to 0 (was ${prevStreak})`;
  } else {
    // Custom / System defined penalty
    nextPlayer.systemVariables.lastAppliedPenalty = {
      questTitle: quest.title,
      penalty: penaltyAppliedSummary,
      appliedAt: now.toISOString(),
    };
  }

  // Create audit system event
  const nowIso = now.toISOString();
  const eventId = `evt_penalty_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
  const penaltyEvent: SystemEvent = {
    id: eventId,
    timestamp: nowIso,
    formattedDate: now.toLocaleString(),
    source: 'SYSTEM CORE // PENALTY ENGINE',
    type: 'quest_incompletion_penalty',
    rawMessage: [
      `[SYSTEM EVENT] ⚠️ QUEST INCOMPLETION PENALTY APPLIED`,
      `Quest: "${quest.title}"`,
      `Penalty Details: ${penaltyAppliedSummary}`,
      `Timestamp: ${nowIso}`,
      `Status: FAILED / PENALTY APPLIED`,
      `State Version: v${(nextPlayer.stateVersion ?? 0) + 1}`,
    ].join('\n'),
    summary: `⚠️ Quest Incompletion Penalty Applied: "${quest.title}" (${penaltyAppliedSummary})`,
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
  if (rewards.coins && rewards.coins > 0) parts.push(`+${rewards.coins} Coins`);
  if (rewards.items && Array.isArray(rewards.items)) {
    for (const item of rewards.items) {
      if (item && item.name) {
        parts.push(`${item.quantity > 1 ? `×${item.quantity} ` : ''}${item.name}`);
      }
    }
  }
  if (rewards.stats && typeof rewards.stats === 'object') {
    for (const [k, v] of Object.entries(rewards.stats)) {
      if (v !== undefined && v !== null) {
        parts.push(`+${v} ${k}`);
      }
    }
  }
  if (rewards.title) parts.push(`Title: "${rewards.title}"`);
  if (rewards.custom) parts.push(rewards.custom);

  return parts.join(', ');
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

  // Build reward summary
  const rewardSummary = formatQuestRewardSummary(input.rewards) || (typeof input.reward === 'string' ? input.reward : '');

  // Normalized penalty object
  const penaltyEnabled = input.penaltyEnabled ?? (typeof input.penalty === 'object' ? (input.penalty as any)?.enabled !== false : !!input.penalty);
  let penaltyType = input.penaltyType || (typeof input.penalty === 'object' ? (input.penalty as any)?.type : undefined) || 'XP';
  let penaltyVal = input.penaltyValue ?? (typeof input.penalty === 'object' ? (input.penalty as any)?.value : undefined);
  let penaltyDesc = input.penaltyDescription || (typeof input.penalty === 'object' ? (input.penalty as any)?.description : undefined);

  if (!penaltyDesc && penaltyVal !== undefined && penaltyEnabled) {
    penaltyDesc = `Lose ${penaltyVal} ${penaltyType} if failed`;
  }

  const normalizedPenalty = {
    enabled: penaltyEnabled,
    type: penaltyType,
    value: penaltyVal,
    description: penaltyDesc,
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
    rewards: input.rewards,
    reward: rewardSummary || input.reward,
    penalty: normalizedPenalty,
    penaltyEnabled,
    penaltyType,
    penaltyValue: penaltyVal,
    penaltyDescription: penaltyDesc,
    penaltyApplied: !!input.penaltyApplied,
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

  // When completing (and not uncompleting), grant rewards if configured
  if (!wasCompleted) {
    const rewards = foundQuest.rewards;

    // XP Reward
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

    // Coin Reward
    const coinReward = rewards?.coins ?? (typeof foundQuest.reward === 'object' ? (foundQuest.reward as any)?.coins : undefined);
    if (coinReward && typeof coinReward === 'number' && coinReward > 0) {
      const curCoins = typeof nextPlayer.systemVariables.coins === 'number'
        ? nextPlayer.systemVariables.coins
        : (parseInt(String(nextPlayer.systemVariables.coins || '0'), 10) || 0);
      nextPlayer.systemVariables.coins = curCoins + coinReward;
      rewardGrantedParts.push(`+${coinReward} Coins`);
    }

    // Item Rewards
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

    // Stat Rewards
    const statRewards = rewards?.stats;
    if (statRewards && typeof statRewards === 'object') {
      for (const [stat, bonus] of Object.entries(statRewards)) {
        if (typeof bonus === 'number') {
          const curVal = typeof nextPlayer.attributes[stat] === 'number'
            ? nextPlayer.attributes[stat]
            : (parseFloat(String(nextPlayer.attributes[stat] || 0)) || 0);
          nextPlayer.attributes[stat] = curVal + bonus;
          rewardGrantedParts.push(`+${bonus} ${stat}`);
        }
      }
    }

    // Title Reward
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
    completedAt: newStatus === 'COMPLETED' ? nowIso : undefined,
  };

  existingQuests[targetIndex] = updatedQuestObj;
  nextPlayer.quests = existingQuests;
  nextPlayer.stateVersion = (nextPlayer.stateVersion ?? 0) + 1;

  // System Event creation
  let systemEvent: SystemEvent | undefined;
  if (newStatus === 'COMPLETED') {
    const eventId = `evt_quest_comp_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    systemEvent = {
      id: eventId,
      timestamp: nowIso,
      formattedDate: now.toLocaleString(),
      source: 'SYSTEM CORE // QUEST ENGINE',
      type: 'quest_completed',
      category: 'quest',
      rawMessage: [
        `[QUEST COMPLETED] "${foundQuest.title}"`,
        `Type: ${foundQuest.type || 'CUSTOM'}`,
        `Completed At: ${nowIso}`,
        ...(rewardSummary ? [`Rewards Granted: ${rewardSummary}`] : []),
        `State Version: v${nextPlayer.stateVersion}`,
      ].join('\n'),
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
