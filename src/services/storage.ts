import {
  SystemCoreDatabase,
  SystemSettings,
  PlayerState,
  ChatSession,
  SystemEvent,
} from '../types';

export const STORAGE_KEY = 'system_core_database_v2';
export const LEGACY_STORAGE_KEY = 'system_core_database_v1';

export const DEFAULT_SETTINGS: SystemSettings = {
  systemName: 'SYSTEM CORE',
  systemVersion: '1.0.0',
  contextVersion: '1.0',
  playerId: 'PLAYER-01',
  storageEngine: 'local_storage',
  autoIncrementStateVersion: true,
  maxRecentMemoryEntries: 50,
  geminiModel: 'gemini-3.7-flash',
  geminiStatus: 'NOT_TESTED',
  itemInformationSystemEnabled: true,
  questIncompletionPenaltiesEnabled: true,
};

export const DEFAULT_PLAYER_STATE: PlayerState = {
  playerId: 'PLAYER-01',
  systemVersion: '1.0.0',
  stateVersion: 0,
  level: '1',
  xp: '0',
  status: 'ONLINE',
  progression: {
    level: 1,
    xp: 0,
  },
  questCycleStartedAt: undefined,
  questGeneratedAt: undefined,
  nextQuestRefreshAt: undefined,
  dailyQuestRefreshRequired: false,
  questRefreshAvailable: false,
  questRefreshRequested: false,
  questRefreshRequestedAt: undefined,
  archivedQuests: [],
  attributes: {},
  skills: [],
  quests: [],
  achievements: [],
  titles: [],
  inventory: [],
  worldState: {},
  systemVariables: {},
  importantMemory: [],
  recentMemory: [],
  importantEvents: [],
  chatHistorySummary: null,
};

export const DEFAULT_INITIAL_DATABASE: SystemCoreDatabase = {
  schemaVersion: 2,
  lastUpdated: new Date().toISOString(),
  settings: DEFAULT_SETTINGS,
  player: DEFAULT_PLAYER_STATE,
  events: [],
  sessions: [
    {
      id: 'session-001',
      label: 'Chat Session 001',
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      stateVersion: 0,
      notes: 'Initial session link',
    },
  ],
  activeSessionId: 'session-001',
  itemDefinitions: [],
};

export interface IStorageAdapter {
  load(): Promise<SystemCoreDatabase>;
  save(data: SystemCoreDatabase): Promise<void>;
  clear(): Promise<void>;
  exportBackup(data: SystemCoreDatabase): string;
  validateBackup(jsonString: string): { valid: boolean; error?: string; data?: SystemCoreDatabase };
}

/**
 * Normalizes and upgrades any player state to the modern schema
 */
export function normalizePlayerState(rawPlayer: any): PlayerState {
  if (!rawPlayer || typeof rawPlayer !== 'object') {
    return { ...DEFAULT_PLAYER_STATE };
  }

  const rawLevel = rawPlayer.level !== undefined && rawPlayer.level !== null && rawPlayer.level !== '--'
    ? rawPlayer.level
    : (rawPlayer.progression?.level ?? 1);

  const rawXp = rawPlayer.xp !== undefined && rawPlayer.xp !== null && rawPlayer.xp !== '--'
    ? rawPlayer.xp
    : (rawPlayer.progression?.xp ?? 0);

  return {
    ...DEFAULT_PLAYER_STATE,
    ...rawPlayer,
    playerId: rawPlayer.playerId || DEFAULT_PLAYER_STATE.playerId,
    systemVersion: rawPlayer.systemVersion || DEFAULT_PLAYER_STATE.systemVersion,
    stateVersion: typeof rawPlayer.stateVersion === 'number' ? rawPlayer.stateVersion : 0,
    level: String(rawLevel),
    xp: String(rawXp),
    status: rawPlayer.status || 'ONLINE',
    progression: {
      level: typeof rawLevel === 'number' ? rawLevel : (parseInt(String(rawLevel), 10) || 1),
      xp: typeof rawXp === 'number' ? rawXp : (parseInt(String(rawXp), 10) || 0),
      ...(rawPlayer.progression || {}),
    },
    attributes: rawPlayer.attributes && typeof rawPlayer.attributes === 'object' && !Array.isArray(rawPlayer.attributes)
      ? rawPlayer.attributes
      : {},
    skills: Array.isArray(rawPlayer.skills) ? rawPlayer.skills : [],
    quests: Array.isArray(rawPlayer.quests) ? rawPlayer.quests : [],
    archivedQuests: Array.isArray(rawPlayer.archivedQuests) ? rawPlayer.archivedQuests : [],
    questCycleStartedAt: rawPlayer.questCycleStartedAt || rawPlayer.questGeneratedAt || rawPlayer.systemVariables?.questCycleStartedAt || rawPlayer.systemVariables?.questGeneratedAt || undefined,
    questGeneratedAt: rawPlayer.questGeneratedAt || rawPlayer.questCycleStartedAt || rawPlayer.systemVariables?.questGeneratedAt || undefined,
    nextQuestRefreshAt: rawPlayer.nextQuestRefreshAt || rawPlayer.systemVariables?.nextQuestRefreshAt || undefined,
    dailyQuestRefreshRequired: typeof rawPlayer.dailyQuestRefreshRequired === 'boolean'
      ? rawPlayer.dailyQuestRefreshRequired
      : (rawPlayer.systemVariables?.dailyQuestRefreshRequired ?? false),
    questRefreshAvailable: typeof rawPlayer.questRefreshAvailable === 'boolean'
      ? rawPlayer.questRefreshAvailable
      : (rawPlayer.systemVariables?.questRefreshAvailable ?? false),
    questRefreshRequested: typeof rawPlayer.questRefreshRequested === 'boolean'
      ? rawPlayer.questRefreshRequested
      : (rawPlayer.systemVariables?.questRefreshRequested ?? false),
    questRefreshRequestedAt: rawPlayer.questRefreshRequestedAt || rawPlayer.systemVariables?.questRefreshRequestedAt || undefined,
    achievements: Array.isArray(rawPlayer.achievements) ? rawPlayer.achievements : [],
    titles: Array.isArray(rawPlayer.titles) ? rawPlayer.titles : [],
    inventory: Array.isArray(rawPlayer.inventory) ? rawPlayer.inventory : [],
    worldState: rawPlayer.worldState && typeof rawPlayer.worldState === 'object' && !Array.isArray(rawPlayer.worldState)
      ? rawPlayer.worldState
      : {},
    systemVariables: rawPlayer.systemVariables && typeof rawPlayer.systemVariables === 'object' && !Array.isArray(rawPlayer.systemVariables)
      ? rawPlayer.systemVariables
      : {},
    importantMemory: Array.isArray(rawPlayer.importantMemory)
      ? rawPlayer.importantMemory
      : (Array.isArray(rawPlayer.importantEvents) ? rawPlayer.importantEvents : []),
    recentMemory: Array.isArray(rawPlayer.recentMemory) ? rawPlayer.recentMemory : [],
  };
}

export class LocalStorageAdapter implements IStorageAdapter {
  async load(): Promise<SystemCoreDatabase> {
    try {
      let raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        // Check for legacy v1 storage key to migrate
        raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      }

      if (!raw) {
        // First time initialization
        const initial = { ...DEFAULT_INITIAL_DATABASE, lastUpdated: new Date().toISOString() };
        await this.save(initial);
        return initial;
      }

      const parsed = JSON.parse(raw) as SystemCoreDatabase;
      const normalizedPlayer = normalizePlayerState(parsed.player);

      return {
        ...DEFAULT_INITIAL_DATABASE,
        ...parsed,
        schemaVersion: 2,
        settings: {
          ...DEFAULT_SETTINGS,
          ...(parsed.settings || {}),
        },
        player: normalizedPlayer,
        events: Array.isArray(parsed.events)
          ? parsed.events.map((e) => ({ ...e, read: e.read !== undefined ? e.read : true }))
          : [],
        sessions: Array.isArray(parsed.sessions) && parsed.sessions.length > 0
          ? parsed.sessions
          : DEFAULT_INITIAL_DATABASE.sessions,
        activeSessionId: parsed.activeSessionId || DEFAULT_INITIAL_DATABASE.activeSessionId,
        itemDefinitions: Array.isArray(parsed.itemDefinitions) ? parsed.itemDefinitions : [],
      };
    } catch (err) {
      console.error('Failed to load SYSTEM CORE database from localStorage:', err);
      return { ...DEFAULT_INITIAL_DATABASE, lastUpdated: new Date().toISOString() };
    }
  }

  async save(data: SystemCoreDatabase): Promise<void> {
    try {
      const updated = {
        ...data,
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to save SYSTEM CORE database to localStorage:', err);
      throw new Error('Storage write failed. Browser storage may be restricted.');
    }
  }

  async clear(): Promise<void> {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch (err) {
      console.error('Failed to clear storage:', err);
    }
  }

  exportBackup(data: SystemCoreDatabase): string {
    return JSON.stringify(data, null, 2);
  }

  validateBackup(jsonString: string): { valid: boolean; error?: string; data?: SystemCoreDatabase } {
    try {
      if (!jsonString || typeof jsonString !== 'string') {
        return { valid: false, error: 'Empty or invalid JSON input.' };
      }
      const parsed = JSON.parse(jsonString);
      if (!parsed || typeof parsed !== 'object') {
        return { valid: false, error: 'Parsed backup is not an object.' };
      }
      if (!parsed.player || typeof parsed.player !== 'object') {
        return { valid: false, error: 'Backup is missing player state object.' };
      }
      if (!Array.isArray(parsed.events)) {
        return { valid: false, error: 'Backup events must be an array.' };
      }

      const validatedPlayer = normalizePlayerState(parsed.player);

      const validated: SystemCoreDatabase = {
        schemaVersion: parsed.schemaVersion || 2,
        lastUpdated: parsed.lastUpdated || new Date().toISOString(),
        settings: {
          ...DEFAULT_SETTINGS,
          ...(parsed.settings || {}),
        },
        player: validatedPlayer,
        events: parsed.events,
        sessions: Array.isArray(parsed.sessions) && parsed.sessions.length > 0
          ? parsed.sessions
          : DEFAULT_INITIAL_DATABASE.sessions,
        activeSessionId: parsed.activeSessionId || parsed.sessions?.[0]?.id || 'session-001',
        itemDefinitions: Array.isArray(parsed.itemDefinitions) ? parsed.itemDefinitions : [],
      };

      return { valid: true, data: validated };
    } catch (err: any) {
      return { valid: false, error: err?.message || 'Invalid JSON syntax' };
    }
  }
}

// Singleton storage instance
export const storageAdapter: IStorageAdapter = new LocalStorageAdapter();
