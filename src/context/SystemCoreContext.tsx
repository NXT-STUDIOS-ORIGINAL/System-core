import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  SystemCoreDatabase,
  SystemEvent,
  ChatSession,
  PlayerState,
  SystemSettings,
  ProcessedSystemInputResult,
  MemoryEntry,
  GeminiProcessResult,
  GeminiTestResult,
  GeminiStatusInfo,
  GeminiModelOption,
  GeminiConnectionStatus,
  ItemDefinition,
  ItemDefinitionHistory,
  QuestItem,
} from '../types';
import { storageAdapter, DEFAULT_INITIAL_DATABASE } from '../services/storage';
import { parseSystemMessage, calculateMessageHash, convertSummaryToGeminiChanges, determineEventImportance } from '../services/stateParser';
import { applyStructuredGeminiChanges, applyStateChanges, extractXpComponents, extractNumeric, formatXpDisplay } from '../services/stateManager';
import { geminiService, DEFAULT_GEMINI_MODEL } from '../services/geminiService';
import {
  createExplicitItemDefinition,
  updateItemDefinition,
  findItemDefinition,
  generateItemId,
} from '../services/itemDefinitionManager';
import {
  getSavedAvatar,
  saveAvatarToStorage,
  removeAvatarFromStorage,
  hasCustomAvatar,
} from '../services/avatarStorage';
import {
  ensureQuestTimestamps,
  calculateQuestCountdown,
  createQuestRefreshRequest,
  checkAndExecuteAllQuestExpirations,
  getQuestTimingType,
  formatDynamicTimer,
  parseQuestPenalty,
  QuestCountdownInfo,
  createCustomQuestItem,
  executeQuestCompletion,
  executeQuestProgressUpdate,
  generateCustomQuestId,
} from '../services/questManager';
import {
  executeLootBoxTransaction,
  consumeInventoryItem,
  normalizeItemName,
} from '../services/inventoryManager';

export interface ToastNotification {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
}

export type { GeminiTestResult, GeminiStatusInfo, GeminiModelOption, GeminiConnectionStatus };

interface SystemCoreContextType {
  db: SystemCoreDatabase;
  isLoading: boolean;
  activeSession?: ChatSession;
  toasts: ToastNotification[];
  showToast: (message: string, type?: ToastNotification['type']) => void;
  removeToast: (id: string) => void;
  currentTime: Date;
  
  // Profile Picture / Avatar State (Isolated UI storage)
  profileAvatar: string | null;
  setProfileAvatar: (dataUrl: string) => void;
  removeProfileAvatar: () => void;
  hasCustomProfileAvatar: () => boolean;

  // Core System Processing via Gemini Engine
  addSystemEvent: (
    rawMessage: string,
    options?: {
      source?: string;
      type?: string;
      tags?: string[];
      metadata?: Record<string, any>;
      bypassDuplicateCheck?: boolean;
    }
  ) => Promise<{
    event: SystemEvent;
    didChangeState: boolean;
    geminiResult?: GeminiProcessResult;
    error?: string;
  }>;
  
  retryProcessEvent: (eventId: string) => Promise<{ success: boolean; error?: string }>;
  checkIsDuplicate: (rawMessage: string) => SystemEvent | undefined;
  
  // Gemini Connection & Model Management
  saveGeminiApiKey: (key: string) => void;
  clearGeminiApiKey: () => void;
  getMaskedGeminiApiKey: () => string;
  hasCustomGeminiApiKey: () => boolean;
  geminiModel: string;
  setGeminiModel: (model: string) => Promise<void>;
  getAvailableGeminiModels: (apiKeyOverride?: string) => Promise<GeminiModelOption[]>;
  testGeminiConnection: (apiKeyOverride?: string, modelOverride?: string) => Promise<GeminiTestResult>;
  getGeminiStatus: () => Promise<GeminiStatusInfo>;
  
  // State Management
  updatePlayerState: (updater: Partial<PlayerState> | ((prev: PlayerState) => PlayerState)) => Promise<void>;
  refreshStateFromStorage: () => Promise<void>;
  addImportantMemory: (summary: string, importance?: 'normal' | 'high' | 'critical') => Promise<void>;
  deleteImportantMemory: (index: number) => Promise<void>;
  deleteRecentMemory: (index: number) => Promise<void>;
  
  // Event & Session Management
  unreadEventCount: number;
  markEventsAsRead: () => Promise<void>;
  markEventAsRead: (eventId: string) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;
  clearAllEvents: () => Promise<void>;
  createChatSession: (label: string, notes?: string) => Promise<ChatSession>;
  setActiveSession: (sessionId: string) => Promise<void>;
  deleteChatSession: (sessionId: string) => Promise<void>;
  
  // Quest & 24-Hour Cycle Management
  questCountdown: QuestCountdownInfo;
  refreshQuestsNow: () => Promise<void>;
  requestQuestRefresh: () => Promise<{ success: boolean; message: string }>;
  toggleQuestComplete: (questTitleOrId: string) => Promise<void>;
  toggleQuestPenaltyEnabled: (questTitleOrId: string) => Promise<void>;
  toggleQuestIncompletionPenalties: (enabled?: boolean) => Promise<void>;
  addCustomQuest: (questData: Partial<QuestItem> & { title: string }) => Promise<void>;
  deleteQuest: (questTitleOrId: string) => Promise<void>;
  createCustomQuestAction: (questData: Partial<QuestItem> & { title: string }) => Promise<{ success: boolean; quest: QuestItem }>;
  updateCustomQuestAction: (questId: string, updates: Partial<QuestItem>) => Promise<{ success: boolean; quest?: QuestItem }>;
  deleteCustomQuestAction: (questId: string) => Promise<{ success: boolean }>;
  duplicateCustomQuestAction: (quest: QuestItem) => Promise<{ success: boolean; newQuest?: QuestItem }>;
  updateQuestProgressAction: (questIdOrTitle: string, deltaOrValue: number, isAbsolute?: boolean) => Promise<{ success: boolean; completedNow: boolean; message: string }>;

  // Inventory & Loot Box Consumption Engine
  openLootBox: (boxIdentifier: string, keyIdentifier?: string) => Promise<{ success: boolean; error?: string; rewardSummary?: string }>;
  consumeInventoryItemAction: (itemIdentifier: string, quantity?: number) => Promise<{ success: boolean; error?: string }>;
  isItemOpening: boolean;
  openingItemName: string | null;

  // Item Information Database
  itemDefinitions: ItemDefinition[];
  itemInformationSystemEnabled: boolean;
  toggleItemInformationSystem: (enabled?: boolean) => Promise<void>;
  saveItemDefinition: (definition: Partial<ItemDefinition> & { itemName: string }, changeNote?: string) => Promise<{ success: boolean; item: ItemDefinition }>;
  updateItemDefinitionAction: (itemId: string, updates: Partial<ItemDefinition>, changeNote?: string) => Promise<{ success: boolean; item?: ItemDefinition }>;
  toggleItemDefinitionEnabled: (itemId: string) => Promise<void>;
  deleteItemDefinitionAction: (itemId: string) => Promise<{ success: boolean }>;
  exportItemDefinitionsJson: () => string;
  importItemDefinitionsJson: (jsonString: string) => Promise<{ success: boolean; importedCount: number; message: string }>;
  getItemDefinition: (itemOrName: string | { name?: string; id?: string }) => ItemDefinition | undefined;

  // Settings & Core Maintenance
  updateSettings: (newSettings: Partial<SystemSettings>) => Promise<void>;
  resetDatabase: () => Promise<void>;
  exportDatabase: () => string;
  importDatabase: (jsonString: string) => Promise<{ success: boolean; message: string }>;
  importDatabaseBackup: (jsonString: string) => Promise<{ success: boolean; message: string }>;
}

const SystemCoreContext = createContext<SystemCoreContextType | undefined>(undefined);

export const SystemCoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [db, setDb] = useState<SystemCoreDatabase>(DEFAULT_INITIAL_DATABASE);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [profileAvatar, setProfileAvatarState] = useState<string | null>(() => getSavedAvatar());
  const [isItemOpening, setIsItemOpening] = useState<boolean>(false);
  const [openingItemName, setOpeningItemName] = useState<string | null>(null);
  const activeLocksRef = React.useRef<Set<string>>(new Set());

  // Load database on mount with immediate expiration verification
  useEffect(() => {
    let isMounted = true;
    async function init() {
      try {
        const loaded = await storageAdapter.load();
        const playerWithTimestamps = ensureQuestTimestamps(loaded.player);
        const globalPenalties = loaded.settings?.questIncompletionPenaltiesEnabled !== false;
        
        // Check if any quests or daily cycle expired while app was closed
        const checkRes = checkAndExecuteAllQuestExpirations(playerWithTimestamps, globalPenalties, new Date());
        
        const finalDb: SystemCoreDatabase = {
          ...loaded,
          player: checkRes.updatedPlayer,
          events: checkRes.events.length > 0 ? [...checkRes.events, ...loaded.events] : loaded.events,
          lastUpdated: checkRes.hasChanges ? new Date().toISOString() : loaded.lastUpdated,
        };

        if (checkRes.hasChanges || playerWithTimestamps !== loaded.player) {
          await storageAdapter.save(finalDb);
        }

        if (isMounted) {
          setDb(finalDb);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Failed to init db:', err);
        if (isMounted) setIsLoading(false);
      }
    }
    init();
    return () => {
      isMounted = false;
    };
  }, []);

  const [currentTime, setCurrentTime] = useState<Date>(() => new Date());

  // 1-second dynamic heartbeat interval for countdowns and real-time expiration monitoring
  useEffect(() => {
    if (isLoading) return;

    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);

      setDb((prevDb) => {
        const globalPenalties = prevDb.settings.questIncompletionPenaltiesEnabled !== false;
        const checkRes = checkAndExecuteAllQuestExpirations(prevDb.player, globalPenalties, now);

        if (!checkRes.hasChanges) {
          return prevDb;
        }

        const nextDb: SystemCoreDatabase = {
          ...prevDb,
          player: checkRes.updatedPlayer,
          events: checkRes.events.length > 0 ? [...checkRes.events, ...prevDb.events] : prevDb.events,
          lastUpdated: now.toISOString(),
        };

        // Persist to storage asynchronously
        storageAdapter.save(nextDb).catch((err) => console.error('Failed to persist heartbeat state:', err));
        return nextDb;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isLoading]);

  const questCountdown: QuestCountdownInfo = calculateQuestCountdown(
    db.player.nextQuestRefreshAt,
    db.player.questCycleStartedAt || db.player.questGeneratedAt,
    currentTime,
    Boolean(db.player.questRefreshRequested),
    Boolean(db.player.questRefreshAvailable),
    db.player.questRefreshRequestedAt,
    Boolean(db.player.dailyQuestRefreshRequired)
  );

  const requestQuestRefresh = async (): Promise<{ success: boolean; message: string }> => {
    if (db.player.questRefreshRequested) {
      showToast('Quest refresh already requested.', 'warning');
      return { success: false, message: 'Quest refresh already requested.' };
    }

    const now = new Date();
    const { updatedPlayer, systemEvent } = createQuestRefreshRequest(db.player, now);

    const newDb: SystemCoreDatabase = {
      ...db,
      player: updatedPlayer,
      events: [systemEvent, ...db.events],
      lastUpdated: now.toISOString(),
    };

    setDb(newDb);
    await storageAdapter.save(newDb);
    showToast('⚔️ Quest refresh requested. Awaiting System Controller.', 'info');
    return { success: true, message: '⚔️ Quest refresh requested. Awaiting System Controller.' };
  };

  const refreshQuestsNow = async () => {
    await requestQuestRefresh();
  };

  const toggleQuestComplete = async (questTitleOrId: string) => {
    const result = executeQuestCompletion(db.player, questTitleOrId);
    if (!result.updatedPlayer) return;

    const newDb: SystemCoreDatabase = {
      ...db,
      player: result.updatedPlayer,
      events: result.systemEvent ? [result.systemEvent, ...db.events] : db.events,
      lastUpdated: new Date().toISOString(),
    };

    setDb(newDb);
    await storageAdapter.save(newDb);

    if (result.isCompleted) {
      const rewardMsg = result.rewardSummary ? ` Rewards: ${result.rewardSummary}` : '';
      showToast(`Quest completed! ✓${rewardMsg}`, 'success');
    } else {
      showToast('Quest reactivated (Active)', 'info');
    }
  };

  const toggleQuestPenaltyEnabled = async (questTitleOrId: string) => {
    const existingQuests = [...(db.player.quests || [])];
    let found = false;
    let newStatus = false;
    const updatedQuests = existingQuests.map((q) => {
      if (typeof q === 'string') return q;
      if (q.id === questTitleOrId || q.questId === questTitleOrId || q.title?.toLowerCase() === questTitleOrId.toLowerCase()) {
        found = true;
        const currentVal = q.penaltyEnabled !== undefined ? q.penaltyEnabled : (q.penalty ? (typeof q.penalty === 'object' ? q.penalty.enabled !== false : true) : false);
        newStatus = !currentVal;
        return {
          ...q,
          penaltyEnabled: newStatus,
        };
      }
      return q;
    });

    if (found) {
      const nextPlayer: PlayerState = {
        ...db.player,
        quests: updatedQuests,
      };
      const newDb = { ...db, player: nextPlayer, lastUpdated: new Date().toISOString() };
      setDb(newDb);
      await storageAdapter.save(newDb);
      showToast(`Quest penalty ${newStatus ? 'enabled' : 'disabled'}`, 'info');
    }
  };

  const toggleQuestIncompletionPenalties = async (enabled?: boolean) => {
    const nextVal = enabled !== undefined ? enabled : !(db.settings.questIncompletionPenaltiesEnabled !== false);
    const updatedSettings: SystemSettings = {
      ...db.settings,
      questIncompletionPenaltiesEnabled: nextVal,
    };
    const newDb = { ...db, settings: updatedSettings, lastUpdated: new Date().toISOString() };
    setDb(newDb);
    await storageAdapter.save(newDb);
    showToast(`Quest incompletion penalties ${nextVal ? 'ENABLED' : 'DISABLED'}`, 'info');
  };

  const createCustomQuestAction = async (
    questData: Partial<QuestItem> & { title: string }
  ): Promise<{ success: boolean; quest: QuestItem }> => {
    const newQuest = createCustomQuestItem(questData);
    const nowIso = new Date().toISOString();

    const nextPlayer: PlayerState = {
      ...db.player,
      quests: [...(db.player.quests || []), newQuest],
      stateVersion: (db.player.stateVersion ?? 0) + 1,
    };

    // Create audit System Event
    const eventId = `evt_create_quest_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const systemEvent: SystemEvent = {
      id: eventId,
      timestamp: nowIso,
      formattedDate: new Date().toLocaleString(),
      source: 'SYSTEM CORE // QUEST CREATOR',
      type: 'custom_quest_created',
      category: 'quest',
      rawMessage: [
        `[CUSTOM QUEST CREATED] "${newQuest.title}"`,
        `Quest ID: ${newQuest.questId}`,
        `Type: ${newQuest.type} | Difficulty: ${newQuest.difficulty} | Rank: ${newQuest.rank}`,
        ...(newQuest.completionRequirement ? [`Requirements: ${newQuest.completionRequirement}`] : []),
        ...(newQuest.expiresAt ? [`Expires At: ${newQuest.expiresAt}`] : []),
        ...(newQuest.reward ? [`Reward: ${typeof newQuest.reward === 'object' ? JSON.stringify(newQuest.reward) : newQuest.reward}`] : []),
        `Penalty: ${newQuest.penaltyEnabled ? (newQuest.penaltyDescription || 'Enabled') : 'OFF'}`,
        `State Version: v${nextPlayer.stateVersion}`,
      ].join('\n'),
      summary: `🎯 Custom Quest Created: "${newQuest.title}" [${newQuest.type}]`,
      read: true,
      importance: 'HIGH',
      processed: true,
      processedAt: nowIso,
      stateChangesApplied: true,
    };

    const newDb: SystemCoreDatabase = {
      ...db,
      player: nextPlayer,
      events: [systemEvent, ...db.events],
      lastUpdated: nowIso,
    };

    setDb(newDb);
    await storageAdapter.save(newDb);
    showToast(`🎯 Custom quest "${newQuest.title}" created successfully!`, 'success');

    return { success: true, quest: newQuest };
  };

  const updateCustomQuestAction = async (
    questId: string,
    updates: Partial<QuestItem>
  ): Promise<{ success: boolean; quest?: QuestItem }> => {
    const existingQuests = [...(db.player.quests || [])];
    const targetIdx = existingQuests.findIndex((q) => {
      if (typeof q === 'string') return false;
      return (q.questId && q.questId === questId) || (q.id && q.id === questId);
    });

    if (targetIdx === -1) {
      showToast('Quest not found.', 'error');
      return { success: false };
    }

    const currentQuest = existingQuests[targetIdx] as QuestItem;
    const merged = { ...currentQuest, ...updates };
    const normalized = createCustomQuestItem(merged);

    existingQuests[targetIdx] = normalized;

    const nextPlayer: PlayerState = {
      ...db.player,
      quests: existingQuests,
      stateVersion: (db.player.stateVersion ?? 0) + 1,
    };

    const newDb: SystemCoreDatabase = {
      ...db,
      player: nextPlayer,
      lastUpdated: new Date().toISOString(),
    };

    setDb(newDb);
    await storageAdapter.save(newDb);
    showToast(`Quest "${normalized.title}" updated ✓`, 'success');

    return { success: true, quest: normalized };
  };

  const deleteCustomQuestAction = async (questId: string): Promise<{ success: boolean }> => {
    const existingQuests = [...(db.player.quests || [])];
    let targetTitle = '';
    const filtered = existingQuests.filter((q) => {
      const qTitle = typeof q === 'string' ? q : q.title;
      const qId = typeof q === 'object' ? (q.questId || q.id) : undefined;
      const match = (qId && qId === questId) || (qTitle && qTitle.toLowerCase() === questId.toLowerCase());
      if (match) targetTitle = qTitle;
      return !match;
    });

    const nextPlayer: PlayerState = {
      ...db.player,
      quests: filtered,
      stateVersion: (db.player.stateVersion ?? 0) + 1,
    };

    const newDb = { ...db, player: nextPlayer, lastUpdated: new Date().toISOString() };
    setDb(newDb);
    await storageAdapter.save(newDb);
    showToast(`Quest "${targetTitle || questId}" deleted.`, 'info');
    return { success: true };
  };

  const duplicateCustomQuestAction = async (quest: QuestItem): Promise<{ success: boolean; newQuest?: QuestItem }> => {
    const cloned = {
      ...quest,
      id: generateCustomQuestId(),
      questId: generateCustomQuestId(),
      title: `${quest.title} (Copy)`,
      status: 'ACTIVE' as const,
      createdAt: new Date().toISOString(),
      completedAt: undefined,
      penaltyApplied: false,
    };

    const res = await createCustomQuestAction(cloned);
    return { success: res.success, newQuest: res.quest };
  };

  const updateQuestProgressAction = async (
    questIdOrTitle: string,
    deltaOrValue: number,
    isAbsolute: boolean = false
  ): Promise<{ success: boolean; completedNow: boolean; message: string }> => {
    const result = executeQuestProgressUpdate(db.player, questIdOrTitle, deltaOrValue, isAbsolute);
    if (!result.updatedPlayer) return { success: false, completedNow: false, message: 'Update failed' };

    const newDb = { ...db, player: result.updatedPlayer, lastUpdated: new Date().toISOString() };
    setDb(newDb);
    await storageAdapter.save(newDb);

    if (result.completedNow) {
      showToast(`🏆 ${result.message}`, 'success');
    } else {
      showToast(result.message, 'info');
    }

    return { success: true, completedNow: result.completedNow, message: result.message };
  };

  const addCustomQuest = async (questData: Partial<QuestItem> & { title: string }) => {
    await createCustomQuestAction(questData);
  };

  const deleteQuest = async (questTitleOrId: string) => {
    await deleteCustomQuestAction(questTitleOrId);
  };

  /**
   * ATOMIC LOOT BOX OPENING
   * Single-use lock protection against double-click/double-tap.
   * Decrements/removes box and key in central player state, generates & adds rewards, saves to storage, and writes audit event.
   */
  const openLootBox = async (
    boxIdentifier: string,
    keyIdentifier?: string
  ): Promise<{ success: boolean; error?: string; rewardSummary?: string }> => {
    const lockKey = normalizeItemName(boxIdentifier).toLowerCase();
    
    // Protection against rapid double-clicks / concurrent executions
    if (activeLocksRef.current.has(lockKey) || isItemOpening) {
      console.warn(`[INVENTORY] Open transaction already locked for "${boxIdentifier}"`);
      return { success: false, error: 'Transaction in progress. Please wait.' };
    }

    activeLocksRef.current.add(lockKey);
    setIsItemOpening(true);
    setOpeningItemName(boxIdentifier);

    try {
      // Execute the atomic transaction
      const result = executeLootBoxTransaction(db.player, boxIdentifier, keyIdentifier);

      if (!result.success || !result.updatedPlayer || !result.systemEvent) {
        showToast(result.error || 'Failed to open loot box.', 'error');
        return { success: false, error: result.error };
      }

      const now = new Date();
      const newDb: SystemCoreDatabase = {
        ...db,
        player: result.updatedPlayer,
        events: [result.systemEvent, ...db.events],
        lastUpdated: now.toISOString(),
      };

      // Atomic persistent save
      await storageAdapter.save(newDb);
      setDb(newDb);

      const boxTitle = result.consumedBox?.name || 'Loot Box';
      const summary = result.rewardSummary || 'Waiting for System Result';
      showToast(`🎁 ${boxTitle} consumed (×1). ${summary}`, 'info');

      return { success: true, rewardSummary: summary };
    } catch (err: any) {
      console.error('[INVENTORY] Loot box transaction failed:', err);
      showToast(`Transaction failed: ${err.message}`, 'error');
      return { success: false, error: err.message };
    } finally {
      activeLocksRef.current.delete(lockKey);
      setIsItemOpening(false);
      setOpeningItemName(null);
    }
  };

  /**
   * ATOMIC ITEM CONSUMPTION
   */
  const consumeInventoryItemAction = async (
    itemIdentifier: string,
    quantity: number = 1
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = consumeInventoryItem(db.player, itemIdentifier, quantity);

      if (!result.success || !result.updatedPlayer) {
        showToast(result.error || 'Failed to consume item.', 'error');
        return { success: false, error: result.error };
      }

      const cleanName = normalizeItemName(itemIdentifier);
      const now = new Date();
      const nowIso = now.toISOString();

      const systemEvent: SystemEvent = {
        id: `evt_item_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
        timestamp: nowIso,
        formattedDate: now.toLocaleString(),
        source: 'SYSTEM CORE // INVENTORY ENGINE',
        type: 'item_consumed',
        category: 'inventory',
        rawMessage: [
          `[ITEM CONSUMED] ${cleanName} ×${quantity}`,
          `Remaining Quantity: ${result.remainingQuantity}`,
          `State Version: v${result.updatedPlayer.stateVersion}`,
        ].join('\n'),
        summary: `Consumed ${cleanName} ×${quantity}. Remaining: ${result.remainingQuantity}`,
        read: true,
        processed: true,
        processedAt: nowIso,
        stateChangesApplied: true,
      };

      const newDb: SystemCoreDatabase = {
        ...db,
        player: result.updatedPlayer,
        events: [systemEvent, ...db.events],
        lastUpdated: nowIso,
      };

      await storageAdapter.save(newDb);
      setDb(newDb);

      showToast(`Consumed ${cleanName} ✓ (Remaining: ${result.remainingQuantity})`, 'info');
      return { success: true };
    } catch (err: any) {
      console.error('[INVENTORY] Consume item error:', err);
      showToast(`Error: ${err.message}`, 'error');
      return { success: false, error: err.message };
    }
  };

  // Listen to window storage events for multi-tab sync
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'system_core_profile_avatar') {
        setProfileAvatarState(getSavedAvatar());
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const setProfileAvatar = (dataUrl: string) => {
    saveAvatarToStorage(dataUrl);
    setProfileAvatarState(dataUrl);
    showToast('Profile picture updated successfully ✓', 'success');
  };

  const removeProfileAvatar = () => {
    removeAvatarFromStorage();
    setProfileAvatarState(null);
    showToast('Profile picture removed. Default avatar restored.', 'info');
  };

  const hasCustomProfileAvatar = () => {
    return !!profileAvatar;
  };

  const showToast = (message: string, type: ToastNotification['type'] = 'info') => {
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const activeSession = db.sessions.find((s) => s.id === db.activeSessionId) || db.sessions[0];

  const geminiModel = db.settings.geminiModel || geminiService.getSelectedModel();

  const saveGeminiApiKey = (key: string) => {
    geminiService.setApiKey(key);
    showToast('Gemini API key saved in isolated storage ✓', 'success');
  };

  const clearGeminiApiKey = () => {
    geminiService.clearApiKey();
    showToast('Gemini API key cleared', 'info');
  };

  const getMaskedGeminiApiKey = () => {
    return geminiService.getMaskedApiKey();
  };

  const hasCustomGeminiApiKey = () => {
    return geminiService.hasApiKey();
  };

  const setGeminiModel = async (modelId: string) => {
    const sanitized = (modelId || '').trim() || DEFAULT_GEMINI_MODEL;
    geminiService.setSelectedModel(sanitized);
    const updatedSettings = {
      ...db.settings,
      geminiModel: sanitized,
    };
    const newDb: SystemCoreDatabase = {
      ...db,
      settings: updatedSettings,
      lastUpdated: new Date().toISOString(),
    };
    setDb(newDb);
    await storageAdapter.save(newDb);
    showToast(`Gemini model set to ${sanitized}`, 'info');
  };

  const getAvailableGeminiModels = async (apiKeyOverride?: string): Promise<GeminiModelOption[]> => {
    return await geminiService.getAvailableModels(apiKeyOverride);
  };

  /**
   * Check if an identical raw message already exists
   */
  const checkIsDuplicate = (rawMessage: string): SystemEvent | undefined => {
    const hash = calculateMessageHash(rawMessage);
    const trimmed = rawMessage.trim();
    return db.events.find(
      (e) => e.messageHash === hash || e.rawMessage.trim() === trimmed
    );
  };

  /**
   * Test Gemini connectivity with active key & model
   */
  const testGeminiConnection = async (
    apiKeyOverride?: string,
    modelOverride?: string
  ): Promise<GeminiTestResult> => {
    const activeM = modelOverride || db.settings.geminiModel || geminiService.getSelectedModel();
    const res = await geminiService.testConnection(apiKeyOverride, activeM);
    
    // Update settings with result status
    const updatedSettings: SystemSettings = {
      ...db.settings,
      geminiStatus: res.connected ? 'CONNECTED' : (res.category === 'Quota exceeded' ? 'QUOTA_EXCEEDED' : 'ERROR'),
      geminiLastTestedAt: new Date().toISOString(),
    };

    const newDb: SystemCoreDatabase = {
      ...db,
      settings: updatedSettings,
    };
    setDb(newDb);
    await storageAdapter.save(newDb);

    return res;
  };

  /**
   * Check Gemini engine status
   */
  const getGeminiStatus = async (): Promise<GeminiStatusInfo> => {
    const status = await geminiService.getStatus();
    return {
      ...status,
      connectionStatus: db.settings.geminiStatus || 'NOT_TESTED',
    };
  };

  /**
   * Main Processing Entry Point:
   * 1. Preserves complete original message in raw event storage
   * 2. Calls centralized Gemini Data Processing Pipeline
   * 3. Handles Quota Exceeded cleanly without modifying Player State
   * 4. Updates Player State & Recent Memory
   * 5. Atomically persists new database state
   */
  const addSystemEvent = async (
    rawMessage: string,
    options: {
      source?: string;
      type?: string;
      tags?: string[];
      metadata?: Record<string, any>;
      bypassDuplicateCheck?: boolean;
    } = {}
  ) => {
    const now = new Date();
    const eventId = `evt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const hash = calculateMessageHash(rawMessage);
    const activeM = db.settings.geminiModel || geminiService.getSelectedModel();

    console.log('[PIPELINE 1/6] Raw Input Received:', {
      eventId,
      length: rawMessage.length,
      snippet: rawMessage.substring(0, 100),
      session: db.activeSessionId,
      oldStateVersion: db.player.stateVersion ?? 0,
      model: activeM,
    });

    // 1. Determine importance and create base raw event (guarantees zero data loss)
    const preliminaryImportance = determineEventImportance(rawMessage, undefined, options.metadata?.importance);
    const nextSessionVersion = (db.settings.sessionVersion ?? 1) + 1;

    let initialEvent: SystemEvent = {
      id: eventId,
      eventId: eventId,
      timestamp: now.toISOString(),
      formattedDate: now.toLocaleString(),
      source: options.source || 'SYSTEM',
      type: options.type || 'system_input',
      rawMessage,
      rawSystemMessage: rawMessage,
      summary: 'Processing system message...',
      importance: preliminaryImportance,
      read: false,
      readStatus: 'UNREAD',
      processingStatus: 'PENDING',
      messageHash: hash,
      tags: options.tags || ['system_payload', 'system_input'],
      metadata: {
        ...(options.metadata || {}),
        sessionId: db.activeSessionId,
        sessionVersion: nextSessionVersion,
        rawLength: rawMessage.length,
      },
      processed: false,
      stateChangesApplied: false,
    };

    try {
      console.log(`[PIPELINE 2/6] Sending Input to Gemini Engine [${activeM}]...`);
      
      const geminiResponse = await geminiService.processSystemInput({
        rawMessage,
        playerState: db.player,
        recentMemories: db.player.recentMemory || [],
        importantMemories: db.player.importantMemory || [],
        stateVersion: db.player.stateVersion ?? 0,
        systemVersion: db.player.systemVersion ?? '1.0.0',
        model: activeM,
      });

      // Handle Quota Exceeded
      if (geminiResponse.isQuotaExceeded || geminiResponse.category === 'Quota exceeded') {
        console.warn('[PIPELINE] Gemini Quota Exceeded. Preserving original input as PENDING without modifying Player State.');
        
        const quotaPendingEvent: SystemEvent = {
          ...initialEvent,
          summary: 'PROCESSING PENDING / QUOTA EXCEEDED',
          processed: false,
          processingStatus: 'PENDING',
          geminiProcessingVersion: geminiResponse.model || activeM,
          processingError: 'QUOTA EXCEEDED: Gemini API quota exceeded. Input preserved as PENDING for retry.',
          stateChangesApplied: false,
        };

        const updatedSessions = db.sessions.map((sess) => {
          if (sess.id === db.activeSessionId) {
            return {
              ...sess,
              lastUpdated: now.toISOString(),
              sessionVersion: nextSessionVersion,
              eventCount: (sess.eventCount || 0) + 1,
            };
          }
          return sess;
        });

        const newDb: SystemCoreDatabase = {
          ...db,
          settings: {
            ...db.settings,
            geminiStatus: 'QUOTA_EXCEEDED',
            sessionVersion: nextSessionVersion,
          },
          lastUpdated: now.toISOString(),
          events: [quotaPendingEvent, ...db.events],
          sessions: updatedSessions,
        };

        setDb(newDb);
        await storageAdapter.save(newDb);
        showToast('Gemini Quota Exceeded: Input preserved as PENDING for retry.', 'warning');

        return {
          event: quotaPendingEvent,
          didChangeState: false,
          error: 'Quota exceeded',
        };
      }

      if (geminiResponse.success && geminiResponse.data) {
        const geminiData: GeminiProcessResult = geminiResponse.data;
        console.log('[PIPELINE 3/6] Gemini Processing Succeeded:', {
          summary: geminiData.summary,
          changesCount: geminiData.stateChanges?.length || 0,
          changes: geminiData.stateChanges,
          confidence: geminiData.confidence,
          usedModel: geminiResponse.model,
        });

        // 3. Apply state changes to Player State
        const { updatedState, didChange } = applyStructuredGeminiChanges(
          db.player,
          geminiData,
          {
            eventId,
            maxRecentMemory: db.settings.maxRecentMemoryEntries || 50,
            incrementVersion: db.settings.autoIncrementStateVersion,
          }
        );

        const finalImportance = determineEventImportance(
          rawMessage,
          undefined,
          options.metadata?.importance || (geminiData.importantMemory && geminiData.importantMemory.length > 0 ? 'HIGH' : undefined)
        );

        // 4. Update Event record with complete audit trail
        const processedEvent: SystemEvent = {
          ...initialEvent,
          summary: geminiData.summary || 'System event recorded',
          importance: finalImportance,
          read: false,
          readStatus: 'UNREAD',
          processingStatus: didChange ? 'SUCCESS' : 'NO_STATE_CHANGE',
          processed: true,
          geminiProcessingVersion: geminiResponse.model || activeM,
          stateChanges: geminiData.stateChanges,
          explicitStateChanges: geminiData.stateChanges,
          warnings: geminiData.warnings,
          confidence: geminiData.confidence,
          processedAt: new Date().toISOString(),
          stateChangesApplied: didChange,
        };

        // 5. Extract item definitions if system enabled
        let currentDefs = [...(db.itemDefinitions || [])];
        if (db.settings.itemInformationSystemEnabled !== false) {
          if (geminiData.itemDefinitions && Array.isArray(geminiData.itemDefinitions)) {
            for (const rawDef of geminiData.itemDefinitions) {
              if (!rawDef.itemName) continue;
              const existingIndex = currentDefs.findIndex(
                (d) => d.itemId === rawDef.itemId || d.itemName.toLowerCase() === rawDef.itemName!.toLowerCase()
              );
              if (existingIndex >= 0) {
                currentDefs[existingIndex] = updateItemDefinition(
                  currentDefs[existingIndex],
                  rawDef,
                  'Discovered properties from System message'
                );
              } else {
                currentDefs.push(createExplicitItemDefinition({ ...rawDef, itemName: rawDef.itemName }));
              }
            }
          }

          // Register new inventory items without fabricated properties
          if (updatedState.inventory && Array.isArray(updatedState.inventory)) {
            for (const inv of updatedState.inventory) {
              const rawName = typeof inv === 'string' ? inv : inv.name;
              if (!rawName) continue;
              const clean = normalizeItemName(rawName);
              const exists = currentDefs.some((d) => d.itemName.toLowerCase() === clean.toLowerCase());
              if (!exists) {
                currentDefs.push(createExplicitItemDefinition({ itemName: clean }));
              }
            }
          }
        }

        // 6. Update session last updated & version
        const updatedSessions = db.sessions.map((sess) => {
          if (sess.id === db.activeSessionId) {
            return {
              ...sess,
              lastUpdated: now.toISOString(),
              stateVersion: updatedState.stateVersion,
              sessionVersion: nextSessionVersion,
              eventCount: (sess.eventCount || 0) + 1,
            };
          }
          return sess;
        });

        const newDb: SystemCoreDatabase = {
          ...db,
          settings: {
            ...db.settings,
            geminiStatus: 'CONNECTED',
            sessionVersion: nextSessionVersion,
          },
          lastUpdated: now.toISOString(),
          player: updatedState,
          itemDefinitions: currentDefs,
          events: [processedEvent, ...db.events],
          sessions: updatedSessions,
        };

        console.log('[PIPELINE 5/6] Persisting New State to Storage Adapter...');
        setDb(newDb);
        await storageAdapter.save(newDb);
        console.log('[PIPELINE 6/6] Storage Save Complete. UI State Reactively Dispatched.');

        if (didChange) {
          showToast(`SYSTEM UPDATE APPLIED ✓ (v${updatedState.stateVersion})`, 'success');
        } else {
          showToast('SYSTEM EVENT RECORDED ✓', 'info');
        }

        return {
          event: processedEvent,
          didChangeState: didChange,
          geminiResult: geminiData,
        };
      } else {
        // Fallback: Use deterministic local parser if not quota exceeded
        console.warn('[PIPELINE FALLBACK] Using deterministic local parser:', geminiResponse.error);
        
        const fallbackParsed = parseSystemMessage(rawMessage, eventId);
        const { updatedState, didChange } = applyStateChanges(
          db.player,
          fallbackParsed.stateChanges,
          {
            maxRecentMemory: db.settings.maxRecentMemoryEntries || 50,
            incrementVersion: db.settings.autoIncrementStateVersion,
            eventId,
          }
        );

        const detectedImportance = determineEventImportance(
          rawMessage,
          fallbackParsed.stateChanges,
          options.metadata?.importance
        );

        const fallbackEvent: SystemEvent = {
          ...initialEvent,
          summary: fallbackParsed.memoryEntry?.summary || 'System event recorded',
          importance: detectedImportance,
          read: false,
          readStatus: 'UNREAD',
          processingStatus: didChange ? 'SUCCESS' : 'NO_STATE_CHANGE',
          processed: true,
          geminiProcessingVersion: 'local-deterministic-engine',
          processingError: geminiResponse.error,
          stateChanges: convertSummaryToGeminiChanges(fallbackParsed.stateChanges),
          explicitStateChanges: convertSummaryToGeminiChanges(fallbackParsed.stateChanges),
          stateChangesApplied: didChange,
        };

        const updatedSessions = db.sessions.map((sess) => {
          if (sess.id === db.activeSessionId) {
            return {
              ...sess,
              lastUpdated: now.toISOString(),
              stateVersion: updatedState.stateVersion,
              sessionVersion: nextSessionVersion,
              eventCount: (sess.eventCount || 0) + 1,
            };
          }
          return sess;
        });

        // Extract item definitions for fallback if system enabled
        let fallbackDefs = [...(db.itemDefinitions || [])];
        if (db.settings.itemInformationSystemEnabled !== false) {
          if (updatedState.inventory && Array.isArray(updatedState.inventory)) {
            for (const inv of updatedState.inventory) {
              const rawName = typeof inv === 'string' ? inv : inv.name;
              if (!rawName) continue;
              const clean = normalizeItemName(rawName);
              const exists = fallbackDefs.some((d) => d.itemName.toLowerCase() === clean.toLowerCase());
              if (!exists) {
                fallbackDefs.push(createExplicitItemDefinition({ itemName: clean }));
              }
            }
          }
        }

        const newDb: SystemCoreDatabase = {
          ...db,
          settings: {
            ...db.settings,
            sessionVersion: nextSessionVersion,
          },
          lastUpdated: now.toISOString(),
          player: updatedState,
          itemDefinitions: fallbackDefs,
          events: [fallbackEvent, ...db.events],
          sessions: updatedSessions,
        };

        setDb(newDb);
        await storageAdapter.save(newDb);

        if (didChange) {
          showToast(`SYSTEM UPDATE APPLIED ✓ (v${updatedState.stateVersion})`, 'success');
        } else {
          showToast('System event recorded ✓', 'info');
        }

        return {
          event: fallbackEvent,
          didChangeState: didChange,
          error: geminiResponse.error,
        };
      }
    } catch (err: any) {
      console.error('[PIPELINE ERROR] Processing request caught exception:', err);

      // Emergency deterministic fallback execution to never drop player state
      let updatedState = db.player;
      let didChange = false;
      let summary = 'System event recorded';

      try {
        const emergencyParsed = parseSystemMessage(rawMessage, eventId);
        const res = applyStateChanges(db.player, emergencyParsed.stateChanges, {
          maxRecentMemory: db.settings.maxRecentMemoryEntries || 50,
          incrementVersion: db.settings.autoIncrementStateVersion,
          eventId,
        });
        updatedState = res.updatedState;
        didChange = res.didChange;
        if (emergencyParsed.memoryEntry?.summary) {
          summary = emergencyParsed.memoryEntry.summary;
        }
      } catch (pErr) {
        console.error('[PIPELINE EMERGENCY] Parser error:', pErr);
      }

      const emergencyEvent: SystemEvent = {
        ...initialEvent,
        summary,
        processed: true,
        processingError: err?.message || 'Processing recovered with local parser',
        stateChangesApplied: didChange,
      };

      const newDb: SystemCoreDatabase = {
        ...db,
        lastUpdated: now.toISOString(),
        player: updatedState,
        events: [emergencyEvent, ...db.events],
      };

      setDb(newDb);
      await storageAdapter.save(newDb);

      showToast(didChange ? `SYSTEM UPDATE APPLIED ✓ (v${updatedState.stateVersion})` : 'System event recorded.', 'info');

      return {
        event: emergencyEvent,
        didChangeState: didChange,
        error: err.message,
      };
    }
  };

  /**
   * Retry processing an existing raw event through Gemini
   */
  const retryProcessEvent = async (eventId: string): Promise<{ success: boolean; error?: string }> => {
    const targetEvent = db.events.find((e) => e.id === eventId);
    if (!targetEvent) {
      return { success: false, error: 'Event not found in database.' };
    }

    const activeM = db.settings.geminiModel || geminiService.getSelectedModel();

    try {
      const response = await geminiService.processSystemInput({
        rawMessage: targetEvent.rawMessage,
        playerState: db.player,
        recentMemories: db.player.recentMemory || [],
        importantMemories: db.player.importantMemory || [],
        stateVersion: db.player.stateVersion ?? 0,
        systemVersion: db.player.systemVersion ?? '1.0.0',
        model: activeM,
      });

      if (response.isQuotaExceeded || response.category === 'Quota exceeded') {
        showToast('Quota exceeded: Cannot retry right now.', 'warning');
        return { success: false, error: 'Quota exceeded' };
      }

      if (response.success && response.data) {
        const geminiData: GeminiProcessResult = response.data;

        // Apply state changes to Player State
        const { updatedState, didChange } = applyStructuredGeminiChanges(
          db.player,
          geminiData,
          {
            eventId,
            maxRecentMemory: db.settings.maxRecentMemoryEntries || 50,
            incrementVersion: db.settings.autoIncrementStateVersion,
          }
        );

        const updatedEvents = db.events.map((e) => {
          if (e.id === eventId) {
            return {
              ...e,
              summary: geminiData.summary || e.summary,
              processed: true,
              geminiProcessingVersion: response.model || activeM,
              stateChanges: geminiData.stateChanges,
              warnings: geminiData.warnings,
              confidence: geminiData.confidence,
              processedAt: new Date().toISOString(),
              processingError: undefined,
              stateChangesApplied: didChange,
            };
          }
          return e;
        });

        const newDb: SystemCoreDatabase = {
          ...db,
          settings: {
            ...db.settings,
            geminiStatus: 'CONNECTED',
          },
          lastUpdated: new Date().toISOString(),
          player: updatedState,
          events: updatedEvents,
        };

        setDb(newDb);
        await storageAdapter.save(newDb);
        showToast('Event re-processed successfully with Gemini!', 'success');
        return { success: true };
      } else {
        showToast(`Processing failed: ${response.error || 'Unknown error'}`, 'error');
        return { success: false, error: response.error || 'Gemini processing failed' };
      }
    } catch (err: any) {
      showToast(`Network error: ${err.message}`, 'error');
      return { success: false, error: err.message };
    }
  };

  const updatePlayerState = async (
    updater: Partial<PlayerState> | ((prev: PlayerState) => PlayerState)
  ) => {
    let nextPlayer: PlayerState;
    if (typeof updater === 'function') {
      nextPlayer = updater(db.player);
    } else {
      const mergedProgression = { ...(db.player.progression || {}) };
      let newXpStr = updater.xp ?? db.player.xp;
      
      if (updater.xp !== undefined) {
        const xpInfo = extractXpComponents(updater.xp, mergedProgression);
        mergedProgression.currentXP = xpInfo.currentXp;
        if (xpInfo.requiredXp !== undefined) {
          mergedProgression.requiredXp = xpInfo.requiredXp;
          mergedProgression.requiredXP = xpInfo.requiredXp;
          newXpStr = formatXpDisplay(xpInfo.currentXp, xpInfo.requiredXp);
        } else {
          newXpStr = String(xpInfo.currentXp);
        }
      }
      if (updater.level !== undefined) {
        mergedProgression.level = extractNumeric(updater.level, 1);
      }

      nextPlayer = {
        ...db.player,
        ...updater,
        xp: newXpStr,
        progression: {
          ...mergedProgression,
          ...(updater.progression || {}),
        },
        stateVersion: db.settings.autoIncrementStateVersion
          ? (db.player.stateVersion ?? 0) + 1
          : db.player.stateVersion,
      };
    }

    const newDb: SystemCoreDatabase = {
      ...db,
      lastUpdated: new Date().toISOString(),
      player: nextPlayer,
    };

    setDb(newDb);
    await storageAdapter.save(newDb);
    showToast('Player state updated.', 'success');
  };

  const refreshStateFromStorage = async () => {
    try {
      const reloaded = await storageAdapter.load();
      setDb(reloaded);
      console.log('[SYSTEM CORE] State refreshed from storage:', reloaded);
      showToast(`State re-synchronized (v${reloaded.player?.stateVersion ?? 0})`, 'info');
    } catch (err: any) {
      console.error('[SYSTEM CORE] Failed to refresh state:', err);
      showToast('Failed to reload state from storage', 'error');
    }
  };

  const addImportantMemory = async (summary: string, importance: 'normal' | 'high' | 'critical' = 'high') => {
    const trimmed = summary.trim();
    if (!trimmed) return;

    const entry: MemoryEntry = {
      id: `mem_imp_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      summary: trimmed,
      importance,
    };

    const nextImportant = [...(db.player.importantMemory || []), entry];
    const nextPlayer: PlayerState = {
      ...db.player,
      importantMemory: nextImportant,
      stateVersion: db.settings.autoIncrementStateVersion
        ? (db.player.stateVersion ?? 0) + 1
        : db.player.stateVersion,
    };

    const newDb: SystemCoreDatabase = {
      ...db,
      lastUpdated: new Date().toISOString(),
      player: nextPlayer,
    };

    setDb(newDb);
    await storageAdapter.save(newDb);
    showToast('Added to Important Memory', 'success');
  };

  const deleteImportantMemory = async (index: number) => {
    const nextImportant = [...(db.player.importantMemory || [])];
    if (index >= 0 && index < nextImportant.length) {
      nextImportant.splice(index, 1);
      const nextPlayer: PlayerState = {
        ...db.player,
        importantMemory: nextImportant,
      };
      const newDb: SystemCoreDatabase = {
        ...db,
        lastUpdated: new Date().toISOString(),
        player: nextPlayer,
      };
      setDb(newDb);
      await storageAdapter.save(newDb);
      showToast('Removed from Important Memory', 'info');
    }
  };

  const deleteRecentMemory = async (index: number) => {
    const nextRecent = [...(db.player.recentMemory || [])];
    if (index >= 0 && index < nextRecent.length) {
      nextRecent.splice(index, 1);
      const nextPlayer: PlayerState = {
        ...db.player,
        recentMemory: nextRecent,
      };
      const newDb: SystemCoreDatabase = {
        ...db,
        lastUpdated: new Date().toISOString(),
        player: nextPlayer,
      };
      setDb(newDb);
      await storageAdapter.save(newDb);
      showToast('Removed memory entry', 'info');
    }
  };

  const unreadEventCount = db.events.filter((e) => !e.read || e.readStatus === 'UNREAD').length;

  const markEventsAsRead = async () => {
    const hasUnread = db.events.some((e) => !e.read || e.readStatus === 'UNREAD');
    if (!hasUnread) return;

    const updatedEvents = db.events.map((e) => ({
      ...e,
      read: true,
      readStatus: 'READ' as const,
    }));
    const newDb: SystemCoreDatabase = {
      ...db,
      events: updatedEvents,
      lastUpdated: new Date().toISOString(),
    };
    setDb(newDb);
    await storageAdapter.save(newDb);
  };

  const markEventAsRead = async (eventId: string) => {
    const event = db.events.find((e) => e.id === eventId);
    if (!event || (event.read && event.readStatus === 'READ')) return;

    const updatedEvents = db.events.map((e) =>
      e.id === eventId ? { ...e, read: true, readStatus: 'READ' as const } : e
    );
    const newDb: SystemCoreDatabase = {
      ...db,
      events: updatedEvents,
      lastUpdated: new Date().toISOString(),
    };
    setDb(newDb);
    await storageAdapter.save(newDb);
  };

  const deleteEvent = async (eventId: string) => {
    const filteredEvents = db.events.filter((e) => e.id !== eventId);
    const newDb: SystemCoreDatabase = {
      ...db,
      lastUpdated: new Date().toISOString(),
      events: filteredEvents,
    };
    setDb(newDb);
    await storageAdapter.save(newDb);
    showToast('Event deleted from archive.', 'info');
  };

  const clearAllEvents = async () => {
    const newDb: SystemCoreDatabase = {
      ...db,
      lastUpdated: new Date().toISOString(),
      events: [],
    };
    setDb(newDb);
    await storageAdapter.save(newDb);
    showToast('All event logs cleared. Player State preserved.', 'warning');
  };

  const createChatSession = async (label: string, notes?: string): Promise<ChatSession> => {
    const id = `session-${Date.now().toString(36)}`;
    const newSession: ChatSession = {
      id,
      label: label.trim() || `Session ${db.sessions.length + 1}`,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      stateVersion: db.player.stateVersion ?? 0,
      notes: notes || '',
      eventCount: 0,
    };

    const newDb: SystemCoreDatabase = {
      ...db,
      lastUpdated: new Date().toISOString(),
      sessions: [...db.sessions, newSession],
      activeSessionId: id,
    };

    setDb(newDb);
    await storageAdapter.save(newDb);
    showToast(`Created & Activated ${newSession.label}`, 'success');
    return newSession;
  };

  const setActiveSession = async (sessionId: string) => {
    if (!db.sessions.some((s) => s.id === sessionId)) return;
    const newDb: SystemCoreDatabase = {
      ...db,
      activeSessionId: sessionId,
      lastUpdated: new Date().toISOString(),
    };
    setDb(newDb);
    await storageAdapter.save(newDb);
    const sess = db.sessions.find((s) => s.id === sessionId);
    showToast(`Switched active chat to ${sess?.label || sessionId}`, 'info');
  };

  const deleteChatSession = async (sessionId: string) => {
    if (db.sessions.length <= 1) {
      showToast('Cannot delete the only active chat session.', 'warning');
      return;
    }
    const filtered = db.sessions.filter((s) => s.id !== sessionId);
    const newActive = db.activeSessionId === sessionId ? filtered[0].id : db.activeSessionId;

    const newDb: SystemCoreDatabase = {
      ...db,
      sessions: filtered,
      activeSessionId: newActive,
      lastUpdated: new Date().toISOString(),
    };

    setDb(newDb);
    await storageAdapter.save(newDb);
    showToast('Chat session deleted.', 'info');
  };

  const updateSettings = async (newSettings: Partial<SystemSettings>) => {
    const updatedSettings = { ...db.settings, ...newSettings };
    
    // Check if recent memory limit was adjusted and requires active memory trimming
    let updatedPlayer = {
      ...db.player,
      playerId: updatedSettings.playerId || db.player.playerId,
      systemVersion: updatedSettings.systemVersion || db.player.systemVersion,
    };

    if (
      updatedSettings.maxRecentMemoryEntries &&
      updatedPlayer.recentMemory &&
      updatedPlayer.recentMemory.length > updatedSettings.maxRecentMemoryEntries
    ) {
      updatedPlayer.recentMemory = updatedPlayer.recentMemory.slice(
        updatedPlayer.recentMemory.length - updatedSettings.maxRecentMemoryEntries
      );
    }

    const newDb: SystemCoreDatabase = {
      ...db,
      settings: updatedSettings,
      player: updatedPlayer,
      lastUpdated: new Date().toISOString(),
    };
    setDb(newDb);
    await storageAdapter.save(newDb);
    showToast('Settings saved.', 'success');
  };

  const resetDatabase = async () => {
    await storageAdapter.clear();
    const fresh: SystemCoreDatabase = {
      ...DEFAULT_INITIAL_DATABASE,
      lastUpdated: new Date().toISOString(),
    };
    setDb(fresh);
    await storageAdapter.save(fresh);
    showToast('Database reset to defaults.', 'warning');
  };

  const exportDatabase = (): string => {
    return storageAdapter.exportBackup(db);
  };

  const importDatabaseBackup = async (
    jsonString: string
  ): Promise<{ success: boolean; message: string }> => {
    const result = storageAdapter.validateBackup(jsonString);
    if (!result.valid || !result.data) {
      return {
        success: false,
        message: result.error || 'Invalid database structure',
      };
    }

    try {
      setDb(result.data);
      await storageAdapter.save(result.data);
      showToast('Database successfully restored from backup!', 'success');
      return { success: true, message: 'Database imported successfully.' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Write failure' };
    }
  };

  /**
   * ITEM INFORMATION DATABASE ACTIONS
   */
  const toggleItemInformationSystem = async (enabled?: boolean) => {
    const nextVal = enabled !== undefined ? enabled : !(db.settings.itemInformationSystemEnabled !== false);
    const updatedSettings = {
      ...db.settings,
      itemInformationSystemEnabled: nextVal,
    };
    const newDb = {
      ...db,
      settings: updatedSettings,
      lastUpdated: new Date().toISOString(),
    };
    setDb(newDb);
    await storageAdapter.save(newDb);
    showToast(
      nextVal ? 'Item Information Database enabled ✓' : 'Item Information Database disabled',
      'info'
    );
  };

  const saveItemDefinition = async (
    definition: Partial<ItemDefinition> & { itemName: string },
    changeNote?: string
  ): Promise<{ success: boolean; item: ItemDefinition }> => {
    const current = [...(db.itemDefinitions || [])];
    const targetId = definition.itemId || generateItemId(definition.itemName);
    const existingIndex = current.findIndex(
      (d) => d.itemId.toLowerCase() === targetId.toLowerCase() || d.itemName.toLowerCase() === definition.itemName.toLowerCase()
    );

    let savedItem: ItemDefinition;
    if (existingIndex >= 0) {
      savedItem = updateItemDefinition(current[existingIndex], definition, changeNote || 'Manual update');
      current[existingIndex] = savedItem;
    } else {
      savedItem = createExplicitItemDefinition({
        ...definition,
        itemId: targetId,
      });
      current.push(savedItem);
    }

    const newDb = {
      ...db,
      itemDefinitions: current,
      lastUpdated: new Date().toISOString(),
    };

    setDb(newDb);
    await storageAdapter.save(newDb);
    showToast(`Item definition saved: ${savedItem.itemName} (v${savedItem.definitionVersion})`, 'success');
    return { success: true, item: savedItem };
  };

  const updateItemDefinitionAction = async (
    itemId: string,
    updates: Partial<ItemDefinition>,
    changeNote?: string
  ): Promise<{ success: boolean; item?: ItemDefinition }> => {
    const current = [...(db.itemDefinitions || [])];
    const existingIndex = current.findIndex((d) => d.itemId.toLowerCase() === itemId.toLowerCase());

    if (existingIndex < 0) {
      showToast('Item definition not found.', 'error');
      return { success: false };
    }

    const updated = updateItemDefinition(current[existingIndex], updates, changeNote || 'Manual update');
    current[existingIndex] = updated;

    const newDb = {
      ...db,
      itemDefinitions: current,
      lastUpdated: new Date().toISOString(),
    };

    setDb(newDb);
    await storageAdapter.save(newDb);
    showToast(`Updated definition: ${updated.itemName} (v${updated.definitionVersion})`, 'success');
    return { success: true, item: updated };
  };

  const toggleItemDefinitionEnabled = async (itemId: string) => {
    const current = [...(db.itemDefinitions || [])];
    const existingIndex = current.findIndex((d) => d.itemId.toLowerCase() === itemId.toLowerCase());
    if (existingIndex < 0) return;

    const target = current[existingIndex];
    const nextEnabled = target.enabled === false ? true : false;
    current[existingIndex] = {
      ...target,
      enabled: nextEnabled,
      lastUpdated: new Date().toISOString(),
    };

    const newDb = {
      ...db,
      itemDefinitions: current,
      lastUpdated: new Date().toISOString(),
    };

    setDb(newDb);
    await storageAdapter.save(newDb);
    showToast(
      `${target.itemName} definition ${nextEnabled ? 'enabled' : 'disabled'}`,
      'info'
    );
  };

  const deleteItemDefinitionAction = async (itemId: string): Promise<{ success: boolean }> => {
    const current = [...(db.itemDefinitions || [])];
    const filtered = current.filter((d) => d.itemId.toLowerCase() !== itemId.toLowerCase());

    const newDb = {
      ...db,
      itemDefinitions: filtered,
      lastUpdated: new Date().toISOString(),
    };

    setDb(newDb);
    await storageAdapter.save(newDb);
    showToast('Item definition deleted. (Inventory quantities unaffected)', 'info');
    return { success: true };
  };

  const exportItemDefinitionsJson = (): string => {
    return JSON.stringify(db.itemDefinitions || [], null, 2);
  };

  const importItemDefinitionsJson = async (
    jsonString: string
  ): Promise<{ success: boolean; importedCount: number; message: string }> => {
    try {
      const parsed = JSON.parse(jsonString);
      if (!Array.isArray(parsed)) {
        return {
          success: false,
          importedCount: 0,
          message: 'Expected a JSON array of item definitions.',
        };
      }

      const current = [...(db.itemDefinitions || [])];
      let importedCount = 0;

      for (const item of parsed) {
        if (!item || typeof item !== 'object' || !item.itemName) continue;
        const targetId = item.itemId || generateItemId(item.itemName);
        const existingIdx = current.findIndex(
          (d) => d.itemId.toLowerCase() === targetId.toLowerCase() || d.itemName.toLowerCase() === item.itemName.toLowerCase()
        );

        if (existingIdx >= 0) {
          current[existingIdx] = updateItemDefinition(current[existingIdx], item, 'Imported definition update');
        } else {
          current.push(createExplicitItemDefinition(item));
        }
        importedCount++;
      }

      const newDb = {
        ...db,
        itemDefinitions: current,
        lastUpdated: new Date().toISOString(),
      };

      setDb(newDb);
      await storageAdapter.save(newDb);
      showToast(`Imported ${importedCount} item definitions ✓`, 'success');
      return {
        success: true,
        importedCount,
        message: `Successfully imported ${importedCount} item definitions.`,
      };
    } catch (err: any) {
      return {
        success: false,
        importedCount: 0,
        message: `Invalid JSON format: ${err.message}`,
      };
    }
  };

  const getItemDefinition = (
    itemOrName: string | { name?: string; id?: string }
  ): ItemDefinition | undefined => {
    return findItemDefinition(db.itemDefinitions, itemOrName);
  };

  return (
    <SystemCoreContext.Provider
      value={{
        db,
        isLoading,
        activeSession,
        toasts,
        showToast,
        removeToast,
        currentTime,
        profileAvatar,
        setProfileAvatar,
        removeProfileAvatar,
        hasCustomProfileAvatar,
        addSystemEvent,
        retryProcessEvent,
        checkIsDuplicate,
        saveGeminiApiKey,
        clearGeminiApiKey,
        getMaskedGeminiApiKey,
        hasCustomGeminiApiKey,
        geminiModel,
        setGeminiModel,
        getAvailableGeminiModels,
        testGeminiConnection,
        getGeminiStatus,
        updatePlayerState,
        refreshStateFromStorage,
        addImportantMemory,
        deleteImportantMemory,
        deleteRecentMemory,
        unreadEventCount,
        markEventsAsRead,
        markEventAsRead,
        deleteEvent,
        clearAllEvents,
        createChatSession,
        setActiveSession,
        deleteChatSession,
        questCountdown,
        refreshQuestsNow,
        requestQuestRefresh,
        toggleQuestComplete,
        toggleQuestPenaltyEnabled,
        toggleQuestIncompletionPenalties,
        addCustomQuest,
        deleteQuest,
        createCustomQuestAction,
        updateCustomQuestAction,
        deleteCustomQuestAction,
        duplicateCustomQuestAction,
        updateQuestProgressAction,
        openLootBox,
        consumeInventoryItemAction,
        isItemOpening,
        openingItemName,
        itemDefinitions: db.itemDefinitions || [],
        itemInformationSystemEnabled: db.settings.itemInformationSystemEnabled !== false,
        toggleItemInformationSystem,
        saveItemDefinition,
        updateItemDefinitionAction,
        toggleItemDefinitionEnabled,
        deleteItemDefinitionAction,
        exportItemDefinitionsJson,
        importItemDefinitionsJson,
        getItemDefinition,
        updateSettings,
        resetDatabase,
        exportDatabase,
        importDatabase: importDatabaseBackup,
        importDatabaseBackup,
      }}
    >
      {children}
    </SystemCoreContext.Provider>
  );
};

export const useSystemCore = (): SystemCoreContextType => {
  const context = useContext(SystemCoreContext);
  if (!context) {
    throw new Error('useSystemCore must be used within a SystemCoreProvider');
  }
  return context;
};
