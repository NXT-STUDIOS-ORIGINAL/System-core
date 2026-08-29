import React, { useState } from 'react';
import { useSystemCore } from '../context/SystemCoreContext';
import {
  User,
  Shield,
  Award,
  Zap,
  Package,
  Globe,
  Variable,
  Layers,
  Edit3,
  Check,
  X,
  History,
  Info,
  Bookmark,
  Plus,
  Trash2,
  Cpu,
  Clock,
  RefreshCw,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Gift,
  Key,
  Lock,
  Unlock,
  Sparkles,
  Loader2,
  Target,
  Swords,
  ShieldAlert,
  AlertTriangle,
  Timer,
  Copy,
  Coins,
} from 'lucide-react';
import { ProfileAvatar } from './ProfileAvatar';
import { XpProgressBar } from './XpProgressBar';
import { ItemCardModal } from './ItemCardModal';
import { ItemDefinitionModal } from './ItemDefinitionModal';
import { CustomQuestModal } from './CustomQuestModal';
import { calculatePlayerXp } from '../utils/xpHelper';
import { ItemDefinition, InventoryItem, QuestItem } from '../types';
import { getPlayerCoins } from '../services/currencyManager';
import {
  getQuestTimingType,
  formatDynamicTimer,
  parseQuestPenalty,
  getStatIcon,
  getStatFullName,
} from '../services/questManager';
import {
  isLootBox,
  getRequiredKeyName,
  findMatchingKey,
  getItemQuantity,
  normalizeItemName,
} from '../services/inventoryManager';

export const PlayerScreen: React.FC = () => {
  const {
    db,
    currentTime,
    updatePlayerState,
    addImportantMemory,
    deleteImportantMemory,
    deleteRecentMemory,
    showToast,
    questCountdown,
    refreshQuestsNow,
    requestQuestRefresh,
    toggleQuestComplete,
    toggleQuestPenaltyEnabled,
    deleteQuest,
    openLootBox,
    consumeInventoryItemAction,
    isItemOpening,
    openingItemName,
    itemDefinitions,
    itemInformationSystemEnabled,
    getItemDefinition,
    saveItemDefinition,
    deleteItemDefinitionAction,
    createCustomQuestAction,
    updateCustomQuestAction,
    deleteCustomQuestAction,
    duplicateCustomQuestAction,
    updateQuestProgressAction,
  } = useSystemCore();
  const player = db.player;

  // Custom Quest Modal & Management
  const [isCustomQuestModalOpen, setIsCustomQuestModalOpen] = useState(false);
  const [selectedQuestForEdit, setSelectedQuestForEdit] = useState<QuestItem | null>(null);
  const [questFilter, setQuestFilter] = useState<'ALL' | 'ACTIVE' | 'CUSTOM' | 'DAILY' | 'COMPLETED'>('ALL');

  const handleOpenCreateCustomQuest = () => {
    setSelectedQuestForEdit(null);
    setIsCustomQuestModalOpen(true);
  };

  const handleOpenEditCustomQuest = (quest: QuestItem) => {
    setSelectedQuestForEdit(quest);
    setIsCustomQuestModalOpen(true);
  };

  const handleSaveCustomQuest = async (questData: Partial<QuestItem> & { title: string }) => {
    if (selectedQuestForEdit && (selectedQuestForEdit.questId || selectedQuestForEdit.id)) {
      const qId = selectedQuestForEdit.questId || selectedQuestForEdit.id || selectedQuestForEdit.title;
      await updateCustomQuestAction(qId, questData);
    } else {
      await createCustomQuestAction(questData);
    }
  };

  const handleDeleteCustomQuest = async (questId: string) => {
    await deleteCustomQuestAction(questId);
  };

  const handleDuplicateCustomQuest = async (quest: QuestItem) => {
    await duplicateCustomQuestAction(quest);
    setIsCustomQuestModalOpen(false);
  };

  const handleAdjustQuestProgress = async (questIdOrTitle: string, delta: number) => {
    const q = player.quests?.find((item) => {
      if (typeof item === 'string') return item === questIdOrTitle;
      return item.id === questIdOrTitle || item.questId === questIdOrTitle || item.title === questIdOrTitle;
    });
    if (q && typeof q === 'object') {
      const cur = q.currentValue ?? (typeof q.progress === 'number' ? q.progress : 0);
      const nextVal = Math.max(0, cur + delta);
      await updateQuestProgressAction(questIdOrTitle, nextVal);
    }
  };

  // Item Card & Definition Modals
  const [selectedItemForCard, setSelectedItemForCard] = useState<string | InventoryItem | null>(null);
  const [selectedDefinitionForEdit, setSelectedDefinitionForEdit] = useState<ItemDefinition | null>(null);
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [isDefModalOpen, setIsDefModalOpen] = useState(false);

  // Manual core state editor
  const [isEditing, setIsEditing] = useState(false);
  const [editLevel, setEditLevel] = useState(player.level || '1');
  const [editXP, setEditXP] = useState(player.xp || '0');
  const [editStatus, setEditStatus] = useState(player.status || 'ONLINE');
  const [editPlayerId, setEditPlayerId] = useState(player.playerId || 'PLAYER-01');

  // New important memory input
  const [newImportantText, setNewImportantText] = useState('');
  const [isAddingImportant, setIsAddingImportant] = useState(false);

  // Archived quests accordion toggle
  const [showArchivedQuests, setShowArchivedQuests] = useState(false);
  const [isRefreshingQuests, setIsRefreshingQuests] = useState(false);
  const [showQuestRefreshModal, setShowQuestRefreshModal] = useState(false);

  const handleManualRefreshQuests = () => {
    if (player.questRefreshRequested) {
      showToast('Quest refresh already requested.', 'warning');
      return;
    }
    setShowQuestRefreshModal(true);
  };

  const handleConfirmQuestRefresh = async () => {
    setIsRefreshingQuests(true);
    try {
      await requestQuestRefresh();
      setShowQuestRefreshModal(false);
    } finally {
      setIsRefreshingQuests(false);
    }
  };

  const handleSaveEdit = async () => {
    try {
      await updatePlayerState({
        level: editLevel.trim() || '1',
        xp: editXP.trim() || '0',
        status: editStatus.trim() || 'ONLINE',
        playerId: editPlayerId.trim() || 'PLAYER-01',
      });
      setIsEditing(false);
    } catch (err) {
      showToast('Failed to update state', 'error');
    }
  };

  const handleAddImportant = async () => {
    if (!newImportantText.trim()) return;
    await addImportantMemory(newImportantText.trim());
    setNewImportantText('');
    setIsAddingImportant(false);
  };

  const renderSectionContent = (data: any, label: string) => {
    // Currency is NOT a stat - Coins must never appear in Stats panel
    if (label === 'Stats') {
      if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
        const filtered: Record<string, any> = {};
        for (const [k, v] of Object.entries(data)) {
          if (['coins', 'coin', 'currency'].includes(k.toLowerCase())) continue;
          filtered[k] = v;
        }
        data = filtered;
      } else if (Array.isArray(data)) {
        data = data.filter((item) => {
          if (typeof item === 'string') {
            return !/^coins?\b/i.test(item.trim());
          }
          return true;
        });
      }
    }

    if (
      data === null ||
      data === undefined ||
      (Array.isArray(data) && data.length === 0) ||
      (typeof data === 'object' && Object.keys(data).length === 0)
    ) {
      return (
        <div className="p-3 bg-[#05070a] border border-[#1a2b3c] font-mono text-xs text-slate-500 italic">
          NO DATA
        </div>
      );
    }

    if (Array.isArray(data)) {
      return (
        <ul className="space-y-1.5 font-mono text-xs text-slate-300">
          {data.map((item, idx) => {
            if (typeof item === 'string') {
              return (
                <li key={idx} className="p-2.5 bg-[#05070a] border border-[#1a2b3c] flex items-center gap-2">
                  <span className="text-[#00f2ff] font-bold">•</span>
                  <span>{item}</span>
                </li>
              );
            }
            if (typeof item === 'object') {
              if ('title' in item && 'status' in item) {
                const isCompleted = item.status === 'COMPLETED';
                return (
                  <li key={idx} className="p-2.5 bg-[#05070a] border border-[#1a2b3c] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[#00f2ff] font-bold">•</span>
                      <span className="font-semibold text-slate-200">{item.title}</span>
                    </div>
                    <span className={`px-2 py-0.5 text-[10px] font-bold border uppercase tracking-wider ${
                      isCompleted
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                        : 'border-[#00f2ff]/50 bg-[#00f2ff]/10 text-[#00f2ff]'
                    }`}>
                      {item.status}
                    </span>
                  </li>
                );
              }
              if ('name' in item) {
                return (
                  <li key={idx} className="p-2.5 bg-[#05070a] border border-[#1a2b3c] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[#00f2ff] font-bold">•</span>
                      <span>{item.name}</span>
                    </div>
                    {item.quantity && item.quantity > 1 && (
                      <span className="px-1.5 py-0.5 bg-[#0c1420] text-[#00f2ff] border border-[#1a2b3c] text-[10px]">
                        x{item.quantity}
                      </span>
                    )}
                  </li>
                );
              }
              return (
                <li key={idx} className="p-2.5 bg-[#05070a] border border-[#1a2b3c] flex items-center gap-2">
                  <span className="text-[#00f2ff] font-bold">•</span>
                  <span>{JSON.stringify(item)}</span>
                </li>
              );
            }
            return (
              <li key={idx} className="p-2.5 bg-[#05070a] border border-[#1a2b3c]">
                {String(item)}
              </li>
            );
          })}
        </ul>
      );
    }

    if (typeof data === 'object') {
      const keys = Object.keys(data);
      if (keys.length === 0) {
        return (
          <div className="p-3 bg-[#05070a] border border-[#1a2b3c] font-mono text-xs text-slate-500 italic">
            NO DATA
          </div>
        );
      }
      return (
        <div className="space-y-1.5 font-mono text-xs">
          {keys.map((k) => (
            <div key={k} className="p-2.5 bg-[#05070a] border border-[#1a2b3c] flex justify-between items-center">
              <span className="text-slate-400 uppercase tracking-wider text-[11px]">{k}</span>
              <span className="text-[#00f2ff] font-bold">{String(data[k])}</span>
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="p-3 bg-[#05070a] border border-[#1a2b3c] font-mono text-xs text-slate-200">
        {String(data)}
      </div>
    );
  };

  /**
   * RENDER INVENTORY SECTION WITH ATOMIC CONSUMPTION & MECHANICAL CONTROLS
   */
  const renderInventoryContent = () => {
    const rawItems = player.inventory || [];
    // Only display items with valid quantity > 0
    const items = rawItems.filter((i) => {
      const q = getItemQuantity(i);
      return q > 0;
    });

    return (
      <div className="space-y-3">
        {/* Item List */}
        {items.length === 0 ? (
          <div className="p-4 bg-[#05070a] border border-[#1a2b3c] font-mono text-xs text-slate-500 italic text-center">
            NO ITEMS IN INVENTORY
          </div>
        ) : (
          <ul className="space-y-2 font-mono text-xs">
            {items.map((item, idx) => {
              const cleanName = normalizeItemName(item);
              const qty = getItemQuantity(item);
              const isBox = isLootBox(item);
              const reqKey = getRequiredKeyName(item);
              const hasReqKey = reqKey ? Boolean(findMatchingKey(player.inventory, reqKey)) : true;
              const isCurrentOpening = isItemOpening && openingItemName === cleanName;
              const definition = getItemDefinition(cleanName);

              // Item Type / Icon determination
              let itemIcon = definition?.icon || '📦';
              let badgeColor = 'text-slate-300 border-[#1a2b3c] bg-[#0c1420]';
              if (definition?.icon) {
                itemIcon = definition.icon;
              } else if (isBox) {
                itemIcon = '🎁';
                badgeColor = 'text-[#00f2ff] border-[#00f2ff]/30 bg-[#00f2ff]/10';
              } else if (cleanName.toLowerCase().includes('key')) {
                itemIcon = '🗝️';
                badgeColor = 'text-amber-300 border-amber-500/30 bg-amber-500/10';
              } else if (cleanName.toLowerCase().includes('potion') || cleanName.toLowerCase().includes('elixir')) {
                itemIcon = '🧪';
                badgeColor = 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10';
              } else if (cleanName.toLowerCase().includes('sword') || cleanName.toLowerCase().includes('blade') || cleanName.toLowerCase().includes('dagger')) {
                itemIcon = '🗡️';
                badgeColor = 'text-red-300 border-red-500/30 bg-red-500/10';
              } else if (cleanName.toLowerCase().includes('scroll')) {
                itemIcon = '📜';
                badgeColor = 'text-purple-300 border-purple-500/30 bg-purple-500/10';
              }

              return (
                <li
                  key={`${cleanName}-${idx}`}
                  className="p-3 bg-[#05070a] border border-[#1a2b3c] hover:border-[#1a2b3c]/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-base select-none">{itemIcon}</span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-100">{cleanName}</span>
                        <span className={`px-1.5 py-0.5 text-[10px] font-bold border rounded ${badgeColor}`}>
                          ×{qty}
                        </span>
                        {definition?.rank && (
                          <span className="px-1.5 py-0.2 text-[9px] font-bold text-amber-300 border border-amber-500/40 bg-amber-950/30 uppercase">
                            RANK {definition.rank}
                          </span>
                        )}
                        {definition?.rarity && definition.rarity !== 'Common' && (
                          <span className="px-1.5 py-0.2 text-[9px] font-bold text-[#00f2ff] border border-[#00f2ff]/30 bg-[#00f2ff]/10 uppercase">
                            {definition.rarity}
                          </span>
                        )}
                      </div>
                      {reqKey && (
                        <div className="flex items-center gap-1 mt-1 text-[10px]">
                          {hasReqKey ? (
                            <span className="text-emerald-400 flex items-center gap-1">
                              <Unlock className="w-2.5 h-2.5" />
                              Requires: {reqKey} (Available ✓)
                            </span>
                          ) : (
                            <span className="text-amber-400 flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5" />
                              Requires: {reqKey} (Missing ✗)
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedItemForCard(item);
                        setIsCardModalOpen(true);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono text-slate-300 hover:text-[#00f2ff] bg-[#0c1420] border border-[#1a2b3c] hover:border-[#00f2ff]/40 transition-colors cursor-pointer"
                      title="View detailed Item Card & Database Definition"
                    >
                      <Info className="w-3 h-3 text-[#00f2ff]" />
                      <span>CARD</span>
                    </button>

                    {isBox ? (
                      <button
                        onClick={() => openLootBox(cleanName, reqKey || undefined)}
                        disabled={isItemOpening || (!hasReqKey && Boolean(reqKey))}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold font-mono uppercase tracking-wider border transition-all ${
                          isCurrentOpening
                            ? 'bg-[#00f2ff]/20 text-[#00f2ff] border-[#00f2ff] animate-pulse cursor-wait'
                            : !hasReqKey && reqKey
                            ? 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
                            : 'bg-[#0a1a2b] hover:bg-[#00f2ff]/20 text-[#00f2ff] hover:text-white border-[#00f2ff]/50 hover:border-[#00f2ff] active:scale-95'
                        }`}
                      >
                        {isCurrentOpening ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>OPENING...</span>
                          </>
                        ) : reqKey && !hasReqKey ? (
                          <>
                            <Lock className="w-3 h-3 text-amber-500" />
                            <span>LOCKED</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3 text-[#00f2ff]" />
                            <span>USE / OPEN</span>
                          </>
                        )}
                      </button>
                    ) : cleanName.toLowerCase().includes('potion') || cleanName.toLowerCase().includes('elixir') || cleanName.toLowerCase().includes('ration') ? (
                      <button
                        onClick={() => consumeInventoryItemAction(cleanName, 1)}
                        disabled={isItemOpening}
                        className="px-2.5 py-1 text-xs font-mono uppercase tracking-wider bg-emerald-950/30 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:border-emerald-400 active:scale-95 transition-all"
                      >
                        USE
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  };

  const recentMemories = player.recentMemory || [];
  const importantMemories = player.importantMemory || [];

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="hud-panel p-4 sm:p-5 border border-[#1a2b3c] hud-border-bracket flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <ProfileAvatar
            size="xl"
            showBorder
            showStatusIndicator
            statusOnline={player.status !== 'OFFLINE'}
          />
          <div>
            <div className="flex items-center gap-2 text-[#00f2ff] text-[10px] font-mono tracking-[0.2em] uppercase">
              <User className="w-3.5 h-3.5" />
              <span>PERSISTENT PLAYER DATABASE</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold font-mono text-slate-100 tracking-[0.2em] uppercase mt-1">
              PLAYER STATE // {player.playerId || 'PLAYER-01'}
            </h2>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Authoritative source of truth for the player state. Updates are incremental and preserve unmentioned fields.
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setEditLevel(player.level || '1');
            setEditXP(player.xp || '0');
            setEditStatus(player.status || 'ONLINE');
            setEditPlayerId(player.playerId || 'PLAYER-01');
            setIsEditing(!isEditing);
          }}
          className="flex items-center gap-2 px-4 py-2 border border-[#1a2b3c] hover:border-[#00f2ff]/40 bg-[#05070a] hover:bg-[#00f2ff]/5 text-[#00f2ff] font-mono text-[11px] font-bold uppercase tracking-widest transition-colors shrink-0"
        >
          <Edit3 className="w-3.5 h-3.5 text-[#00f2ff]" />
          <span>{isEditing ? 'CLOSE EDITOR' : 'EDIT CORE FIELDS'}</span>
        </button>
      </div>

      {/* Manual Core Field Editor if opened */}
      {isEditing && (
        <div className="hud-panel p-5 border border-[#00f2ff]/40 font-mono text-xs space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-[#1a2b3c] pb-2">
            <span className="font-bold text-[#00f2ff] uppercase tracking-wider">Edit Player State Stats</span>
            <span className="text-[10px] text-slate-500 uppercase">Saving will increment state version</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-slate-400 text-[10px] uppercase mb-1">PLAYER ID</label>
              <input
                type="text"
                value={editPlayerId}
                onChange={(e) => setEditPlayerId(e.target.value)}
                className="w-full px-3 py-2 bg-[#05070a] border border-[#1a2b3c] text-slate-200 focus:outline-none focus:border-[#00f2ff] font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-[10px] uppercase mb-1">LEVEL</label>
              <input
                type="text"
                value={editLevel}
                onChange={(e) => setEditLevel(e.target.value)}
                className="w-full px-3 py-2 bg-[#05070a] border border-[#1a2b3c] text-slate-200 focus:outline-none focus:border-[#00f2ff] font-mono text-xs"
                placeholder="1"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-[10px] uppercase mb-1">XP</label>
              <input
                type="text"
                value={editXP}
                onChange={(e) => setEditXP(e.target.value)}
                className="w-full px-3 py-2 bg-[#05070a] border border-[#1a2b3c] text-slate-200 focus:outline-none focus:border-[#00f2ff] font-mono text-xs"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-[10px] uppercase mb-1">STATUS</label>
              <input
                type="text"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="w-full px-3 py-2 bg-[#05070a] border border-[#1a2b3c] text-slate-200 focus:outline-none focus:border-[#00f2ff] font-mono text-xs"
                placeholder="ONLINE"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setIsEditing(false)}
              className="px-3 py-1.5 border border-[#1a2b3c] text-slate-400 hover:text-slate-200 hover:bg-slate-800/30 font-mono text-xs uppercase"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEdit}
              className="flex items-center gap-1.5 px-4 py-1.5 border border-[#00f2ff]/60 bg-[#00f2ff]/10 hover:bg-[#00f2ff]/20 text-[#00f2ff] font-bold font-mono text-xs uppercase tracking-wider"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save &amp; Update Version</span>
            </button>
          </div>
        </div>
      )}

      {/* Primary Attributes Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 font-mono">
        <div className="hud-panel p-4 border border-[#1a2b3c]">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider block">PLAYER ID</span>
          <span className="text-base sm:text-lg font-bold text-[#00f2ff] mt-1 block truncate">
            {player.playerId || 'UNASSIGNED'}
          </span>
        </div>

        <div className="hud-panel p-4 border border-[#1a2b3c]">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider block">SYSTEM VERSION</span>
          <span className="text-base sm:text-lg font-bold text-slate-200 mt-1 block">
            {player.systemVersion || '1.0.0'}
          </span>
        </div>

        <div className="hud-panel p-4 border border-[#1a2b3c]">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider block">STATE VERSION</span>
          <span className="text-base sm:text-lg font-bold text-emerald-400 mt-1 block">
            v{player.stateVersion ?? 0}
          </span>
        </div>

        <div className="hud-panel p-4 border border-[#1a2b3c]">
          <span className="text-[10px] text-slate-500 uppercase tracking-wider block">STATUS</span>
          <span className="text-base sm:text-lg font-bold text-[#00f2ff] mt-1 block flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#00f2ff] animate-pulse"></span>
            {player.status || 'ONLINE'}
          </span>
        </div>
      </div>

      {/* Stats Cards (Level, XP, & Dynamic Progression Fields) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 font-mono">
        <div className="hud-panel p-5 border border-[#1a2b3c] flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-[0.2em] block">CURRENT LEVEL</span>
            <span className="text-2xl sm:text-3xl font-bold text-[#00f2ff] mt-1 block">
              {player.level || (player.progression?.level ?? '1')}
            </span>
          </div>
          <Shield className="w-7 h-7 text-[#00f2ff]/30" />
        </div>

        <div className="hud-panel p-5 border border-[#1a2b3c] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-[0.2em] block">EXPERIENCE (XP)</span>
              <span className="text-xl sm:text-2xl font-bold text-slate-100 mt-1 block">
                {calculatePlayerXp(player).displayText}
              </span>
            </div>
            <Zap className="w-7 h-7 text-[#00f2ff]/30" />
          </div>
          <div className="mt-3">
            <XpProgressBar player={player} showText={false} size="sm" />
          </div>
        </div>

        {/* Dynamic Progression items if present */}
        {player.progression?.rank && (
          <div className="hud-panel p-5 border border-[#1a2b3c] flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-[0.2em] block">RANK / TIER</span>
              <span className="text-2xl sm:text-3xl font-bold text-amber-400 mt-1 block">
                {String(player.progression.rank)}
              </span>
            </div>
            <Award className="w-7 h-7 text-amber-400/30" />
          </div>
        )}

        {(player.progression?.statPoints !== undefined || player.progression?.skillPoints !== undefined) && (
          <div className="hud-panel p-5 border border-[#1a2b3c] flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-[0.2em] block">AVAILABLE POINTS</span>
              <div className="flex items-center gap-3 mt-1 text-sm font-bold text-emerald-400">
                {player.progression?.statPoints !== undefined && (
                  <span>STAT: {String(player.progression.statPoints)}</span>
                )}
                {player.progression?.skillPoints !== undefined && (
                  <span>SKILL: {String(player.progression.skillPoints)}</span>
                )}
              </div>
            </div>
            <Plus className="w-7 h-7 text-emerald-400/30" />
          </div>
        )}
      </div>

      {/* Detailed System Collections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* STATS */}
        <div className="hud-panel p-5 border border-[#1a2b3c]">
          <div className="flex items-center gap-2 border-b border-[#1a2b3c] pb-3 mb-3">
            <Zap className="w-4 h-4 text-[#00f2ff]" />
            <h3 className="text-[10px] font-bold font-mono text-slate-300 uppercase tracking-[0.2em]">
              STATS
            </h3>
          </div>
          {renderSectionContent(player.stats || player.attributes, 'Stats')}
        </div>

        {/* CURRENCY */}
        <div className="hud-panel p-5 border border-[#1a2b3c]">
          <div className="flex items-center justify-between border-b border-[#1a2b3c] pb-3 mb-3">
            <div className="flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-400" />
              <h3 className="text-[10px] font-bold font-mono text-slate-300 uppercase tracking-[0.2em]">
                🪙 CURRENCY
              </h3>
            </div>
            <span className="text-[10px] font-mono text-amber-400/80 uppercase">Authoritative Wallet</span>
          </div>
          <div className="space-y-2 font-mono">
            <div className="p-3 bg-[#05070a] border border-[#1a2b3c] flex justify-between items-center">
              <span className="text-slate-300 uppercase tracking-wider text-xs flex items-center gap-1.5">
                <span className="text-amber-400">🪙</span>
                <strong className="text-slate-200">Coins:</strong>
              </span>
              <span className="text-amber-400 font-bold text-base sm:text-lg">
                {getPlayerCoins(player)}
              </span>
            </div>
          </div>
        </div>

        {/* QUESTS - 24-HOUR REFRESH & PERSISTENCE HUD */}
        <div className="hud-panel p-5 border border-[#1a2b3c] flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1a2b3c] pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-[#00f2ff]" />
                <h3 className="text-[10px] font-bold font-mono text-slate-300 uppercase tracking-[0.2em]">
                  QUESTS & DIRECTIVES
                </h3>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                {/* CREATE CUSTOM QUEST BUTTON */}
                <button
                  type="button"
                  id="btn-create-custom-quest-header"
                  onClick={handleOpenCreateCustomQuest}
                  className="px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-[#00f2ff]/60 hover:border-[#00f2ff] text-[#00f2ff] shadow-md shadow-cyan-950/50 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>CREATE CUSTOM QUEST</span>
                </button>

                <div className={`px-2.5 py-1 bg-[#05070a] border font-mono text-[10px] font-bold flex items-center gap-1.5 ${
                  player.questRefreshRequested
                    ? 'border-amber-500/50 text-amber-300'
                    : (player.questRefreshAvailable || questCountdown.status === 'REFRESH_AVAILABLE')
                    ? 'border-cyan-500/50 text-cyan-300'
                    : 'border-[#00f2ff]/30 text-[#00f2ff]'
                }`}>
                  <Clock className="w-3 h-3 text-[#00f2ff]" />
                  <span>
                    {player.questRefreshRequested
                      ? '⚔️ REFRESH REQUESTED'
                      : (player.questRefreshAvailable || questCountdown.status === 'REFRESH_AVAILABLE')
                      ? '🔄 REFRESH AVAILABLE'
                      : `⏳ ${questCountdown.formatted}`}
                  </span>
                </div>
                <button
                  onClick={handleManualRefreshQuests}
                  disabled={isRefreshingQuests}
                  className={`px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors disabled:opacity-50 cursor-pointer border ${
                    player.questRefreshRequested
                      ? 'border-amber-500/40 bg-amber-950/20 text-amber-300 hover:bg-amber-950/40'
                      : 'border-[#1a2b3c] bg-[#05070a] hover:border-[#00f2ff]/50 hover:bg-[#00f2ff]/5 text-slate-300 hover:text-[#00f2ff]'
                  }`}
                  title={player.questRefreshRequested ? 'Quest refresh already requested' : 'Request Quest Refresh from System Controller'}
                >
                  <RefreshCw className={`w-2.5 h-2.5 ${isRefreshingQuests ? 'animate-spin' : ''}`} />
                  <span>{player.questRefreshRequested ? 'REQUESTED' : 'REFRESH'}</span>
                </button>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 mb-3 font-mono text-[10px]">
              {(['ALL', 'ACTIVE', 'CUSTOM', 'DAILY', 'COMPLETED'] as const).map((filter) => {
                const isActive = questFilter === filter;
                return (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setQuestFilter(filter)}
                    className={`px-2.5 py-1 rounded-sm border uppercase transition-colors ${
                      isActive
                        ? 'border-[#00f2ff] bg-[#00f2ff]/10 text-[#00f2ff] font-bold'
                        : 'border-[#1a2b3c] bg-[#05070a] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {filter}
                  </button>
                );
              })}
            </div>

            {/* Refresh Requested, New Cycle Ready, or Available Banner */}
            {player.dailyQuestRefreshRequired && (
              <div className="p-3 mb-3 bg-cyan-950/40 border border-[#00f2ff] text-cyan-200 text-xs font-mono space-y-1 animate-pulse">
                <div className="flex items-center gap-2 font-bold text-[#00f2ff]">
                  <Swords className="w-4 h-4 text-[#00f2ff]" />
                  <span>⚔️ NEW QUEST CYCLE READY</span>
                </div>
                <p className="text-[11px] text-slate-300 pl-6">
                  24-hour daily cycle has elapsed. Awaiting System Controller input for new daily quests.
                </p>
              </div>
            )}

            {player.questRefreshRequested && !player.dailyQuestRefreshRequired && (
              <div className="p-3 mb-3 bg-amber-950/30 border border-amber-500/40 text-amber-200 text-xs font-mono space-y-1">
                <div className="flex items-center gap-2 font-bold text-amber-300">
                  <Swords className="w-3.5 h-3.5 text-amber-400" />
                  <span>⚔️ Quest refresh requested.</span>
                </div>
                <p className="text-[11px] text-amber-200/90 pl-5">
                  Awaiting System Controller.
                </p>
              </div>
            )}

            {!player.questRefreshRequested && !player.dailyQuestRefreshRequired && (player.questRefreshAvailable || questCountdown.status === 'REFRESH_AVAILABLE') && (
              <div className="p-3 mb-3 bg-cyan-950/30 border border-[#00f2ff]/40 text-cyan-200 text-xs font-mono space-y-1">
                <div className="flex items-center gap-2 font-bold text-[#00f2ff]">
                  <RefreshCw className="w-3.5 h-3.5 text-[#00f2ff]" />
                  <span>🔄 QUEST REFRESH AVAILABLE</span>
                </div>
                <p className="text-[11px] text-slate-300 pl-5">
                  24-hour cycle timer expired. Press REFRESH or await System Controller input.
                </p>
              </div>
            )}

            {/* Cycle Telemetry Sub-bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 font-mono text-[10px] text-slate-400 bg-[#05070a] p-2.5 border border-[#1a2b3c]">
              <div>
                <span className="text-slate-500 block">CYCLE INITIALIZED:</span>
                <span className="text-slate-300">
                  {player.questCycleStartedAt || player.questGeneratedAt ? new Date(player.questCycleStartedAt || player.questGeneratedAt!).toLocaleString() : 'Active'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block">NEXT AUTO-REFRESH:</span>
                <span className="text-[#00f2ff] font-semibold">
                  {player.nextQuestRefreshAt ? new Date(player.nextQuestRefreshAt).toLocaleString() : 'In 24h'}
                </span>
              </div>
            </div>

            {/* Active Quests List */}
            {(!player.quests || player.quests.length === 0) ? (
              <div className="p-4 bg-[#05070a] border border-[#1a2b3c] font-mono text-xs text-slate-500 italic text-center space-y-2">
                <div>NO ACTIVE QUESTS</div>
                <button
                  type="button"
                  onClick={handleOpenCreateCustomQuest}
                  className="px-3 py-1.5 bg-[#00f2ff]/10 hover:bg-[#00f2ff]/20 border border-[#00f2ff]/40 text-[#00f2ff] font-bold text-xs uppercase transition inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Create Your First Custom Quest
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {player.quests
                  .filter((quest) => {
                    const isCompleted = typeof quest === 'string'
                      ? /\[completed\]/i.test(quest)
                      : quest.status === 'COMPLETED';
                    const timingType = getQuestTimingType(quest);
                    const isCustom = typeof quest === 'object' && (quest.isCustom || String(quest.questId || quest.id).startsWith('custom_') || timingType === 'CUSTOM');

                    if (questFilter === 'ACTIVE') return !isCompleted;
                    if (questFilter === 'COMPLETED') return isCompleted;
                    if (questFilter === 'CUSTOM') return isCustom;
                    if (questFilter === 'DAILY') return !isCustom && timingType === 'DAILY';
                    return true;
                  })
                  .map((quest, idx) => {
                    const title = typeof quest === 'string' ? quest : quest.title;
                    const isCompleted = typeof quest === 'string'
                      ? /\[completed\]/i.test(quest)
                      : quest.status === 'COMPLETED';
                    const questId = typeof quest === 'object' ? (quest.questId || quest.id || title) : title;
                    const desc = typeof quest === 'object' ? quest.description : undefined;
                    const icon = typeof quest === 'object' ? quest.icon : undefined;
                    const rank = typeof quest === 'object' ? quest.rank : undefined;
                    const difficulty = typeof quest === 'object' ? quest.difficulty : undefined;
                    const priority = typeof quest === 'object' ? quest.priority : undefined;
                    const reward = typeof quest === 'object' ? quest.reward : undefined;
                    const rewardsObj = typeof quest === 'object' ? quest.rewards : undefined;
                    const category = typeof quest === 'object' ? (quest.category || quest.type) : undefined;
                    const timingType = getQuestTimingType(quest);
                    const penaltyInfo = parseQuestPenalty(quest);
                    const isCustom = typeof quest === 'object' && (quest.isCustom || String(quest.questId || quest.id).startsWith('custom_') || timingType === 'CUSTOM');
                    const isCustomExpired = typeof quest === 'object' && quest.expiresAt && !isCompleted && new Date(quest.expiresAt).getTime() <= currentTime.getTime();

                    // Progress calculations
                    const progType = typeof quest === 'object' ? quest.progressType : 'CHECKBOX';
                    const targetVal = typeof quest === 'object' ? quest.targetValue : undefined;
                    const currentVal = typeof quest === 'object' ? (quest.currentValue ?? (typeof quest.progress === 'number' ? quest.progress : 0)) : 0;
                    const unitStr = typeof quest === 'object' ? quest.unit : '';
                    const hasNumericProg = progType === 'NUMERIC' && targetVal !== undefined && targetVal > 0;
                    const pctProg = hasNumericProg ? Math.min(100, Math.round((currentVal / targetVal) * 100)) : 0;

                    // Requirements sub-items
                    const reqList = typeof quest === 'object' && quest.requirements && Array.isArray(quest.requirements) ? quest.requirements : null;

                    return (
                      <div
                        key={idx}
                        className={`p-3.5 bg-[#05070a] border transition-all rounded-sm ${
                          isCompleted
                            ? 'border-emerald-500/40 bg-emerald-500/5'
                            : isCustomExpired
                            ? 'border-rose-500/40 bg-rose-500/5'
                            : 'border-[#1a2b3c] hover:border-[#00f2ff]/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            {/* Completion Checkbox */}
                            <button
                              type="button"
                              onClick={() => toggleQuestComplete(questId)}
                              className={`mt-0.5 w-5 h-5 rounded-sm border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                                isCompleted
                                  ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                                  : 'border-slate-600 hover:border-[#00f2ff] bg-slate-900/50'
                              }`}
                              title={isCompleted ? 'Mark Active' : 'Mark Completed'}
                            >
                              {isCompleted && <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />}
                            </button>

                            <div className="min-w-0 flex-1 space-y-1.5">
                              {/* Title & Badges Row */}
                              <div className="flex flex-wrap items-center gap-1.5">
                                {icon && <span className="text-sm">{icon}</span>}
                                <span className={`font-mono text-xs font-bold ${
                                  isCompleted ? 'text-slate-400 line-through' : isCustomExpired ? 'text-rose-300' : 'text-slate-100'
                                }`}>
                                  {title}
                                </span>

                                {/* Custom Badge */}
                                {isCustom && (
                                  <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase rounded-xs bg-cyan-950 border border-cyan-500/50 text-cyan-400">
                                    CUSTOM
                                  </span>
                                )}

                                {/* Rank / Difficulty */}
                                {(rank || difficulty) && (
                                  <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase rounded-xs bg-slate-800 border border-slate-700 text-amber-400">
                                    {rank ? `Rank ${rank}` : ''}{rank && difficulty ? ' • ' : ''}{difficulty || ''}
                                  </span>
                                )}

                                {/* Priority Badge */}
                                {priority && priority !== 'MEDIUM' && (
                                  <span className={`px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase rounded-xs border ${
                                    priority === 'CRITICAL' ? 'bg-rose-950/60 border-rose-600 text-rose-300' :
                                    priority === 'HIGH' ? 'bg-amber-950/60 border-amber-600 text-amber-300' :
                                    'bg-slate-900 border-slate-700 text-slate-400'
                                  }`}>
                                    {priority}
                                  </span>
                                )}

                                {/* Timing Badge */}
                                <span className={`px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-wider border font-semibold ${
                                  timingType === 'CUSTOM'
                                    ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
                                    : timingType === 'DAILY'
                                    ? 'border-slate-700 bg-slate-800 text-slate-300'
                                    : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                                }`}>
                                  {timingType === 'CUSTOM' && typeof quest === 'object' && quest.expiresAt
                                    ? `⏱️ ${formatDynamicTimer(quest.expiresAt, currentTime)}`
                                    : timingType}
                                </span>

                                {category && category !== timingType && (
                                  <span className="px-1.5 py-0.2 bg-slate-800 text-slate-400 border border-slate-700 text-[9px] font-mono uppercase tracking-wider">
                                    {category}
                                  </span>
                                )}
                              </div>

                              {/* Description / Lore */}
                              {desc && (
                                <p className="text-[11px] font-mono text-slate-400 leading-relaxed">
                                  {desc}
                                </p>
                              )}

                              {/* Numeric Progress Bar with Steppers */}
                              {hasNumericProg && (
                                <div className="p-2 rounded bg-slate-950 border border-slate-800 space-y-1.5 font-mono text-[11px]">
                                  <div className="flex items-center justify-between text-slate-300">
                                    <span>Progress: <strong className="text-cyan-300">{currentVal}</strong> / {targetVal} {unitStr}</span>
                                    <span className="text-cyan-400 font-bold">{pctProg}%</span>
                                  </div>
                                  <div className="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                                    <div
                                      className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                                      style={{ width: `${pctProg}%` }}
                                    />
                                  </div>
                                  {!isCompleted && (
                                    <div className="flex items-center justify-end gap-1.5 pt-1">
                                      <button
                                        type="button"
                                        onClick={() => handleAdjustQuestProgress(questId, -1)}
                                        className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[10px]"
                                      >
                                        -1
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleAdjustQuestProgress(questId, 1)}
                                        className="px-2 py-0.5 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-600/50 text-cyan-300 font-bold text-[10px]"
                                      >
                                        +1
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleAdjustQuestProgress(questId, 10)}
                                        className="px-2 py-0.5 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-600/50 text-cyan-300 font-bold text-[10px]"
                                      >
                                        +10
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Multi-stage Sub-requirements */}
                              {reqList && reqList.length > 0 && (
                                <div className="space-y-1 pt-1 font-mono text-[10px]">
                                  <span className="text-slate-500 uppercase tracking-wider block">Requirements ({typeof quest === 'object' && quest.requirementLogic === 'ANY' ? 'ANY ONE' : 'ALL'}):</span>
                                  <div className="space-y-1 pl-2 border-l border-slate-800">
                                    {reqList.map((r, rIdx) => {
                                      const reqText = typeof r === 'string' ? r : r.text;
                                      const reqDone = typeof r === 'object' && r.completed;
                                      return (
                                        <div key={rIdx} className="flex items-center gap-1.5 text-slate-300">
                                          <span className={reqDone ? 'text-emerald-400' : 'text-slate-600'}>
                                            {reqDone ? '✓' : '•'}
                                          </span>
                                          <span className={reqDone ? 'line-through text-slate-500' : ''}>{reqText}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Structured Rewards Breakdown */}
                              {rewardsObj ? (
                                <div className="flex flex-wrap items-center gap-2 pt-1 font-mono text-[10px]">
                                  <span className="text-slate-500 uppercase">Rewards:</span>
                                  {rewardsObj.xp !== undefined && (
                                    <span className="px-1.5 py-0.2 rounded bg-cyan-950/60 border border-cyan-600/40 text-cyan-300 font-bold">
                                      +{rewardsObj.xp} XP
                                    </span>
                                  )}
                                  {rewardsObj.currencyEffects && rewardsObj.currencyEffects.length > 0 ? (
                                    rewardsObj.currencyEffects.map((cEff, cIdx) => (
                                      <span key={cIdx} className="px-1.5 py-0.2 rounded bg-amber-950/60 border border-amber-600/40 text-amber-300 font-bold">
                                        🪙 {cEff.currencyName || 'Coins'} +{cEff.amount}
                                      </span>
                                    ))
                                  ) : rewardsObj.coins !== undefined ? (
                                    <span className="px-1.5 py-0.2 rounded bg-amber-950/60 border border-amber-600/40 text-amber-300 font-bold">
                                      🪙 +{rewardsObj.coins} Coins
                                    </span>
                                  ) : null}
                                  {rewardsObj.statEffects && rewardsObj.statEffects.length > 0 ? (
                                    rewardsObj.statEffects.map((eff, eIdx) => (
                                      <span
                                        key={eIdx}
                                        className={`px-1.5 py-0.2 rounded border font-bold ${
                                          eff.operation === 'decrease'
                                            ? 'bg-rose-950/60 border-rose-600/40 text-rose-300'
                                            : 'bg-emerald-950/60 border-emerald-600/40 text-emerald-300'
                                        }`}
                                      >
                                        {getStatIcon(eff.stat)} {eff.statName || getStatFullName(eff.stat)} {eff.operation === 'decrease' ? `-${eff.amount}` : `+${eff.amount}`}
                                      </span>
                                    ))
                                  ) : rewardsObj.stats && Object.keys(rewardsObj.stats).length > 0 ? (
                                    <span className="px-1.5 py-0.2 rounded bg-emerald-950/60 border border-emerald-600/40 text-emerald-300 font-bold">
                                      {Object.entries(rewardsObj.stats).map(([k, v]) => `${v >= 0 ? `+${v}` : v} ${k}`).join(', ')}
                                    </span>
                                  ) : null}
                                  {rewardsObj.title && (
                                    <span className="px-1.5 py-0.2 rounded bg-purple-950/60 border border-purple-600/40 text-purple-300">
                                      👑 {rewardsObj.title}
                                    </span>
                                  )}
                                  {rewardsObj.items && rewardsObj.items.length > 0 && (
                                    <span className="px-1.5 py-0.2 rounded bg-slate-800 border border-slate-700 text-slate-300">
                                      🎒 {rewardsObj.items.map(it => `${it.name} x${it.quantity}`).join(', ')}
                                    </span>
                                  )}
                                </div>
                              ) : reward ? (
                                <p className="text-[10px] font-mono text-emerald-400/90 mt-1">
                                  <span className="text-slate-500">Reward:</span> {typeof reward === 'object' ? JSON.stringify(reward) : reward}
                                </p>
                              ) : null}

                              {/* Penalty Pill / Configuration */}
                              {penaltyInfo.isExplicit && (
                                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono border ${
                                    typeof quest === 'object' && quest.penaltyApplied
                                      ? 'border-rose-500/60 bg-rose-500/20 text-rose-300 font-bold'
                                      : penaltyInfo.enabled
                                      ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                                      : 'border-slate-700 bg-slate-800/80 text-slate-500'
                                  }`}>
                                    <ShieldAlert className="w-2.5 h-2.5" />
                                    <span>Penalty: {penaltyInfo.description || `${penaltyInfo.type || 'PENALTY'}${penaltyInfo.value !== undefined ? ` (${penaltyInfo.value})` : ''}`}</span>
                                    {typeof quest === 'object' && quest.penaltyApplied ? (
                                      <span className="font-bold text-rose-400">[APPLIED]</span>
                                    ) : (
                                      <span className="text-[8px] opacity-80">[{penaltyInfo.enabled ? 'ON' : 'OFF'}]</span>
                                    )}
                                  </span>

                                  {typeof quest === 'object' && !quest.penaltyApplied && (
                                    <button
                                      type="button"
                                      onClick={() => toggleQuestPenaltyEnabled(questId)}
                                      className="text-[9px] font-mono text-slate-500 hover:text-amber-300 underline cursor-pointer"
                                    >
                                      {penaltyInfo.enabled ? 'Disable penalty' : 'Enable penalty'}
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Right Column: Status & Action Buttons */}
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                            <span className={`px-2 py-0.5 text-[9px] font-mono font-bold border uppercase tracking-wider ${
                              isCompleted
                                ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                                : isCustomExpired
                                ? 'border-rose-500/50 bg-rose-500/10 text-rose-400'
                                : 'border-[#00f2ff]/50 bg-[#00f2ff]/10 text-[#00f2ff]'
                            }`}>
                              {isCompleted ? 'COMPLETED' : isCustomExpired ? 'EXPIRED' : 'ACTIVE'}
                            </span>

                            {/* Action icons for quests */}
                            {typeof quest === 'object' && (
                              <div className="flex items-center gap-1 mt-1">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditCustomQuest(quest)}
                                  className="p-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-cyan-300 transition"
                                  title="Edit quest rules"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDuplicateCustomQuest(quest)}
                                  className="p-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-cyan-300 transition"
                                  title="Duplicate quest"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCustomQuest(questId)}
                                  className="p-1 rounded bg-slate-900 hover:bg-rose-950/60 border border-slate-700 text-slate-400 hover:text-rose-400 transition"
                                  title="Delete quest"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Past 24h Quests Archive Accordion */}
            {player.archivedQuests && player.archivedQuests.length > 0 && (
              <div className="mt-4 pt-3 border-t border-[#1a2b3c]">
                <button
                  onClick={() => setShowArchivedQuests(!showArchivedQuests)}
                  className="w-full flex items-center justify-between text-[10px] font-mono text-slate-400 hover:text-[#00f2ff] transition-colors py-1 cursor-pointer"
                >
                  <span className="flex items-center gap-1.5 uppercase tracking-wider font-bold">
                    <History className="w-3 h-3 text-[#00f2ff]" />
                    Archived Past Cycles History ({player.archivedQuests.length})
                  </span>
                  {showArchivedQuests ? (
                    <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </button>

                {showArchivedQuests && (
                  <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {player.archivedQuests.map((arch, aIdx) => {
                      const aTitle = typeof arch === 'string' ? arch : arch.title;
                      const aStatus = typeof arch === 'string'
                        ? (/\[completed\]/i.test(arch) ? 'COMPLETED' : 'EXPIRED')
                        : arch.status;
                      const aArchivedAt = typeof arch === 'object' && arch.archivedAt
                        ? new Date(arch.archivedAt).toLocaleDateString()
                        : '';
                      const aPenaltyApplied = typeof arch === 'object' && arch.penaltyApplied;
                      return (
                        <div
                          key={aIdx}
                          className="p-2 bg-[#05070a]/70 border border-[#1a2b3c] font-mono text-[10px] flex items-center justify-between text-slate-400"
                        >
                          <div className="truncate flex-1 pr-2">
                            <span>{aTitle}</span>
                            {aPenaltyApplied && (
                              <span className="ml-2 text-[9px] text-rose-400 font-bold">
                                (Penalty Applied)
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {aArchivedAt && <span className="text-slate-600 text-[9px]">{aArchivedAt}</span>}
                            <span className={`px-1.5 py-0.2 text-[8px] font-bold border uppercase ${
                              aStatus === 'COMPLETED'
                                ? 'border-emerald-500/30 text-emerald-400'
                                : 'border-slate-700 text-slate-500'
                            }`}>
                              {aStatus}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* INVENTORY */}
        <div className="hud-panel p-5 border border-[#1a2b3c]">
          <div className="flex items-center gap-2 border-b border-[#1a2b3c] pb-3 mb-3">
            <Package className="w-4 h-4 text-[#00f2ff]" />
            <h3 className="text-[10px] font-bold font-mono text-slate-300 uppercase tracking-[0.2em]">
              INVENTORY
            </h3>
          </div>
          {renderInventoryContent()}
        </div>

        {/* SKILLS */}
        <div className="hud-panel p-5 border border-[#1a2b3c]">
          <div className="flex items-center gap-2 border-b border-[#1a2b3c] pb-3 mb-3">
            <Layers className="w-4 h-4 text-[#00f2ff]" />
            <h3 className="text-[10px] font-bold font-mono text-slate-300 uppercase tracking-[0.2em]">
              SKILLS
            </h3>
          </div>
          {renderSectionContent(player.skills, 'Skills')}
        </div>

        {/* TITLES */}
        <div className="hud-panel p-5 border border-[#1a2b3c]">
          <div className="flex items-center gap-2 border-b border-[#1a2b3c] pb-3 mb-3">
            <Shield className="w-4 h-4 text-amber-400" />
            <h3 className="text-[10px] font-bold font-mono text-slate-300 uppercase tracking-[0.2em]">
              TITLES
            </h3>
          </div>
          {renderSectionContent(player.titles, 'Titles')}
        </div>

        {/* ACHIEVEMENTS */}
        <div className="hud-panel p-5 border border-[#1a2b3c]">
          <div className="flex items-center gap-2 border-b border-[#1a2b3c] pb-3 mb-3">
            <Award className="w-4 h-4 text-emerald-400" />
            <h3 className="text-[10px] font-bold font-mono text-slate-300 uppercase tracking-[0.2em]">
              ACHIEVEMENTS
            </h3>
          </div>
          {renderSectionContent(player.achievements, 'Achievements')}
        </div>

        {/* IMPORTANT MEMORY */}
        <div className="hud-panel p-5 border border-[#1a2b3c] flex flex-col">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#1a2b3c]">
            <div className="flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-amber-400" />
              <h3 className="text-[10px] font-bold font-mono text-slate-200 uppercase tracking-[0.2em]">
                IMPORTANT MEMORY ({importantMemories.length})
              </h3>
            </div>

            <button
              onClick={() => setIsAddingImportant(!isAddingImportant)}
              className="flex items-center gap-1 text-[10px] font-mono text-amber-400 hover:underline uppercase cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>ADD MEMORY</span>
            </button>
          </div>

          {isAddingImportant && (
            <div className="mb-3 p-3 bg-[#05070a] border border-amber-500/40 font-mono text-xs space-y-2">
              <input
                type="text"
                value={newImportantText}
                onChange={(e) => setNewImportantText(e.target.value)}
                placeholder="Enter permanent milestone / critical memory..."
                className="w-full p-2 bg-[#0c1420] border border-[#1a2b3c] text-slate-200 focus:outline-none focus:border-amber-400 font-mono text-xs"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setIsAddingImportant(false)}
                  className="px-2 py-1 text-slate-400 hover:text-slate-200 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddImportant}
                  className="px-3 py-1 bg-amber-500/20 border border-amber-500 text-amber-300 font-bold text-xs cursor-pointer"
                >
                  Save Permanent Memory
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 max-h-[320px] overflow-y-auto space-y-2">
            {importantMemories.length === 0 ? (
              <div className="p-4 text-center font-mono text-xs text-slate-500 italic bg-[#05070a] border border-[#1a2b3c]">
                No important memories stored. Mark critical milestones or tag them with [IMPORTANT MEMORY].
              </div>
            ) : (
              importantMemories.map((item, idx) => {
                const summary = typeof item === 'string' ? item : item.summary;
                const timestamp = typeof item === 'object' && item.timestamp ? new Date(item.timestamp).toLocaleDateString() : '';
                return (
                  <div
                    key={idx}
                    className="p-3 bg-[#05070a] border border-[#1a2b3c] flex items-start justify-between gap-2 font-mono text-xs group"
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-amber-400 font-bold shrink-0">[{idx + 1}]</span>
                      <div>
                        <p className="text-slate-200">{summary}</p>
                        {timestamp && <span className="text-[10px] text-slate-500 mt-0.5 block">{timestamp}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => deleteImportantMemory(idx)}
                      className="text-slate-600 hover:text-rose-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      title="Remove"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* WORLD STATE */}
        <div className="hud-panel p-5 border border-[#1a2b3c]">
          <div className="flex items-center gap-2 border-b border-[#1a2b3c] pb-3 mb-3">
            <Globe className="w-4 h-4 text-cyan-400" />
            <h3 className="text-[10px] font-bold font-mono text-slate-300 uppercase tracking-[0.2em]">
              WORLD STATE
            </h3>
          </div>
          {renderSectionContent(player.worldState, 'World State')}
        </div>

        {/* SYSTEM VARIABLES */}
        <div className="hud-panel p-5 border border-[#1a2b3c]">
          <div className="flex items-center gap-2 border-b border-[#1a2b3c] pb-3 mb-3">
            <Variable className="w-4 h-4 text-purple-400" />
            <h3 className="text-[10px] font-bold font-mono text-slate-300 uppercase tracking-[0.2em]">
              IMPORTANT SYSTEM VARIABLES
            </h3>
          </div>
          {renderSectionContent(player.systemVariables, 'System Variables')}
        </div>
      </div>

      {/* ROLLING RECENT MEMORY - ABSOLUTE BOTTOM OF PLAYER SCREEN */}
      <div className="hud-panel p-5 border border-[#1a2b3c] flex flex-col">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#1a2b3c]">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#00f2ff]" />
            <h3 className="text-[10px] font-bold font-mono text-slate-200 uppercase tracking-[0.2em]">
              🧠 RECENT MEMORY ({recentMemories.length}/50 ROLLING)
            </h3>
          </div>
          <span className="text-[10px] font-mono text-slate-500">Auto-trimmed buffer</span>
        </div>

        <div className="flex-1 max-h-[360px] overflow-y-auto space-y-2">
          {recentMemories.length === 0 ? (
            <div className="p-4 text-center font-mono text-xs text-slate-500 italic bg-[#05070a] border border-[#1a2b3c]">
              No recent memories generated yet. Paste a System message in System Input to generate memories.
            </div>
          ) : (
            recentMemories.map((item, idx) => (
              <div
                key={item.id || idx}
                className="p-3 bg-[#05070a] border border-[#1a2b3c] flex items-start justify-between gap-2 font-mono text-xs group"
              >
                <div className="flex items-start gap-2">
                  <span className="text-[#00f2ff] font-bold shrink-0">[{idx + 1}]</span>
                  <div>
                    <p className="text-slate-200">{item.summary}</p>
                    {item.timestamp && (
                      <span className="text-[10px] text-slate-500 mt-0.5 block">
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deleteRecentMemory(idx)}
                  className="text-slate-600 hover:text-rose-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  title="Remove from memory"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Item Card Modal */}
      {selectedItemForCard && (
        <ItemCardModal
          isOpen={isCardModalOpen}
          onClose={() => {
            setIsCardModalOpen(false);
            setSelectedItemForCard(null);
          }}
          item={selectedItemForCard}
          definition={getItemDefinition(
            typeof selectedItemForCard === 'string' ? selectedItemForCard : selectedItemForCard.name
          )}
          itemInformationSystemEnabled={itemInformationSystemEnabled}
          onEditDefinition={(def) => {
            setSelectedDefinitionForEdit(def);
            setIsDefModalOpen(true);
          }}
          onCreateDefinition={(name) => {
            setSelectedDefinitionForEdit({
              itemId: '',
              itemName: name,
              enabled: true,
              type: 'Miscellaneous',
              rarity: 'Common',
              maximumStack: 99,
            });
            setIsDefModalOpen(true);
          }}
          onUseItem={(name) => {
            consumeInventoryItemAction(name, 1);
            setIsCardModalOpen(false);
          }}
        />
      )}

      {/* Item Definition Editor Modal */}
      <ItemDefinitionModal
        isOpen={isDefModalOpen}
        onClose={() => {
          setIsDefModalOpen(false);
          setSelectedDefinitionForEdit(null);
        }}
        initialItem={selectedDefinitionForEdit}
        onSave={async (definition, note) => {
          await saveItemDefinition(definition, note);
        }}
        onDelete={async (itemId) => {
          await deleteItemDefinitionAction(itemId);
        }}
      />

      {/* Custom Quest Creator / Editor Modal */}
      <CustomQuestModal
        isOpen={isCustomQuestModalOpen}
        onClose={() => {
          setIsCustomQuestModalOpen(false);
          setSelectedQuestForEdit(null);
        }}
        initialQuest={selectedQuestForEdit}
        onSave={handleSaveCustomQuest}
        onDelete={handleDeleteCustomQuest}
        onDuplicate={handleDuplicateCustomQuest}
      />

      {/* Quest Refresh Confirmation Modal */}
      {showQuestRefreshModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="hud-panel p-6 border border-[#00f2ff]/60 max-w-md w-full font-mono text-xs space-y-4 shadow-2xl shadow-[#00f2ff]/20">
            <div className="flex items-center justify-between text-[#00f2ff] border-b border-[#1a2b3c] pb-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-[#00f2ff]" />
                <h3 className="text-sm font-bold uppercase tracking-widest text-[#00f2ff]">
                  🎯 QUEST REFRESH REQUEST
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowQuestRefreshModal(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 py-2 text-slate-200 text-xs leading-relaxed">
              <p className="text-slate-100 font-semibold text-sm">
                Quest refresh requested.
              </p>
              <p className="text-slate-300">
                The System Controller must provide the new quests.
              </p>
              <p className="text-[#00f2ff] text-xs pt-1 font-bold">
                Continue?
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-[#1a2b3c]">
              <button
                type="button"
                onClick={() => setShowQuestRefreshModal(false)}
                disabled={isRefreshingQuests}
                className="px-4 py-2 border border-[#1a2b3c] bg-[#05070a] hover:bg-slate-800 text-slate-300 font-bold uppercase text-xs tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
              >
                CANCEL
              </button>

              <button
                type="button"
                onClick={handleConfirmQuestRefresh}
                disabled={isRefreshingQuests}
                className="flex items-center gap-1.5 px-5 py-2 border border-[#00f2ff]/60 bg-[#00f2ff]/20 hover:bg-[#00f2ff]/30 text-[#00f2ff] font-bold uppercase text-xs tracking-wider transition-all shadow-[0_0_10px_rgba(0,242,255,0.2)] disabled:opacity-50 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>YES</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
