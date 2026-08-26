export type StorageEngine = 'local_storage' | 'indexed_db' | 'firestore';

export type EventImportance = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'normal' | 'high' | 'critical';
export type ProcessingStatus = 'SUCCESS' | 'FAILED' | 'PENDING' | 'NO_STATE_CHANGE';
export type EventReadStatus = 'READ' | 'UNREAD';

export interface MemoryEntry {
  id: string;
  timestamp: string; // ISO 8601
  summary: string;
  sourceEventId?: string;
  category?: string;
  importance?: EventImportance;
}

export type QuestTimingType = 'DAILY' | 'CUSTOM' | 'MANUAL' | 'PERMANENT' | 'daily' | 'custom' | 'manual' | 'permanent' | string;
export type QuestStatus = 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'EXPIRED' | 'CANCELLED' | 'PENDING_SYSTEM_UPDATE' | 'IN_PROGRESS' | string;

export interface QuestRequirement {
  id?: string;
  text: string;
  completed?: boolean;
}

export interface QuestRewardItem {
  name: string;
  quantity: number;
  rank?: string;
  rarity?: string;
}

export interface QuestRewards {
  xp?: number;
  coins?: number;
  items?: QuestRewardItem[];
  stats?: Record<string, any>;
  title?: string;
  custom?: string;
}

export interface QuestPenalty {
  enabled: boolean;
  type: 'XP' | 'COIN' | 'STAT' | 'CUSTOM' | string;
  value?: number | string;
  description?: string;
  duration?: string;
}

export interface QuestItem {
  id?: string;
  questId?: string; // e.g. "custom_quest_<unique_id>"
  title: string;
  description?: string;
  type?: QuestTimingType;
  difficulty?: 'Very Easy' | 'Easy' | 'Medium' | 'Hard' | 'Very Hard' | 'Extreme' | 'Hell' | 'Nightmare' | string;
  rank?: 'E' | 'D' | 'C' | 'B' | 'A' | 'S' | 'SS' | 'SSS' | string;
  requirements?: Array<QuestRequirement | string>;
  requirementLogic?: 'ALL' | 'ANY';
  progressType?: 'NUMERIC' | 'PERCENTAGE' | 'CHECKBOX' | 'STAGES';
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  startTime?: string; // ISO 8601
  createdAt?: string; // ISO 8601
  expiresAt?: string; // ISO 8601
  durationHours?: number;
  durationMinutes?: number;
  durationDays?: number;
  status: QuestStatus;
  progress?: number | string;
  completionRequirement?: string;
  reward?: string | Record<string, any>;
  rewards?: QuestRewards;
  penalty?: string | Record<string, any> | QuestPenalty;
  penaltyEnabled?: boolean;
  penaltyType?: 'XP' | 'COIN' | 'FATIGUE' | 'STREAK' | 'ITEM' | 'STAT' | 'CUSTOM' | string;
  penaltyValue?: number | string;
  penaltyDescription?: string;
  penaltyApplied?: boolean;
  completedAt?: string;
  category?: 'daily' | 'custom' | 'hidden' | 'boss_chain' | 'emergency' | 'special_event' | string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | string;
  tags?: string[];
  notes?: string;
  icon?: string;
  maxAttempts?: number;
  currentAttempts?: number;
  cooldown?: string;
  isDaily?: boolean;
  isCustom?: boolean;
  enabled?: boolean;
  author?: 'PLAYER' | 'SYSTEM' | string;
  generatedAt?: string;
  archivedAt?: string;
  cycleGeneratedAt?: string;
  [key: string]: any;
}

export interface SkillItem {
  id?: string;
  name: string;
  level?: number | string;
  description?: string;
  type?: string;
}

export interface AchievementItem {
  id?: string;
  title: string;
  unlockedAt?: string;
  description?: string;
}

export interface InventoryItem {
  id?: string;
  name: string;
  quantity?: number;
  description?: string;
  category?: string;
  requiresKey?: string;
  rank?: string;
  rarity?: string;
  [key: string]: any;
}

export type QuestObject = QuestItem;

export interface ItemDefinitionHistory {
  version: number;
  updatedAt: string; // ISO 8601
  changes?: string;
  previousState?: Partial<ItemDefinition>;
}

export interface ItemDefinition {
  itemId: string; // Unique slug/ID (e.g. "crimson-crystal")
  itemName: string; // Explicit name of the item
  description?: string;
  rank?: string; // e.g. "E", "S", "Ancient", etc.
  type?: string; // e.g. "Loot Box", "Key", "Consumable", "Material", "Equipment", etc.
  rarity?: string; // e.g. "Common", "Rare", "Epic", "Legendary", etc.
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
  icon?: string; // Emoji or icon identifier
  image?: string; // Data URL or image path
  enabled: boolean; // Default true. If false, definition remains stored but is inactive for display
  definitionVersion: number; // Increments on each manual edit
  createdAt: string; // ISO 8601
  lastUpdated: string; // ISO 8601
  history?: ItemDefinitionHistory[];
  [key: string]: any; // Expandable structure
}

export type StateOperationType = 'SET' | 'ADD' | 'REMOVE' | 'COMPLETE' | 'UNLOCK' | 'UPDATE';

export interface GeminiStateChange {
  operation: StateOperationType;
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
  itemDefinitions?: Array<Partial<ItemDefinition>>;
  importantMemory?: ImportantMemoryProposal[];
  warnings?: string[];
  confidence?: number;
}

export interface PlayerProgression {
  level: number | string;
  xp: number | string;
  currentXP?: number | string;
  requiredXp?: number | string;
  requiredXP?: number | string;
  maxXp?: number | string;
  overflowXp?: number | string;
  rank?: string;
  statPoints?: number;
  skillPoints?: number;
  [key: string]: any;
}

export interface PlayerState {
  playerId: string;
  systemVersion: string;
  stateVersion: number;
  // Core convenience progression fields (synced with progression object)
  level: string;
  xp: string;
  status: string;
  
  // 24-Hour Quest Refresh Cycle Timestamps & Refresh Request State
  questCycleStartedAt?: string; // ISO 8601
  questGeneratedAt?: string; // ISO 8601 (alias/compatibility)
  nextQuestRefreshAt?: string; // ISO 8601
  dailyQuestRefreshRequired?: boolean; // When true: ⚔️ NEW QUEST CYCLE READY / Daily Quest Refresh Required
  questRefreshAvailable?: boolean;
  questRefreshRequested?: boolean;
  questRefreshRequestedAt?: string; // ISO 8601
  archivedQuests?: (string | QuestItem)[];
  
  // Expandable Structured Sections
  progression: PlayerProgression;
  attributes: Record<string, any>;
  skills: (string | SkillItem)[];
  quests: (string | QuestItem)[];
  achievements: (string | AchievementItem)[];
  titles: string[];
  inventory: (string | InventoryItem)[];
  worldState: Record<string, any>;
  systemVariables: Record<string, any>;
  
  // Memory Architecture
  importantMemory: (string | MemoryEntry)[];
  recentMemory: MemoryEntry[]; // Rolling recent memory pool governed by limit
  
  // Legacy / metadata support
  importantEvents?: string[] | null;
  chatHistorySummary?: string | null;
  metadata?: Record<string, any>;
}

export interface SystemEvent {
  id: string;
  eventId?: string; // Explicit alias for eventId
  timestamp: string; // ISO 8601
  formattedDate: string;
  source: string; // e.g. "SYSTEM" | "PLAYER" | "ChatGPT"
  type: string; // e.g. "system_input", "session_start", "state_update", "system_decision"
  rawMessage: string;
  rawSystemMessage?: string; // Explicit verbatim message field
  summary?: string; // High-level concise summary preserving original meaning
  importance?: EventImportance; // 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  read?: boolean; // Unread tracking for UI badge
  readStatus?: EventReadStatus; // 'READ' | 'UNREAD'
  processingStatus?: ProcessingStatus; // 'SUCCESS' | 'FAILED' | 'PENDING' | 'NO_STATE_CHANGE'
  explicitStateChanges?: GeminiStateChange[] | Record<string, any>;
  category?: string;
  messageHash?: string;
  tags?: string[];
  metadata?: Record<string, any>;
  stateChangesApplied?: boolean;
  
  // Gemini Processing Audit Trail
  processed?: boolean;
  geminiProcessingVersion?: string;
  stateChanges?: GeminiStateChange[];
  warnings?: string[];
  confidence?: number;
  processedAt?: string;
  processingError?: string;
}

export interface ChatSession {
  id: string; // e.g. "session-001"
  label: string; // e.g. "Chat Session 001"
  createdAt: string;
  lastUpdated: string;
  stateVersion: number;
  sessionVersion?: number;
  notes?: string;
  eventCount?: number;
}

export type GeminiConnectionStatus = 'CONNECTED' | 'NOT_TESTED' | 'ERROR' | 'QUOTA_EXCEEDED';

export interface GeminiModelOption {
  id: string;
  name: string;
  description?: string;
  isRecommended?: boolean;
}

export interface GeminiTestResult {
  connected: boolean;
  model: string;
  latencyMs?: number;
  message?: string;
  category?: 'Invalid API key' | 'Model unavailable' | 'Quota exceeded' | 'Network error' | 'Permission error' | 'Request rejected';
  error?: string;
}

export interface GeminiStatusInfo {
  configured: boolean;
  status: string;
  model: string;
  hasServerEnvKey?: boolean;
  hasCustomKey?: boolean;
  connectionStatus?: GeminiConnectionStatus;
  message?: string;
}

export interface SystemSettings {
  systemName: string;
  systemVersion: string;
  contextVersion: string;
  playerId: string;
  storageEngine: StorageEngine;
  autoIncrementStateVersion: boolean;
  sessionVersion?: number; // Session version counter
  maxRecentMemoryEntries: number; // default 50
  geminiModel?: string; // e.g. 'gemini-3.7-flash'
  geminiStatus?: GeminiConnectionStatus;
  geminiLastTestedAt?: string;
  itemInformationSystemEnabled: boolean; // default true. If false, disables active item definition enrichment/processing without deleting definitions or inventory.
  questIncompletionPenaltiesEnabled?: boolean; // Global setting: ⚠️ QUEST INCOMPLETION PENALTIES (default: true)
}

export interface SystemCoreDatabase {
  schemaVersion: number;
  lastUpdated: string;
  settings: SystemSettings;
  player: PlayerState;
  events: SystemEvent[];
  sessions: ChatSession[];
  activeSessionId: string;
  itemDefinitions?: ItemDefinition[];
}

export interface StateChangeSummary {
  progressionUpdates?: Partial<PlayerProgression>;
  attributesUpdated?: Record<string, any>;
  skillsAdded?: (string | SkillItem)[];
  questsUpdated?: (string | QuestItem)[];
  achievementsAdded?: (string | AchievementItem)[];
  titlesAdded?: string[];
  inventoryUpdated?: (string | InventoryItem)[];
  inventoryRemoved?: (string | InventoryItem)[];
  itemDefinitionsExtracted?: ItemDefinition[];
  worldStateUpdated?: Record<string, any>;
  systemVariablesUpdated?: Record<string, any>;
  importantMemoriesAdded?: MemoryEntry[];
  memoryEntry?: MemoryEntry;
  rawParsedLines?: string[];
  hasChanges?: boolean;
}

export interface ProcessedSystemInputResult {
  rawMessage: string;
  timestamp: string;
  stateChanges: StateChangeSummary;
  memoryEntry?: MemoryEntry;
  eventType: string;
}
