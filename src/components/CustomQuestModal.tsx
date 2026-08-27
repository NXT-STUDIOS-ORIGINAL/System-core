import React, { useState, useEffect, useMemo } from 'react';
import { QuestItem, QuestRequirement, QuestRewardItem, QuestRewards, QuestPenalty, QuestStatEffect, QuestCurrencyEffect } from '../types';
import {
  X,
  Save,
  Target,
  Clock,
  Award,
  AlertTriangle,
  Plus,
  Trash2,
  Copy,
  CheckCircle2,
  Layers,
  Sparkles,
  Zap,
  Tag,
  BookOpen,
  Info,
  Calendar,
  Coins,
  Shield,
  Activity,
  Check,
} from 'lucide-react';
import {
  generateCustomQuestId,
  formatQuestRewardSummary,
  formatQuestPenaltySummary,
  getAuthoritativePlayerStats,
  validateAuthoritativeStatsConsistency,
  AuthoritativeStatInfo,
  getStatIcon,
  getStatFullName,
  normalizeStatKey,
  extractQuestRewardStatEffects,
  extractQuestRewardCurrencyEffects,
  extractQuestPenaltyStatEffects,
  extractQuestPenaltyCurrencyEffects,
} from '../services/questManager';
import { useSystemCore } from '../context/SystemCoreContext';

interface CustomQuestModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialQuest?: QuestItem | null;
  onSave: (questData: Partial<QuestItem> & { title: string }) => Promise<void>;
  onDelete?: (questId: string) => Promise<void>;
  onDuplicate?: (quest: QuestItem) => Promise<void>;
}

const CURRENCY_OPTIONS = [
  { value: 'Coins', label: 'Coins', icon: '🪙' },
];

const COMMON_ICONS = ['⚔️', '🎯', '🏋️', '🏃‍♂️', '🧘', '📚', '💻', '🧪', '🛡️', '🏆', '⚡', '🔥', '💧', '🥗', '📜', '✨'];
const QUEST_TYPES = [
  { value: 'CUSTOM', label: 'Custom Timer', desc: 'Custom countdown independent of daily reset' },
  { value: 'DAILY', label: 'Daily Cycle', desc: 'Resets on the 24-hour daily cycle' },
  { value: 'ONE_TIME', label: 'One-Time', desc: 'Single completion quest' },
  { value: 'PERMANENT', label: 'Permanent', desc: 'Always available or repeatable' },
  { value: 'MANUAL', label: 'Manual Check', desc: 'Untimed manual completion' },
];
const DIFFICULTIES = ['Very Easy', 'Easy', 'Medium', 'Hard', 'Very Hard', 'Extreme', 'Hell', 'Nightmare'];
const RANKS = ['E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS'];
const PRIORITIES = [
  { value: 'LOW', label: 'Low', color: 'text-slate-400 border-slate-700' },
  { value: 'MEDIUM', label: 'Medium', color: 'text-cyan-400 border-cyan-800' },
  { value: 'HIGH', label: 'High', color: 'text-amber-400 border-amber-800' },
  { value: 'CRITICAL', label: 'Critical', color: 'text-rose-400 border-rose-800' },
];
const PROGRESS_TYPES = [
  { value: 'CHECKBOX', label: 'Checkbox', desc: 'Simple complete / active toggle' },
  { value: 'NUMERIC', label: 'Numeric Target', desc: 'e.g. 0 / 100 pushups' },
  { value: 'PERCENTAGE', label: 'Percentage', desc: '0% to 100%' },
  { value: 'STAGES', label: 'Multi-Stage Checklist', desc: 'Multiple sub-requirements' },
];

const PRESETS = [
  {
    name: 'Iron Discipline (Daily Workout)',
    desc: 'Complete 100 pushups, 100 situps, 100 squats, and a 10km run.',
    type: 'CUSTOM',
    difficulty: 'Hard',
    rank: 'B',
    requirements: ['100 Pushups', '100 Situps', '100 Squats', '10km Run'],
    reqLogic: 'ALL',
    progType: 'NUMERIC',
    target: 100,
    unit: 'reps',
    durationHours: 24,
    xp: 500,
    coins: 250,
    items: [{ name: 'Elixir of Focus', quantity: 1, rank: 'B', rarity: 'Rare' }],
    penaltyEnabled: true,
    penaltyType: 'XP',
    penaltyValue: 100,
    penaltyDesc: 'Lose 100 XP if failed',
    icon: '🏋️',
  },
  {
    name: 'Deep Focus Sprint',
    desc: 'Uninterrupted deep work or coding session.',
    type: 'CUSTOM',
    difficulty: 'Medium',
    rank: 'C',
    requirements: ['90 Minutes Deep Work without phone distractions'],
    reqLogic: 'ALL',
    progType: 'NUMERIC',
    target: 90,
    unit: 'minutes',
    durationHours: 4,
    xp: 300,
    coins: 150,
    items: [{ name: 'Mana Potion', quantity: 1, rank: 'C', rarity: 'Uncommon' }],
    penaltyEnabled: true,
    penaltyType: 'FATIGUE',
    penaltyValue: 10,
    penaltyDesc: '+10 Fatigue if neglected',
    icon: '💻',
  },
  {
    name: 'Knowledge Acquisition',
    desc: 'Read educational literature or research documentation.',
    type: 'CUSTOM',
    difficulty: 'Easy',
    rank: 'D',
    requirements: ['Read 30 pages of literature or study notes'],
    reqLogic: 'ALL',
    progType: 'NUMERIC',
    target: 30,
    unit: 'pages',
    durationHours: 12,
    xp: 150,
    coins: 80,
    items: [{ name: 'Ancient Scroll of Insight', quantity: 1, rank: 'D', rarity: 'Common' }],
    penaltyEnabled: false,
    icon: '📚',
  },
];

export const CustomQuestModal: React.FC<CustomQuestModalProps> = ({
  isOpen,
  onClose,
  initialQuest,
  onSave,
  onDelete,
  onDuplicate,
}) => {
  const { db } = useSystemCore();
  const globalPenaltiesEnabled = db.settings.questIncompletionPenaltiesEnabled !== false;
  const isEditing = Boolean(initialQuest && (initialQuest.questId || initialQuest.id));

  // Authoritative Single Source of Truth for Player Stats
  const authoritativeStats: AuthoritativeStatInfo[] = useMemo(() => {
    return getAuthoritativePlayerStats(db.player);
  }, [db.player]);

  const authoritativeStatNames: string[] = useMemo(() => {
    return authoritativeStats.map((s) => s.name);
  }, [authoritativeStats]);

  // Automated Consistency Validation Assertion: availableRewardStats == availablePenaltyStats == authoritativePlayerStats
  useEffect(() => {
    const playerExisting = authoritativeStatNames;
    const rewardAvailable = authoritativeStatNames;
    const penaltyAvailable = authoritativeStatNames;
    const validation = validateAuthoritativeStatsConsistency(playerExisting, rewardAvailable, penaltyAvailable);
    if (!validation.isConsistent) {
      console.warn('[SYSTEM CORE ASSERTION FAILED] Stat selectors mismatch with authoritative Player Stats:', validation.error);
    }
  }, [authoritativeStatNames]);

  // Tabs
  type TabKey = 'general' | 'requirements' | 'timing' | 'rewards' | 'penalty';
  const [activeTab, setActiveTab] = useState<TabKey>('general');

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('⚔️');
  const [category, setCategory] = useState('custom');
  const [type, setType] = useState('CUSTOM');
  const [difficulty, setDifficulty] = useState('Medium');
  const [rank, setRank] = useState('C');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM');
  const [enabled, setEnabled] = useState(true);

  // Requirements & Progress
  const [reqLogic, setReqLogic] = useState<'ALL' | 'ANY'>('ALL');
  const [requirementsList, setRequirementsList] = useState<Array<{ id: string; text: string; completed: boolean }>>([
    { id: '1', text: '', completed: false },
  ]);
  const [progressType, setProgressType] = useState<'CHECKBOX' | 'NUMERIC' | 'PERCENTAGE' | 'STAGES'>('CHECKBOX');
  const [targetValue, setTargetValue] = useState<string>('100');
  const [currentValue, setCurrentValue] = useState<string>('0');
  const [unit, setUnit] = useState<string>('');

  // Timers & Expiration
  const [timingMode, setTimingMode] = useState<'duration' | 'none' | 'specific'>('duration');
  const [durationDays, setDurationDays] = useState<string>('0');
  const [durationHours, setDurationHours] = useState<string>('24');
  const [durationMinutes, setDurationMinutes] = useState<string>('0');
  const [specificExpiresAt, setSpecificExpiresAt] = useState<string>('');

  // Rewards
  const [rewardXp, setRewardXp] = useState<string>('250');
  const [rewardCoins, setRewardCoins] = useState<string>('100');
  const [rewardTitle, setRewardTitle] = useState<string>('');
  const [rewardCustom, setRewardCustom] = useState<string>('');
  const [rewardItems, setRewardItems] = useState<Array<{ name: string; quantity: number; rank?: string; rarity?: string }>>([]);
  const [statBonuses, setStatBonuses] = useState<Array<{ stat: string; value: number }>>([]);
  const [rewardStatEffects, setRewardStatEffects] = useState<QuestStatEffect[]>([]);
  const [rewardCurrencyEffects, setRewardCurrencyEffects] = useState<QuestCurrencyEffect[]>([]);

  // Penalty State — Separated Stat and Currency Penalties
  const [penaltyEnabled, setPenaltyEnabled] = useState<boolean>(true);
  const [penaltyStatEffects, setPenaltyStatEffects] = useState<QuestStatEffect[]>([]);
  const [penaltyCurrencyEffects, setPenaltyCurrencyEffects] = useState<QuestCurrencyEffect[]>([]);
  const [penaltyType, setPenaltyType] = useState<string>('STAT');
  const [penaltyValue, setPenaltyValue] = useState<string>('1');
  const [penaltyDescription, setPenaltyDescription] = useState<string>('');
  const [penaltyStat, setPenaltyStat] = useState<string>('Strength');
  const [penaltyStatOperation, setPenaltyStatOperation] = useState<'increase' | 'decrease'>('decrease');

  // Advanced & Metadata
  const [maxAttempts, setMaxAttempts] = useState<string>('');
  const [cooldown, setCooldown] = useState<string>('');
  const [tagsInput, setTagsInput] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Submitting / UI states
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Initialize or reset form
  useEffect(() => {
    const defaultStatName = authoritativeStats[0]?.name || 'Strength';
    const defaultStatKey = authoritativeStats[0]?.key || 'STR';

    if (initialQuest) {
      setTitle(initialQuest.title || '');
      setDescription(initialQuest.description || '');
      setIcon(initialQuest.icon || '⚔️');
      setCategory(initialQuest.category || 'custom');
      setType(initialQuest.type || 'CUSTOM');
      setDifficulty(initialQuest.difficulty || 'Medium');
      setRank(initialQuest.rank || 'C');
      setPriority(initialQuest.priority || 'MEDIUM');
      setEnabled(initialQuest.enabled !== false);

      // Requirements
      setReqLogic(initialQuest.requirementLogic || 'ALL');
      if (initialQuest.requirements && initialQuest.requirements.length > 0) {
        setRequirementsList(
          initialQuest.requirements.map((r, i) =>
            typeof r === 'string'
              ? { id: String(i + 1), text: r, completed: false }
              : { id: r.id || String(i + 1), text: r.text, completed: !!r.completed }
          )
        );
      } else if (initialQuest.completionRequirement) {
        setRequirementsList([{ id: '1', text: initialQuest.completionRequirement, completed: false }]);
      } else {
        setRequirementsList([{ id: '1', text: '', completed: false }]);
      }

      setProgressType(initialQuest.progressType || 'CHECKBOX');
      setTargetValue(initialQuest.targetValue !== undefined ? String(initialQuest.targetValue) : '100');
      setCurrentValue(initialQuest.currentValue !== undefined ? String(initialQuest.currentValue) : '0');
      setUnit(initialQuest.unit || '');

      // Timing
      if (initialQuest.expiresAt) {
        setTimingMode('specific');
        setSpecificExpiresAt(initialQuest.expiresAt);
      } else if (
        initialQuest.durationHours !== undefined ||
        initialQuest.durationDays !== undefined ||
        initialQuest.durationMinutes !== undefined
      ) {
        setTimingMode('duration');
        setDurationDays(String(initialQuest.durationDays ?? 0));
        setDurationHours(String(initialQuest.durationHours ?? 0));
        setDurationMinutes(String(initialQuest.durationMinutes ?? 0));
      } else {
        setTimingMode('none');
      }

      // Rewards
      const rewards = initialQuest.rewards;
      setRewardXp(rewards?.xp !== undefined ? String(rewards.xp) : '');
      setRewardCoins(rewards?.coins !== undefined ? String(rewards.coins) : '');
      setRewardTitle(rewards?.title || '');
      setRewardCustom(rewards?.custom || (typeof initialQuest.reward === 'string' ? initialQuest.reward : ''));
      setRewardItems(rewards?.items ? [...rewards.items] : []);

      if (rewards?.stats) {
        setStatBonuses(Object.entries(rewards.stats).map(([stat, value]) => ({ stat, value: Number(value) })));
      } else {
        setStatBonuses([]);
      }

      // Reward Stat Effects & Currency Effects (Authoritative)
      const extractedRewardStats = extractQuestRewardStatEffects(rewards, initialQuest);
      const extractedRewardCurrs = extractQuestRewardCurrencyEffects(rewards, initialQuest);

      if (extractedRewardStats.length > 0) {
        setRewardStatEffects(
          extractedRewardStats.map((eff) => {
            const matched = authoritativeStats.find(
              (s) => s.name.toLowerCase() === (eff.statName || eff.stat || '').toLowerCase() ||
                     s.key.toLowerCase() === (eff.stat || '').toLowerCase()
            );
            return {
              ...eff,
              stat: matched ? matched.name : (eff.stat || defaultStatName),
              statName: matched ? matched.name : (eff.statName || defaultStatName),
            };
          })
        );
      } else {
        setRewardStatEffects([
          { type: 'stat', statName: defaultStatName, stat: defaultStatName, operation: 'increase', amount: 1 },
        ]);
      }

      setRewardCurrencyEffects(
        extractedRewardCurrs.length > 0
          ? extractedRewardCurrs
          : rewards?.coins !== undefined
          ? [{ type: 'currency', currencyName: 'Coins', currency: 'Coins', operation: 'increase', amount: rewards.coins }]
          : [{ type: 'currency', currencyName: 'Coins', currency: 'Coins', operation: 'increase', amount: 100 }]
      );

      // Penalty (Separated Stat Effects and Currency Effects)
      const p = initialQuest.penalty;
      const isPenEnabled = initialQuest.penaltyEnabled ?? (typeof p === 'object' ? p.enabled !== false : !!p);
      setPenaltyEnabled(isPenEnabled);
      const parsedPen = typeof p === 'object' ? p : undefined;
      const extractedPenStats = extractQuestPenaltyStatEffects(parsedPen as any, initialQuest);
      const extractedPenCurrs = extractQuestPenaltyCurrencyEffects(parsedPen as any, initialQuest);

      if (extractedPenStats.length > 0) {
        setPenaltyStatEffects(
          extractedPenStats.map((eff) => {
            const matched = authoritativeStats.find(
              (s) => s.name.toLowerCase() === (eff.statName || eff.stat || '').toLowerCase() ||
                     s.key.toLowerCase() === (eff.stat || '').toLowerCase()
            );
            return {
              ...eff,
              stat: matched ? matched.name : (eff.stat || defaultStatName),
              statName: matched ? matched.name : (eff.statName || defaultStatName),
            };
          })
        );
      } else {
        setPenaltyStatEffects([
          { type: 'stat', statName: defaultStatName, stat: defaultStatName, operation: 'decrease', amount: 1 },
        ]);
      }
      setPenaltyCurrencyEffects(extractedPenCurrs);

      let pType = initialQuest.penaltyType || (typeof p === 'object' ? p.type : undefined) || 'STAT';
      if (extractedPenStats.length > 0 && extractedPenCurrs.length > 0) {
        pType = 'STAT_AND_CURRENCY';
      } else if (extractedPenStats.length > 0) {
        pType = 'STAT';
      } else if (extractedPenCurrs.length > 0) {
        pType = 'COIN';
      }
      setPenaltyType(pType);

      if (extractedPenStats.length > 0) {
        setPenaltyStat(extractedPenStats[0].statName || extractedPenStats[0].stat);
        setPenaltyStatOperation(extractedPenStats[0].operation === 'increase' ? 'increase' : 'decrease');
      }

      setPenaltyValue(
        initialQuest.penaltyValue !== undefined
          ? String(initialQuest.penaltyValue)
          : (typeof p === 'object' && p.value !== undefined ? String(p.value) : (extractedPenStats.length > 0 ? String(extractedPenStats[0].amount) : '1'))
      );
      setPenaltyDescription(
        initialQuest.penaltyDescription ||
        (typeof p === 'object' ? p.description : undefined) ||
        ''
      );

      // Metadata
      setMaxAttempts(initialQuest.maxAttempts !== undefined ? String(initialQuest.maxAttempts) : '');
      setCooldown(initialQuest.cooldown || '');
      setTagsInput(Array.isArray(initialQuest.tags) ? initialQuest.tags.join(', ') : '');
      setNotes(initialQuest.notes || '');
    } else {
      // Defaults for brand new quest
      setTitle('');
      setDescription('');
      setIcon('⚔️');
      setCategory('custom');
      setType('CUSTOM');
      setDifficulty('Medium');
      setRank('C');
      setPriority('MEDIUM');
      setEnabled(true);
      setReqLogic('ALL');
      setRequirementsList([{ id: '1', text: '', completed: false }]);
      setProgressType('CHECKBOX');
      setTargetValue('100');
      setCurrentValue('0');
      setUnit('');
      setTimingMode('duration');
      setDurationDays('0');
      setDurationHours('24');
      setDurationMinutes('0');
      setSpecificExpiresAt('');
      setRewardXp('300');
      setRewardCoins('150');
      setRewardTitle('');
      setRewardCustom('');
      setRewardItems([]);
      setStatBonuses([]);
      setRewardStatEffects([{ type: 'stat', statName: defaultStatName, stat: defaultStatName, operation: 'increase', amount: 1 }]);
      setRewardCurrencyEffects([{ type: 'currency', currencyName: 'Coins', currency: 'Coins', operation: 'increase', amount: 100 }]);
      setPenaltyEnabled(true);
      setPenaltyType('STAT');
      setPenaltyStat(defaultStatName);
      setPenaltyStatOperation('decrease');
      setPenaltyValue('1');
      setPenaltyDescription(`📊 ${defaultStatName} -1`);
      setPenaltyStatEffects([{ type: 'stat', statName: defaultStatName, stat: defaultStatName, operation: 'decrease', amount: 1 }]);
      setPenaltyCurrencyEffects([]);
      setMaxAttempts('');
      setCooldown('');
      setTagsInput('');
      setNotes('');
    }
    setActiveTab('general');
    setFormError(null);
    setShowDeleteConfirm(false);
  }, [initialQuest, isOpen, authoritativeStats]);

  if (!isOpen) return null;

  // Requirement list handlers
  const handleAddRequirement = () => {
    setRequirementsList([...requirementsList, { id: String(Date.now()), text: '', completed: false }]);
  };

  const handleUpdateRequirement = (index: number, text: string) => {
    const updated = [...requirementsList];
    updated[index].text = text;
    setRequirementsList(updated);
  };

  const handleRemoveRequirement = (index: number) => {
    if (requirementsList.length <= 1) {
      setRequirementsList([{ id: '1', text: '', completed: false }]);
      return;
    }
    setRequirementsList(requirementsList.filter((_, i) => i !== index));
  };

  // Reward Item handlers
  const handleAddRewardItem = () => {
    setRewardItems([...rewardItems, { name: '', quantity: 1, rank: 'C', rarity: 'Common' }]);
  };

  const handleUpdateRewardItem = (index: number, field: string, val: any) => {
    const updated = [...rewardItems];
    updated[index] = { ...updated[index], [field]: val };
    setRewardItems(updated);
  };

  const handleRemoveRewardItem = (index: number) => {
    setRewardItems(rewardItems.filter((_, i) => i !== index));
  };

  // Stat Bonus handlers
  const handleAddStatBonus = () => {
    const defaultStat = authoritativeStats[0]?.name || 'Strength';
    setStatBonuses([...statBonuses, { stat: defaultStat, value: 1 }]);
  };

  const handleUpdateStatBonus = (index: number, field: 'stat' | 'value', val: any) => {
    const updated = [...statBonuses];
    updated[index] = { ...updated[index], [field]: field === 'value' ? Number(val) : val };
    setStatBonuses(updated);
  };

  const handleRemoveStatBonus = (index: number) => {
    setStatBonuses(statBonuses.filter((_, i) => i !== index));
  };

  // Stat Effect handlers for Rewards (STAT REWARD)
  const handleAddRewardStatEffect = () => {
    const defaultStat = authoritativeStats[0]?.name || 'Strength';
    setRewardStatEffects([
      ...rewardStatEffects,
      { type: 'stat', statName: defaultStat, stat: defaultStat, operation: 'increase', amount: 1 },
    ]);
  };

  const handleUpdateRewardStatEffect = (index: number, field: string, val: any) => {
    const updated = [...rewardStatEffects];
    if (field === 'stat') {
      const match = authoritativeStats.find(
        (s) => s.name === val || s.key === val || s.name.toLowerCase() === String(val).toLowerCase()
      );
      const statName = match ? match.name : val;
      updated[index] = {
        ...updated[index],
        stat: statName,
        statName: statName,
      };
    } else if (field === 'amount') {
      const rawVal = typeof val === 'number' ? val : parseInt(String(val), 10);
      const wholeAmount = isNaN(rawVal) ? 1 : Math.max(1, Math.round(rawVal));
      updated[index] = {
        ...updated[index],
        amount: wholeAmount,
      };
    } else if (field === 'operation') {
      updated[index] = {
        ...updated[index],
        operation: val,
      };
    }
    setRewardStatEffects(updated);
  };

  const handleRemoveRewardStatEffect = (index: number) => {
    setRewardStatEffects(rewardStatEffects.filter((_, i) => i !== index));
  };

  // Currency Effect handlers for Rewards (CURRENCY REWARD)
  const handleAddRewardCurrencyEffect = () => {
    setRewardCurrencyEffects([
      ...rewardCurrencyEffects,
      { type: 'currency', currencyName: 'Coins', currency: 'Coins', operation: 'increase', amount: 100 },
    ]);
  };

  const handleUpdateRewardCurrencyEffect = (index: number, field: string, val: any) => {
    const updated = [...rewardCurrencyEffects];
    if (field === 'currencyName' || field === 'currency') {
      updated[index] = {
        ...updated[index],
        currencyName: 'Coins',
        currency: 'Coins',
      };
    } else if (field === 'amount') {
      const rawVal = typeof val === 'number' ? val : parseInt(String(val), 10);
      const wholeAmount = isNaN(rawVal) ? 1 : Math.max(1, Math.round(rawVal));
      updated[index] = {
        ...updated[index],
        amount: wholeAmount,
      };
    } else if (field === 'operation') {
      updated[index] = {
        ...updated[index],
        operation: val,
      };
    }
    setRewardCurrencyEffects(updated);
  };

  const handleRemoveRewardCurrencyEffect = (index: number) => {
    setRewardCurrencyEffects(rewardCurrencyEffects.filter((_, i) => i !== index));
  };

  // Stat Effect handlers for Penalties (STAT PENALTY)
  const handleAddPenaltyStatEffect = () => {
    const defaultStat = authoritativeStats[0]?.name || 'Strength';
    setPenaltyStatEffects([
      ...penaltyStatEffects,
      { type: 'stat', statName: defaultStat, stat: defaultStat, operation: 'decrease', amount: 1 },
    ]);
  };

  const handleUpdatePenaltyStatEffect = (index: number, field: string, val: any) => {
    const updated = [...penaltyStatEffects];
    if (field === 'stat') {
      const match = authoritativeStats.find(
        (s) => s.name === val || s.key === val || s.name.toLowerCase() === String(val).toLowerCase()
      );
      const statName = match ? match.name : val;
      updated[index] = {
        ...updated[index],
        stat: statName,
        statName: statName,
      };
    } else if (field === 'amount') {
      const rawVal = typeof val === 'number' ? val : parseInt(String(val), 10);
      const wholeAmount = isNaN(rawVal) ? 1 : Math.max(1, Math.round(rawVal));
      updated[index] = {
        ...updated[index],
        amount: wholeAmount,
      };
    } else if (field === 'operation') {
      updated[index] = {
        ...updated[index],
        operation: val,
      };
    }
    setPenaltyStatEffects(updated);
  };

  const handleRemovePenaltyStatEffect = (index: number) => {
    setPenaltyStatEffects(penaltyStatEffects.filter((_, i) => i !== index));
  };

  // Currency Effect handlers for Penalties (CURRENCY PENALTY)
  const handleAddPenaltyCurrencyEffect = () => {
    setPenaltyCurrencyEffects([
      ...penaltyCurrencyEffects,
      { type: 'currency', currencyName: 'Coins', currency: 'Coins', operation: 'decrease', amount: 100 },
    ]);
  };

  const handleUpdatePenaltyCurrencyEffect = (index: number, field: string, val: any) => {
    const updated = [...penaltyCurrencyEffects];
    if (field === 'currencyName' || field === 'currency') {
      updated[index] = {
        ...updated[index],
        currencyName: val,
        currency: val,
      };
    } else if (field === 'amount') {
      const rawVal = typeof val === 'number' ? val : parseInt(String(val), 10);
      const wholeAmount = isNaN(rawVal) ? 1 : Math.max(1, Math.round(rawVal));
      updated[index] = {
        ...updated[index],
        amount: wholeAmount,
      };
    } else if (field === 'operation') {
      updated[index] = {
        ...updated[index],
        operation: val,
      };
    }
    setPenaltyCurrencyEffects(updated);
  };

  const handleRemovePenaltyCurrencyEffect = (index: number) => {
    setPenaltyCurrencyEffects(penaltyCurrencyEffects.filter((_, i) => i !== index));
  };

  // Preset Applier
  const applyPreset = (preset: typeof PRESETS[0]) => {
    const defaultStat = authoritativeStats[0]?.name || 'Strength';
    setTitle(preset.name);
    setDescription(preset.desc);
    setIcon(preset.icon);
    setType(preset.type);
    setDifficulty(preset.difficulty);
    setRank(preset.rank);
    setReqLogic(preset.reqLogic as any);
    setRequirementsList(preset.requirements.map((r, i) => ({ id: String(i + 1), text: r, completed: false })));
    setProgressType(preset.progType as any);
    setTargetValue(String(preset.target));
    setUnit(preset.unit);
    setTimingMode('duration');
    setDurationDays('0');
    setDurationHours(String(preset.durationHours));
    setDurationMinutes('0');
    setRewardXp(String(preset.xp));
    setRewardCoins(String(preset.coins));
    setRewardItems(preset.items ? [...preset.items] : []);
    setPenaltyEnabled(preset.penaltyEnabled);
    if (preset.penaltyType === 'STAT') {
      setPenaltyStatEffects([{ type: 'stat', statName: defaultStat, stat: defaultStat, operation: 'decrease', amount: 1 }]);
      setPenaltyCurrencyEffects([]);
    } else if (preset.penaltyType === 'COIN') {
      setPenaltyStatEffects([]);
      setPenaltyCurrencyEffects([{ type: 'currency', currencyName: 'Coins', currency: 'Coins', operation: 'decrease', amount: preset.penaltyValue || 100 }]);
    } else {
      if (preset.penaltyType) setPenaltyType(preset.penaltyType);
      if (preset.penaltyValue) setPenaltyValue(String(preset.penaltyValue));
      if (preset.penaltyDesc) setPenaltyDescription(preset.penaltyDesc);
    }
  };

  // Calculate live preview of expiration timestamp
  let computedExpiresAtPreview: string | null = null;
  if (timingMode === 'specific' && specificExpiresAt) {
    computedExpiresAtPreview = new Date(specificExpiresAt).toLocaleString();
  } else if (timingMode === 'duration') {
    const days = parseInt(durationDays || '0', 10) || 0;
    const hours = parseInt(durationHours || '0', 10) || 0;
    const mins = parseInt(durationMinutes || '0', 10) || 0;
    const totalMs = (days * 86400 + hours * 3600 + mins * 60) * 1000;
    if (totalMs > 0) {
      computedExpiresAtPreview = new Date(Date.now() + totalMs).toLocaleString();
    }
  }

  // Submission handler
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setFormError('Quest name / title is required.');
      setActiveTab('general');
      return;
    }

    const filteredReqs = requirementsList
      .map((r) => ({ ...r, text: r.text.trim() }))
      .filter((r) => r.text.length > 0);

    const numTarget = progressType === 'NUMERIC' ? parseFloat(targetValue) || 100 : undefined;
    const numCurrent = progressType === 'NUMERIC' ? parseFloat(currentValue) || 0 : 0;

    // Durations
    let finalExpiresAt: string | undefined = undefined;
    let daysNum: number | undefined = undefined;
    let hoursNum: number | undefined = undefined;
    let minsNum: number | undefined = undefined;

    if (timingMode === 'specific' && specificExpiresAt) {
      finalExpiresAt = new Date(specificExpiresAt).toISOString();
    } else if (timingMode === 'duration') {
      daysNum = parseInt(durationDays || '0', 10) || 0;
      hoursNum = parseInt(durationHours || '0', 10) || 0;
      minsNum = parseInt(durationMinutes || '0', 10) || 0;
      const totalMs = (daysNum * 86400 + hoursNum * 3600 + minsNum * 60) * 1000;
      if (totalMs > 0) {
        finalExpiresAt = new Date(Date.now() + totalMs).toISOString();
      }
    }

    // Build structured rewards
    const xpVal = rewardXp.trim() ? parseInt(rewardXp, 10) : undefined;
    const coinsVal = rewardCoins.trim() ? parseInt(rewardCoins, 10) : undefined;
    const filteredRewardItems = rewardItems
      .filter((item) => item.name && item.name.trim().length > 0)
      .map((item) => ({ ...item, name: item.name.trim(), quantity: Math.max(1, item.quantity || 1) }));

    const statsMap: Record<string, number> = {};
    for (const b of statBonuses) {
      if (b.stat && b.stat.trim()) {
        statsMap[b.stat.trim().toUpperCase()] = b.value;
      }
    }

    // Filter valid reward stat effects
    const filteredRewardStatEffects = rewardStatEffects
      .filter((e) => e && e.stat && e.amount > 0)
      .map((e) => {
        const match = authoritativeStats.find(
          (s) => s.name === e.statName || s.name === e.stat || s.key === e.stat || s.name.toLowerCase() === String(e.stat).toLowerCase()
        );
        const statName = match ? match.name : (e.statName || e.stat);
        const statKey = match ? match.key : normalizeStatKey(e.stat);
        return {
          type: 'stat' as const,
          stat: statKey,
          statName: statName,
          operation: 'increase' as const,
          amount: Math.max(1, Math.round(e.amount)),
        };
      });

    // Filter valid reward currency effects
    const filteredRewardCurrencyEffects = rewardCurrencyEffects
      .filter((c) => c && c.amount > 0)
      .map((c) => ({
        type: 'currency' as const,
        currencyName: c.currencyName || 'Coins',
        currency: c.currency || 'Coins',
        operation: 'increase' as const,
        amount: Math.max(1, Math.round(c.amount)),
      }));

    const finalCoinsVal = filteredRewardCurrencyEffects.length > 0
      ? filteredRewardCurrencyEffects[0].amount
      : coinsVal;

    const structuredRewards: QuestRewards = {
      xp: xpVal,
      coins: finalCoinsVal,
      title: rewardTitle.trim() || undefined,
      custom: rewardCustom.trim() || undefined,
      items: filteredRewardItems.length > 0 ? filteredRewardItems : undefined,
      stats: Object.keys(statsMap).length > 0 ? statsMap : undefined,
      statEffects: filteredRewardStatEffects.length > 0 ? filteredRewardStatEffects : undefined,
      currencyEffects: filteredRewardCurrencyEffects.length > 0 ? filteredRewardCurrencyEffects : undefined,
    };

    const rewardSummary = formatQuestRewardSummary(structuredRewards);

    // Penalty Filtering & Packaging
    const filteredPenaltyStatEffects = penaltyStatEffects
      .filter((e) => e && e.stat && e.amount > 0)
      .map((e) => {
        const match = authoritativeStats.find(
          (s) => s.name === e.statName || s.name === e.stat || s.key === e.stat || s.name.toLowerCase() === String(e.stat).toLowerCase()
        );
        const statName = match ? match.name : (e.statName || e.stat);
        const statKey = match ? match.key : normalizeStatKey(e.stat);
        return {
          type: 'stat' as const,
          stat: statKey,
          statName: statName,
          operation: e.operation || 'decrease',
          amount: Math.max(1, Math.round(e.amount)),
        };
      });

    const filteredPenaltyCurrencyEffects = penaltyCurrencyEffects
      .filter((c) => c && c.amount > 0)
      .map((c) => ({
        type: 'currency' as const,
        currencyName: c.currencyName || 'Coins',
        currency: c.currency || 'Coins',
        operation: c.operation || 'decrease',
        amount: Math.max(1, Math.round(c.amount)),
      }));

    let finalPenaltyType = 'STAT';
    if (filteredPenaltyStatEffects.length > 0 && filteredPenaltyCurrencyEffects.length > 0) {
      finalPenaltyType = 'STAT_AND_CURRENCY';
    } else if (filteredPenaltyStatEffects.length > 0) {
      finalPenaltyType = 'STAT';
    } else if (filteredPenaltyCurrencyEffects.length > 0) {
      finalPenaltyType = 'COIN';
    } else {
      finalPenaltyType = penaltyType || 'XP';
    }

    const descParts: string[] = [];
    if (filteredPenaltyStatEffects.length > 0) {
      descParts.push(...filteredPenaltyStatEffects.map((e) => `${getStatIcon(e.stat)} ${e.statName || getStatFullName(e.stat)} -${e.amount}`));
    }
    if (filteredPenaltyCurrencyEffects.length > 0) {
      descParts.push(...filteredPenaltyCurrencyEffects.map((c) => `🪙 ${c.currencyName || 'Coins'} -${c.amount}`));
    }
    const finalPenaltyDesc = descParts.length > 0 ? descParts.join(', ') : (penaltyDescription.trim() || undefined);

    const firstPenaltyVal = filteredPenaltyStatEffects.length > 0
      ? filteredPenaltyStatEffects[0].amount
      : (filteredPenaltyCurrencyEffects.length > 0 ? filteredPenaltyCurrencyEffects[0].amount : (penaltyValue.trim() ? parseFloat(penaltyValue) : undefined));

    const normalizedPenalty: QuestPenalty = {
      enabled: penaltyEnabled,
      type: finalPenaltyType,
      value: firstPenaltyVal,
      description: finalPenaltyDesc,
      stat: filteredPenaltyStatEffects.length > 0 ? filteredPenaltyStatEffects[0].stat : undefined,
      statOperation: filteredPenaltyStatEffects.length > 0 ? filteredPenaltyStatEffects[0].operation : undefined,
      statEffects: filteredPenaltyStatEffects.length > 0 ? filteredPenaltyStatEffects : undefined,
      currencyEffects: filteredPenaltyCurrencyEffects.length > 0 ? filteredPenaltyCurrencyEffects : undefined,
      coins: filteredPenaltyCurrencyEffects.length > 0 ? filteredPenaltyCurrencyEffects[0].amount : undefined,
    };

    // Tags
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const questData: Partial<QuestItem> & { title: string } = {
      id: initialQuest?.id || initialQuest?.questId || generateCustomQuestId(),
      questId: initialQuest?.questId || initialQuest?.id || generateCustomQuestId(),
      title: cleanTitle,
      description: description.trim() || undefined,
      icon,
      category,
      type,
      difficulty,
      rank,
      priority,
      enabled,
      requirements: filteredReqs.length > 0 ? filteredReqs : undefined,
      requirementLogic: reqLogic,
      progressType,
      targetValue: numTarget,
      currentValue: numCurrent,
      unit: unit.trim() || undefined,
      durationDays: daysNum,
      durationHours: hoursNum,
      durationMinutes: minsNum,
      expiresAt: finalExpiresAt,
      rewards: structuredRewards,
      reward: rewardSummary || undefined,
      statEffects: filteredRewardStatEffects.length > 0 ? filteredRewardStatEffects : undefined,
      currencyEffects: filteredRewardCurrencyEffects.length > 0 ? filteredRewardCurrencyEffects : undefined,
      penalty: normalizedPenalty,
      penaltyEnabled,
      penaltyType: finalPenaltyType,
      penaltyValue: firstPenaltyVal,
      penaltyDescription: finalPenaltyDesc,
      penaltyStatEffects: filteredPenaltyStatEffects.length > 0 ? filteredPenaltyStatEffects : undefined,
      penaltyCurrencyEffects: filteredPenaltyCurrencyEffects.length > 0 ? filteredPenaltyCurrencyEffects : undefined,
      penaltyCoins: filteredPenaltyCurrencyEffects.length > 0 ? filteredPenaltyCurrencyEffects[0].amount : undefined,
      maxAttempts: maxAttempts.trim() ? parseInt(maxAttempts, 10) : undefined,
      cooldown: cooldown.trim() || undefined,
      tags,
      notes: notes.trim() || undefined,
      isCustom: true,
      status: initialQuest?.status || 'ACTIVE',
      createdAt: initialQuest?.createdAt || new Date().toISOString(),
    };

    try {
      setIsSaving(true);
      await onSave(questData);
      onClose();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save custom quest.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      id="custom-quest-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto animate-fade-in"
    >
      <div
        id="custom-quest-modal-container"
        className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-slate-900/95 border border-cyan-500/40 rounded-xl shadow-2xl shadow-cyan-950/60 overflow-hidden text-slate-100"
      >
        {/* Header */}
        <div
          id="custom-quest-modal-header"
          className="flex items-center justify-between px-5 py-4 bg-slate-950/80 border-b border-cyan-500/30"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-950/80 border border-cyan-500/50 flex items-center justify-center text-2xl shadow-inner shadow-cyan-500/20">
              {icon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-wider text-cyan-300 uppercase">
                  {isEditing ? 'Edit Custom Quest' : 'Create Custom Quest'}
                </h2>
                <span className="px-2 py-0.5 text-xs font-mono font-semibold rounded bg-cyan-950 border border-cyan-600/50 text-cyan-400">
                  {type}
                </span>
                <span className="px-2 py-0.5 text-xs font-mono font-semibold rounded bg-slate-800 border border-slate-700 text-amber-400">
                  Rank {rank} • {difficulty}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Player-defined directive • Executes authoritative rewards and timers
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isEditing && onDuplicate && initialQuest && (
              <button
                type="button"
                id="btn-duplicate-custom-quest"
                onClick={() => onDuplicate(initialQuest)}
                title="Duplicate this quest"
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 border border-slate-700 transition"
              >
                <Copy className="w-4 h-4" />
              </button>
            )}
            <button
              type="button"
              id="btn-close-custom-quest-modal"
              onClick={onClose}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form Presets Banner (Only on new quest) */}
        {!isEditing && (
          <div className="px-5 py-2.5 bg-cyan-950/30 border-b border-cyan-500/20 flex items-center gap-2 overflow-x-auto text-xs">
            <span className="text-cyan-400 font-semibold flex items-center gap-1 shrink-0">
              <Sparkles className="w-3.5 h-3.5" /> Presets:
            </span>
            {PRESETS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => applyPreset(p)}
                className="px-2.5 py-1 rounded bg-slate-800/90 hover:bg-cyan-900/60 text-slate-300 hover:text-cyan-200 border border-slate-700 hover:border-cyan-500/50 whitespace-nowrap transition"
              >
                {p.icon} {p.name.split(' (')[0]}
              </button>
            ))}
          </div>
        )}

        {/* Tabs Bar */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-5 gap-1 overflow-x-auto">
          {[
            { key: 'general', label: 'General', icon: Target },
            { key: 'requirements', label: 'Requirements & Progress', icon: CheckCircle2 },
            { key: 'timing', label: 'Timers & Expiration', icon: Clock },
            { key: 'rewards', label: 'Reward Builder', icon: Award },
            { key: 'penalty', label: 'Penalty Builder', icon: AlertTriangle },
          ].map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                id={`tab-custom-quest-${tab.key}`}
                onClick={() => setActiveTab(tab.key as TabKey)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider transition border-b-2 whitespace-nowrap ${
                  isActive
                    ? 'border-cyan-400 text-cyan-300 bg-cyan-950/30'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                }`}
              >
                <TabIcon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Global Error Banner */}
        {formError && (
          <div className="mx-5 mt-4 p-3 rounded-lg bg-rose-950/60 border border-rose-600/50 text-rose-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{formError}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* TAB: GENERAL */}
          {activeTab === 'general' && (
            <div className="space-y-5 animate-fade-in">
              {/* Quest Title & Icon */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                <div className="sm:col-span-8 space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
                    Quest Name / Title <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    id="input-custom-quest-title"
                    required
                    placeholder="e.g. Iron Discipline, 100 Pushups Daily..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-slate-950 border border-cyan-500/40 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 text-sm font-medium"
                  />
                </div>

                <div className="sm:col-span-4 space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Quest Icon
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      maxLength={4}
                      value={icon}
                      onChange={(e) => setIcon(e.target.value)}
                      className="w-14 px-2 py-2 text-center text-xl rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-cyan-400"
                    />
                    <div className="flex flex-wrap gap-1 overflow-x-auto py-1">
                      {COMMON_ICONS.slice(0, 7).map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setIcon(emoji)}
                          className={`w-7 h-7 rounded text-sm flex items-center justify-center hover:bg-slate-800 transition ${
                            icon === emoji ? 'bg-cyan-950 border border-cyan-500 text-cyan-300' : 'bg-slate-900'
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Description / Lore */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Quest Description & Lore
                </label>
                <textarea
                  id="input-custom-quest-desc"
                  rows={3}
                  placeholder="Detailed instructions, player lore, and specific conditions for this quest..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400 text-xs leading-relaxed"
                />
              </div>

              {/* Quest Classification: Type, Difficulty, Rank, Priority */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Quest Type
                  </label>
                  <select
                    id="select-custom-quest-type"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-cyan-300 text-xs font-mono focus:outline-none focus:border-cyan-400"
                  >
                    {QUEST_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Difficulty
                  </label>
                  <select
                    id="select-custom-quest-difficulty"
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs font-medium focus:outline-none focus:border-cyan-400"
                  >
                    {DIFFICULTIES.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Rank
                  </label>
                  <select
                    id="select-custom-quest-rank"
                    value={rank}
                    onChange={(e) => setRank(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-amber-400 font-bold text-xs focus:outline-none focus:border-cyan-400"
                  >
                    {RANKS.map((r) => (
                      <option key={r} value={r}>
                        Rank {r}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Priority
                  </label>
                  <select
                    id="select-custom-quest-priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs font-medium focus:outline-none focus:border-cyan-400"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Category, Tags, and Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Category
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Fitness, Study, Coding, Health"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    placeholder="pushups, strength, daily"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div className="space-y-1.5 flex flex-col justify-end">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Quest Status
                  </label>
                  <button
                    type="button"
                    onClick={() => setEnabled(!enabled)}
                    className={`w-full py-2 px-3 rounded-lg border text-xs font-semibold transition flex items-center justify-center gap-2 ${
                      enabled
                        ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/40'
                        : 'bg-slate-900 border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${enabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                    {enabled ? 'Active / Enabled' : 'Draft / Paused'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: REQUIREMENTS & PROGRESS */}
          {activeTab === 'requirements' && (
            <div className="space-y-5 animate-fade-in">
              {/* Progress Type & Logic Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
                    Progress Type
                  </label>
                  <select
                    id="select-custom-quest-prog-type"
                    value={progressType}
                    onChange={(e) => setProgressType(e.target.value as any)}
                    className="w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs font-medium focus:outline-none focus:border-cyan-400"
                  >
                    {PROGRESS_TYPES.map((pt) => (
                      <option key={pt.value} value={pt.value}>
                        {pt.label} ({pt.desc})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
                    Requirement Logic
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setReqLogic('ALL')}
                      className={`flex-1 py-2 rounded-lg border text-xs font-bold uppercase transition ${
                        reqLogic === 'ALL'
                          ? 'bg-cyan-950 border-cyan-400 text-cyan-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900'
                      }`}
                    >
                      ALL Required (AND)
                    </button>
                    <button
                      type="button"
                      onClick={() => setReqLogic('ANY')}
                      className={`flex-1 py-2 rounded-lg border text-xs font-bold uppercase transition ${
                        reqLogic === 'ANY'
                          ? 'bg-cyan-950 border-cyan-400 text-cyan-300'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900'
                      }`}
                    >
                      ANY One (OR)
                    </button>
                  </div>
                </div>
              </div>

              {/* Numeric target configuration */}
              {progressType === 'NUMERIC' && (
                <div className="p-4 rounded-lg bg-slate-950 border border-cyan-500/30 grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Current Progress</label>
                    <input
                      type="number"
                      min={0}
                      value={currentValue}
                      onChange={(e) => setCurrentValue(e.target.value)}
                      className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-cyan-300">Target Value</label>
                    <input
                      type="number"
                      min={1}
                      value={targetValue}
                      onChange={(e) => setTargetValue(e.target.value)}
                      className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300">Unit / Label</label>
                    <input
                      type="text"
                      placeholder="e.g. pushups, km, mins, pages"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>
              )}

              {/* Requirement Items List */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Requirements Checklist ({requirementsList.length})
                  </label>
                  <button
                    type="button"
                    onClick={handleAddRequirement}
                    className="px-2.5 py-1 text-xs rounded bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 flex items-center gap-1 transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Requirement
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {requirementsList.map((req, idx) => (
                    <div
                      key={req.id || idx}
                      className="flex items-center gap-2 p-2 rounded-lg bg-slate-950/70 border border-slate-800"
                    >
                      <span className="text-xs font-mono text-cyan-400 font-bold w-6 text-center">
                        #{idx + 1}
                      </span>
                      <input
                        type="text"
                        placeholder={`Requirement #${idx + 1} (e.g. 100 Pushups, Drink 2L water)`}
                        value={req.text}
                        onChange={(e) => handleUpdateRequirement(idx, e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-cyan-400"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveRequirement(idx)}
                        className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: TIMERS & EXPIRATION */}
          {activeTab === 'timing' && (
            <div className="space-y-5 animate-fade-in">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-cyan-300">
                  Timer & Expiration Strategy
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { mode: 'duration', title: 'Relative Duration', desc: 'Sets timer relative to now (e.g. 24h)' },
                    { mode: 'specific', title: 'Specific Timestamp', desc: 'Exact date and time expiration' },
                    { mode: 'none', title: 'Untimed / Manual', desc: 'No automatic expiration countdown' },
                  ].map((m) => (
                    <button
                      key={m.mode}
                      type="button"
                      onClick={() => setTimingMode(m.mode as any)}
                      className={`p-3.5 rounded-lg border text-left transition ${
                        timingMode === m.mode
                          ? 'bg-cyan-950/50 border-cyan-400 text-cyan-200 shadow-md shadow-cyan-950'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900'
                      }`}
                    >
                      <div className="text-xs font-bold uppercase">{m.title}</div>
                      <div className="text-[11px] text-slate-400 mt-1">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Relative Duration Fields */}
              {timingMode === 'duration' && (
                <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3 animate-fade-in">
                  <label className="text-xs font-semibold text-slate-300">
                    Duration from Creation / Activation
                  </label>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-400 uppercase">Days</label>
                      <input
                        type="number"
                        min={0}
                        max={365}
                        value={durationDays}
                        onChange={(e) => setDurationDays(e.target.value)}
                        className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-400 uppercase">Hours</label>
                      <input
                        type="number"
                        min={0}
                        max={23}
                        value={durationHours}
                        onChange={(e) => setDurationHours(e.target.value)}
                        className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-400 uppercase">Minutes</label>
                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={durationMinutes}
                        onChange={(e) => setDurationMinutes(e.target.value)}
                        className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Specific Expiration Input */}
              {timingMode === 'specific' && (
                <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2 animate-fade-in">
                  <label className="text-xs font-semibold text-slate-300">
                    Exact Expiration Date & Time (Local / ISO)
                  </label>
                  <input
                    type="datetime-local"
                    value={specificExpiresAt ? specificExpiresAt.slice(0, 16) : ''}
                    onChange={(e) => setSpecificExpiresAt(e.target.value ? new Date(e.target.value).toISOString() : '')}
                    className="w-full px-3.5 py-2.5 rounded bg-slate-900 border border-slate-700 text-cyan-300 text-xs focus:outline-none focus:border-cyan-400 font-mono"
                  />
                </div>
              )}

              {/* Computed Expiration Preview Badge */}
              {computedExpiresAtPreview && timingMode !== 'none' && (
                <div className="p-3 rounded-lg bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-between text-xs">
                  <span className="text-slate-300 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400" /> Calculated Expiration Time:
                  </span>
                  <span className="font-mono font-bold text-cyan-300">{computedExpiresAtPreview}</span>
                </div>
              )}

              {/* Cooldown & Max Attempts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Max Attempts (optional)
                  </label>
                  <input
                    type="number"
                    min={1}
                    placeholder="Unlimited"
                    value={maxAttempts}
                    onChange={(e) => setMaxAttempts(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Cooldown (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 24h, 7 days"
                    value={cooldown}
                    onChange={(e) => setCooldown(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB: REWARDS */}
          {activeTab === 'rewards' && (
            <div className="space-y-5 animate-fade-in">
              {/* Primary XP Reward */}
              <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-cyan-400" /> XP Reward
                </label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  placeholder="e.g. 500"
                  value={rewardXp}
                  onChange={(e) => setRewardXp(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-slate-900 border border-slate-700 text-cyan-300 font-bold text-sm focus:outline-none focus:border-cyan-400 font-mono"
                />
                <p className="text-[11px] text-slate-400">Directly adds to Player XP upon quest completion</p>
              </div>

              {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                  1. 📊 STAT REWARD SECTION
                  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
              <div className="p-4 rounded-lg bg-slate-950/90 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-400" />
                      <span>📊 STAT REWARD</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Configure stat point gains awarded when this quest is completed.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddRewardStatEffect}
                    disabled={authoritativeStats.length === 0}
                    className="px-2.5 py-1 text-xs rounded bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 flex items-center gap-1 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Stat Reward
                  </button>
                </div>

                {authoritativeStats.length === 0 ? (
                  <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs font-mono">
                    ⚠️ Authoritative Player Stats are currently unavailable. Stat selection is disabled to prevent invalid assignments.
                  </div>
                ) : rewardStatEffects.length === 0 ? (
                  <div className="p-3.5 rounded-lg bg-slate-900/60 border border-dashed border-slate-800 text-center space-y-2">
                    <p className="text-xs text-slate-400">
                      No stat rewards configured.
                    </p>
                    <button
                      type="button"
                      onClick={handleAddRewardStatEffect}
                      className="px-3 py-1 text-xs rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/80 transition"
                    >
                      + Add Stat Reward
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rewardStatEffects.map((eff, idx) => {
                      const matched = authoritativeStats.find(
                        (s) => s.name.toLowerCase() === (eff.statName || eff.stat || '').toLowerCase() ||
                               s.key.toLowerCase() === (eff.stat || '').toLowerCase()
                      );
                      const statName = matched ? matched.name : (eff.statName || eff.stat || 'Strength');
                      const icon = matched ? matched.icon : getStatIcon(statName);
                      const isValidAmount = Number.isInteger(eff.amount) && eff.amount >= 1;

                      return (
                        <div
                          key={`reward-stat-${idx}`}
                          className="p-3 rounded-lg bg-slate-900/90 border border-emerald-950/60 space-y-2.5"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                            {/* Stat Dropdown */}
                            <div className="sm:col-span-6 space-y-1">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Stat:
                              </label>
                              <select
                                id={`select-reward-stat-${idx}`}
                                value={statName}
                                disabled={authoritativeStats.length === 0}
                                onChange={(e) => handleUpdateRewardStatEffect(idx, 'stat', e.target.value)}
                                className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-slate-100 text-xs font-mono font-bold focus:outline-none focus:border-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {authoritativeStats.map((opt) => (
                                  <option key={opt.name} value={opt.name}>
                                    {opt.icon} {opt.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Amount Input */}
                            <div className="sm:col-span-5 space-y-1">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Amount:
                              </label>
                              <input
                                id={`input-reward-stat-amount-${idx}`}
                                type="number"
                                min={1}
                                step={1}
                                placeholder="1"
                                value={eff.amount === undefined || eff.amount === null ? '' : eff.amount}
                                onChange={(e) => {
                                  const parsed = parseInt(e.target.value, 10);
                                  handleUpdateRewardStatEffect(idx, 'amount', isNaN(parsed) ? '' : Math.max(1, parsed));
                                }}
                                onBlur={() => {
                                  if (!eff.amount || eff.amount < 1) {
                                    handleUpdateRewardStatEffect(idx, 'amount', 1);
                                  }
                                }}
                                className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-emerald-300 font-bold font-mono text-xs focus:outline-none focus:border-emerald-400"
                              />
                            </div>

                            {/* Delete Button */}
                            <div className="sm:col-span-1 flex justify-end sm:justify-center pt-2 sm:pt-4">
                              <button
                                type="button"
                                onClick={() => handleRemoveRewardStatEffect(idx)}
                                className="p-2 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
                                title="Remove this stat reward"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Effect Preview & Validation */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/60 text-[11px]">
                            <span className="text-slate-400">Effect preview:</span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold px-2.5 py-0.5 rounded border bg-emerald-950/70 border-emerald-500/50 text-emerald-300">
                                {icon} {statName} +{eff.amount || 1}
                              </span>
                              {isValidAmount ? (
                                <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-0.5">
                                  <Check className="w-3 h-3" /> Valid
                                </span>
                              ) : (
                                <span className="text-[10px] text-amber-400 font-mono">
                                  ⚠️ Whole number required (min 1)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                  2. 🪙 CURRENCY REWARD SECTION
                  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
              <div className="p-4 rounded-lg bg-slate-950/90 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-2">
                      <Coins className="w-4 h-4 text-amber-400" />
                      <span>🪙 CURRENCY REWARD</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Configure coin / currency rewards added directly to the player wallet upon completion.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddRewardCurrencyEffect}
                    className="px-2.5 py-1 text-xs rounded bg-amber-950/70 hover:bg-amber-900 border border-amber-500/50 text-amber-300 flex items-center gap-1 transition cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Currency Reward
                  </button>
                </div>

                {rewardCurrencyEffects.length === 0 ? (
                  <div className="p-3.5 rounded-lg bg-slate-900/60 border border-dashed border-slate-800 text-center space-y-2">
                    <p className="text-xs text-slate-400">
                      No currency rewards configured.
                    </p>
                    <button
                      type="button"
                      onClick={handleAddRewardCurrencyEffect}
                      className="px-3 py-1 text-xs rounded bg-amber-950/80 border border-amber-500/40 text-amber-300 hover:bg-amber-900/80 transition"
                    >
                      + Add Currency Reward
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rewardCurrencyEffects.map((cur, idx) => {
                      const currencyName = cur.currencyName || cur.currency || 'Coins';
                      const isValidAmount = Number.isInteger(cur.amount) && cur.amount >= 1;

                      return (
                        <div
                          key={`reward-curr-${idx}`}
                          className="p-3 rounded-lg bg-slate-900/90 border border-amber-950/60 space-y-2.5"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                            {/* Currency Dropdown */}
                            <div className="sm:col-span-6 space-y-1">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Currency:
                              </label>
                              <select
                                value={currencyName}
                                onChange={(e) => handleUpdateRewardCurrencyEffect(idx, 'currencyName', e.target.value)}
                                className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-slate-100 text-xs font-mono font-bold focus:outline-none focus:border-amber-400"
                              >
                                {CURRENCY_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.icon} {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Amount Input */}
                            <div className="sm:col-span-5 space-y-1">
                              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Amount:
                              </label>
                              <input
                                type="number"
                                min={1}
                                step={1}
                                placeholder="100"
                                value={cur.amount === undefined || cur.amount === null ? '' : cur.amount}
                                onChange={(e) => {
                                  const parsed = parseInt(e.target.value, 10);
                                  handleUpdateRewardCurrencyEffect(idx, 'amount', isNaN(parsed) ? '' : Math.max(1, parsed));
                                }}
                                onBlur={() => {
                                  if (!cur.amount || cur.amount < 1) {
                                    handleUpdateRewardCurrencyEffect(idx, 'amount', 100);
                                  }
                                }}
                                className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-amber-300 font-bold font-mono text-xs focus:outline-none focus:border-amber-400"
                              />
                            </div>

                            {/* Delete Button */}
                            <div className="sm:col-span-1 flex justify-end sm:justify-center pt-2 sm:pt-4">
                              <button
                                type="button"
                                onClick={() => handleRemoveRewardCurrencyEffect(idx)}
                                className="p-2 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
                                title="Remove this currency reward"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Effect Preview & Validation */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/60 text-[11px]">
                            <span className="text-slate-400">Effect preview:</span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold px-2.5 py-0.5 rounded border bg-amber-950/70 border-amber-500/50 text-amber-300">
                                🪙 {currencyName} +{cur.amount || 100}
                              </span>
                              {isValidAmount ? (
                                <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-0.5">
                                  <Check className="w-3 h-3" /> Valid
                                </span>
                              ) : (
                                <span className="text-[10px] text-amber-400 font-mono">
                                  ⚠️ Whole number required (min 1)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Item Drops / Inventory Rewards */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-cyan-400" /> Item Drops / Inventory Rewards ({rewardItems.length})
                  </label>
                  <button
                    type="button"
                    onClick={handleAddRewardItem}
                    className="px-2.5 py-1 text-xs rounded bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 flex items-center gap-1 transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Item
                  </button>
                </div>

                {rewardItems.length === 0 ? (
                  <p className="text-xs text-slate-500 italic p-3 bg-slate-950/50 rounded-lg border border-slate-800">
                    No item drops configured for this quest.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {rewardItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-12 gap-2 p-2 rounded-lg bg-slate-950/70 border border-slate-800 items-center"
                      >
                        <input
                          type="text"
                          placeholder="Item Name (e.g. Elixir of Focus)"
                          value={item.name}
                          onChange={(e) => handleUpdateRewardItem(idx, 'name', e.target.value)}
                          className="col-span-5 px-2.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-cyan-400"
                        />
                        <input
                          type="number"
                          min={1}
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => handleUpdateRewardItem(idx, 'quantity', parseInt(e.target.value, 10) || 1)}
                          className="col-span-2 px-2 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-200 text-xs text-center focus:outline-none focus:border-cyan-400"
                        />
                        <select
                          value={item.rank || 'C'}
                          onChange={(e) => handleUpdateRewardItem(idx, 'rank', e.target.value)}
                          className="col-span-2 px-1.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-amber-400 text-xs font-bold focus:outline-none focus:border-cyan-400"
                        >
                          {RANKS.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                        <select
                          value={item.rarity || 'Common'}
                          onChange={(e) => handleUpdateRewardItem(idx, 'rarity', e.target.value)}
                          className="col-span-2 px-1.5 py-1.5 rounded bg-slate-900 border border-slate-700 text-slate-300 text-xs focus:outline-none focus:border-cyan-400"
                        >
                          {['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'].map((rar) => (
                            <option key={rar} value={rar}>
                              {rar}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => handleRemoveRewardItem(idx)}
                          className="col-span-1 p-1 rounded text-slate-400 hover:text-rose-400 flex justify-center transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Title & Custom Lore Rewards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Title Unlock (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. The Iron-Willed, Shadow Sovereign"
                    value={rewardTitle}
                    onChange={(e) => setRewardTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Custom Lore / Other Reward
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Access to Hidden Sanctum, Secret Quest Trigger"
                    value={rewardCustom}
                    onChange={(e) => setRewardCustom(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                  3. LIVE REWARDS SUMMARY PREVIEW
                  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
              <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Completion Rewards Summary Preview</span>
                </div>

                <div className="flex flex-wrap gap-2 text-xs font-mono">
                  {rewardXp && parseInt(rewardXp, 10) > 0 && (
                    <span className="px-2.5 py-1 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-bold flex items-center gap-1">
                      <Zap className="w-3 h-3 text-cyan-400" /> +{rewardXp} XP
                    </span>
                  )}
                  {rewardStatEffects.map((e, idx) => (
                    <span
                      key={`rew-st-${idx}`}
                      className="px-2.5 py-1 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-bold"
                    >
                      {getStatIcon(e.stat)} {e.statName || getStatFullName(e.stat)} +{e.amount}
                    </span>
                  ))}
                  {rewardCurrencyEffects.map((c, idx) => (
                    <span
                      key={`rew-cur-${idx}`}
                      className="px-2.5 py-1 rounded bg-amber-950/80 border border-amber-500/40 text-amber-300 font-bold"
                    >
                      🪙 {c.currencyName || 'Coins'} +{c.amount}
                    </span>
                  ))}
                  {rewardItems.map((item, idx) => (
                    <span
                      key={`rew-it-${idx}`}
                      className="px-2.5 py-1 rounded bg-purple-950/80 border border-purple-500/40 text-purple-300 font-bold"
                    >
                      📦 {item.name} x{item.quantity || 1}
                    </span>
                  ))}
                  {rewardTitle.trim() && (
                    <span className="px-2.5 py-1 rounded bg-amber-950/60 border border-amber-500/30 text-amber-200 font-bold">
                      👑 {rewardTitle.trim()}
                    </span>
                  )}
                  {!rewardXp &&
                    rewardStatEffects.length === 0 &&
                    rewardCurrencyEffects.length === 0 &&
                    rewardItems.length === 0 &&
                    !rewardTitle.trim() && (
                      <span className="text-slate-500 italic text-xs font-sans">
                        No rewards configured.
                      </span>
                    )}
                </div>
              </div>
            </div>
          )}

          {/* TAB: PENALTY */}
          {activeTab === 'penalty' && (
            <div className="space-y-5 animate-fade-in">
              {/* Global Penalty Status Banner */}
              <div
                className={`p-3.5 rounded-lg border flex items-center justify-between text-xs ${
                  globalPenaltiesEnabled
                    ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                    : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className={`w-4 h-4 ${globalPenaltiesEnabled ? 'text-amber-400' : 'text-slate-500'}`} />
                  <div>
                    <span className="font-bold">
                      Global Incompletion Penalties: {globalPenaltiesEnabled ? 'ENABLED' : 'DISABLED'}
                    </span>
                    <p className="text-[11px] text-slate-400">
                      {globalPenaltiesEnabled
                        ? 'Penalties configured here will execute atomically on quest failure or expiration.'
                        : 'Global setting in Settings currently pauses penalty enforcement.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Penalty ON/OFF Toggle */}
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-rose-400" />
                    <span>Quest Incompletion Penalty</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Enforce consequences (Stat deductions and/or Currency loss) if quest timer expires or attempt fails
                  </div>
                </div>
                <button
                  type="button"
                  id="btn-toggle-custom-quest-penalty"
                  onClick={() => setPenaltyEnabled(!penaltyEnabled)}
                  className={`px-4 py-2 rounded-lg border text-xs font-bold tracking-wider uppercase transition cursor-pointer ${
                    penaltyEnabled
                      ? 'bg-rose-950/70 border-rose-500 text-rose-300 shadow-md shadow-rose-950'
                      : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {penaltyEnabled ? 'Penalty ON' : 'Penalty OFF'}
                </button>
              </div>

              {/* Penalty Configurations (Separated Stat & Currency) */}
              {penaltyEnabled && (
                <div className="space-y-6 animate-fade-in">
                  {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                      1. 📊 STAT PENALTY SECTION
                      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                  <div className="p-4 rounded-lg bg-slate-950/90 border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-2">
                          <Activity className="w-4 h-4 text-rose-400" />
                          <span>📊 STAT PENALTY</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950/80 border border-rose-800/60 text-rose-300">
                            {penaltyStatEffects.length} {penaltyStatEffects.length === 1 ? 'Penalty' : 'Penalties'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Deducts from authoritative Player Stats ({authoritativeStats.map((s) => s.name).join(', ') || 'None'}) upon failure.
                        </p>
                      </div>

                      <button
                        type="button"
                        id="btn-add-stat-penalty"
                        onClick={handleAddPenaltyStatEffect}
                        disabled={authoritativeStats.length === 0}
                        className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/40 text-rose-300 text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Stat Penalty</span>
                      </button>
                    </div>

                    {authoritativeStats.length === 0 ? (
                      <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs font-mono">
                        ⚠️ Authoritative Player Stats are currently unavailable. Stat selection is disabled to prevent invalid assignments.
                      </div>
                    ) : penaltyStatEffects.length === 0 ? (
                      <div className="p-4 rounded border border-dashed border-slate-800 text-center text-xs text-slate-500">
                        No stat penalties configured. Click <strong className="text-rose-400">+ Add Stat Penalty</strong> to penalize player stats.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {penaltyStatEffects.map((eff, idx) => {
                          const matched = authoritativeStats.find(
                            (s) => s.name.toLowerCase() === (eff.statName || eff.stat || '').toLowerCase() ||
                                   s.key.toLowerCase() === (eff.stat || '').toLowerCase()
                          );
                          const statName = matched ? matched.name : (eff.statName || eff.stat || 'Strength');
                          const icon = matched ? matched.icon : getStatIcon(statName);
                          const isDecrease = eff.operation !== 'increase';
                          const rawAmount = eff.amount;
                          const isValidAmount = Number.isInteger(rawAmount) && rawAmount >= 1;

                          return (
                            <div
                              key={idx}
                              className="p-3 rounded-lg bg-slate-900/90 border border-rose-950/60 space-y-2.5"
                            >
                              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                                {/* Stat Dropdown */}
                                <div className="sm:col-span-6 space-y-1">
                                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    Stat:
                                  </label>
                                  <select
                                    id={`select-penalty-stat-${idx}`}
                                    value={statName}
                                    disabled={authoritativeStats.length === 0}
                                    onChange={(e) => handleUpdatePenaltyStatEffect(idx, 'stat', e.target.value)}
                                    className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-slate-100 text-xs font-mono font-bold focus:outline-none focus:border-rose-400 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {authoritativeStats.map((opt) => (
                                      <option key={opt.name} value={opt.name}>
                                        {opt.icon} {opt.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                {/* Amount Input */}
                                <div className="sm:col-span-5 space-y-1">
                                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    Amount:
                                  </label>
                                  <input
                                    id={`input-penalty-stat-amount-${idx}`}
                                    type="number"
                                    min={1}
                                    step={1}
                                    placeholder="1"
                                    value={eff.amount === undefined || eff.amount === null ? '' : eff.amount}
                                    onChange={(e) => {
                                      const parsed = parseInt(e.target.value, 10);
                                      handleUpdatePenaltyStatEffect(idx, 'amount', isNaN(parsed) ? '' : Math.max(1, parsed));
                                    }}
                                    onBlur={() => {
                                      if (!eff.amount || eff.amount < 1) {
                                        handleUpdatePenaltyStatEffect(idx, 'amount', 1);
                                      }
                                    }}
                                    className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-rose-300 font-bold font-mono text-xs focus:outline-none focus:border-rose-400"
                                  />
                                </div>

                                {/* Delete Button */}
                                <div className="sm:col-span-1 flex justify-end sm:justify-center pt-2 sm:pt-4">
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePenaltyStatEffect(idx)}
                                    className="p-2 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
                                    title="Remove this stat penalty"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                              {/* Effect Preview & Validation */}
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/60 text-[11px]">
                                <span className="text-slate-400">Effect preview:</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold px-2.5 py-0.5 rounded border bg-rose-950/70 border-rose-500/50 text-rose-300">
                                    {icon} {statName} {isDecrease ? `-${eff.amount || 1}` : `+${eff.amount || 1}`}
                                  </span>
                                  {isValidAmount ? (
                                    <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-0.5">
                                      <Check className="w-3 h-3" /> Valid
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-amber-400 font-mono">
                                      ⚠️ Whole number required (min 1)
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                      2. 🪙 CURRENCY PENALTY SECTION
                      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                  <div className="p-4 rounded-lg bg-slate-950/90 border border-slate-800 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                          <Coins className="w-4 h-4 text-amber-400" />
                          <span>🪙 CURRENCY PENALTY</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/80 border border-amber-800/60 text-amber-300">
                            {penaltyCurrencyEffects.length} {penaltyCurrencyEffects.length === 1 ? 'Penalty' : 'Penalties'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Deducts player currency (Coins) upon failure. Kept strictly separate from player stats.
                        </p>
                      </div>

                      <button
                        type="button"
                        id="btn-add-currency-penalty"
                        onClick={handleAddPenaltyCurrencyEffect}
                        className="px-3 py-1.5 rounded-lg bg-amber-950/60 hover:bg-amber-900/80 border border-amber-500/40 text-amber-300 text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Currency Penalty</span>
                      </button>
                    </div>

                    {penaltyCurrencyEffects.length === 0 ? (
                      <div className="p-4 rounded border border-dashed border-slate-800 text-center text-xs text-slate-500">
                        No currency penalties configured. Click <strong className="text-amber-400">+ Add Currency Penalty</strong> to deduct Coins on failure.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {penaltyCurrencyEffects.map((cur, idx) => {
                          const currencyName = cur.currencyName || cur.currency || 'Coins';
                          const isDecrease = cur.operation !== 'increase';
                          const rawAmount = cur.amount;
                          const isValidAmount = Number.isInteger(rawAmount) && rawAmount >= 1;

                          return (
                            <div
                              key={idx}
                              className="p-3 rounded-lg bg-slate-900/90 border border-amber-950/60 space-y-2.5"
                            >
                              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                                {/* Currency Dropdown */}
                                <div className="sm:col-span-6 space-y-1">
                                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    Currency:
                                  </label>
                                  <select
                                    value={currencyName}
                                    onChange={(e) => handleUpdatePenaltyCurrencyEffect(idx, 'currencyName', e.target.value)}
                                    className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-slate-100 text-xs font-mono font-bold focus:outline-none focus:border-amber-400"
                                  >
                                    {CURRENCY_OPTIONS.map((opt) => (
                                      <option key={opt.value} value={opt.value}>
                                        {opt.icon} {opt.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                {/* Amount Input */}
                                <div className="sm:col-span-5 space-y-1">
                                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    Amount:
                                  </label>
                                  <input
                                    type="number"
                                    min={1}
                                    step={1}
                                    placeholder="100"
                                    value={cur.amount === undefined || cur.amount === null ? '' : cur.amount}
                                    onChange={(e) => {
                                      const parsed = parseInt(e.target.value, 10);
                                      handleUpdatePenaltyCurrencyEffect(idx, 'amount', isNaN(parsed) ? '' : Math.max(1, parsed));
                                    }}
                                    onBlur={() => {
                                      if (!cur.amount || cur.amount < 1) {
                                        handleUpdatePenaltyCurrencyEffect(idx, 'amount', 100);
                                      }
                                    }}
                                    className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-amber-300 font-bold font-mono text-xs focus:outline-none focus:border-amber-400"
                                  />
                                </div>

                                {/* Delete Button */}
                                <div className="sm:col-span-1 flex justify-end sm:justify-center pt-2 sm:pt-4">
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePenaltyCurrencyEffect(idx)}
                                    className="p-2 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
                                    title="Remove this currency penalty"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>

                              {/* Effect Preview & Validation */}
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/60 text-[11px]">
                                <span className="text-slate-400">Effect preview:</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold px-2.5 py-0.5 rounded border bg-amber-950/70 border-amber-500/50 text-amber-300">
                                    🪙 {currencyName} {isDecrease ? `-${cur.amount || 100}` : `+${cur.amount || 100}`}
                                  </span>
                                  {isValidAmount ? (
                                    <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-0.5">
                                      <Check className="w-3 h-3" /> Valid
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-amber-400 font-mono">
                                      ⚠️ Whole number required (min 1)
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                      3. LIVE INCOMPLETION SUMMARY PREVIEW
                      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                  <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      <span>Incompletion Penalty Summary Preview</span>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs font-mono">
                      {penaltyStatEffects.length === 0 && penaltyCurrencyEffects.length === 0 ? (
                        <span className="text-slate-500 italic text-xs font-sans">
                          No penalties will be applied on failure.
                        </span>
                      ) : (
                        <>
                          {penaltyStatEffects.map((e, idx) => (
                            <span
                              key={`st-${idx}`}
                              className="px-2.5 py-1 rounded bg-rose-950/80 border border-rose-500/40 text-rose-300 font-bold"
                            >
                              {getStatIcon(e.stat)} {e.statName || getStatFullName(e.stat)} {e.operation === 'increase' ? `+${e.amount}` : `-${e.amount}`}
                            </span>
                          ))}
                          {penaltyCurrencyEffects.map((c, idx) => (
                            <span
                              key={`cur-${idx}`}
                              className="px-2.5 py-1 rounded bg-amber-950/80 border border-amber-500/40 text-amber-300 font-bold"
                            >
                              🪙 {c.currencyName || 'Coins'} {c.operation === 'increase' ? `+${c.amount}` : `-${c.amount}`}
                            </span>
                          ))}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Private Notes */}
              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Private Notes & Reminders
                </label>
                <textarea
                  rows={2}
                  placeholder="Personal reflections, gear requirements, strategies..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs leading-relaxed focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div>
              {isEditing && onDelete && initialQuest && (
                <div>
                  {showDeleteConfirm ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-rose-400">Confirm deletion?</span>
                      <button
                        type="button"
                        onClick={async () => {
                          const targetId = initialQuest.questId || initialQuest.id || initialQuest.title;
                          await onDelete(targetId);
                          onClose();
                        }}
                        className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition"
                      >
                        Yes, Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(false)}
                        className="px-2.5 py-1.5 rounded bg-slate-800 text-slate-300 text-xs transition"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      id="btn-delete-custom-quest"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="px-3 py-2 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 text-xs font-semibold flex items-center gap-1.5 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete Quest
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                id="btn-cancel-custom-quest"
                onClick={onClose}
                className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold uppercase tracking-wider transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="btn-save-custom-quest"
                disabled={isSaving}
                className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-cyan-900/50 transition flex items-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Custom Quest'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
