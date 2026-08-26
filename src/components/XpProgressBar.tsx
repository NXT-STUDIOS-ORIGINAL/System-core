import React, { useMemo } from 'react';
import { PlayerState } from '../types';
import { calculatePlayerXp, XpCalculationResult } from '../utils/xpHelper';

interface XpProgressBarProps {
  player?: Partial<PlayerState> | null;
  currentXP?: number;
  requiredXP?: number | null;
  showText?: boolean;
  showPercentageBadge?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const XpProgressBar: React.FC<XpProgressBarProps> = ({
  player,
  currentXP: propCurrentXP,
  requiredXP: propRequiredXP,
  showText = true,
  showPercentageBadge = true,
  size = 'md',
  className = '',
}) => {
  // If player object is passed, calculate from player. Otherwise calculate from explicit props.
  const xpData: XpCalculationResult = useMemo(() => {
    if (player) {
      return calculatePlayerXp(player);
    }
    const curr = propCurrentXP ?? 0;
    const req = propRequiredXP ?? null;
    return calculatePlayerXp({
      xp: req !== null && req > 0 ? `${curr} / ${req}` : String(curr),
      progression: {
        xp: curr,
        currentXP: curr,
        requiredXP: req ?? undefined,
        requiredXp: req ?? undefined,
        level: 1,
      },
    });
  }, [player, propCurrentXP, propRequiredXP]);

  const heightClasses = {
    sm: 'h-1.5',
    md: 'h-2 sm:h-2.5',
    lg: 'h-3 sm:h-3.5',
  }[size];

  return (
    <div
      id="xp-progress-indicator-container"
      className={`space-y-1.5 font-mono ${className}`}
      data-xp-current={xpData.currentXP}
      data-xp-required={xpData.requiredXP ?? 'none'}
      data-xp-percentage={xpData.percentage}
      data-xp-percentage-formatted={xpData.percentageFormatted}
    >
      {/* Header labels if requested */}
      {showText && (
        <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-wider">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-bold">EXPERIENCE</span>
            {xpData.hasRequirement && showPercentageBadge && (
              <span
                id="xp-percentage-badge"
                className="px-1.5 py-0.2 bg-[#00f2ff]/10 border border-[#00f2ff]/30 text-[#00f2ff] font-bold text-[9px] tracking-widest rounded-none"
              >
                {xpData.percentageFormatted}
              </span>
            )}
          </div>
          <span
            id="xp-display-text"
            className="text-slate-100 font-bold tracking-wider"
          >
            {xpData.displayText}
          </span>
        </div>
      )}

      {/* Progress Track & Fill Bar */}
      <div
        id="xp-progress-track"
        className={`w-full ${heightClasses} bg-[#05070a] border border-[#1a2b3c] relative overflow-hidden flex items-center`}
        role="progressbar"
        aria-valuenow={xpData.percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={`${xpData.percentageFormatted} (${xpData.displayText})`}
      >
        {/* Subtle grid ticks on the background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1a2b3c_1px,transparent_1px)] bg-[size:25%_100%] opacity-40 pointer-events-none" />

        {/* Dynamic XP Fill Bar */}
        <div
          id="xp-progress-fill"
          data-testid="xp-progress-fill"
          className="h-full bg-gradient-to-r from-[#00b4d8] via-[#00f2ff] to-[#70e000] transition-all duration-300 ease-out relative shadow-[0_0_10px_rgba(0,242,255,0.4)]"
          style={{ width: `${xpData.percentage}%` }}
        >
          {/* Glowing front-edge marker */}
          {xpData.percentage > 0 && xpData.percentage < 100 && (
            <div className="absolute top-0 right-0 bottom-0 w-1 bg-white shadow-[0_0_8px_#ffffff] animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
};
