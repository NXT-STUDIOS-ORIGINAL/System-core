import React from 'react';
import { useSystemCore } from '../context/SystemCoreContext';
import { Radio, Sparkles } from 'lucide-react';
import { ProfileAvatar } from './ProfileAvatar';

interface HeaderProps {
  onOpenSystemInput: () => void;
  activeScreen: string;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSystemInput, activeScreen }) => {
  const { db, activeSession } = useSystemCore();
  const player = db.player;

  return (
    <header className="sticky top-0 z-30 w-full border-b border-[#1a2b3c] bg-[#0a0f18] px-4 sm:px-8 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3 sm:gap-4">
          <ProfileAvatar
            size="sm"
            showStatusIndicator
            statusOnline={player.status !== 'OFFLINE'}
          />
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-base sm:text-xl font-bold tracking-[0.2em] text-[#00f2ff] uppercase font-mono">
                {db.settings.systemName || 'SYSTEM CORE'}
              </h1>
              <span className="hidden sm:inline-flex text-[9px] uppercase font-mono px-1.5 py-0.5 border border-[#1a2b3c] text-slate-400 bg-[#05070a]">
                v{db.settings.systemVersion || '1.0.4-BETA'}
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-mono tracking-wider flex items-center gap-2">
              <span>ID: <span className="text-slate-400">{player.playerId || 'UNASSIGNED'}</span></span>
              <span className="text-slate-700">|</span>
              <span>STATE: <span className="text-[#00f2ff]">v{player.stateVersion ?? 0}</span></span>
            </p>
          </div>
        </div>

        {/* Right side telemetry & quick action */}
        <div className="flex items-center gap-3 sm:gap-6 text-[10px] font-mono uppercase tracking-widest text-slate-500">
          {/* Active Session badge */}
          <div className="hidden md:flex items-center gap-2 text-slate-400">
            <Radio className="w-3 h-3 text-[#00f2ff] animate-pulse" />
            <span>SESSION:</span>
            <span className="text-[#00f2ff] truncate max-w-[130px] font-bold">
              {activeSession?.label || 'Session 001'}
            </span>
          </div>

          <span className="hidden sm:inline">STATE VER: <strong className="text-slate-300">{player.stateVersion ?? 0}</strong></span>
          <span className="hidden sm:inline">SYNC: <strong className="text-slate-300">100%</strong></span>
          <span className="text-[#00f2ff] font-bold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#00f2ff] animate-pulse"></span>
            {player.status || 'ONLINE'}
          </span>

          {/* Quick trigger for System Input */}
          <button
            onClick={onOpenSystemInput}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-[#00f2ff]/50 bg-[#00f2ff]/5 hover:bg-[#00f2ff]/15 active:bg-[#00f2ff]/25 text-[#00f2ff] font-bold font-mono text-[11px] tracking-[0.2em] uppercase transition-all shadow-[0_0_8px_rgba(0,242,255,0.15)]"
            title="Paste & store incoming ChatGPT message"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">INPUT</span>
          </button>
        </div>
      </div>
    </header>
  );
};

