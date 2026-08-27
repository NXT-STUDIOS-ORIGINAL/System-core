import React, { useState, useRef, useEffect } from 'react';
import {
  useSystemCore,
  GeminiTestResult,
  GeminiStatusInfo,
  GeminiModelOption,
} from '../context/SystemCoreContext';
import {
  Settings,
  Database,
  Download,
  Upload,
  RotateCcw,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  FileJson,
  Check,
  Save,
  Server,
  Cpu,
  Sparkles,
  RefreshCw,
  Activity,
  Key,
  Eye,
  EyeOff,
  Trash2,
  Bot,
  ShieldCheck,
  User,
  Image as ImageIcon,
  Package,
  Layers,
  Plus,
  Search,
  Filter,
  Sliders,
  Edit3,
  Target,
  Swords,
  Clock,
} from 'lucide-react';
import { FALLBACK_GEMINI_MODELS } from '../services/geminiService';
import { ProfileAvatar } from './ProfileAvatar';
import { ProfilePictureModal } from './ProfilePictureModal';
import { ItemDefinitionModal } from './ItemDefinitionModal';
import { ItemCardModal } from './ItemCardModal';
import { CustomQuestModal } from './CustomQuestModal';
import { ItemDefinition, QuestObject } from '../types';

export const SettingsScreen: React.FC = () => {
  const {
    db,
    updateSettings,
    exportDatabase,
    importDatabase,
    resetDatabase,
    testGeminiConnection,
    getGeminiStatus,
    saveGeminiApiKey,
    clearGeminiApiKey,
    getMaskedGeminiApiKey,
    hasCustomGeminiApiKey,
    geminiModel,
    setGeminiModel,
    getAvailableGeminiModels,
    refreshStateFromStorage,
    profileAvatar,
    setProfileAvatar,
    removeProfileAvatar,
    hasCustomProfileAvatar,
    showToast,
    itemDefinitions,
    itemInformationSystemEnabled,
    toggleItemInformationSystem,
    saveItemDefinition,
    updateItemDefinitionAction,
    toggleItemDefinitionEnabled,
    deleteItemDefinitionAction,
    exportItemDefinitionsJson,
    importItemDefinitionsJson,
    questCountdown,
    requestQuestRefresh,
    toggleQuestIncompletionPenalties,
    createCustomQuestAction,
    updateCustomQuestAction,
    deleteCustomQuestAction,
    duplicateCustomQuestAction,
  } = useSystemCore();

  const [systemName, setSystemName] = useState(db.settings.systemName || 'SYSTEM CORE');
  const [systemVersion, setSystemVersion] = useState(db.settings.systemVersion || '1.0.0');
  const [playerId, setPlayerId] = useState(db.settings.playerId || 'PLAYER-01');
  const [autoIncrement, setAutoIncrement] = useState(
    db.settings.autoIncrementStateVersion ?? true
  );
  const [maxRecentMemory, setMaxRecentMemory] = useState(
    db.settings.maxRecentMemoryEntries ?? 50
  );
  const [isRefreshingState, setIsRefreshingState] = useState(false);
  const [showRawStateDebug, setShowRawStateDebug] = useState(false);

  // Quest Control & Custom Quest state
  const [showQuestRefreshModal, setShowQuestRefreshModal] = useState(false);
  const [isSubmittingQuestRefresh, setIsSubmittingQuestRefresh] = useState(false);
  const [isCustomQuestModalOpen, setIsCustomQuestModalOpen] = useState(false);
  const [selectedQuestForEdit, setSelectedQuestForEdit] = useState<QuestObject | null>(null);

  // Profile Picture state
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [showRemoveAvatarConfirm, setShowRemoveAvatarConfirm] = useState(false);

  // Gemini Engine state
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKeyPlain, setShowApiKeyPlain] = useState(false);
  const [isEditingKey, setIsEditingKey] = useState(!hasCustomGeminiApiKey());
  const [availableModels, setAvailableModels] = useState<GeminiModelOption[]>(FALLBACK_GEMINI_MODELS);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [geminiStatus, setGeminiStatus] = useState<GeminiStatusInfo | null>(null);
  const [isTestingGemini, setIsTestingGemini] = useState(false);
  const [geminiTestResult, setGeminiTestResult] = useState<GeminiTestResult | null>(null);

  // Import states
  const [importJsonText, setImportJsonText] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Item Information Database states
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [itemTypeFilter, setItemTypeFilter] = useState('ALL');
  const [itemRankFilter, setItemRankFilter] = useState('ALL');
  const [itemStatusFilter, setItemStatusFilter] = useState('ALL');
  const [editingItemDef, setEditingItemDef] = useState<ItemDefinition | null>(null);
  const [isItemDefModalOpen, setIsItemDefModalOpen] = useState(false);
  const [itemCardViewTarget, setItemCardViewTarget] = useState<ItemDefinition | null>(null);
  const [isItemCardModalOpen, setIsItemCardModalOpen] = useState(false);
  const [showItemImportModal, setShowItemImportModal] = useState(false);
  const [itemImportJsonText, setItemImportJsonText] = useState('');
  const itemFileInputRef = useRef<HTMLInputElement>(null);

  // Filtered Item Definitions calculation
  const filteredItemDefinitions = (itemDefinitions || []).filter((item) => {
    if (itemSearchQuery.trim()) {
      const q = itemSearchQuery.toLowerCase();
      const matchName = item.itemName.toLowerCase().includes(q);
      const matchId = item.itemId.toLowerCase().includes(q);
      const matchDesc = item.description?.toLowerCase().includes(q) || false;
      const matchType = item.type?.toLowerCase().includes(q) || false;
      if (!matchName && !matchId && !matchDesc && !matchType) return false;
    }
    if (itemTypeFilter !== 'ALL') {
      if ((item.type || 'Miscellaneous').toLowerCase() !== itemTypeFilter.toLowerCase()) return false;
    }
    if (itemRankFilter !== 'ALL') {
      if ((item.rank || '').toUpperCase() !== itemRankFilter.toUpperCase()) return false;
    }
    if (itemStatusFilter === 'ENABLED' && item.enabled === false) return false;
    if (itemStatusFilter === 'DISABLED' && item.enabled !== false) return false;
    return true;
  });

  const handleExportItemDefs = () => {
    try {
      const dataStr = exportItemDefinitionsJson();
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `item-definitions-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showToast('Item definitions exported successfully ✓', 'success');
    } catch (err: any) {
      showToast(`Export failed: ${err.message}`, 'error');
    }
  };

  const handleItemFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (e.target.files && e.target.files[0]) {
      fileReader.readAsText(e.target.files[0], 'UTF-8');
      fileReader.onload = (event) => {
        if (event.target?.result) {
          setItemImportJsonText(event.target.result as string);
        }
      };
    }
  };

  const handleOpenQuestRefreshModal = () => {
    if (db.player.questRefreshRequested) {
      showToast('Quest refresh already requested.', 'warning');
      return;
    }
    setShowQuestRefreshModal(true);
  };

  const handleConfirmQuestRefresh = async () => {
    setIsSubmittingQuestRefresh(true);
    try {
      await requestQuestRefresh();
      setShowQuestRefreshModal(false);
    } finally {
      setIsSubmittingQuestRefresh(false);
    }
  };

  const handleImportItemDefsSubmit = async () => {
    if (!itemImportJsonText.trim()) {
      showToast('Please provide valid JSON content.', 'warning');
      return;
    }
    const res = await importItemDefinitionsJson(itemImportJsonText);
    if (res.success) {
      setShowItemImportModal(false);
      setItemImportJsonText('');
    } else {
      showToast(res.message, 'error');
    }
  };

  useEffect(() => {
    let mounted = true;
    getGeminiStatus().then((status) => {
      if (mounted) setGeminiStatus(status);
    });

    // Load available models on mount
    getAvailableGeminiModels().then((models) => {
      if (mounted && models && models.length > 0) {
        setAvailableModels(models);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  const handleSaveApiKey = () => {
    if (!apiKeyInput.trim()) {
      showToast('Please enter a valid Gemini API key.', 'warning');
      return;
    }
    saveGeminiApiKey(apiKeyInput.trim());
    setApiKeyInput('');
    setIsEditingKey(false);
    setShowApiKeyPlain(false);
    // Refresh models with the new key
    handleRefreshModels(apiKeyInput.trim());
  };

  const handleClearApiKey = () => {
    clearGeminiApiKey();
    setApiKeyInput('');
    setIsEditingKey(true);
    setShowApiKeyPlain(false);
    setGeminiTestResult(null);
  };

  const handleRefreshModels = async (keyOverride?: string) => {
    setIsLoadingModels(true);
    try {
      const models = await getAvailableGeminiModels(keyOverride);
      if (models && models.length > 0) {
        setAvailableModels(models);
        showToast(`Discovered ${models.length} compatible Gemini models`, 'info');
      }
    } catch {
      showToast('Using default Gemini model list', 'info');
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleModelChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newModel = e.target.value;
    await setGeminiModel(newModel);
  };

  const handleTestGemini = async () => {
    setIsTestingGemini(true);
    setGeminiTestResult(null);
    try {
      const activeKey = apiKeyInput.trim() || undefined;
      const res = await testGeminiConnection(activeKey, geminiModel);
      setGeminiTestResult(res);
      if (res.connected) {
        showToast(`Gemini Connection ✓ (${res.latencyMs}ms)`, 'success');
      } else {
        const errorMsg = res.category ? `[${res.category}] ${res.error || 'Connection failed'}` : (res.error || 'Check configuration');
        showToast(`Gemini Connection Failed: ${errorMsg}`, 'error');
      }
    } catch (err: any) {
      setGeminiTestResult({
        connected: false,
        model: geminiModel,
        category: 'Network error',
        error: err.message || 'Network failure',
      });
      showToast('Gemini Connection test failed.', 'error');
    } finally {
      setIsTestingGemini(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedLimit = Math.max(5, Math.min(500, Number(maxRecentMemory) || 50));
    await updateSettings({
      systemName: systemName.trim() || 'SYSTEM CORE',
      systemVersion: systemVersion.trim() || '1.0.0',
      playerId: playerId.trim() || 'PLAYER-01',
      autoIncrementStateVersion: autoIncrement,
      maxRecentMemoryEntries: parsedLimit,
    });
    setMaxRecentMemory(parsedLimit);
  };

  const handleExport = () => {
    const jsonString = exportDatabase();
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `system-core-backup-${playerId}-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Database backup JSON exported successfully', 'success');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        setImportJsonText(content);
        setShowImportModal(true);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const handleConfirmImport = async () => {
    if (!importJsonText.trim()) {
      showToast('No JSON data to import', 'warning');
      return;
    }

    const res = await importDatabase(importJsonText);
    if (res.success) {
      setShowImportModal(false);
      setImportJsonText('');
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleConfirmReset = async () => {
    if (resetConfirmText.trim().toUpperCase() !== 'RESET') {
      showToast('Please type "RESET" to confirm deletion.', 'warning');
      return;
    }

    await resetDatabase();
    setShowResetModal(false);
    setResetConfirmText('');
  };

  // Compute status badge
  const currentStatus = db.settings.geminiStatus || (geminiStatus?.configured ? 'CONNECTED' : 'NOT_TESTED');
  const hasCustomKey = hasCustomGeminiApiKey();
  const maskedKey = getMaskedGeminiApiKey();

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="hud-panel p-4 sm:p-5 border border-[#1a2b3c] hud-border-bracket flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#00f2ff] text-[10px] font-mono tracking-[0.2em] uppercase">
            <Settings className="w-3.5 h-3.5" />
            <span>SYSTEM CONFIGURATION &amp; PERSISTENCE</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold font-mono text-slate-100 tracking-[0.2em] uppercase mt-1">
            SYSTEM SETTINGS
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl font-mono">
            Configure Gemini AI parsing engine, system metadata, event retention pools, and cryptographic backup archives.
          </p>
        </div>
      </div>

      {/* 👤 PROFILE PICTURE */}
      <div id="profile-picture-settings" className="hud-panel p-5 border border-[#1a2b3c] font-mono text-xs shadow-lg shadow-[#00f2ff]/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#1a2b3c] pb-3 mb-4 gap-2">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-[#00f2ff]" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#00f2ff]">
              👤 PROFILE PICTURE
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {hasCustomProfileAvatar() ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-bold border border-emerald-500/50 bg-emerald-500/10 text-emerald-400 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                CUSTOM AVATAR ACTIVE
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-bold border border-slate-500/50 bg-slate-500/10 text-slate-400 uppercase tracking-wider">
                DEFAULT AVATAR ACTIVE
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center sm:items-start gap-6 p-4 bg-[#05070a] border border-[#1a2b3c]">
          {/* Avatar Preview Display */}
          <div className="flex flex-col items-center gap-2 shrink-0">
            <ProfileAvatar size="2xl" showBorder showStatusIndicator statusOnline={true} />
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">CURRENT AVATAR</span>
          </div>

          {/* Details & Controls */}
          <div className="flex-1 space-y-4 text-center sm:text-left w-full">
            <div>
              <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
                PLAYER AVATAR IDENTITY
              </h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Upload and crop a custom avatar image from your device. The image is compressed into an optimized format and persisted in isolated client-side storage across page reloads and sessions.
              </p>
              <p className="text-[10px] text-slate-500 mt-1.5">
                <strong className="text-slate-400">Note:</strong> Profile picture storage is completely isolated from RPG Player State, level, quests, events, and database exports.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-1">
              <button
                id="change-profile-picture-button"
                type="button"
                onClick={() => setIsAvatarModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 border border-[#00f2ff]/60 bg-[#00f2ff]/10 hover:bg-[#00f2ff]/20 text-[#00f2ff] font-bold uppercase tracking-wider text-xs transition-all shadow-[0_0_10px_rgba(0,242,255,0.15)]"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>CHANGE PROFILE PICTURE</span>
              </button>

              {hasCustomProfileAvatar() && (
                <button
                  id="remove-profile-picture-button"
                  type="button"
                  onClick={() => setShowRemoveAvatarConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2.5 border border-rose-500/50 bg-rose-950/20 hover:bg-rose-900/40 text-rose-300 font-bold uppercase tracking-wider text-xs transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>REMOVE PROFILE PICTURE</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 🎯 QUEST MANAGEMENT */}
      <div id="quest-management-settings" className="hud-panel p-5 border border-[#1a2b3c] font-mono text-xs shadow-lg shadow-[#00f2ff]/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#1a2b3c] pb-3 mb-4 gap-2">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-[#00f2ff]" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#00f2ff]">
              🎯 QUEST MANAGEMENT
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="btn-settings-create-custom-quest"
              onClick={() => {
                setSelectedQuestForEdit(null);
                setIsCustomQuestModalOpen(true);
              }}
              className="px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-[#00f2ff]/60 hover:border-[#00f2ff] text-[#00f2ff] shadow-md shadow-cyan-950/50 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>➕ CREATE CUSTOM QUEST</span>
            </button>

            {db.player.questRefreshRequested ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-bold border border-amber-500/50 bg-amber-500/10 text-amber-300 uppercase tracking-wider animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                ⚔️ REFRESH REQUESTED
              </span>
            ) : (db.player.questRefreshAvailable || questCountdown.status === 'REFRESH_AVAILABLE') ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-bold border border-cyan-500/50 bg-cyan-500/10 text-cyan-300 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                🔄 REFRESH AVAILABLE
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-bold border border-slate-500/50 bg-slate-500/10 text-slate-400 uppercase tracking-wider">
                <Clock className="w-3 h-3 text-[#00f2ff]" />
                CYCLE ACTIVE
              </span>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* Status Alert for Refresh Requested */}
          {db.player.questRefreshRequested && (
            <div className="p-4 bg-amber-950/30 border border-amber-500/40 text-amber-200 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-amber-300 text-sm">
                <Swords className="w-4 h-4 text-amber-400 shrink-0" />
                <span>⚔️ Quest refresh requested.</span>
              </div>
              <p className="text-xs text-amber-200 font-semibold pl-6">
                Awaiting System Controller.
              </p>
              <p className="text-[10px] text-slate-400 pl-6 pt-1">
                Requested at: {db.player.questRefreshRequestedAt ? new Date(db.player.questRefreshRequestedAt).toLocaleString() : 'Recent'} — The app is not the System Controller and does not generate replacement quests autonomously.
              </p>
            </div>
          )}

          {/* Status Alert for Refresh Available */}
          {!db.player.questRefreshRequested && (db.player.questRefreshAvailable || questCountdown.status === 'REFRESH_AVAILABLE') && (
            <div className="p-4 bg-cyan-950/30 border border-[#00f2ff]/40 text-cyan-200 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-[#00f2ff] text-sm">
                <RefreshCw className="w-4 h-4 text-[#00f2ff] shrink-0" />
                <span>🔄 QUEST REFRESH AVAILABLE</span>
              </div>
              <p className="text-xs text-slate-300 pl-6">
                The 24-hour quest cycle timer has reached zero. You can press REFRESH QUESTS to submit a request, or the System Controller can provide new quests directly through System Input.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-[#05070a] border border-[#1a2b3c]">
            {/* Countdown Display */}
            <div className="space-y-1.5">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                Next automatic refresh:
              </span>
              <div className="text-sm sm:text-base font-bold text-[#00f2ff] font-mono flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#00f2ff] shrink-0" />
                <span className="break-all">
                  {db.player.questRefreshRequested
                    ? '⚔️ Quest refresh requested. Awaiting System Controller.'
                    : (db.player.questRefreshAvailable || questCountdown.status === 'REFRESH_AVAILABLE')
                    ? '🔄 QUEST REFRESH AVAILABLE'
                    : `⏳ ${questCountdown.formatted}`}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                When the 24-hour timer expires, the app marks refresh available. The app will never invent or randomize replacement quests.
              </p>
            </div>

            {/* Action Button */}
            <div className="flex flex-col justify-center items-start md:items-end gap-2">
              <button
                id="manual-refresh-quests-button"
                type="button"
                onClick={handleOpenQuestRefreshModal}
                disabled={isSubmittingQuestRefresh}
                className={`flex items-center gap-2 px-5 py-2.5 font-bold uppercase tracking-wider text-xs transition-all border ${
                  db.player.questRefreshRequested
                    ? 'border-amber-500/50 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 cursor-pointer'
                    : 'border-[#00f2ff]/60 bg-[#00f2ff]/10 hover:bg-[#00f2ff]/20 text-[#00f2ff] shadow-[0_0_10px_rgba(0,242,255,0.15)] cursor-pointer'
                }`}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSubmittingQuestRefresh ? 'animate-spin' : ''}`} />
                <span>🔄 REFRESH QUESTS</span>
              </button>

              {db.player.questRefreshRequested ? (
                <span className="text-[10px] text-amber-400 font-mono">
                  Pending System Controller directives
                </span>
              ) : (
                <span className="text-[10px] text-slate-500 font-mono">
                  Requests new quests from System Controller
                </span>
              )}
            </div>
          </div>

          {/* Custom Quests In-Settings Management List */}
          <div className="p-4 bg-[#05070a] border border-[#1a2b3c] space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                CUSTOM QUESTS LIST ({
                  (db.player.quests || []).filter(q => typeof q === 'object' && (q.isCustom || String(q.questId || q.id).startsWith('custom_') || q.type === 'CUSTOM')).length
                })
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedQuestForEdit(null);
                  setIsCustomQuestModalOpen(true);
                }}
                className="text-[10px] text-[#00f2ff] hover:underline font-bold uppercase flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Add Custom Quest
              </button>
            </div>

            {(() => {
              const customQuests = (db.player.quests || []).filter(
                q => typeof q === 'object' && (q.isCustom || String(q.questId || q.id).startsWith('custom_') || q.type === 'CUSTOM')
              );

              if (customQuests.length === 0) {
                return (
                  <p className="text-[11px] text-slate-500 italic">
                    No custom quests configured yet. Click "➕ CREATE CUSTOM QUEST" to define custom objectives, timers, and rewards.
                  </p>
                );
              }

              return (
                <div className="space-y-2">
                  {customQuests.map((q, idx) => {
                    const questObj = q as QuestObject;
                    const qId = questObj.questId || questObj.id || questObj.title;
                    const isDone = questObj.status === 'COMPLETED';

                    return (
                      <div
                        key={idx}
                        className="p-2.5 bg-slate-950 border border-slate-800 rounded flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {questObj.icon && <span>{questObj.icon}</span>}
                            <span className={`font-bold text-xs ${isDone ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                              {questObj.title}
                            </span>
                            {questObj.rank && (
                              <span className="px-1.5 py-0.2 text-[9px] bg-slate-800 text-amber-400 font-bold border border-slate-700">
                                Rank {questObj.rank}
                              </span>
                            )}
                            <span className="px-1.5 py-0.2 text-[9px] bg-cyan-950 text-cyan-300 border border-cyan-800">
                              {questObj.progressType || 'CHECKBOX'}
                            </span>
                          </div>
                          {questObj.description && (
                            <p className="text-[10px] text-slate-400 truncate mt-0.5">
                              {questObj.description}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedQuestForEdit(questObj);
                              setIsCustomQuestModalOpen(true);
                            }}
                            className="p-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-cyan-300 cursor-pointer"
                            title="Edit"
                          >
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => duplicateCustomQuestAction(questObj)}
                            className="p-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-cyan-300 cursor-pointer"
                            title="Duplicate"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteCustomQuestAction(qId)}
                            className="p-1 rounded bg-slate-900 hover:bg-rose-950 border border-slate-700 text-slate-400 hover:text-rose-400 cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Global Quest Incompletion Penalty Setting */}
          <div className="p-4 bg-[#05070a] border border-[#1a2b3c] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  QUEST INCOMPLETION PENALTIES (GLOBAL)
                </span>
                <span className={`px-2 py-0.5 text-[9px] font-bold border uppercase tracking-wider ${
                  db.settings.questIncompletionPenaltiesEnabled !== false
                    ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                    : 'border-slate-700 bg-slate-800 text-slate-400'
                }`}>
                  {db.settings.questIncompletionPenaltiesEnabled !== false ? 'ENABLED' : 'DISABLED'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed max-w-xl">
                When enabled, quests with explicitly defined penalties from the System Controller that expire uncompleted will apply their penalty. The app never invents penalties autonomously.
              </p>
            </div>

            <button
              type="button"
              onClick={() => toggleQuestIncompletionPenalties()}
              className={`px-4 py-2 text-xs font-bold font-mono uppercase tracking-wider border transition-colors cursor-pointer shrink-0 ${
                db.settings.questIncompletionPenaltiesEnabled !== false
                  ? 'border-amber-500/50 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                  : 'border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-200'
              }`}
            >
              {db.settings.questIncompletionPenaltiesEnabled !== false ? 'DISABLE PENALTIES' : 'ENABLE PENALTIES'}
            </button>
          </div>
        </div>
      </div>

      {/* 1. 🤖 GEMINI ENGINE */}
      <div id="gemini-engine-settings" className="hud-panel p-5 border border-[#1a2b3c] font-mono text-xs shadow-lg shadow-[#00f2ff]/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#1a2b3c] pb-3 mb-4 gap-2">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4 text-[#00f2ff]" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#00f2ff]">
              🤖 GEMINI ENGINE
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {currentStatus === 'CONNECTED' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-bold border border-emerald-500/50 bg-emerald-500/10 text-emerald-400 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                CONNECTED ✓
              </span>
            ) : currentStatus === 'QUOTA_EXCEEDED' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-bold border border-amber-500/50 bg-amber-500/10 text-amber-400 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                QUOTA EXCEEDED
              </span>
            ) : currentStatus === 'ERROR' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-bold border border-rose-500/50 bg-rose-500/10 text-rose-400 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                CONNECTION ERROR
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-bold border border-slate-500/50 bg-slate-500/10 text-slate-400 uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                {hasCustomKey || geminiStatus?.hasServerEnvKey ? 'READY / NOT TESTED' : 'NO API KEY'}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* Architecture info cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-[#05070a] border border-[#1a2b3c]">
              <span className="text-slate-500 text-[10px] uppercase block">FUNCTION</span>
              <span className="text-slate-200 font-bold mt-0.5 block text-xs">
                STRUCTURED STATE MUTATIONS
              </span>
              <span className="text-[10px] text-slate-500 mt-1 block">
                ChatGPT remains the System mastermind. Gemini parses System output into structured JSON state updates.
              </span>
            </div>

            <div className="p-3 bg-[#05070a] border border-[#1a2b3c]">
              <span className="text-slate-500 text-[10px] uppercase block">ACTIVE MODEL</span>
              <span className="text-[#00f2ff] font-bold mt-0.5 block text-xs truncate">
                {geminiModel}
              </span>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Server-side JSON Schema enforcement with automated model fallbacks.
              </span>
            </div>

            <div className="p-3 bg-[#05070a] border border-[#1a2b3c]">
              <span className="text-slate-500 text-[10px] uppercase block">SECURITY &amp; ISOLATION</span>
              <span className="text-emerald-400 font-bold mt-0.5 block text-xs">
                ISOLATED STORAGE
              </span>
              <span className="text-[10px] text-slate-500 mt-1 block">
                API credentials are never logged, exported, or embedded into Player Data / Game DB backups.
              </span>
            </div>
          </div>

          {/* API Key Configuration Section */}
          <div className="p-4 bg-[#05070a] border border-[#1a2b3c] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-3.5 h-3.5 text-[#00f2ff]" />
                <label className="text-slate-200 font-bold text-xs uppercase tracking-wider">
                  GEMINI API KEY
                </label>
              </div>
              <span className="text-[10px] text-slate-400">
                {hasCustomKey ? (
                  <span className="text-emerald-400 flex items-center gap-1 font-bold">
                    <ShieldCheck className="w-3 h-3" /> CUSTOM KEY STORED
                  </span>
                ) : geminiStatus?.hasServerEnvKey ? (
                  <span className="text-cyan-400">ENVIRONMENT KEY AVAILABLE</span>
                ) : (
                  <span className="text-amber-400">NO KEY CONFIGURED</span>
                )}
              </span>
            </div>

            {/* If key is saved and user isn't editing, show masked view */}
            {hasCustomKey && !isEditingKey ? (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-[#0a0f16] border border-[#1a2b3c]">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-slate-500 uppercase block">SAVED CREDENTIAL:</span>
                  <span className="font-mono text-xs text-slate-200 tracking-wider">
                    {maskedKey}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditingKey(true)}
                    className="px-3 py-1.5 border border-[#00f2ff]/40 bg-[#00f2ff]/10 hover:bg-[#00f2ff]/20 text-[#00f2ff] font-bold uppercase text-[10px] tracking-wider transition-colors"
                  >
                    CHANGE KEY
                  </button>
                  <button
                    type="button"
                    onClick={handleClearApiKey}
                    className="flex items-center gap-1 px-3 py-1.5 border border-rose-500/40 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold uppercase text-[10px] tracking-wider transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    CLEAR KEY
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <input
                    id="gemini-api-key-input"
                    type={showApiKeyPlain ? 'text' : 'password'}
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder={hasCustomKey ? 'Enter new API key to replace current' : 'Enter Gemini API key (e.g. AIzaSy...)'}
                    className="w-full pl-3 pr-10 py-2.5 bg-[#0a0f16] border border-[#1a2b3c] text-slate-100 placeholder-slate-600 focus:outline-none focus:border-[#00f2ff] text-xs font-mono"
                    autoComplete="off"
                    spellCheck="false"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKeyPlain(!showApiKeyPlain)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                    title={showApiKeyPlain ? 'Hide API key' : 'Show API key'}
                  >
                    {showApiKeyPlain ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      id="save-gemini-api-key-button"
                      type="button"
                      onClick={handleSaveApiKey}
                      disabled={!apiKeyInput.trim()}
                      className="flex items-center gap-1.5 px-4 py-2 border border-emerald-500/60 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 font-bold uppercase text-xs tracking-wider transition-all disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      SAVE API KEY
                    </button>

                    {hasCustomKey && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingKey(false);
                          setApiKeyInput('');
                        }}
                        className="px-3 py-2 border border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200 uppercase text-xs tracking-wider"
                      >
                        CANCEL
                      </button>
                    )}
                  </div>

                  {hasCustomKey && (
                    <button
                      id="clear-gemini-api-key-button"
                      type="button"
                      onClick={handleClearApiKey}
                      className="flex items-center gap-1.5 px-3 py-2 border border-rose-500/50 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-bold uppercase text-xs tracking-wider transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      CLEAR API KEY
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Model Selection Dropdown Section */}
          <div className="p-4 bg-[#05070a] border border-[#1a2b3c] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-[#00f2ff]" />
                <label htmlFor="gemini-model-select" className="text-slate-200 font-bold text-xs uppercase tracking-wider">
                  MODEL SELECTION
                </label>
              </div>
              <button
                id="refresh-gemini-models-button"
                type="button"
                onClick={() => handleRefreshModels(apiKeyInput.trim() || undefined)}
                disabled={isLoadingModels}
                className="flex items-center gap-1.5 text-[10px] text-[#00f2ff] hover:text-[#00f2ff]/80 font-bold uppercase tracking-wider disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingModels ? 'animate-spin' : ''}`} />
                <span>REFRESH MODELS</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <select
                  id="gemini-model-select"
                  value={geminiModel}
                  onChange={handleModelChange}
                  className="w-full px-3 py-2.5 bg-[#0a0f16] border border-[#1a2b3c] text-[#00f2ff] font-bold text-xs focus:outline-none focus:border-[#00f2ff] cursor-pointer"
                >
                  {availableModels.map((m) => (
                    <option key={m.id} value={m.id} className="bg-[#0a0f16] text-slate-200">
                      {m.name} {m.isRecommended ? '★ (Recommended)' : ''} — {m.id}
                    </option>
                  ))}
                  {/* Ensure currently chosen model is always listed even if not in dynamic list */}
                  {!availableModels.some((m) => m.id === geminiModel) && (
                    <option value={geminiModel} className="bg-[#0a0f16] text-slate-200">
                      {geminiModel} (Custom selected)
                    </option>
                  )}
                </select>
              </div>

              <div className="p-2.5 bg-[#0a0f16] border border-[#1a2b3c] flex items-center justify-between text-[11px]">
                <span className="text-slate-400">ACTIVE:</span>
                <span className="text-[#00f2ff] font-bold truncate max-w-[140px]">{geminiModel}</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400">
              Select the primary Gemini model to execute structured state extraction. If the primary model encounters a temporary spike, fallback models will be seamlessly attempted.
            </p>
          </div>

          {/* Test connection action & diagnostics */}
          <div className="p-4 bg-[#05070a] border border-[#1a2b3c] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <span className="text-slate-200 font-bold text-xs block">
                TEST CONNECTION &amp; DIAGNOSTICS
              </span>
              <span className="text-slate-400 text-[11px]">
                Sends a lightweight health check to verify credentials and response latency for <strong className="text-[#00f2ff]">{geminiModel}</strong>.
              </span>
            </div>

            <button
              id="test-gemini-connection-button"
              type="button"
              onClick={handleTestGemini}
              disabled={isTestingGemini}
              className="flex items-center gap-2 px-5 py-2.5 border border-[#00f2ff]/60 bg-[#00f2ff]/10 hover:bg-[#00f2ff]/20 text-[#00f2ff] font-bold uppercase tracking-wider text-xs transition-all disabled:opacity-50 whitespace-nowrap"
            >
              {isTestingGemini ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>TESTING...</span>
                </>
              ) : (
                <>
                  <Activity className="w-3.5 h-3.5" />
                  <span>TEST CONNECTION</span>
                </>
              )}
            </button>
          </div>

          {/* Test result banner */}
          {geminiTestResult && (
            <div className={`p-4 border font-mono text-xs animate-in fade-in duration-150 ${
              geminiTestResult.connected
                ? 'border-emerald-500/50 bg-emerald-950/30 text-emerald-300'
                : geminiTestResult.category === 'Quota exceeded'
                ? 'border-amber-500/50 bg-amber-950/30 text-amber-300'
                : 'border-rose-500/50 bg-rose-950/30 text-rose-300'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-bold uppercase text-xs">
                  {geminiTestResult.connected ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span>
                    {geminiTestResult.connected
                      ? 'Gemini Connection ✓'
                      : geminiTestResult.category
                      ? `Gemini Connection Failed — ${geminiTestResult.category}`
                      : 'Gemini Connection Failed'}
                  </span>
                </div>
                {geminiTestResult.latencyMs !== undefined && (
                  <span className="text-[10px] opacity-75 font-mono">
                    Latency: {geminiTestResult.latencyMs}ms | Model: {geminiTestResult.model}
                  </span>
                )}
              </div>
              <p className="text-[11px] mt-1.5 opacity-90 leading-relaxed">
                {geminiTestResult.connected
                  ? `Successfully authenticated and contacted ${geminiTestResult.model}. Ready to parse and mutate RPG system updates.`
                  : (geminiTestResult.error || 'Failed to communicate with Gemini API. Check your API key or model selection.')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 2. System Metadata Form */}
      <div className="hud-panel p-5 border border-[#1a2b3c]">
        <div className="flex items-center gap-2 border-b border-[#1a2b3c] pb-3 mb-4">
          <Database className="w-4 h-4 text-[#00f2ff]" />
          <h3 className="text-xs font-bold font-mono uppercase tracking-widest text-slate-200">
            SYSTEM METADATA &amp; IDENTIFIERS
          </h3>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-4 font-mono text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-400 text-[10px] uppercase mb-1">SYSTEM NAME</label>
              <input
                type="text"
                value={systemName}
                onChange={(e) => setSystemName(e.target.value)}
                className="w-full px-3 py-2 bg-[#05070a] border border-[#1a2b3c] text-slate-200 focus:outline-none focus:border-[#00f2ff] text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-400 text-[10px] uppercase mb-1">SYSTEM VERSION</label>
              <input
                type="text"
                value={systemVersion}
                onChange={(e) => setSystemVersion(e.target.value)}
                className="w-full px-3 py-2 bg-[#05070a] border border-[#1a2b3c] text-slate-200 focus:outline-none focus:border-[#00f2ff] text-xs font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-400 text-[10px] uppercase mb-1">PLAYER ID</label>
              <input
                type="text"
                value={playerId}
                onChange={(e) => setPlayerId(e.target.value)}
                className="w-full px-3 py-2 bg-[#05070a] border border-[#1a2b3c] text-slate-200 focus:outline-none focus:border-[#00f2ff] text-xs font-mono"
              />
            </div>
          </div>

          <div className="p-3 bg-[#05070a] border border-[#1a2b3c] flex items-center justify-between">
            <div>
              <span className="text-slate-200 font-bold block text-xs">AUTO-INCREMENT STATE VERSION</span>
              <span className="text-slate-500 text-[10px]">
                Increment state version tag automatically whenever structured updates occur.
              </span>
            </div>
            <input
              type="checkbox"
              checked={autoIncrement}
              onChange={(e) => setAutoIncrement(e.target.checked)}
              className="w-4 h-4 accent-[#00f2ff] cursor-pointer"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 border border-[#00f2ff]/60 bg-[#00f2ff]/10 hover:bg-[#00f2ff]/20 text-[#00f2ff] font-bold uppercase tracking-widest transition-all"
            >
              <Save className="w-4 h-4" />
              <span>SAVE CONFIGURATION</span>
            </button>
          </div>
        </form>
      </div>

      {/* 3. Memory & Event Retention Settings */}
      <div className="hud-panel p-5 border border-[#1a2b3c] font-mono text-xs">
        <div className="flex items-center gap-2 border-b border-[#1a2b3c] pb-3 mb-4">
          <Database className="w-4 h-4 text-[#00f2ff]" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-200">
            MEMORY / EVENT SETTINGS
          </h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-slate-300 font-bold uppercase text-xs mb-1">
              RECENT EVENT MEMORY LIMIT
            </label>
            <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
              Controls the maximum number of recent event summaries retained in the active rolling recent-memory context pool.
              <br />
              <strong className="text-[#00f2ff]">Note:</strong> Changing this setting does <em>not</em> delete raw event logs from the permanent Events archive.
            </p>

            <div className="flex flex-wrap items-center gap-2 mb-3">
              {[20, 30, 50, 75, 100].map((preset) => {
                const isSelected = maxRecentMemory === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={async () => {
                      setMaxRecentMemory(preset);
                      await updateSettings({ maxRecentMemoryEntries: preset });
                    }}
                    className={`px-3 py-1.5 font-mono text-xs font-bold transition-colors border ${
                      isSelected
                        ? 'border-[#00f2ff] bg-[#00f2ff]/20 text-[#00f2ff]'
                        : 'border-[#1a2b3c] bg-[#05070a] text-slate-400 hover:text-slate-200 hover:border-slate-600'
                    }`}
                  >
                    {preset} ENTRIES
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <div className="w-32">
                <input
                  type="number"
                  min={5}
                  max={500}
                  value={maxRecentMemory}
                  onChange={(e) => setMaxRecentMemory(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-[#05070a] border border-[#1a2b3c] text-[#00f2ff] font-mono font-bold text-xs focus:outline-none focus:border-[#00f2ff]"
                />
              </div>
              <button
                type="button"
                onClick={async () => {
                  const val = Math.max(5, Math.min(500, Number(maxRecentMemory) || 50));
                  await updateSettings({ maxRecentMemoryEntries: val });
                }}
                className="px-4 py-2 border border-[#00f2ff]/40 bg-[#00f2ff]/10 hover:bg-[#00f2ff]/20 text-[#00f2ff] font-bold uppercase text-[11px] tracking-wider"
              >
                APPLY LIMIT
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Debug Panel & Real-Time Diagnostics */}
      <div className="hud-panel p-5 border border-[#00f2ff]/40 font-mono text-xs shadow-lg shadow-[#00f2ff]/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1a2b3c] pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[#00f2ff]" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#00f2ff]">
              DEBUG PANEL &amp; STATE DIAGNOSTICS
            </h3>
          </div>
          <button
            type="button"
            onClick={async () => {
              setIsRefreshingState(true);
              await refreshStateFromStorage();
              setTimeout(() => setIsRefreshingState(false), 500);
            }}
            disabled={isRefreshingState}
            className="flex items-center gap-2 px-3 py-1.5 border border-[#00f2ff]/60 bg-[#00f2ff]/15 hover:bg-[#00f2ff]/25 text-[#00f2ff] font-bold uppercase text-[11px] tracking-wider transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingState ? 'animate-spin' : ''}`} />
            <span>REFRESH STATE</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="p-3 bg-[#05070a] border border-[#1a2b3c]">
            <span className="text-[10px] text-slate-500 uppercase block">STATE VERSION</span>
            <span className="text-base font-bold text-[#00f2ff]">
              v{db.player.stateVersion ?? 0}
            </span>
          </div>

          <div className="p-3 bg-[#05070a] border border-[#1a2b3c]">
            <span className="text-[10px] text-slate-500 uppercase block">LEVEL &amp; XP</span>
            <span className="text-xs font-bold text-slate-200 block truncate">
              LVL {db.player.level || '1'} ({String(db.player.xp || '0')})
            </span>
          </div>

          <div className="p-3 bg-[#05070a] border border-[#1a2b3c]">
            <span className="text-[10px] text-slate-500 uppercase block">ACTIVE SESSION</span>
            <span className="text-xs font-bold text-slate-200 block truncate">
              {db.activeSessionId} ({db.events.length} evts)
            </span>
          </div>

          <div className="p-3 bg-[#05070a] border border-[#1a2b3c]">
            <span className="text-[10px] text-slate-500 uppercase block">MEMORY POOL</span>
            <span className="text-xs font-bold text-slate-200 block truncate">
              {db.player.recentMemory?.length || 0} / {db.settings.maxRecentMemoryEntries || 50}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3 text-[11px]">
          <div className="p-3 bg-[#05070a] border border-[#1a2b3c] space-y-1">
            <span className="text-slate-400 font-bold uppercase block text-[10px]">CURRENT STATS:</span>
            <div className="text-slate-300 font-mono flex flex-wrap gap-x-3 gap-y-1">
              {Object.keys(db.player.attributes || {}).length > 0 ? (
                Object.entries(db.player.attributes).map(([k, v]) => (
                  <span key={k} className="bg-slate-900 px-1.5 py-0.5 border border-slate-800">
                    <strong className="text-[#00f2ff]">{k}:</strong> {String(v)}
                  </span>
                ))
              ) : (
                <span className="text-slate-600 italic">No stats recorded</span>
              )}
            </div>
          </div>

          <div className="p-3 bg-[#05070a] border border-[#1a2b3c] space-y-1">
            <span className="text-slate-400 font-bold uppercase block text-[10px]">ENTITY COUNTS:</span>
            <div className="text-slate-300 grid grid-cols-2 gap-1 text-[10px]">
              <div>Skills: <strong className="text-slate-100">{db.player.skills?.length || 0}</strong></div>
              <div>Quests: <strong className="text-slate-100">{db.player.quests?.length || 0}</strong></div>
              <div>Inventory: <strong className="text-slate-100">{db.player.inventory?.length || 0}</strong></div>
              <div>Important Mem: <strong className="text-slate-100">{db.player.importantMemory?.length || 0}</strong></div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[#1a2b3c]">
          <button
            type="button"
            onClick={() => setShowRawStateDebug(!showRawStateDebug)}
            className="text-[10px] text-slate-400 hover:text-[#00f2ff] uppercase underline font-bold"
          >
            {showRawStateDebug ? 'Hide Raw JSON Inspector' : 'Show Raw JSON State Inspector'}
          </button>
          <span className="text-[10px] text-slate-500">
            Last Updated: {new Date(db.lastUpdated).toLocaleTimeString()}
          </span>
        </div>

        {showRawStateDebug && (
          <div className="mt-3 p-3 bg-[#020408] border border-slate-800 font-mono text-[10px] text-emerald-400 overflow-x-auto max-h-60">
            <pre>{JSON.stringify(db.player, null, 2)}</pre>
          </div>
        )}
      </div>

      {/* 5. ITEM INFORMATION DATABASE */}
      <div className="hud-panel p-5 border border-[#1a2b3c] font-mono text-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1a2b3c] pb-3">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-[#00f2ff]" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-200">
              ITEM INFORMATION DATABASE
            </h3>
            <span className="px-2 py-0.5 bg-[#00f2ff]/10 text-[#00f2ff] border border-[#00f2ff]/30 text-[10px] font-bold">
              {itemDefinitions?.length || 0} DEFINITIONS
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => toggleItemInformationSystem()}
              className={`px-3 py-1.5 text-xs font-bold uppercase border transition-colors flex items-center gap-1.5 ${
                itemInformationSystemEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                  : 'bg-slate-800 text-slate-400 border-slate-700'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>SYSTEM: {itemInformationSystemEnabled ? 'ENABLED' : 'DISABLED'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingItemDef(null);
                setIsItemDefModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00f2ff]/20 hover:bg-[#00f2ff]/30 border border-[#00f2ff] text-[#00f2ff] hover:text-white text-xs font-bold uppercase tracking-wider transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>NEW ITEM</span>
            </button>
          </div>
        </div>

        {/* Database Telemetry & Summary Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div className="p-2.5 bg-[#05070a] border border-[#1a2b3c]">
            <span className="text-[10px] text-slate-500 uppercase block">TOTAL DEFINED</span>
            <span className="text-sm font-bold text-slate-100">{itemDefinitions?.length || 0}</span>
          </div>
          <div className="p-2.5 bg-[#05070a] border border-[#1a2b3c]">
            <span className="text-[10px] text-slate-500 uppercase block">ACTIVE (ENABLED)</span>
            <span className="text-sm font-bold text-emerald-400">
              {(itemDefinitions || []).filter((d) => d.enabled !== false).length}
            </span>
          </div>
          <div className="p-2.5 bg-[#05070a] border border-[#1a2b3c]">
            <span className="text-[10px] text-slate-500 uppercase block">DISABLED</span>
            <span className="text-sm font-bold text-slate-500">
              {(itemDefinitions || []).filter((d) => d.enabled === false).length}
            </span>
          </div>
          <div className="p-2.5 bg-[#05070a] border border-[#1a2b3c]">
            <span className="text-[10px] text-slate-500 uppercase block">INVENTORY ITEMS</span>
            <span className="text-sm font-bold text-[#00f2ff]">{db.player.inventory?.length || 0}</span>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-3 bg-[#05070a] border border-[#1a2b3c] flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={itemSearchQuery}
              onChange={(e) => setItemSearchQuery(e.target.value)}
              placeholder="Search by name, ID slug, description, or keyword..."
              className="w-full pl-8 pr-3 py-1.5 bg-[#0a0f16] border border-[#1a2b3c] text-slate-200 text-xs focus:outline-none focus:border-[#00f2ff]"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={itemTypeFilter}
              onChange={(e) => setItemTypeFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-[#0a0f16] border border-[#1a2b3c] text-slate-300 text-xs focus:outline-none focus:border-[#00f2ff]"
            >
              <option value="ALL">ALL TYPES</option>
              <option value="Consumable">Consumable</option>
              <option value="Weapon">Weapon</option>
              <option value="Armor">Armor</option>
              <option value="Accessory">Accessory</option>
              <option value="Key">Key</option>
              <option value="Loot Box">Loot Box</option>
              <option value="Material">Material</option>
              <option value="Quest Item">Quest Item</option>
              <option value="Skill Book">Skill Book</option>
              <option value="Miscellaneous">Miscellaneous</option>
            </select>

            <select
              value={itemRankFilter}
              onChange={(e) => setItemRankFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-[#0a0f16] border border-[#1a2b3c] text-slate-300 text-xs focus:outline-none focus:border-[#00f2ff]"
            >
              <option value="ALL">ALL RANKS</option>
              <option value="F">Rank F</option>
              <option value="E">Rank E</option>
              <option value="D">Rank D</option>
              <option value="C">Rank C</option>
              <option value="B">Rank B</option>
              <option value="A">Rank A</option>
              <option value="S">Rank S</option>
              <option value="SS">Rank SS</option>
              <option value="SSS">Rank SSS</option>
              <option value="EX">Rank EX</option>
            </select>

            <select
              value={itemStatusFilter}
              onChange={(e) => setItemStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-[#0a0f16] border border-[#1a2b3c] text-slate-300 text-xs focus:outline-none focus:border-[#00f2ff]"
            >
              <option value="ALL">ALL STATUS</option>
              <option value="ENABLED">Enabled Only</option>
              <option value="DISABLED">Disabled Only</option>
            </select>
          </div>
        </div>

        {/* Item Definitions List */}
        <div className="space-y-2 max-h-[420px] overflow-y-auto">
          {filteredItemDefinitions.length === 0 ? (
            <div className="p-6 bg-[#05070a] border border-[#1a2b3c] text-center text-slate-500 italic space-y-1">
              <p>No item definitions matching the current filters.</p>
              <p className="text-[10px]">
                Items mentioned in System messages or registered manually will be cataloged here.
              </p>
            </div>
          ) : (
            filteredItemDefinitions.map((itemDef) => {
              const isEnabled = itemDef.enabled !== false;
              return (
                <div
                  key={itemDef.itemId}
                  className={`p-3 bg-[#05070a] border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                    isEnabled
                      ? 'border-[#1a2b3c] hover:border-[#00f2ff]/40'
                      : 'border-slate-800 opacity-60'
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <span className="text-xl select-none">{itemDef.icon || '📦'}</span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-100 text-xs">{itemDef.itemName}</span>
                        <span className="text-[10px] text-slate-500 font-mono">({itemDef.itemId})</span>
                        {itemDef.rank && (
                          <span className="px-1.5 py-0.2 font-bold text-amber-300 border border-amber-500/40 bg-amber-950/30 text-[9px] uppercase">
                            RANK {itemDef.rank}
                          </span>
                        )}
                        {itemDef.rarity && (
                          <span className="px-1.5 py-0.2 text-cyan-300 border border-cyan-500/30 bg-cyan-950/30 text-[9px] uppercase">
                            {itemDef.rarity}
                          </span>
                        )}
                        <span className="px-1.5 py-0.2 text-slate-400 border border-slate-700 bg-slate-900 text-[9px] uppercase">
                          {itemDef.type || 'Miscellaneous'}
                        </span>
                        <span className="text-[9px] text-[#00f2ff]/80 font-mono">
                          v{itemDef.definitionVersion || 1}
                        </span>
                      </div>
                      {itemDef.description && (
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                          {itemDef.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Row actions */}
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setItemCardViewTarget(itemDef);
                        setIsItemCardModalOpen(true);
                      }}
                      className="px-2 py-1 text-[10px] font-bold border border-[#1a2b3c] hover:border-[#00f2ff]/50 bg-[#0a0f16] text-[#00f2ff] uppercase transition-colors"
                      title="View Card"
                    >
                      CARD
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleItemDefinitionEnabled(itemDef.itemId)}
                      className={`px-2 py-1 text-[10px] font-bold border uppercase transition-colors ${
                        isEnabled
                          ? 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10'
                          : 'border-slate-700 text-slate-500 hover:bg-slate-800'
                      }`}
                    >
                      {isEnabled ? 'ACTIVE' : 'OFF'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingItemDef(itemDef);
                        setIsItemDefModalOpen(true);
                      }}
                      className="p-1.5 text-slate-400 hover:text-white border border-[#1a2b3c] hover:border-slate-600 bg-[#0a0f16] transition-colors"
                      title="Edit Definition"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteItemDefinitionAction(itemDef.itemId)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 border border-[#1a2b3c] hover:border-rose-500/40 bg-[#0a0f16] transition-colors"
                      title="Delete Definition"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Export & Import Sub-actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#1a2b3c]">
          <span className="text-[10px] text-slate-400">
            Export or restore item definition catalogs independently from core database backups.
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportItemDefs}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-[#1a2b3c] hover:border-[#00f2ff]/40 bg-[#05070a] text-slate-300 hover:text-[#00f2ff] text-xs uppercase tracking-wider font-bold transition-colors"
            >
              <Download className="w-3 h-3" />
              <span>EXPORT ITEMS (.JSON)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setItemImportJsonText('');
                setShowItemImportModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-[#1a2b3c] hover:border-[#00f2ff]/40 bg-[#05070a] text-slate-300 hover:text-[#00f2ff] text-xs uppercase tracking-wider font-bold transition-colors"
            >
              <Upload className="w-3 h-3" />
              <span>IMPORT ITEMS (.JSON)</span>
            </button>
          </div>
        </div>
      </div>

      {/* 6. Storage Engine Status */}
      <div className="hud-panel p-5 border border-[#1a2b3c] font-mono text-xs">
        <div className="flex items-center gap-2 border-b border-[#1a2b3c] pb-3 mb-4">
          <Server className="w-4 h-4 text-[#00f2ff]" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-200">
            DATA STORAGE ENGINE &amp; ADAPTER
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 bg-[#05070a] border border-[#1a2b3c]">
            <span className="text-slate-500 text-[10px] uppercase block">CURRENT ADAPTER</span>
            <span className="text-sm font-bold text-[#00f2ff] mt-1 block">
              Browser Local Storage (Isolated Key-Value)
            </span>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              Permanent persistence within browser storage. Stored state survives reloads, app updates, and window restarts.
            </p>
          </div>

          <div className="p-4 bg-[#05070a] border border-[#1a2b3c]">
            <span className="text-slate-500 text-[10px] uppercase block">DATA INTEGRITY</span>
            <span className="text-sm font-bold text-slate-300 mt-1 block">
              Dual-Layer Storage Architecture
            </span>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              Raw message payload is recorded intact before Gemini parsing, guaranteeing zero state data loss.
            </p>
          </div>
        </div>
      </div>

      {/* 5. Backup & Restore (Export / Import) */}
      <div className="hud-panel p-5 border border-[#1a2b3c] font-mono text-xs">
        <div className="flex items-center gap-2 border-b border-[#1a2b3c] pb-3 mb-4">
          <FileJson className="w-4 h-4 text-[#00f2ff]" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-200">
            DATA BACKUP &amp; RESTORE (IMPORT / EXPORT)
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Export card */}
          <div className="p-4 bg-[#05070a] border border-[#1a2b3c] flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-slate-200 block uppercase mb-1">
                EXPORT COMPLETE BACKUP
              </span>
              <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
                Download a complete JSON snapshot containing all events, sessions, player state, and system variables.
              </p>
            </div>

            <button
              onClick={handleExport}
              className="flex items-center justify-center gap-2 w-full py-2.5 border border-[#00f2ff]/60 bg-[#00f2ff]/10 hover:bg-[#00f2ff]/20 text-[#00f2ff] font-bold uppercase tracking-wider transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>EXPORT DATA (.JSON)</span>
            </button>
          </div>

          {/* Import card */}
          <div className="p-4 bg-[#05070a] border border-[#1a2b3c] flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-slate-200 block uppercase mb-1">
                IMPORT / RESTORE BACKUP
              </span>
              <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
                Upload or paste a previous JSON backup file with structural verification before applying.
              </p>
            </div>

            <div className="flex gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".json,application/json"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-[#1a2b3c] bg-[#05070a] hover:border-[#00f2ff]/40 text-slate-300 font-bold uppercase transition-colors"
              >
                <Upload className="w-4 h-4" />
                <span>UPLOAD FILE</span>
              </button>
              <button
                onClick={() => setShowImportModal(true)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-[#1a2b3c] bg-[#05070a] hover:border-[#00f2ff]/40 text-[#00f2ff] font-bold uppercase transition-colors"
              >
                <span>PASTE JSON</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 6. Danger Zone: Reset Local Data */}
      <div className="hud-panel p-5 border border-rose-500/30 font-mono text-xs">
        <div className="flex items-center gap-2 border-b border-rose-950/80 pb-3 mb-4">
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          <h3 className="text-xs font-bold uppercase tracking-widest text-rose-300">
            DANGER ZONE: RESET LOCAL DATA
          </h3>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <span className="text-slate-200 font-bold block mb-1">WIPE CURRENT DATABASE STATE</span>
            <p className="text-[11px] text-slate-400 leading-relaxed max-w-xl">
              Permanently clears all logged events, sessions, and state variables, returning SYSTEM CORE to initial defaults. Requires explicit confirmation.
            </p>
          </div>

          <button
            onClick={() => setShowResetModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 border border-rose-500/60 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 font-bold uppercase tracking-wider transition-colors shrink-0"
          >
            <RotateCcw className="w-4 h-4" />
            <span>RESET LOCAL DATA</span>
          </button>
        </div>
      </div>

      {/* IMPORT CONFIRMATION MODAL */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-2xl hud-panel p-5 sm:p-6 space-y-4 font-mono text-xs border border-[#00f2ff]/50">
            <div className="flex items-center justify-between border-b border-[#1a2b3c] pb-3">
              <div className="flex items-center gap-2 text-[#00f2ff] font-bold uppercase text-xs tracking-wider">
                <Upload className="w-4 h-4" />
                <span>CONFIRM IMPORT JSON BACKUP</span>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-amber-950/40 border border-amber-500/40 text-amber-300 flex items-start gap-2 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>Warning:</strong> Importing will replace your current state and events with the backup. Please ensure you have exported your current data if needed.
              </span>
            </div>

            <div>
              <label className="block text-slate-300 text-[10px] uppercase mb-1">PASTE OR INSPECT BACKUP JSON PAYLOAD:</label>
              <textarea
                value={importJsonText}
                onChange={(e) => setImportJsonText(e.target.value)}
                placeholder="Paste valid System Core backup JSON here..."
                className="w-full h-48 p-3 bg-[#05070a] border border-[#1a2b3c] text-slate-200 font-mono text-xs focus:outline-none focus:border-[#00f2ff] resize-y"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-[#1a2b3c]">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 border border-[#1a2b3c] text-slate-300 hover:bg-slate-800"
              >
                CANCEL
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={!importJsonText.trim()}
                className="flex items-center gap-1.5 px-5 py-2 border border-[#00f2ff]/60 bg-[#00f2ff]/10 hover:bg-[#00f2ff]/20 text-[#00f2ff] font-bold uppercase disabled:opacity-50 tracking-wider"
              >
                <Check className="w-4 h-4" />
                <span>VALIDATE &amp; RESTORE BACKUP</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESET CONFIRMATION MODAL */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative w-full max-w-md hud-panel p-5 sm:p-6 border border-rose-500/60 space-y-4 font-mono text-xs">
            <div className="flex items-center gap-2 text-rose-400 font-bold uppercase text-xs tracking-wider border-b border-[#1a2b3c] pb-3">
              <ShieldAlert className="w-5 h-5" />
              <span>CONFIRM DESTRUCTIVE RESET</span>
            </div>

            <p className="text-slate-300 leading-relaxed text-xs">
              This action will irreversibly delete all {db.events.length} event logs, custom session histories, and player variables stored in this browser.
            </p>

            <div className="p-3 bg-[#05070a] border border-[#1a2b3c] space-y-2">
              <label className="block text-slate-400 text-[10px] uppercase">
                To confirm, type <strong className="text-rose-400">RESET</strong> below:
              </label>
              <input
                type="text"
                value={resetConfirmText}
                onChange={(e) => setResetConfirmText(e.target.value)}
                placeholder="Type RESET"
                className="w-full px-3 py-2 bg-[#0a0f18] border border-rose-900/80 text-rose-200 focus:outline-none focus:border-rose-500 font-mono uppercase text-xs"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => {
                  setShowResetModal(false);
                  setResetConfirmText('');
                }}
                className="px-4 py-2 border border-[#1a2b3c] text-slate-300 hover:bg-slate-800"
              >
                CANCEL
              </button>
              <button
                onClick={handleConfirmReset}
                disabled={resetConfirmText.trim().toUpperCase() !== 'RESET'}
                className="flex items-center gap-1.5 px-5 py-2 border border-rose-500/60 bg-rose-600 hover:bg-rose-500 text-white font-bold uppercase disabled:opacity-40 disabled:pointer-events-none tracking-wider"
              >
                <span>CONFIRM WIPE</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* PROFILE PICTURE MODAL */}
      <ProfilePictureModal
        isOpen={isAvatarModalOpen}
        onClose={() => setIsAvatarModalOpen(false)}
        onSaveAvatar={(dataUrl) => setProfileAvatar(dataUrl)}
        currentAvatar={profileAvatar}
      />

      {/* REMOVE PROFILE PICTURE CONFIRMATION MODAL */}
      {showRemoveAvatarConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            id="remove-avatar-confirmation-modal"
            className="relative w-full max-w-md hud-panel p-5 sm:p-6 border border-rose-500/60 space-y-4 font-mono text-xs shadow-[0_0_20px_rgba(244,63,94,0.2)]"
          >
            <div className="flex items-center gap-2 text-rose-400 font-bold uppercase text-xs tracking-wider border-b border-[#1a2b3c] pb-3">
              <Trash2 className="w-4 h-4 text-rose-400" />
              <span>REMOVE PROFILE PICTURE</span>
            </div>

            <div className="flex items-center gap-4 p-3 bg-[#05070a] border border-[#1a2b3c]">
              <ProfileAvatar size="lg" showBorder />
              <div>
                <p className="text-slate-200 font-bold text-xs">Revert to Default Avatar?</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  Your custom profile image will be deleted from local storage and the default cyberpunk avatar will be restored across all screens.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRemoveAvatarConfirm(false)}
                className="px-4 py-2 border border-[#1a2b3c] text-slate-300 hover:bg-slate-800 uppercase tracking-wider text-xs font-bold"
              >
                CANCEL
              </button>
              <button
                id="confirm-remove-profile-picture-button"
                type="button"
                onClick={() => {
                  removeProfileAvatar();
                  setShowRemoveAvatarConfirm(false);
                }}
                className="flex items-center gap-1.5 px-5 py-2 border border-rose-500/60 bg-rose-600 hover:bg-rose-500 text-white font-bold uppercase tracking-wider text-xs shadow-[0_0_10px_rgba(244,63,94,0.3)] transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>CONFIRM REMOVAL</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ITEM DEFINITION EDITOR MODAL */}
      <ItemDefinitionModal
        isOpen={isItemDefModalOpen}
        onClose={() => {
          setIsItemDefModalOpen(false);
          setEditingItemDef(null);
        }}
        initialItem={editingItemDef}
        onSave={async (definition, note) => {
          await saveItemDefinition(definition, note);
        }}
        onDelete={async (itemId) => {
          await deleteItemDefinitionAction(itemId);
        }}
      />

      {/* ITEM CARD MODAL */}
      {itemCardViewTarget && (
        <ItemCardModal
          isOpen={isItemCardModalOpen}
          onClose={() => {
            setIsItemCardModalOpen(false);
            setItemCardViewTarget(null);
          }}
          item={itemCardViewTarget.itemName}
          definition={itemCardViewTarget}
          itemInformationSystemEnabled={itemInformationSystemEnabled}
          onEditDefinition={(def) => {
            setEditingItemDef(def);
            setIsItemCardModalOpen(false);
            setIsItemDefModalOpen(true);
          }}
        />
      )}

      {/* ITEM DEFINITIONS IMPORT MODAL */}
      {showItemImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-150 font-mono text-xs">
          <div className="relative w-full max-w-xl hud-panel p-5 sm:p-6 space-y-4 border border-[#00f2ff]/50">
            <div className="flex items-center justify-between border-b border-[#1a2b3c] pb-3">
              <div className="flex items-center gap-2 text-[#00f2ff] font-bold uppercase tracking-wider">
                <Upload className="w-4 h-4" />
                <span>IMPORT ITEM DEFINITIONS (.JSON)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowItemImportModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-[11px] text-slate-400">
              Upload a JSON file or paste an array of item definitions below to merge or restore into your Item Information Database.
            </p>

            <div className="flex items-center gap-3">
              <input
                ref={itemFileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleItemFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => itemFileInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 border border-[#1a2b3c] bg-[#05070a] text-slate-300 hover:text-[#00f2ff] hover:border-[#00f2ff]/40 font-bold uppercase tracking-wider text-[11px]"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>SELECT JSON FILE</span>
              </button>
            </div>

            <div>
              <label className="block text-slate-400 text-[10px] uppercase mb-1">
                OR PASTE RAW JSON ARRAY:
              </label>
              <textarea
                value={itemImportJsonText}
                onChange={(e) => setItemImportJsonText(e.target.value)}
                placeholder='[{"itemId": "crimson-crystal", "itemName": "Crimson Crystal", "type": "Material", "rarity": "Rare", "rank": "B"}]'
                className="w-full h-44 p-3 bg-[#05070a] border border-[#1a2b3c] text-slate-200 font-mono text-xs focus:outline-none focus:border-[#00f2ff] resize-y"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-[#1a2b3c]">
              <button
                type="button"
                onClick={() => setShowItemImportModal(false)}
                className="px-4 py-2 border border-[#1a2b3c] text-slate-300 hover:bg-slate-800 uppercase"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={handleImportItemDefsSubmit}
                disabled={!itemImportJsonText.trim()}
                className="flex items-center gap-1.5 px-5 py-2 border border-[#00f2ff]/60 bg-[#00f2ff]/10 hover:bg-[#00f2ff]/20 text-[#00f2ff] font-bold uppercase disabled:opacity-50 tracking-wider"
              >
                <Check className="w-4 h-4" />
                <span>IMPORT &amp; MERGE</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Quest Creator / Editor Modal */}
      <CustomQuestModal
        isOpen={isCustomQuestModalOpen}
        onClose={() => {
          setIsCustomQuestModalOpen(false);
          setSelectedQuestForEdit(null);
        }}
        initialQuest={selectedQuestForEdit}
        onSave={(questData) => {
          if (selectedQuestForEdit) {
            const qId = selectedQuestForEdit.questId || selectedQuestForEdit.id || selectedQuestForEdit.title;
            updateCustomQuestAction(qId, questData);
          } else {
            createCustomQuestAction(questData);
          }
          setIsCustomQuestModalOpen(false);
          setSelectedQuestForEdit(null);
        }}
        onDelete={(questId) => {
          deleteCustomQuestAction(questId);
          setIsCustomQuestModalOpen(false);
          setSelectedQuestForEdit(null);
        }}
        onDuplicate={(quest) => {
          duplicateCustomQuestAction(quest);
          setIsCustomQuestModalOpen(false);
          setSelectedQuestForEdit(null);
        }}
      />

      {/* QUEST REFRESH CONFIRMATION MODAL */}
      {showQuestRefreshModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="hud-panel p-6 border border-[#00f2ff]/60 max-w-md w-full font-mono text-xs space-y-4 shadow-2xl shadow-[#00f2ff]/20">
            <div className="flex items-center justify-between text-[#00f2ff] border-b border-[#1a2b3c] pb-3">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-[#00f2ff]" />
                <h3 className="text-sm font-bold uppercase tracking-widest text-[#00f2ff]">
                  🎯 QUEST CONTROL
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
                disabled={isSubmittingQuestRefresh}
                className="px-4 py-2 border border-[#1a2b3c] bg-[#05070a] hover:bg-slate-800 text-slate-300 font-bold uppercase text-xs tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
              >
                CANCEL
              </button>

              <button
                type="button"
                onClick={handleConfirmQuestRefresh}
                disabled={isSubmittingQuestRefresh}
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
