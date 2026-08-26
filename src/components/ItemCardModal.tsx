import React from 'react';
import { ItemDefinition, InventoryItem } from '../types';
import {
  X,
  Package,
  Sparkles,
  Shield,
  Key,
  Layers,
  DollarSign,
  Zap,
  Info,
  Clock,
  Edit3,
  Plus,
  Lock,
  Unlock,
  Check,
  AlertCircle,
} from 'lucide-react';
import { normalizeItemName, getItemQuantity } from '../services/inventoryManager';

interface ItemCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: string | InventoryItem | null;
  definition?: ItemDefinition | null;
  itemInformationSystemEnabled?: boolean;
  onEditDefinition?: (def: ItemDefinition) => void;
  onCreateDefinition?: (itemName: string) => void;
  onUseItem?: (itemName: string) => void;
  isUsing?: boolean;
}

export const ItemCardModal: React.FC<ItemCardModalProps> = ({
  isOpen,
  onClose,
  item,
  definition,
  itemInformationSystemEnabled = true,
  onEditDefinition,
  onCreateDefinition,
  onUseItem,
  isUsing = false,
}) => {
  if (!isOpen || !item) return null;

  const rawName = typeof item === 'string' ? item : item.name;
  const cleanName = normalizeItemName(rawName);
  const qty = getItemQuantity(item);
  const hasDefinition = Boolean(definition && definition.itemName);
  const isEnabled = definition ? definition.enabled !== false : true;

  const icon = definition?.icon || (typeof item === 'object' && item.icon) || '📦';
  const rank = definition?.rank || (typeof item === 'object' ? item.rank : undefined);
  const rarity = definition?.rarity || (typeof item === 'object' ? item.rarity : undefined) || 'Common';
  const type = definition?.type || (typeof item === 'object' ? item.type : undefined) || 'Miscellaneous';
  const desc = definition?.description || (typeof item === 'object' ? item.description : undefined);
  const usage = definition?.usage || (typeof item === 'object' ? item.usage : undefined);
  const effects = definition?.effects || (typeof item === 'object' ? item.effects : undefined);
  const requirements = definition?.requirements || (typeof item === 'object' ? item.requirements : undefined);
  const reqKey = definition?.keyType || (typeof item === 'object' ? item.requiresKey : undefined);
  const boxType = definition?.boxType;
  const sellValue = definition?.sellValue || (typeof item === 'object' ? item.sellValue : undefined);
  const buyValue = definition?.buyValue || (typeof item === 'object' ? item.buyValue : undefined);
  const crafting = definition?.craftingInformation;
  const specialProps = definition?.specialProperties;
  const notes = definition?.notes;
  const maxStack = definition?.maximumStack || 99;
  const version = definition?.definitionVersion || 1;

  // Rarity color mappings
  let rarityBadgeColor = 'text-slate-300 border-slate-700 bg-slate-900/60';
  const rLower = (rarity || '').toLowerCase();
  if (rLower === 'uncommon') {
    rarityBadgeColor = 'text-emerald-300 border-emerald-500/40 bg-emerald-950/30';
  } else if (rLower === 'rare') {
    rarityBadgeColor = 'text-cyan-300 border-cyan-500/40 bg-cyan-950/30';
  } else if (rLower === 'epic') {
    rarityBadgeColor = 'text-purple-300 border-purple-500/40 bg-purple-950/30';
  } else if (rLower === 'legendary') {
    rarityBadgeColor = 'text-amber-300 border-amber-500/40 bg-amber-950/30';
  } else if (rLower === 'mythic' || rLower === 'unique') {
    rarityBadgeColor = 'text-rose-300 border-rose-500/40 bg-rose-950/30';
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 font-mono">
      <div className="relative w-full max-w-lg bg-[#090e17] border border-[#1a2b3c] shadow-2xl text-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top Header */}
        <div className="p-4 bg-[#05070a] border-b border-[#1a2b3c] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{icon}</span>
            <div>
              <span className="text-[9px] text-[#00f2ff] uppercase tracking-[0.2em] font-bold block">
                ITEM INFORMATION CARD
              </span>
              <h2 className="text-base font-bold text-slate-100 uppercase tracking-wider truncate max-w-[280px] sm:max-w-md">
                {definition?.itemName || cleanName}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {/* Main Attributes Row */}
          <div className="flex flex-wrap items-center gap-2">
            {rank && (
              <span className="px-2 py-0.5 font-bold text-amber-300 border border-amber-500/50 bg-amber-950/40 text-[10px] uppercase">
                RANK {rank}
              </span>
            )}
            <span className={`px-2 py-0.5 font-bold border text-[10px] uppercase ${rarityBadgeColor}`}>
              {rarity}
            </span>
            <span className="px-2 py-0.5 text-slate-300 border border-slate-700 bg-slate-900/60 text-[10px] uppercase">
              {type}
            </span>
            {qty > 0 && (
              <span className="px-2 py-0.5 text-[#00f2ff] border border-[#00f2ff]/40 bg-[#00f2ff]/10 text-[10px] font-bold">
                HELD: ×{qty} / {maxStack}
              </span>
            )}
            {hasDefinition && (
              <span className="ml-auto text-[9px] text-slate-500 font-mono">
                v{version} {isEnabled ? '(Active)' : '(Disabled)'}
              </span>
            )}
          </div>

          {/* Item Definition status note */}
          {!hasDefinition && (
            <div className="p-3 bg-[#05070a] border border-amber-500/30 text-amber-300/90 text-[11px] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">No Explicit Definition in Database</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Properties are shown strictly as parsed without fabrication. You can register a persistent definition below.
                </span>
              </div>
            </div>
          )}

          {/* Description */}
          {desc ? (
            <div className="p-3 bg-[#05070a] border border-[#1a2b3c]">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                DESCRIPTION
              </span>
              <p className="text-slate-200 text-xs leading-relaxed">{desc}</p>
            </div>
          ) : (
            <div className="p-2.5 bg-[#05070a] border border-[#1a2b3c] text-slate-500 italic text-[11px]">
              No description explicitly provided by the System.
            </div>
          )}

          {/* Usage & Effects */}
          {(usage || effects) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {usage && (
                <div className="p-3 bg-[#05070a] border border-[#1a2b3c]">
                  <span className="text-[10px] font-bold text-[#00f2ff] uppercase tracking-wider block mb-1">
                    USAGE
                  </span>
                  <p className="text-slate-200 text-xs">{usage}</p>
                </div>
              )}
              {effects && (
                <div className="p-3 bg-[#05070a] border border-[#1a2b3c]">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">
                    EFFECTS &amp; BUFFS
                  </span>
                  <p className="text-slate-200 text-xs">{effects}</p>
                </div>
              )}
            </div>
          )}

          {/* Key requirements / Container info */}
          {(reqKey || boxType || requirements) && (
            <div className="p-3 bg-[#05070a] border border-[#1a2b3c] space-y-1.5 text-[11px]">
              {requirements && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">REQUIREMENTS:</span>
                  <span className="text-slate-200 font-bold">{requirements}</span>
                </div>
              )}
              {reqKey && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">KEY REQUIRED:</span>
                  <span className="text-amber-400 font-bold">{reqKey}</span>
                </div>
              )}
              {boxType && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">CONTAINER TYPE:</span>
                  <span className="text-[#00f2ff] font-bold">{boxType}</span>
                </div>
              )}
            </div>
          )}

          {/* Economy & Crafting */}
          {(sellValue || buyValue || crafting) && (
            <div className="p-3 bg-[#05070a] border border-[#1a2b3c] space-y-1.5 text-[11px]">
              {sellValue && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">SELL VALUE:</span>
                  <span className="text-emerald-400 font-bold">{sellValue}</span>
                </div>
              )}
              {buyValue && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">BUY VALUE:</span>
                  <span className="text-amber-400 font-bold">{buyValue}</span>
                </div>
              )}
              {crafting && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">CRAFTING RECIPE:</span>
                  <span className="text-slate-200 font-bold">{crafting}</span>
                </div>
              )}
            </div>
          )}

          {/* Special Properties / Notes */}
          {(specialProps || notes) && (
            <div className="p-3 bg-[#05070a] border border-[#1a2b3c] space-y-1 text-[11px]">
              {specialProps && (
                <p className="text-purple-300">
                  <span className="text-slate-400 font-bold">SPECIAL: </span>
                  {specialProps}
                </p>
              )}
              {notes && (
                <p className="text-slate-400">
                  <span className="text-slate-500 font-bold">NOTES: </span>
                  {notes}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Action Footer */}
        <div className="p-4 bg-[#05070a] border-t border-[#1a2b3c] flex flex-wrap items-center justify-between gap-2.5">
          <div>
            {hasDefinition && onEditDefinition ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditDefinition(definition);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-[#1a2b3c] hover:border-[#00f2ff]/40 bg-[#0a0f16] text-[#00f2ff] text-xs font-bold uppercase tracking-wider transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>EDIT DEFINITION</span>
              </button>
            ) : onCreateDefinition ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onCreateDefinition(cleanName);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-[#00f2ff]/50 hover:border-[#00f2ff] bg-[#00f2ff]/10 text-[#00f2ff] text-xs font-bold uppercase tracking-wider transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>CREATE DEFINITION</span>
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {onUseItem && qty > 0 && (
              <button
                type="button"
                onClick={() => onUseItem(cleanName)}
                disabled={isUsing}
                className="px-4 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500 text-emerald-300 font-bold text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
              >
                {isUsing ? 'PROCESSING...' : 'USE ITEM'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 border border-slate-700 hover:border-slate-500 text-slate-300 font-bold text-xs uppercase tracking-wider transition-colors"
            >
              CLOSE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
