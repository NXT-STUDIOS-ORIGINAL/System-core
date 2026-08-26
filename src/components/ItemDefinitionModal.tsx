import React, { useState, useEffect } from 'react';
import { ItemDefinition } from '../types';
import {
  X,
  Save,
  Package,
  Sparkles,
  Shield,
  Key,
  Info,
  Clock,
  Layers,
  DollarSign,
  Zap,
  Check,
  AlertTriangle,
  History,
  Trash2,
  Lock,
  Unlock,
} from 'lucide-react';
import { generateItemId } from '../services/itemDefinitionManager';

interface ItemDefinitionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialItem?: ItemDefinition | null;
  onSave: (definition: Partial<ItemDefinition> & { itemName: string }, changeNote?: string) => Promise<void>;
  onDelete?: (itemId: string) => Promise<void>;
}

const COMMON_EMOJIS = ['📦', '🎁', '🗡️', '🛡️', '🧪', '📜', '🗝️', '💎', '💍', '🔮', '🍎', '🥩', '🪙', '✨', '⚡', '🔥', '❄️', '🌿', '🪵', '💀'];
const ITEM_TYPES = ['Consumable', 'Weapon', 'Armor', 'Accessory', 'Key', 'Loot Box', 'Material', 'Quest Item', 'Skill Book', 'Miscellaneous'];
const RARITIES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Unique', 'Unknown'];
const RANKS = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'EX'];

export const ItemDefinitionModal: React.FC<ItemDefinitionModalProps> = ({
  isOpen,
  onClose,
  initialItem,
  onSave,
  onDelete,
}) => {
  const isEditing = Boolean(initialItem && initialItem.itemId);

  const [itemName, setItemName] = useState('');
  const [itemId, setItemId] = useState('');
  const [autoSlug, setAutoSlug] = useState(true);
  const [description, setDescription] = useState('');
  const [rank, setRank] = useState('');
  const [type, setType] = useState('Miscellaneous');
  const [rarity, setRarity] = useState('Common');
  const [maximumStack, setMaximumStack] = useState<string>('99');
  const [sellValue, setSellValue] = useState<string>('');
  const [buyValue, setBuyValue] = useState<string>('');
  const [usage, setUsage] = useState('');
  const [effects, setEffects] = useState('');
  const [requirements, setRequirements] = useState('');
  const [keyType, setKeyType] = useState('');
  const [boxType, setBoxType] = useState('');
  const [craftingInformation, setCraftingInformation] = useState('');
  const [specialProperties, setSpecialProperties] = useState('');
  const [notes, setNotes] = useState('');
  const [icon, setIcon] = useState('📦');
  const [image, setImage] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [changeNote, setChangeNote] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (initialItem) {
      setItemName(initialItem.itemName || '');
      setItemId(initialItem.itemId || '');
      setAutoSlug(false);
      setDescription(initialItem.description || '');
      setRank(initialItem.rank || '');
      setType(initialItem.type || 'Miscellaneous');
      setRarity(initialItem.rarity || 'Common');
      setMaximumStack(initialItem.maximumStack !== undefined ? String(initialItem.maximumStack) : '99');
      setSellValue(initialItem.sellValue !== undefined ? String(initialItem.sellValue) : '');
      setBuyValue(initialItem.buyValue !== undefined ? String(initialItem.buyValue) : '');
      setUsage(initialItem.usage || '');
      setEffects(initialItem.effects || '');
      setRequirements(initialItem.requirements || '');
      setKeyType(initialItem.keyType || '');
      setBoxType(initialItem.boxType || '');
      setCraftingInformation(initialItem.craftingInformation || '');
      setSpecialProperties(initialItem.specialProperties || '');
      setNotes(initialItem.notes || '');
      setIcon(initialItem.icon || '📦');
      setImage(initialItem.image || '');
      setEnabled(initialItem.enabled !== false);
      setChangeNote('');
      setShowHistory(false);
    } else {
      setItemName('');
      setItemId('');
      setAutoSlug(true);
      setDescription('');
      setRank('');
      setType('Miscellaneous');
      setRarity('Common');
      setMaximumStack('99');
      setSellValue('');
      setBuyValue('');
      setUsage('');
      setEffects('');
      setRequirements('');
      setKeyType('');
      setBoxType('');
      setCraftingInformation('');
      setSpecialProperties('');
      setNotes('');
      setIcon('📦');
      setImage('');
      setEnabled(true);
      setChangeNote('');
      setShowHistory(false);
    }
    setShowDeleteConfirm(false);
  }, [initialItem, isOpen]);

  const handleNameChange = (val: string) => {
    setItemName(val);
    if (autoSlug && !isEditing) {
      setItemId(generateItemId(val));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) return;

    setIsSaving(true);
    try {
      const maxStackNum = parseInt(maximumStack, 10);
      const payload: Partial<ItemDefinition> & { itemName: string } = {
        itemId: itemId.trim() || generateItemId(itemName.trim()),
        itemName: itemName.trim(),
        enabled,
        description: description.trim() || undefined,
        rank: rank.trim() || undefined,
        type: type.trim() || undefined,
        rarity: rarity.trim() || undefined,
        maximumStack: !isNaN(maxStackNum) && maxStackNum > 0 ? maxStackNum : undefined,
        sellValue: sellValue.trim() || undefined,
        buyValue: buyValue.trim() || undefined,
        usage: usage.trim() || undefined,
        effects: effects.trim() || undefined,
        requirements: requirements.trim() || undefined,
        keyType: keyType.trim() || undefined,
        boxType: boxType.trim() || undefined,
        craftingInformation: craftingInformation.trim() || undefined,
        specialProperties: specialProperties.trim() || undefined,
        notes: notes.trim() || undefined,
        icon: icon.trim() || undefined,
        image: image.trim() || undefined,
      };

      await onSave(payload, changeNote.trim() || undefined);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!initialItem || !onDelete) return;
    setIsSaving(true);
    try {
      await onDelete(initialItem.itemId);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl bg-[#090e17] border border-[#1a2b3c] shadow-2xl rounded-none font-mono text-slate-200 my-6 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-4 bg-[#05070a] border-b border-[#1a2b3c] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Package className="w-5 h-5 text-[#00f2ff]" />
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-100 uppercase tracking-widest flex items-center gap-2">
                {isEditing ? 'EDIT ITEM DEFINITION' : 'NEW ITEM DEFINITION'}
                {isEditing && (
                  <span className="text-[10px] px-1.5 py-0.2 bg-[#00f2ff]/10 text-[#00f2ff] border border-[#00f2ff]/30">
                    v{initialItem?.definitionVersion || 1}
                  </span>
                )}
              </h2>
              <p className="text-[10px] text-slate-400">
                Persistent Item Information Database. Purely descriptive — does not affect player inventory quantity.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSave} className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* Top Row: Enabled toggle, Icon, Name, ID */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            {/* Icon picker */}
            <div className="sm:col-span-3 flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                ITEM ICON
              </label>
              <div className="flex items-center gap-2">
                <div className="w-12 h-12 bg-[#05070a] border border-[#1a2b3c] flex items-center justify-center text-2xl">
                  {icon || '📦'}
                </div>
                <input
                  type="text"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  maxLength={4}
                  placeholder="📦"
                  className="w-16 p-2 bg-[#05070a] border border-[#1a2b3c] text-center text-sm focus:outline-none focus:border-[#00f2ff]"
                />
              </div>
              <div className="flex flex-wrap gap-1 mt-1">
                {COMMON_EMOJIS.slice(0, 10).map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setIcon(emoji)}
                    className="w-6 h-6 text-xs bg-[#05070a] border border-[#1a2b3c] hover:border-[#00f2ff]/50 flex items-center justify-center transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Name & ID */}
            <div className="sm:col-span-9 space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  ITEM NAME <span className="text-[#00f2ff]">*</span>
                </label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  required
                  placeholder="e.g. Crimson Crystal, E-Rank Loot Box, Steel Key"
                  className="w-full p-2.5 bg-[#05070a] border border-[#1a2b3c] text-slate-100 text-sm font-bold focus:outline-none focus:border-[#00f2ff]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    ITEM ID (SLUG)
                  </label>
                  <input
                    type="text"
                    value={itemId}
                    onChange={(e) => {
                      setItemId(e.target.value);
                      setAutoSlug(false);
                    }}
                    disabled={isEditing}
                    placeholder="e.g. crimson-crystal"
                    className={`w-full p-2 bg-[#05070a] border border-[#1a2b3c] text-slate-300 text-xs focus:outline-none focus:border-[#00f2ff] ${
                      isEditing ? 'opacity-60 cursor-not-allowed' : ''
                    }`}
                  />
                </div>

                <div className="flex items-center justify-between p-2 bg-[#05070a] border border-[#1a2b3c]">
                  <div>
                    <span className="text-[10px] font-bold text-slate-300 uppercase block">ENABLED IN SYSTEM</span>
                    <span className="text-[9px] text-slate-500">Include in context &amp; cards</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEnabled(!enabled)}
                    className={`px-3 py-1 text-[10px] font-bold border uppercase transition-colors ${
                      enabled
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                        : 'bg-slate-800 text-slate-500 border-slate-700'
                    }`}
                  >
                    {enabled ? 'ENABLED' : 'DISABLED'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Classification: Rank, Type, Rarity, Max Stack */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-[#05070a] border border-[#1a2b3c]">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                RANK
              </label>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={rank}
                  onChange={(e) => setRank(e.target.value)}
                  placeholder="e.g. E, D, S"
                  className="w-full p-1.5 bg-[#0a0f16] border border-[#1a2b3c] text-slate-200 text-xs focus:outline-none focus:border-[#00f2ff]"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                TYPE
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full p-1.5 bg-[#0a0f16] border border-[#1a2b3c] text-slate-200 text-xs focus:outline-none focus:border-[#00f2ff]"
              >
                {ITEM_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                RARITY
              </label>
              <select
                value={rarity}
                onChange={(e) => setRarity(e.target.value)}
                className="w-full p-1.5 bg-[#0a0f16] border border-[#1a2b3c] text-slate-200 text-xs focus:outline-none focus:border-[#00f2ff]"
              >
                {RARITIES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                MAX STACK
              </label>
              <input
                type="number"
                value={maximumStack}
                onChange={(e) => setMaximumStack(e.target.value)}
                min={1}
                max={9999}
                className="w-full p-1.5 bg-[#0a0f16] border border-[#1a2b3c] text-slate-200 text-xs focus:outline-none focus:border-[#00f2ff]"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              DESCRIPTION / LORE
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Explicit description as provided by the System..."
              className="w-full p-2 bg-[#05070a] border border-[#1a2b3c] text-slate-200 text-xs focus:outline-none focus:border-[#00f2ff] leading-relaxed"
            />
          </div>

          {/* Usage & Effects */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                USAGE METHOD
              </label>
              <input
                type="text"
                value={usage}
                onChange={(e) => setUsage(e.target.value)}
                placeholder="e.g. Open to obtain random rank reward, Consume to restore 50 HP"
                className="w-full p-2 bg-[#05070a] border border-[#1a2b3c] text-slate-200 text-xs focus:outline-none focus:border-[#00f2ff]"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                EFFECTS / BUFFS
              </label>
              <input
                type="text"
                value={effects}
                onChange={(e) => setEffects(e.target.value)}
                placeholder="e.g. +20 Stability Core, Grants Stealth for 10s"
                className="w-full p-2 bg-[#05070a] border border-[#1a2b3c] text-slate-200 text-xs focus:outline-none focus:border-[#00f2ff]"
              />
            </div>
          </div>

          {/* Requirements, Key Type, Box Type */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                REQUIREMENTS
              </label>
              <input
                type="text"
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                placeholder="e.g. Level 10+, STR 25"
                className="w-full p-2 bg-[#05070a] border border-[#1a2b3c] text-slate-200 text-xs focus:outline-none focus:border-[#00f2ff]"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                KEY TYPE (IF APPLICABLE)
              </label>
              <input
                type="text"
                value={keyType}
                onChange={(e) => setKeyType(e.target.value)}
                placeholder="e.g. Steel Key, Dungeon Key, None"
                className="w-full p-2 bg-[#05070a] border border-[#1a2b3c] text-slate-200 text-xs focus:outline-none focus:border-[#00f2ff]"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                CONTAINER / BOX TIER
              </label>
              <input
                type="text"
                value={boxType}
                onChange={(e) => setBoxType(e.target.value)}
                placeholder="e.g. E-Rank Chest, Boss Crate"
                className="w-full p-2 bg-[#05070a] border border-[#1a2b3c] text-slate-200 text-xs focus:outline-none focus:border-[#00f2ff]"
              />
            </div>
          </div>

          {/* Economy & Crafting */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                SELL VALUE
              </label>
              <input
                type="text"
                value={sellValue}
                onChange={(e) => setSellValue(e.target.value)}
                placeholder="e.g. 50 Coins"
                className="w-full p-2 bg-[#05070a] border border-[#1a2b3c] text-slate-200 text-xs focus:outline-none focus:border-[#00f2ff]"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                BUY VALUE
              </label>
              <input
                type="text"
                value={buyValue}
                onChange={(e) => setBuyValue(e.target.value)}
                placeholder="e.g. 150 Coins"
                className="w-full p-2 bg-[#05070a] border border-[#1a2b3c] text-slate-200 text-xs focus:outline-none focus:border-[#00f2ff]"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                CRAFTING INFO
              </label>
              <input
                type="text"
                value={craftingInformation}
                onChange={(e) => setCraftingInformation(e.target.value)}
                placeholder="e.g. 3x Crimson Crystal + 1x Pure Water"
                className="w-full p-2 bg-[#05070a] border border-[#1a2b3c] text-slate-200 text-xs focus:outline-none focus:border-[#00f2ff]"
              />
            </div>
          </div>

          {/* Special Properties & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                SPECIAL PROPERTIES
              </label>
              <input
                type="text"
                value={specialProperties}
                onChange={(e) => setSpecialProperties(e.target.value)}
                placeholder="e.g. Soulbound, Indestructible, Quest Critical"
                className="w-full p-2 bg-[#05070a] border border-[#1a2b3c] text-slate-200 text-xs focus:outline-none focus:border-[#00f2ff]"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                NOTES &amp; GM DETAILS
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Discovered in Chapter 3 Trial"
                className="w-full p-2 bg-[#05070a] border border-[#1a2b3c] text-slate-200 text-xs focus:outline-none focus:border-[#00f2ff]"
              />
            </div>
          </div>

          {/* Change Note (if editing) */}
          {isEditing && (
            <div className="p-3 bg-[#05070a] border border-[#1a2b3c]">
              <label className="text-[10px] font-bold text-[#00f2ff] uppercase tracking-wider block mb-1">
                VERSION UPDATE NOTE (OPTIONAL)
              </label>
              <input
                type="text"
                value={changeNote}
                onChange={(e) => setChangeNote(e.target.value)}
                placeholder="e.g. Added discovered crafting recipe, Updated sell value"
                className="w-full p-2 bg-[#0a0f16] border border-[#1a2b3c] text-slate-200 text-xs focus:outline-none focus:border-[#00f2ff]"
              />
            </div>
          )}

          {/* Version History Accordion */}
          {isEditing && initialItem?.history && initialItem.history.length > 0 && (
            <div className="border border-[#1a2b3c] bg-[#05070a]">
              <button
                type="button"
                onClick={() => setShowHistory(!showHistory)}
                className="w-full p-3 flex items-center justify-between text-slate-400 hover:text-slate-200 text-xs font-bold uppercase tracking-wider transition-colors"
              >
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-[#00f2ff]" />
                  <span>VERSION HISTORY ({initialItem.history.length} PREVIOUS VERSIONS)</span>
                </div>
                <span>{showHistory ? '▲ HIDE' : '▼ VIEW'}</span>
              </button>

              {showHistory && (
                <div className="p-3 border-t border-[#1a2b3c] space-y-2 max-h-40 overflow-y-auto">
                  {initialItem.history.map((hist, hIdx) => (
                    <div key={hIdx} className="p-2 bg-[#0a0f16] border border-[#1a2b3c] text-[10px]">
                      <div className="flex items-center justify-between text-[#00f2ff]">
                        <span className="font-bold">Version {hist.version}</span>
                        <span className="text-slate-500">{new Date(hist.updatedAt).toLocaleString()}</span>
                      </div>
                      <p className="text-slate-300 mt-1">{hist.changes}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </form>

        {/* Footer Actions */}
        <div className="p-4 bg-[#05070a] border-t border-[#1a2b3c] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div>
            {isEditing && onDelete && (
              <>
                {showDeleteConfirm ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-rose-400">Delete definition? (Inventory untouched)</span>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={isSaving}
                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase"
                    >
                      CONFIRM
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-2 py-1 text-slate-400 hover:text-white text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 font-bold uppercase transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>DELETE DEFINITION</span>
                  </button>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-700 hover:border-slate-500 text-slate-300 font-bold text-xs uppercase tracking-wider transition-colors"
            >
              CANCEL
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || !itemName.trim()}
              className="flex items-center gap-1.5 px-5 py-2 bg-[#00f2ff]/20 hover:bg-[#00f2ff]/30 border border-[#00f2ff] text-[#00f2ff] hover:text-white font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'SAVING...' : 'SAVE DEFINITION'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
