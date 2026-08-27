import { PlayerState, PlayerCurrency, SystemEvent } from '../types';

/**
 * Authoritative reader for player coins.
 * Reads player.currency.coins, with robust fallbacks to preserve existing balances without resetting.
 * Guaranteed to return a non-negative integer.
 */
export function getPlayerCoins(player: Partial<PlayerState> | null | undefined): number {
  if (!player) return 0;

  // 1. Primary authoritative location
  if (player.currency && typeof player.currency.coins === 'number' && !isNaN(player.currency.coins)) {
    return Math.max(0, Math.floor(player.currency.coins));
  }
  if (player.currency && (player.currency as any).Coins !== undefined) {
    const parsed = parseInt(String((player.currency as any).Coins), 10);
    if (!isNaN(parsed)) return Math.max(0, parsed);
  }

  // 2. Direct convenience field
  if (typeof player.coins === 'number' && !isNaN(player.coins)) {
    return Math.max(0, Math.floor(player.coins));
  }

  // 3. Fallback to systemVariables.coins (for backward compatibility)
  if (player.systemVariables && player.systemVariables.coins !== undefined) {
    const num = typeof player.systemVariables.coins === 'number'
      ? player.systemVariables.coins
      : parseInt(String(player.systemVariables.coins), 10);
    if (!isNaN(num)) return Math.max(0, Math.floor(num));
  }
  if (player.systemVariables && (player.systemVariables as any).Coins !== undefined) {
    const num = parseInt(String((player.systemVariables as any).Coins), 10);
    if (!isNaN(num)) return Math.max(0, Math.floor(num));
  }

  // 4. Fallback to worldState.coins
  if (player.worldState && player.worldState.coins !== undefined) {
    const num = typeof player.worldState.coins === 'number'
      ? player.worldState.coins
      : parseInt(String(player.worldState.coins), 10);
    if (!isNaN(num)) return Math.max(0, Math.floor(num));
  }

  return 0;
}

/**
 * Authoritative setter for player coins.
 * Sets player.currency.coins and keeps convenience mirrors aligned.
 */
export function setPlayerCoins(player: PlayerState, newCoins: number): PlayerState {
  const safeCoins = Math.max(0, Math.floor(isNaN(newCoins) ? 0 : newCoins));
  const updatedCurrency: PlayerCurrency = {
    ...(player.currency || {}),
    coins: safeCoins,
  };

  const updatedSystemVars = { ...(player.systemVariables || {}), coins: safeCoins };

  return {
    ...player,
    currency: updatedCurrency,
    coins: safeCoins,
    systemVariables: updatedSystemVars,
  };
}

/**
 * Universal Central Currency Transaction Engine.
 * All coin changes (Rewards, Penalties, Shop, Loot, Custom) MUST execute through this central mechanism.
 * 
 * Rules:
 * - Pure immutable operation on PlayerState.
 * - Negative changes are clamped at 0 (never negative balance).
 * - Records applied delta and previous/new balances.
 */
export function transactPlayerCurrency(
  player: PlayerState,
  delta: number,
  options: {
    reason?: string;
    source?: string;
    type?: string;
  } = {}
): {
  updatedPlayer: PlayerState;
  newCoins: number;
  previousCoins: number;
  appliedDelta: number;
} {
  const previousCoins = getPlayerCoins(player);
  const safeDelta = Math.floor(isNaN(delta) ? 0 : delta);
  const newCoins = Math.max(0, previousCoins + safeDelta);
  const appliedDelta = newCoins - previousCoins;

  const updatedPlayer = setPlayerCoins(player, newCoins);

  return {
    updatedPlayer,
    newCoins,
    previousCoins,
    appliedDelta,
  };
}

/**
 * Formats the standard Currency text block for Context and Prompt outputs.
 */
export function formatCurrencyContextBlock(coins: number): string {
  return `Coins: ${coins}`;
}
