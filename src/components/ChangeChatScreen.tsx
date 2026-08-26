import React, { useState, useMemo } from 'react';
import { useSystemCore } from '../context/SystemCoreContext';
import {
  generatePlayerData,
  generateChatTransferPrompt,
} from '../services/contextGenerator';
import {
  Repeat,
  Copy,
  Check,
  User,
  MessageSquare,
  ShieldCheck,
  PlusCircle,
  Radio,
  ArrowRight,
  Info,
} from 'lucide-react';

export const ChangeChatScreen: React.FC = () => {
  const { db, activeSession, createChatSession, showToast } = useSystemCore();
  const [copiedPlayerData, setCopiedPlayerData] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedBoth, setCopiedBoth] = useState(false);

  const playerDataText = useMemo(() => {
    return generatePlayerData(db);
  }, [db]);

  const transferPromptText = useMemo(() => {
    return generateChatTransferPrompt(db);
  }, [db]);

  const combinedText = useMemo(() => {
    return `${transferPromptText}\n\n${playerDataText}`;
  }, [transferPromptText, playerDataText]);

  const handleCopyPlayerData = async () => {
    try {
      await navigator.clipboard.writeText(playerDataText);
      setCopiedPlayerData(true);
      showToast('OUTPUT 1: Player Data copied to clipboard!', 'success');
      setTimeout(() => setCopiedPlayerData(false), 2500);
    } catch (err) {
      showToast('Failed to copy to clipboard', 'error');
    }
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(transferPromptText);
      setCopiedPrompt(true);
      showToast('OUTPUT 2: Transfer Prompt copied to clipboard!', 'success');
      setTimeout(() => setCopiedPrompt(false), 2500);
    } catch (err) {
      showToast('Failed to copy to clipboard', 'error');
    }
  };

  const handleCopyBoth = async () => {
    try {
      await navigator.clipboard.writeText(combinedText);
      setCopiedBoth(true);
      showToast('Combined Transfer Prompt + Player Data copied!', 'success');
      setTimeout(() => setCopiedBoth(false), 2500);
    } catch (err) {
      showToast('Failed to copy to clipboard', 'error');
    }
  };

  const handleCreateNextSession = async () => {
    const nextNum = db.sessions.length + 1;
    const label = `Chat Session ${String(nextNum).padStart(3, '0')}`;
    await createChatSession(label, `Transferred from ${activeSession?.label || 'previous session'}`);
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Top HUD Banner */}
      <div className="hud-panel p-4 sm:p-5 border border-[#1a2b3c] hud-border-bracket flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-400 text-[10px] font-mono tracking-[0.2em] uppercase">
            <Repeat className="w-3.5 h-3.5" />
            <span>SYSTEM CHAT TRANSFER PROTOCOL</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold font-mono text-slate-100 tracking-[0.2em] uppercase mt-1">
            CHANGE CHAT
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl font-mono">
            Designed to migrate the System to a fresh ChatGPT conversation when the previous conversation exceeds practical context limits.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={handleCreateNextSession}
            className="flex items-center gap-2 px-3.5 py-2 border border-[#1a2b3c] bg-[#05070a] hover:border-[#00f2ff]/40 text-[#00f2ff] font-mono text-xs font-bold tracking-wider uppercase transition-colors"
          >
            <PlusCircle className="w-4 h-4 text-[#00f2ff]" />
            <span>START NEW SESSION #{db.sessions.length + 1}</span>
          </button>

          <button
            onClick={handleCopyBoth}
            className="flex items-center gap-2 px-4 py-2 border border-amber-500/60 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-mono text-xs font-bold tracking-wider uppercase transition-all shadow-[0_0_12px_rgba(245,158,11,0.15)]"
          >
            {copiedBoth ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copiedBoth ? 'COPIED BOTH' : 'COPY PROMPT + DATA'}</span>
          </button>
        </div>
      </div>

      {/* Migration Steps Instruction Strip */}
      <div className="p-4 bg-[#0a0f18] border border-[#1a2b3c] font-mono text-xs text-slate-300">
        <div className="flex items-center gap-2 text-[#00f2ff] font-bold text-[10px] uppercase tracking-[0.2em] mb-2 pb-1 border-b border-[#1a2b3c]">
          <Info className="w-3.5 h-3.5" />
          <span>HOW TO TRANSFER YOUR SYSTEM TO A NEW CHATGPT CONVERSATION:</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-slate-400 text-xs">
          <div className="p-3 bg-[#05070a] border border-[#1a2b3c]">
            <span className="text-[#00f2ff] font-bold block mb-1 text-[10px] tracking-wider">STEP 1</span>
            Copy the <strong>CHAT TRANSFER PROMPT</strong> (Output 2) and paste it into the new ChatGPT window.
          </div>
          <div className="p-3 bg-[#05070a] border border-[#1a2b3c]">
            <span className="text-[#00f2ff] font-bold block mb-1 text-[10px] tracking-wider">STEP 2</span>
            Copy the <strong>PLAYER DATA</strong> (Output 1) to provide the authoritative state.
          </div>
          <div className="p-3 bg-[#05070a] border border-[#1a2b3c]">
            <span className="text-[#00f2ff] font-bold block mb-1 text-[10px] tracking-wider">STEP 3</span>
            Click <strong>START NEW SESSION</strong> above to register the new chat thread in SYSTEM CORE.
          </div>
        </div>
      </div>

      {/* Two Separate Outputs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* OUTPUT 1 — PLAYER DATA */}
        <div className="hud-panel p-5 border border-[#1a2b3c] flex flex-col">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#1a2b3c]">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-[#00f2ff]" />
              <div>
                <span className="text-[9px] font-mono text-[#00f2ff] font-bold block uppercase tracking-wider">
                  OUTPUT 1
                </span>
                <h3 className="text-xs sm:text-sm font-bold font-mono text-slate-200 uppercase tracking-widest">
                  PLAYER DATA
                </h3>
              </div>
            </div>

            <button
              onClick={handleCopyPlayerData}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-[#00f2ff]/60 bg-[#00f2ff]/10 hover:bg-[#00f2ff]/20 text-[#00f2ff] font-mono text-xs font-bold tracking-wider uppercase transition-all"
            >
              {copiedPlayerData ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedPlayerData ? 'COPIED' : 'COPY PLAYER DATA'}</span>
            </button>
          </div>

          <p className="text-xs text-slate-400 font-mono mb-3">
            Contains current persistent player state, level, XP, and event history.
          </p>

          <div className="flex-1 bg-[#05070a] border border-[#1a2b3c] p-4 font-mono text-xs text-slate-300 leading-relaxed overflow-x-auto max-h-[420px] overflow-y-auto whitespace-pre selection:bg-[#00f2ff]/20 selection:text-[#00f2ff]">
            {playerDataText}
          </div>
        </div>

        {/* OUTPUT 2 — CHAT TRANSFER PROMPT */}
        <div className="hud-panel p-5 border border-[#1a2b3c] flex flex-col">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#1a2b3c]">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-amber-400" />
              <div>
                <span className="text-[9px] font-mono text-amber-400 font-bold block uppercase tracking-wider">
                  OUTPUT 2
                </span>
                <h3 className="text-xs sm:text-sm font-bold font-mono text-slate-200 uppercase tracking-widest">
                  CHAT TRANSFER PROMPT
                </h3>
              </div>
            </div>

            <button
              onClick={handleCopyPrompt}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-amber-500/60 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-mono text-xs font-bold tracking-wider uppercase transition-all"
            >
              {copiedPrompt ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedPrompt ? 'COPIED' : 'COPY TRANSFER PROMPT'}</span>
            </button>
          </div>

          <p className="text-xs text-slate-400 font-mono mb-3">
            Instructions for the new ChatGPT conversation enforcing state continuity and prohibiting resets.
          </p>

          <div className="flex-1 bg-[#05070a] border border-[#1a2b3c] p-4 font-mono text-xs text-slate-300 leading-relaxed overflow-x-auto max-h-[420px] overflow-y-auto whitespace-pre selection:bg-amber-500/20 selection:text-amber-200">
            {transferPromptText}
          </div>
        </div>
      </div>
    </div>
  );
};
