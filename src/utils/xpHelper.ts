import { PlayerState } from '../types';

export interface XpCalculationResult {
  currentXP: number;
  requiredXP: number | null;
  percentage: number; // 0 to 100
  percentageFormatted: string; // e.g. "40%", "73.33%"
  displayText: string; // e.g. "150 / 1500 XP", "600 / 1500 XP"
  ratioText: string; // e.g. "150 / 1500"
  hasRequirement: boolean;
}

/**
 * Parses numeric value safely from string or number
 */
export function parseXpNumber(val: any, fallback: number = 0): number {
  if (typeof val === 'number') {
    return isNaN(val) ? fallback : val;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    // If it's a ratio like "600 / 1500", match the leading numeric sequence
    const leadingMatch = trimmed.match(/^([+-]?\d+(?:\.\d+)?)/);
    if (leadingMatch) {
      const parsed = parseFloat(leadingMatch[1]);
      if (!isNaN(parsed)) return parsed;
    }
    const sanitized = trimmed.replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(sanitized);
    if (!isNaN(parsed)) return parsed;
  }
  return fallback;
}

/**
 * Pure formula function to calculate visual XP percentage:
 * xpPercentage = (currentXP / requiredXP) * 100
 * Clamped between 0 and 100.
 * 
 * Edge cases:
 * - currentXP <= 0 -> 0%
 * - currentXP >= requiredXP -> 100%
 * - requiredXP <= 0 -> 0% (division by zero avoided)
 */
export function computeXpPercentage(currentXP: number, requiredXP?: number | null): number {
  if (typeof currentXP !== 'number' || isNaN(currentXP) || currentXP <= 0) {
    return 0;
  }
  if (typeof requiredXP !== 'number' || isNaN(requiredXP) || requiredXP <= 0) {
    return 0;
  }
  if (currentXP >= requiredXP) {
    return 100;
  }
  const ratio = (currentXP / requiredXP) * 100;
  return Math.min(100, Math.max(0, ratio));
}

/**
 * Formats percentage number to clean string representation:
 * 10 -> "10%"
 * 40 -> "40%"
 * 73.333333 -> "73.33%"
 * 2.083333 -> "2.08%"
 * 45.833333 -> "45.83%"
 * 100 -> "100%"
 */
export function formatXpPercentage(percentage: number): string {
  if (typeof percentage !== 'number' || isNaN(percentage) || percentage <= 0) {
    return '0%';
  }
  if (percentage >= 100) {
    return '100%';
  }
  const rounded = Math.round(percentage * 100) / 100;
  if (Number.isInteger(rounded)) {
    return `${rounded}%`;
  }
  // Format with up to 2 decimal places, removing any trailing zero if clean
  return `${parseFloat(rounded.toFixed(2))}%`;
}

/**
 * Comprehensive extractor that inspects live PlayerState and computes
 * dynamic XP values, ratio string, percentage, and display strings.
 */
export function calculatePlayerXp(player?: Partial<PlayerState> | null): XpCalculationResult {
  if (!player) {
    return {
      currentXP: 0,
      requiredXP: null,
      percentage: 0,
      percentageFormatted: '0%',
      displayText: '0 XP',
      ratioText: '0',
      hasRequirement: false,
    };
  }

  let currentXP = 0;
  let requiredXP: number | null = null;
  const rawXp = player.xp;
  const progression: Record<string, any> = (player.progression as Record<string, any>) || {};

  // 1. Check if rawXp is a string ratio like "600 / 1500" or "600/1500" or "150 / 1500 XP"
  if (typeof rawXp === 'string' && rawXp.includes('/')) {
    const parts = rawXp.split('/');
    currentXP = parseXpNumber(parts[0], 0);
    const parsedReq = parseXpNumber(parts[1], 0);
    if (parsedReq > 0) {
      requiredXP = parsedReq;
    }
  } else if (rawXp !== undefined && rawXp !== null) {
    currentXP = parseXpNumber(rawXp, 0);
  }

  // 2. Check progression object for explicit currentXP / requiredXP / requiredXp / maxXp
  if (progression.currentXP !== undefined && progression.currentXP !== null) {
    currentXP = parseXpNumber(progression.currentXP, currentXP);
  }

  const explicitReq = progression.requiredXP ?? progression.requiredXp ?? progression.maxXp;
  if (explicitReq !== undefined && explicitReq !== null) {
    const parsedReq = parseXpNumber(explicitReq, 0);
    if (parsedReq > 0) {
      requiredXP = parsedReq;
    }
  }

  // Handle case where progression.xp is a ratio string
  if (typeof progression.xp === 'string' && progression.xp.includes('/')) {
    const parts = progression.xp.split('/');
    currentXP = parseXpNumber(parts[0], currentXP);
    const parsedReq = parseXpNumber(parts[1], 0);
    if (parsedReq > 0) {
      requiredXP = parsedReq;
    }
  }

  // Calculate percentage and formatted text
  const percentage = computeXpPercentage(currentXP, requiredXP);
  const percentageFormatted = formatXpPercentage(percentage);

  let displayText = '';
  let ratioText = '';

  if (requiredXP !== null && requiredXP > 0) {
    ratioText = `${currentXP} / ${requiredXP}`;
    displayText = `${currentXP} / ${requiredXP} XP`;
  } else {
    ratioText = `${currentXP}`;
    displayText = `${currentXP} XP`;
  }

  return {
    currentXP,
    requiredXP,
    percentage,
    percentageFormatted,
    displayText,
    ratioText,
    hasRequirement: requiredXP !== null && requiredXP > 0,
  };
}
