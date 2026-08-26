import React from 'react';
import { useSystemCore } from '../context/SystemCoreContext';
import { SystemEvent } from '../types';
import {
  Sparkles,
  FileText,
  Repeat,
  Radio,
  Cpu,
  Terminal,
  User,
  Zap,
  Bookmark,
  Clock,
  Award,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { ScreenType } from './Navigation';
import { ProfileAvatar } from './ProfileAvatar';
import { XpProgressBar } from './XpProgressBar';

interface HomeScreenProps {
  onOpenSystemInput: () => void;
  onNavigate: (screen: ScreenType) => void;
  onSelectEvent: (event: SystemEvent) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onOpenSystemInput,
  onNavigate,
  onSelectEvent,
}) => {
  const { db, activeSession, questCountdown, refreshQuestsNow } = useSystemCore();
  const player = db.player;
  const recentEvents = db.events.slice(0, 6);
  const recentMemories = player.recentMemory || [];
  const quests = player.quests || [];
  const completedQuestsCount = quests.filter((q) =>
    typeof q === 'object' ? q.status === 'COMPLETED' : /\[completed\]/i.test(q)
  ).length;

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Top Telemetry Header Strip */}
      <div className="hud-panel p-4 sm:p-5 border border-[#1a2b3c] hud-border-bracket flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#00f2ff] text-[10px] font-mono tracking-[0.2em] uppercase">
            <Cpu className="w-3.5 h-3.5" />
            <span>PERMANENT SYSTEM CORE // AUTHORITATIVE PERSISTENCE</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold font-mono text-slate-100 tracking-[0.2em] uppercase mt-1">
            CONTROL TERMINAL
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl font-mono">
            Authoritative external database for ChatGPT System conversations. Ingest raw events, maintain persistent state, and generate context packages for chat migration.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0 font-mono text-[10px] uppercase tracking-widest">
          <div className="px-3 py-2 bg-[#05070a] border border-[#1a2b3c]">
            <span className="text-slate-500 block">ACTIVE CHAT</span>
            <span className="text-[#00f2ff] font-bold flex items-center gap-1.5 mt-0.5">
              <Radio className="w-3 h-3 text-[#00f2ff] animate-pulse" />
              {activeSession?.label || 'Session 001'}
            </span>
          </div>
          <div className="px-3 py-2 bg-[#05070a] border border-[#1a2b3c]">
            <span className="text-slate-500 block">STATE VERSION</span>
            <span className="text-emerald-400 font-bold mt-0.5 block">
              v{player.stateVersion ?? 0}
            </span>
          </div>
          <div
            onClick={() => onNavigate('settings')}
            className={`px-3 py-2 bg-[#05070a] border cursor-pointer transition-colors group ${
              player.questRefreshRequested
                ? 'border-amber-500/50 hover:border-amber-400'
                : (player.questRefreshAvailable || questCountdown.status === 'REFRESH_AVAILABLE')
                ? 'border-cyan-500/50 hover:border-cyan-400'
                : 'border-[#00f2ff]/30 hover:border-[#00f2ff]'
            }`}
            title="Click to view Quest Control in Settings"
          >
            <span className="text-slate-500 block flex items-center gap-1 text-[9px]">
              <Clock className="w-2.5 h-2.5 text-[#00f2ff]" />
              QUEST REFRESH
            </span>
            <span className={`font-bold mt-0.5 block ${
              player.questRefreshRequested
                ? 'text-amber-300 text-[11px]'
                : (player.questRefreshAvailable || questCountdown.status === 'REFRESH_AVAILABLE')
                ? 'text-cyan-300 text-[11px]'
                : 'text-[#00f2ff]'
            }`}>
              {player.questRefreshRequested
                ? '⚔️ REFRESH REQUESTED'
                : (player.questRefreshAvailable || questCountdown.status === 'REFRESH_AVAILABLE')
                ? '🔄 REFRESH AVAILABLE'
                : `⏳ ${questCountdown.formatted}`}
            </span>
          </div>
        </div>
      </div>

      {/* Main 12-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4">
        {/* Left Column (col-span-3): Player Overview & System Status */}
        <div className="lg:col-span-3 flex flex-col gap-3 sm:gap-4">
          {/* Player Overview Box */}
          <div className="hud-panel p-5 border border-[#1a2b3c] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#1a2b3c]">
                <h3 className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-mono font-bold">
                  Player Overview
                </h3>
                <button
                  onClick={() => onNavigate('player')}
                  className="text-[10px] font-mono text-[#00f2ff] hover:underline"
                >
                  VIEW ALL
                </button>
              </div>

              <div className="flex gap-4 items-start mb-4">
                <ProfileAvatar
                  size="lg"
                  showBorder
                  showStatusIndicator
                  statusOnline={player.status !== 'OFFLINE'}
                />

                <div className="min-w-0 space-y-1 font-mono">
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase tracking-wider">Level</p>
                    <p className="text-2xl font-bold font-mono text-[#00f2ff] leading-none mt-0.5">
                      {player.level || '1'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase tracking-wider">Player ID</p>
                    <p className="text-xs font-mono text-slate-300 truncate">
                      {player.playerId || 'PLAYER-01'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 font-mono">
                {/* Dynamic XP Progress Bar */}
                <XpProgressBar player={player} size="sm" />

                <div className="flex justify-between text-[10px] pt-1">
                  <span className="text-slate-500 uppercase">Status</span>
                  <span className="text-[#00f2ff] font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00f2ff] animate-pulse"></span>
                    {player.status || 'ONLINE'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* System Status Box */}
          <div className="hud-panel p-5 border border-[#1a2b3c]">
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-mono font-bold mb-3 pb-2 border-b border-[#1a2b3c]">
              System Status
            </h3>
            <div className="space-y-2.5 font-mono text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 text-[11px]">STORAGE:</span>
                <span className="text-slate-200 font-bold">LOCAL (PERSISTENT)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 text-[11px]">STATE:</span>
                <span className="text-emerald-400 font-bold">READY (v{player.stateVersion ?? 0})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 text-[11px]">RECENT MEMORY:</span>
                <span className="text-[#00f2ff] font-bold">{recentMemories.length}/50 ENTRIES</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 text-[11px]">RAW EVENTS:</span>
                <span className="text-slate-300 font-bold">{db.events.length} RECORDED</span>
              </div>
            </div>
          </div>

          {/* 24-Hour Daily Quest Status Box */}
          <div className="hud-panel p-5 border border-[#1a2b3c] flex flex-col justify-between">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#1a2b3c]">
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-mono font-bold flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-[#00f2ff]" />
                <span>Daily Quest Cycle</span>
              </h3>
              <button
                onClick={() => onNavigate('player')}
                className="text-[10px] font-mono text-[#00f2ff] hover:underline"
              >
                LOGS
              </button>
            </div>

            <div className="space-y-2.5 font-mono text-xs">
              <div className={`p-2.5 bg-[#05070a] border flex flex-col gap-1 ${
                player.questRefreshRequested
                  ? 'border-amber-500/40 bg-amber-950/20'
                  : (player.questRefreshAvailable || questCountdown.status === 'REFRESH_AVAILABLE')
                  ? 'border-cyan-500/40 bg-cyan-950/20'
                  : 'border-[#00f2ff]/30'
              }`}>
                <div className="flex justify-between items-center text-[10px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-[#00f2ff]" />
                    REFRESH STATUS
                  </span>
                  <span className={`font-bold ${
                    player.questRefreshRequested
                      ? 'text-amber-400'
                      : (player.questRefreshAvailable || questCountdown.status === 'REFRESH_AVAILABLE')
                      ? 'text-cyan-400'
                      : 'text-emerald-400'
                  }`}>
                    {player.questRefreshRequested ? 'PENDING' : '24H CYCLE'}
                  </span>
                </div>
                <div className={`text-xs sm:text-sm font-bold tracking-wider ${
                  player.questRefreshRequested
                    ? 'text-amber-300'
                    : (player.questRefreshAvailable || questCountdown.status === 'REFRESH_AVAILABLE')
                    ? 'text-cyan-300'
                    : 'text-[#00f2ff]'
                }`}>
                  {player.questRefreshRequested
                    ? '⚔️ REFRESH REQUESTED'
                    : (player.questRefreshAvailable || questCountdown.status === 'REFRESH_AVAILABLE')
                    ? '🔄 REFRESH AVAILABLE'
                    : `⏳ ${questCountdown.formatted}`}
                </div>
              </div>

              <div className="flex justify-between text-xs">
                <span className="text-slate-500 text-[11px]">ACTIVE QUESTS:</span>
                <span className="text-slate-200 font-bold">
                  {completedQuestsCount}/{quests.length} Completed
                </span>
              </div>

              {quests.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {quests.slice(0, 2).map((q, idx) => {
                    const title = typeof q === 'string' ? q : q.title;
                    const isComp = typeof q === 'string' ? /\[completed\]/i.test(q) : q.status === 'COMPLETED';
                    return (
                      <div
                        key={idx}
                        className="text-[10px] truncate flex items-center gap-1.5 text-slate-300"
                      >
                        <span className={isComp ? 'text-emerald-400 font-bold' : 'text-[#00f2ff]'}>
                          {isComp ? '✓' : '•'}
                        </span>
                        <span className={`truncate ${isComp ? 'line-through opacity-60' : ''}`}>
                          {title}
                        </span>
                      </div>
                    );
                  })}
                  {quests.length > 2 && (
                    <button
                      onClick={() => onNavigate('player')}
                      className="text-[9px] text-[#00f2ff]/80 hover:text-[#00f2ff] hover:underline block pt-0.5"
                    >
                      + {quests.length - 2} more quests...
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Center Column (col-span-6): Primary Action Buttons & Recent System Events */}
        <div className="lg:col-span-6 flex flex-col gap-3 sm:gap-4">
          {/* Main Action Buttons Grid */}
          <div className="hud-panel p-6 border border-[#1a2b3c] flex flex-col justify-center">
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-mono font-bold mb-4">
              Primary System Actions
            </div>

            <div className="flex flex-col gap-3.5">
              {/* BUTTON 1: SYSTEM INPUT */}
              <button
                onClick={onOpenSystemInput}
                className="w-full py-4 px-5 border border-[#00f2ff]/60 bg-[#00f2ff]/5 hover:bg-[#00f2ff]/15 active:bg-[#00f2ff]/25 text-[#00f2ff] uppercase tracking-[0.3em] font-bold text-xs sm:text-sm font-mono transition-all flex items-center justify-between shadow-[0_0_12px_rgba(0,242,255,0.12)] group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-[#00f2ff]" />
                  <span>SYSTEM INPUT</span>
                </div>
                <span className="text-[10px] tracking-widest text-[#00f2ff]/80 font-normal group-hover:translate-x-1 transition-transform">
                  [ PASTE MESSAGE ] →
                </span>
              </button>

              {/* BUTTON 2: GENERATE CONTEXT */}
              <button
                onClick={() => onNavigate('context')}
                className="w-full py-4 px-5 border border-slate-700 bg-slate-900/30 hover:border-[#00f2ff]/50 hover:bg-[#00f2ff]/5 text-slate-300 hover:text-[#00f2ff] uppercase tracking-[0.3em] font-bold text-xs sm:text-sm font-mono transition-all flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-emerald-400" />
                  <span>GENERATE CONTEXT</span>
                </div>
                <span className="text-[10px] tracking-widest text-slate-500 group-hover:text-[#00f2ff] font-normal group-hover:translate-x-1 transition-transform">
                  [ EXPORT PACKAGE ] →
                </span>
              </button>

              {/* BUTTON 3: CHANGE CHAT */}
              <button
                onClick={() => onNavigate('change_chat')}
                className="w-full py-4 px-5 border border-slate-700 bg-slate-900/30 hover:border-amber-500/50 hover:bg-amber-500/5 text-slate-300 hover:text-amber-400 uppercase tracking-[0.3em] font-bold text-xs sm:text-sm font-mono transition-all flex items-center justify-between group cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Repeat className="w-5 h-5 text-amber-400" />
                  <span>CHANGE CHAT</span>
                </div>
                <span className="text-[10px] tracking-widest text-slate-500 group-hover:text-amber-400 font-normal group-hover:translate-x-1 transition-transform">
                  [ TRANSFER PROMPT ] →
                </span>
              </button>
            </div>
          </div>

          {/* Recent System Events Table Panel */}
          <div className="hud-panel p-5 border border-[#1a2b3c] flex flex-col flex-1 overflow-hidden">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1a2b3c]">
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-mono font-bold flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-[#00f2ff]" />
                <span>Recent Raw System Events</span>
              </h3>
              <button
                onClick={() => onNavigate('events')}
                className="text-[10px] font-mono text-[#00f2ff] hover:underline"
              >
                VIEW ARCHIVE ({db.events.length})
              </button>
            </div>

            {recentEvents.length === 0 ? (
              <div className="py-8 text-center font-mono text-xs text-slate-500 italic">
                No events recorded in current cycle. Click SYSTEM INPUT to paste a message.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-[11px]">
                  <thead>
                    <tr className="text-slate-500 uppercase border-b border-[#1a2b3c]">
                      <th className="py-2.5 font-normal tracking-wider">Event ID</th>
                      <th className="py-2.5 font-normal tracking-wider">Source</th>
                      <th className="py-2.5 font-normal tracking-wider text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1a2b3c]/50">
                    {recentEvents.map((evt) => (
                      <tr
                        key={evt.id}
                        onClick={() => onSelectEvent(evt)}
                        className="hover:bg-[#0c1420] cursor-pointer transition-colors"
                      >
                        <td className="py-2 text-[#00f2ff] font-bold">
                          {evt.id}
                        </td>
                        <td className="py-2 text-slate-400">
                          {evt.source}
                        </td>
                        <td className="py-2 text-slate-500 text-right">
                          {evt.formattedDate || new Date(evt.timestamp).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (col-span-3): Active Sessions & Core Config */}
        <div className="lg:col-span-3 flex flex-col gap-3 sm:gap-4">
          {/* Active Sessions Box */}
          <div className="hud-panel p-5 border border-[#1a2b3c]">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#1a2b3c]">
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-mono font-bold">
                Active Sessions
              </h3>
              <button
                onClick={() => onNavigate('sessions')}
                className="text-[10px] font-mono text-[#00f2ff] hover:underline"
              >
                MANAGE
              </button>
            </div>

            <div className="space-y-2 font-mono">
              {db.sessions.slice(0, 3).map((sess) => {
                const isActive = sess.id === db.activeSessionId;
                return (
                  <div
                    key={sess.id}
                    className={`p-2.5 border transition-all ${
                      isActive
                        ? 'border-[#00f2ff]/40 bg-[#00f2ff]/5'
                        : 'border-slate-800 bg-[#05070a]/60 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <p className={`text-[10px] uppercase font-bold ${isActive ? 'text-[#00f2ff]' : 'text-slate-300'}`}>
                      {sess.label}
                    </p>
                    <p className="text-[9px] text-slate-500 truncate">
                      State v{sess.stateVersion} • ID: {sess.id}
                    </p>
                  </div>
                );
              })}

              {db.sessions.length < 2 && (
                <div className="p-2.5 border border-slate-800 opacity-40 font-mono">
                  <p className="text-[10px] uppercase text-slate-400">Empty Slot</p>
                  <p className="text-[9px] text-slate-600">NO DATA</p>
                </div>
              )}
            </div>
          </div>

          {/* Rolling Memory Quick View */}
          <div className="hud-panel p-5 border border-[#1a2b3c]">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#1a2b3c]">
              <h3 className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-mono font-bold flex items-center gap-1.5">
                <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                <span>Latest Memory</span>
              </h3>
              <button
                onClick={() => onNavigate('player')}
                className="text-[10px] font-mono text-[#00f2ff] hover:underline"
              >
                VIEW
              </button>
            </div>

            {recentMemories.length === 0 ? (
              <p className="text-slate-500 text-[11px] font-mono italic">No memory generated yet.</p>
            ) : (
              <div className="space-y-2 font-mono text-[11px]">
                <p className="text-slate-300 line-clamp-3 leading-relaxed">
                  {recentMemories[recentMemories.length - 1]?.summary}
                </p>
                <span className="text-[9px] text-slate-500 block">
                  Total rolling entries: {recentMemories.length} / 50
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
