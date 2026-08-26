import { PlayerState, PlayerProgression, InventoryItem, SystemEvent, ItemDefinition } from '../types';

export type InventoryTransactionType =
  | 'SELL'
  | 'USE'
  | 'CONSUME'
  | 'OPEN'
  | 'BREAK'
  | 'CRAFT'
  | 'DISMANTLE'
  | 'TRADE'
  | 'EQUIP'
  | 'DROP'
  | 'GIVE'
  | 'DELETE'
  | 'REMOVE'
  | 'ADD'
  | 'TRANSFER';

export interface InventoryTransaction {
  transactionId?: string;
  type: InventoryTransactionType;
  itemId?: string;
  itemName: string;
  quantity?: number; // default 1
  coinDelta?: number; // e.g. +50 for sell, -100 for buy/craft
  statChanges?: Record<string, number>;
  xpDelta?: number;
  keyRequired?: string;
  suppliedReward?: SuppliedLootReward;
  destination?: string;
  reason?: string;
  metadata?: Record<string, any>;
}

export interface InventoryTransactionResult {
  success: boolean;
  error?: string;
  transactionId: string;
  type: InventoryTransactionType;
  updatedPlayer?: PlayerState;
  systemEvent?: SystemEvent;
  itemName: string;
  previousQuantity: number;
  remainingQuantity: number;
  quantityChanged: number;
  coinDelta?: number;
  itemRemovedCompletely: boolean;
  rewardSummary?: string;
}

export interface SuppliedLootReward {
  xpReward?: number;
  coinsReward?: number;
  itemsReward?: (string | InventoryItem)[];
  statsReward?: Record<string, number>;
  description?: string;
}

export interface ConsumeItemResult {
  success: boolean;
  error?: string;
  updatedPlayer?: PlayerState;
  systemEvent?: SystemEvent;
  consumedItem?: InventoryItem;
  remainingQuantity: number;
  previousQuantity: number;
  itemRemovedCompletely?: boolean;
}

export interface LootBoxTransactionResult {
  success: boolean;
  error?: string;
  updatedPlayer?: PlayerState;
  systemEvent?: SystemEvent;
  consumedBox?: InventoryItem;
  consumedKey?: InventoryItem;
  rewardSummary?: string;
  boxRemainingQuantity?: number;
  keyRemainingQuantity?: number;
  boxRemovedCompletely?: boolean;
}

// In-memory idempotency cache for duplicate transaction prevention
const executedTransactionIds = new Set<string>();

/**
 * Generates a unique transaction identifier
 */
export function generateTransactionId(prefix: string = 'tx'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Checks if a transaction has already been executed
 */
export function isTransactionExecuted(txId: string): boolean {
  if (!txId) return false;
  return executedTransactionIds.has(txId);
}

/**
 * Registers a transaction as executed
 */
export function recordTransactionExecuted(txId: string): void {
  if (txId) {
    executedTransactionIds.add(txId);
    // Keep set bounded to prevent memory leaks in long sessions
    if (executedTransactionIds.size > 2000) {
      const firstEntries = Array.from(executedTransactionIds).slice(0, 500);
      for (const id of firstEntries) {
        executedTransactionIds.delete(id);
      }
    }
  }
}

/**
 * Normalizes an item name for case-insensitive and clean comparison
 */
export function normalizeItemName(name: string | InventoryItem | null | undefined): string {
  if (!name) return '';
  const raw = typeof name === 'string' ? name : name.name;
  if (!raw) return '';
  return raw
    .replace(/[🎁🔒🗝️🗡️🛡️🧪📜📦🪙💎✨]/g, '') // remove common emoji prefixes
    .replace(/\s*[×x*]\s*\d+/gi, '') // remove trailing x1, ×5, *2
    .replace(/\s*\(\s*x?\d+\s*\)/gi, '') // remove trailing (x1)
    .replace(/^[-•*#]+\s*/, '') // remove markdown bullets
    .trim();
}

/**
 * Extracts the numerical quantity of an item
 */
export function getItemQuantity(item: string | InventoryItem | null | undefined): number {
  if (!item) return 0;
  if (typeof item === 'object' && item !== null) {
    if (typeof item.quantity === 'number' && !isNaN(item.quantity)) {
      return Math.max(0, item.quantity);
    }
    return 1;
  }
  if (typeof item === 'string') {
    const qtyMatch = item.match(/[x×*]\s*(\d+)/i) || item.match(/\((\d+)\)/);
    if (qtyMatch) {
      const q = parseInt(qtyMatch[1], 10);
      return !isNaN(q) && q > 0 ? q : 1;
    }
    return 1;
  }
  return 0;
}

/**
 * Detects if an item is a loot box / container
 */
export function isLootBox(item: string | InventoryItem | null | undefined): boolean {
  if (!item) return false;
  const name = typeof item === 'string' ? item : item.name;
  if (!name) return false;
  const lower = name.toLowerCase();
  return (
    lower.includes('loot box') ||
    lower.includes('lootbox') ||
    lower.includes('chest') ||
    lower.includes('crate') ||
    lower.includes('cache') ||
    lower.includes('container') ||
    lower.includes('package') ||
    lower.includes('box')
  );
}

/**
 * Extracts required key from item structure or name conventions
 */
export function getRequiredKeyName(item: string | InventoryItem | null | undefined): string | null {
  if (!item) return null;
  if (typeof item === 'object' && item !== null) {
    if (item.requiresKey) {
      return item.requiresKey.trim();
    }
  }

  const name = typeof item === 'string' ? item : item.name;
  if (!name) return null;
  const lower = name.toLowerCase();

  if (lower.includes('locked steel') || lower.includes('steel chest')) {
    return 'Steel Key';
  }
  if (lower.includes('golden chest') || lower.includes('locked gold')) {
    return 'Golden Key';
  }
  if (lower.includes('dungeon chest') || lower.includes('locked dungeon')) {
    return 'Dungeon Key';
  }
  if (lower.includes('boss chest') || lower.includes('locked boss')) {
    return 'Boss Key';
  }

  return null;
}

/**
 * Finds a matching key in inventory
 */
export function findMatchingKey(
  inventory: (string | InventoryItem)[],
  requiredKeyName: string
): { item: string | InventoryItem; index: number } | null {
  if (!inventory || !Array.isArray(inventory)) return null;

  const targetClean = normalizeItemName(requiredKeyName).toLowerCase();
  if (!targetClean) return null;

  for (let i = 0; i < inventory.length; i++) {
    const item = inventory[i];
    const qty = getItemQuantity(item);
    if (qty <= 0) continue;

    const itemClean = normalizeItemName(item).toLowerCase();
    if (itemClean === targetClean || itemClean.includes(targetClean) || targetClean.includes(itemClean)) {
      return { item, index: i };
    }
  }

  return null;
}

/**
 * Cleans an inventory array by:
 * 1. Removing any entries with quantity <= 0.
 * 2. Merging duplicate entries with identical normalized names.
 * 3. Formatting items consistently.
 */
export function sanitizeInventory(inventory: (string | InventoryItem)[]): InventoryItem[] {
  if (!Array.isArray(inventory)) return [];

  const map = new Map<string, InventoryItem>();

  for (const item of inventory) {
    if (!item) continue;
    const cleanName = normalizeItemName(item);
    if (!cleanName) continue;

    const qty = getItemQuantity(item);
    if (qty <= 0) continue; // Purge zero or negative quantities completely

    const key = cleanName.toLowerCase();
    const existing = map.get(key);

    if (existing) {
      existing.quantity = (existing.quantity || 1) + qty;
    } else {
      if (typeof item === 'object') {
        map.set(key, {
          ...item,
          name: cleanName,
          quantity: qty,
        });
      } else {
        map.set(key, {
          name: cleanName,
          quantity: qty,
        });
      }
    }
  }

  return Array.from(map.values()).filter((item) => (item.quantity ?? 1) > 0);
}

/**
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * CENTRAL INVENTORY TRANSACTION ENGINE
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * Executes an atomic inventory transaction on the central Player State.
 * 
 * Pipeline:
 * 1. VALIDATE & IDEMPOTENCY CHECK
 * 2. CHECK ITEM EXISTS IN INVENTORY
 * 3. CHECK QUANTITY
 * 4. CALCULATE RESULT & DEDUCT / REMOVE ITEM (Zero quantity -> Complete Entry Removal)
 * 5. APPLY ASSOCIATED RESULTS (Coins, XP, Attributes, Materials) ATOMICALLY
 * 6. SAVE STATE & INCREMENT STATE VERSION
 * 7. CREATE SYSTEM AUDIT EVENT
 * 8. RETURN RESULT
 */
export function executeInventoryTransaction(
  currentState: PlayerState,
  transaction: InventoryTransaction
): InventoryTransactionResult {
  const txId = transaction.transactionId || generateTransactionId(`tx_${transaction.type.toLowerCase()}`);

  if (!currentState) {
    return {
      success: false,
      error: 'Player state is undefined.',
      transactionId: txId,
      type: transaction.type,
      itemName: transaction.itemName || '',
      previousQuantity: 0,
      remainingQuantity: 0,
      quantityChanged: 0,
      itemRemovedCompletely: false,
    };
  }

  // Idempotency check: prevent duplicate execution
  if (isTransactionExecuted(txId)) {
    console.warn(`[INVENTORY] Transaction ${txId} was already executed. Skipping duplicate.`);
    return {
      success: false,
      error: `Transaction ${txId} was already processed. Duplicate execution prevented.`,
      transactionId: txId,
      type: transaction.type,
      itemName: transaction.itemName || '',
      previousQuantity: 0,
      remainingQuantity: 0,
      quantityChanged: 0,
      itemRemovedCompletely: false,
    };
  }

  const cleanTargetName = normalizeItemName(transaction.itemName || transaction.itemId || '');
  if (!cleanTargetName) {
    return {
      success: false,
      error: 'No valid item name provided for transaction.',
      transactionId: txId,
      type: transaction.type,
      itemName: '',
      previousQuantity: 0,
      remainingQuantity: 0,
      quantityChanged: 0,
      itemRemovedCompletely: false,
    };
  }

  const requestedQty = Math.max(1, transaction.quantity ?? 1);
  const currentInventory = sanitizeInventory(currentState.inventory || []);

  // Locate the item in inventory
  const foundIndex = currentInventory.findIndex((i) => {
    const clean = normalizeItemName(i).toLowerCase();
    const target = cleanTargetName.toLowerCase();
    return clean === target || clean.includes(target) || target.includes(clean);
  });

  const isRemovalOp = [
    'SELL',
    'USE',
    'CONSUME',
    'OPEN',
    'BREAK',
    'DISMANTLE',
    'TRADE',
    'EQUIP',
    'DROP',
    'GIVE',
    'DELETE',
    'REMOVE',
    'TRANSFER',
  ].includes(transaction.type);

  // For removal operations, the item MUST exist in sufficient quantity
  if (isRemovalOp) {
    if (foundIndex === -1) {
      return {
        success: false,
        error: `Item "${cleanTargetName}" is not present in inventory.`,
        transactionId: txId,
        type: transaction.type,
        itemName: cleanTargetName,
        previousQuantity: 0,
        remainingQuantity: 0,
        quantityChanged: 0,
        itemRemovedCompletely: false,
      };
    }

    const currentItem = currentInventory[foundIndex];
    const currentQty = getItemQuantity(currentItem);

    if (currentQty < requestedQty) {
      return {
        success: false,
        error: `Insufficient quantity of "${cleanTargetName}" in inventory (Held: ${currentQty}, Required: ${requestedQty}).`,
        transactionId: txId,
        type: transaction.type,
        itemName: cleanTargetName,
        previousQuantity: currentQty,
        remainingQuantity: currentQty,
        quantityChanged: 0,
        itemRemovedCompletely: false,
      };
    }

    // Key check for OPEN / Loot Box if required
    let consumedKeyName: string | null = null;
    let keyIndex = -1;
    if (transaction.type === 'OPEN' || isLootBox(currentItem)) {
      const reqKey = transaction.keyRequired || getRequiredKeyName(currentItem);
      if (reqKey) {
        const keyMatch = findMatchingKey(currentInventory, reqKey);
        if (!keyMatch) {
          return {
            success: false,
            error: `Cannot open "${cleanTargetName}". Required key "${reqKey}" is missing from inventory.`,
            transactionId: txId,
            type: transaction.type,
            itemName: cleanTargetName,
            previousQuantity: currentQty,
            remainingQuantity: currentQty,
            quantityChanged: 0,
            itemRemovedCompletely: false,
          };
        }
        consumedKeyName = normalizeItemName(keyMatch.item);
        keyIndex = keyMatch.index;
      }
    }

    // Apply removal to working inventory
    const workingInventory = [...currentInventory];
    const newQty = currentQty - requestedQty;
    const itemRemovedCompletely = newQty <= 0;

    if (itemRemovedCompletely) {
      workingInventory.splice(foundIndex, 1);
    } else {
      workingInventory[foundIndex] = {
        ...currentItem,
        quantity: newQty,
      };
    }

    // If a key was consumed, decrement/remove it
    if (consumedKeyName && keyIndex >= 0) {
      const keyItemIdx = workingInventory.findIndex(
        (i) => normalizeItemName(i).toLowerCase() === consumedKeyName!.toLowerCase()
      );
      if (keyItemIdx >= 0) {
        const keyItem = workingInventory[keyItemIdx];
        const keyQty = getItemQuantity(keyItem);
        if (keyQty <= 1) {
          workingInventory.splice(keyItemIdx, 1);
        } else {
          workingInventory[keyItemIdx] = {
            ...keyItem,
            quantity: keyQty - 1,
          };
        }
      }
    }

    // Apply associated economy & stat results atomically
    let updatedSystemVars = { ...(currentState.systemVariables || {}) };
    let updatedAttributes = { ...(currentState.attributes || {}) };
    let updatedProgression: PlayerProgression = {
      level: currentState.level || currentState.progression?.level || 1,
      xp: currentState.xp || currentState.progression?.xp || 0,
      ...(currentState.progression || {}),
    };
    let updatedXp = currentState.xp;

    // Coins / Gold
    let appliedCoinDelta = 0;
    if (transaction.coinDelta !== undefined && transaction.coinDelta !== 0) {
      const currentCoins = typeof updatedSystemVars.coins === 'number'
        ? updatedSystemVars.coins
        : parseFloat(String(updatedSystemVars.coins || 0)) || 0;
      const newCoins = Math.max(0, currentCoins + transaction.coinDelta);
      updatedSystemVars.coins = newCoins;
      appliedCoinDelta = transaction.coinDelta;
    }

    // XP Delta
    if (transaction.xpDelta !== undefined && transaction.xpDelta !== 0) {
      const currentXpNum = typeof currentState.xp === 'number'
        ? currentState.xp
        : parseFloat(String(currentState.xp)) || 0;
      const newXp = Math.max(0, currentXpNum + transaction.xpDelta);
      updatedXp = String(newXp);
      updatedProgression.currentXP = newXp;
    }

    // Stat changes
    if (transaction.statChanges) {
      for (const [stat, delta] of Object.entries(transaction.statChanges)) {
        const cur = typeof updatedAttributes[stat] === 'number' ? updatedAttributes[stat] : parseFloat(String(updatedAttributes[stat] || 0)) || 0;
        updatedAttributes[stat] = cur + delta;
      }
    }

    // Supplied rewards (e.g. from Loot Box or Dismantle)
    let rewardDesc = '';
    if (transaction.suppliedReward) {
      if (transaction.suppliedReward.coinsReward && transaction.suppliedReward.coinsReward > 0) {
        const currentCoins = typeof updatedSystemVars.coins === 'number'
          ? updatedSystemVars.coins
          : parseFloat(String(updatedSystemVars.coins || 0)) || 0;
        updatedSystemVars.coins = currentCoins + transaction.suppliedReward.coinsReward;
        appliedCoinDelta += transaction.suppliedReward.coinsReward;
      }
      if (transaction.suppliedReward.xpReward && transaction.suppliedReward.xpReward > 0) {
        const currentXpNum = typeof updatedXp === 'number' ? updatedXp : parseFloat(String(updatedXp)) || 0;
        const newXp = currentXpNum + transaction.suppliedReward.xpReward;
        updatedXp = String(newXp);
        updatedProgression.currentXP = newXp;
      }
      if (transaction.suppliedReward.statsReward) {
        for (const [stat, val] of Object.entries(transaction.suppliedReward.statsReward)) {
          const cur = typeof updatedAttributes[stat] === 'number' ? updatedAttributes[stat] : parseFloat(String(updatedAttributes[stat] || 0)) || 0;
          updatedAttributes[stat] = cur + val;
        }
      }
      if (transaction.suppliedReward.itemsReward && Array.isArray(transaction.suppliedReward.itemsReward)) {
        for (const newItem of transaction.suppliedReward.itemsReward) {
          const cName = normalizeItemName(newItem);
          const qAdd = getItemQuantity(newItem) || 1;
          const existIdx = workingInventory.findIndex((i) => normalizeItemName(i).toLowerCase() === cName.toLowerCase());
          if (existIdx >= 0) {
            const exItem = workingInventory[existIdx];
            workingInventory[existIdx] = {
              ...exItem,
              quantity: (exItem.quantity || 1) + qAdd,
            };
          } else {
            workingInventory.push({ name: cName, quantity: qAdd });
          }
        }
      }
      rewardDesc = transaction.suppliedReward.description || '';
    }

    // Construct updated PlayerState
    const nextVersion = (currentState.stateVersion ?? 0) + 1;
    const now = new Date();
    const nowIso = now.toISOString();

    const updatedPlayer: PlayerState = {
      ...currentState,
      inventory: sanitizeInventory(workingInventory),
      systemVariables: updatedSystemVars,
      attributes: updatedAttributes,
      progression: updatedProgression,
      xp: updatedXp,
      stateVersion: nextVersion,
    };

    // Format human-readable event log
    let opVerb = 'Removed';
    let opIcon = '📦';
    if (transaction.type === 'SELL') {
      opVerb = 'Sold';
      opIcon = '🪙';
    } else if (transaction.type === 'USE' || transaction.type === 'CONSUME') {
      opVerb = 'Consumed';
      opIcon = '🧪';
    } else if (transaction.type === 'BREAK') {
      opVerb = 'Broke';
      opIcon = '💥';
    } else if (transaction.type === 'OPEN') {
      opVerb = 'Opened';
      opIcon = '🎁';
    } else if (transaction.type === 'DISMANTLE') {
      opVerb = 'Dismantled';
      opIcon = '⚙️';
    } else if (transaction.type === 'DROP') {
      opVerb = 'Dropped';
      opIcon = '🗑️';
    }

    const coinStr = appliedCoinDelta > 0 ? ` (+${appliedCoinDelta} Coins)` : (appliedCoinDelta < 0 ? ` (${appliedCoinDelta} Coins)` : '');
    const rewardStr = rewardDesc ? ` | Result: ${rewardDesc}` : '';
    const remStr = itemRemovedCompletely ? ' (Removed completely from inventory)' : ` (Remaining: ×${newQty})`;

    const systemEvent: SystemEvent = {
      id: `evt_inv_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: nowIso,
      formattedDate: now.toLocaleString(),
      source: 'SYSTEM CORE // INVENTORY ENGINE',
      type: `item_${transaction.type.toLowerCase()}`,
      category: 'inventory',
      rawMessage: [
        `[ITEM ${transaction.type}] ${cleanTargetName} ×${requestedQty}${coinStr}`,
        `Status: ${opVerb} ${cleanTargetName} ×${requestedQty}${remStr}`,
        ...(consumedKeyName ? [`[KEY CONSUMED] ${consumedKeyName} ×1`] : []),
        ...(rewardDesc ? [`Result: ${rewardDesc}`] : []),
        ...(transaction.reason ? [`Reason: ${transaction.reason}`] : []),
        `State Version: v${nextVersion}`,
      ].join('\n'),
      summary: `${opIcon} ${opVerb} ${cleanTargetName} ×${requestedQty}${coinStr}${remStr}${rewardStr}`,
      read: true,
      processed: true,
      processedAt: nowIso,
      stateChangesApplied: true,
    };

    recordTransactionExecuted(txId);

    return {
      success: true,
      transactionId: txId,
      type: transaction.type,
      updatedPlayer,
      systemEvent,
      itemName: cleanTargetName,
      previousQuantity: currentQty,
      remainingQuantity: newQty,
      quantityChanged: requestedQty,
      coinDelta: appliedCoinDelta !== 0 ? appliedCoinDelta : undefined,
      itemRemovedCompletely,
      rewardSummary: rewardDesc || undefined,
    };
  }

  // ADDITION OPERATION (ADD / CRAFT / ACQUIRE)
  const workingInventory = [...currentInventory];
  const existingIdx = workingInventory.findIndex(
    (i) => normalizeItemName(i).toLowerCase() === cleanTargetName.toLowerCase()
  );

  let prevQty = 0;
  let newQty = requestedQty;

  if (existingIdx >= 0) {
    const exist = workingInventory[existingIdx];
    prevQty = getItemQuantity(exist);
    newQty = prevQty + requestedQty;
    workingInventory[existingIdx] = {
      ...exist,
      name: cleanTargetName,
      quantity: newQty,
    };
  } else {
    workingInventory.push({
      name: cleanTargetName,
      quantity: requestedQty,
    });
  }

  let updatedSystemVars = { ...(currentState.systemVariables || {}) };
  if (transaction.coinDelta !== undefined && transaction.coinDelta !== 0) {
    const currentCoins = typeof updatedSystemVars.coins === 'number'
      ? updatedSystemVars.coins
      : parseFloat(String(updatedSystemVars.coins || 0)) || 0;
    updatedSystemVars.coins = Math.max(0, currentCoins + transaction.coinDelta);
  }

  const nextVersion = (currentState.stateVersion ?? 0) + 1;
  const now = new Date();
  const nowIso = now.toISOString();

  const updatedPlayer: PlayerState = {
    ...currentState,
    inventory: sanitizeInventory(workingInventory),
    systemVariables: updatedSystemVars,
    stateVersion: nextVersion,
  };

  const systemEvent: SystemEvent = {
    id: `evt_inv_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
    timestamp: nowIso,
    formattedDate: now.toLocaleString(),
    source: 'SYSTEM CORE // INVENTORY ENGINE',
    type: 'item_acquired',
    category: 'inventory',
    rawMessage: `[ITEM ACQUIRED] ${cleanTargetName} ×${requestedQty} (Total: ×${newQty})\nState Version: v${nextVersion}`,
    summary: `✨ Acquired ${cleanTargetName} ×${requestedQty} (Total: ×${newQty})`,
    read: true,
    processed: true,
    processedAt: nowIso,
    stateChangesApplied: true,
  };

  recordTransactionExecuted(txId);

  return {
    success: true,
    transactionId: txId,
    type: transaction.type,
    updatedPlayer,
    systemEvent,
    itemName: cleanTargetName,
    previousQuantity: prevQty,
    remainingQuantity: newQty,
    quantityChanged: requestedQty,
    coinDelta: transaction.coinDelta,
    itemRemovedCompletely: false,
  };
}

/**
 * Universal helper: Removes or decreases an inventory item in Player State
 */
export function removeInventoryItem(
  currentState: PlayerState,
  itemIdentifier: string | InventoryItem,
  quantity: number = 1,
  reason: string = 'Item removed'
): InventoryTransactionResult {
  const name = normalizeItemName(itemIdentifier);
  return executeInventoryTransaction(currentState, {
    type: 'REMOVE',
    itemName: name,
    quantity,
    reason,
  });
}

/**
 * Universal helper: Adds an item to Player State
 */
export function addInventoryItem(
  currentState: PlayerState,
  itemIdentifier: string | InventoryItem,
  quantity: number = 1,
  itemData?: Partial<InventoryItem>
): InventoryTransactionResult {
  const name = normalizeItemName(itemIdentifier);
  return executeInventoryTransaction(currentState, {
    type: 'ADD',
    itemName: name,
    quantity,
    metadata: itemData,
  });
}

/**
 * Universal helper: Consumes or uses an item in Player State
 */
export function consumeInventoryItem(
  currentState: PlayerState,
  itemIdentifier: string | InventoryItem,
  quantity: number = 1
): ConsumeItemResult {
  const name = normalizeItemName(itemIdentifier);
  const result = executeInventoryTransaction(currentState, {
    type: 'CONSUME',
    itemName: name,
    quantity,
  });

  if (!result.success) {
    return {
      success: false,
      error: result.error,
      remainingQuantity: result.remainingQuantity,
      previousQuantity: result.previousQuantity,
    };
  }

  return {
    success: true,
    updatedPlayer: result.updatedPlayer,
    systemEvent: result.systemEvent,
    consumedItem: {
      name,
      quantity,
    },
    remainingQuantity: result.remainingQuantity,
    previousQuantity: result.previousQuantity,
    itemRemovedCompletely: result.itemRemovedCompletely,
  };
}

/**
 * Universal helper: Sells an item for coins/gold
 */
export function sellInventoryItem(
  currentState: PlayerState,
  itemIdentifier: string | InventoryItem,
  quantity: number = 1,
  coinValue: number = 0
): InventoryTransactionResult {
  const name = normalizeItemName(itemIdentifier);
  return executeInventoryTransaction(currentState, {
    type: 'SELL',
    itemName: name,
    quantity,
    coinDelta: Math.max(0, coinValue),
    reason: coinValue > 0 ? `Sold for ${coinValue} coins` : 'Sold item',
  });
}

/**
 * Universal helper: Breaks an item (durability loss / destruction in battle)
 */
export function breakInventoryItem(
  currentState: PlayerState,
  itemIdentifier: string | InventoryItem,
  quantity: number = 1
): InventoryTransactionResult {
  const name = normalizeItemName(itemIdentifier);
  return executeInventoryTransaction(currentState, {
    type: 'BREAK',
    itemName: name,
    quantity,
    reason: 'Item broke in battle / destroyed',
  });
}

/**
 * Universal helper: Transfers an item to a container / storage / party member
 */
export function transferInventoryItem(
  currentState: PlayerState,
  itemIdentifier: string | InventoryItem,
  quantity: number = 1,
  destination: string = 'Storage'
): InventoryTransactionResult {
  const name = normalizeItemName(itemIdentifier);
  return executeInventoryTransaction(currentState, {
    type: 'TRANSFER',
    itemName: name,
    quantity,
    destination,
    reason: `Transferred to ${destination}`,
  });
}

/**
 * Atomic Loot Box / Container transaction
 */
export function executeLootBoxTransaction(
  currentState: PlayerState,
  boxIdentifier: string | InventoryItem,
  keyIdentifier?: string,
  suppliedReward?: SuppliedLootReward
): LootBoxTransactionResult {
  const boxCleanName = normalizeItemName(boxIdentifier);
  const result = executeInventoryTransaction(currentState, {
    type: 'OPEN',
    itemName: boxCleanName,
    quantity: 1,
    keyRequired: keyIdentifier,
    suppliedReward,
  });

  if (!result.success) {
    return {
      success: false,
      error: result.error,
    };
  }

  return {
    success: true,
    updatedPlayer: result.updatedPlayer,
    systemEvent: result.systemEvent,
    consumedBox: { name: boxCleanName, quantity: 1 },
    rewardSummary: result.rewardSummary || 'Waiting for System Result',
    boxRemainingQuantity: result.remainingQuantity,
    boxRemovedCompletely: result.itemRemovedCompletely,
  };
}
