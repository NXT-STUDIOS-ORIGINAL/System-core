import React, { useState } from 'react';
import { useSystemCore } from '../context/SystemCoreContext';
import { ChatSession } from '../types';
import {
  Radio,
  PlusCircle,
  CheckCircle2,
  Calendar,
  Layers,
  Terminal,
  Activity,
  ArrowRight,
  Sparkles,
  Trash2,
  AlertTriangle,
  ShieldAlert,
  X,
} from 'lucide-react';

export const SessionsScreen: React.FC = () => {
  const { db, activeSession, createChatSession, setActiveSession, deleteChatSession, showToast } = useSystemCore();
  const [newLabel, setNewLabel] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Deletion modal states
  const [sessionPendingDelete, setSessionPendingDelete] = useState<ChatSession | null>(null);
  const [showActiveSessionAlert, setShowActiveSessionAlert] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createChatSession(newLabel.trim() || undefined, newNotes.trim() || undefined);
    setNewLabel('');
    setNewNotes('');
    setIsCreating(false);
  };

  const handleDeleteClick = (session: ChatSession) => {
    const isActive = session.id === db.activeSessionId;
    if (isActive) {
      setShowActiveSessionAlert(true);
      return;
    }
    setSessionPendingDelete(session);
  };

  const handleConfirmDelete = async () => {
    if (!sessionPendingDelete || isDeleting) return;

    setIsDeleting(true);
    try {
      await deleteChatSession(sessionPendingDelete.id);
      setSessionPendingDelete(null);
    } catch (err: any) {
      showToast('Failed to delete session.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4 pb-28 sm:pb-16 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="hud-panel p-4 sm:p-5 border border-[#1a2b3c] hud-border-bracket flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#00f2ff] text-[10px] font-mono tracking-[0.2em] uppercase">
            <Radio className="w-3.5 h-3.5" />
            <span>CHAT CONVERSATION REGISTRY</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold font-mono text-slate-100 tracking-[0.2em] uppercase mt-1">
            CHAT SESSIONS ({db.sessions.length})
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl font-mono">
            Tracks active and historical ChatGPT conversations, associating incoming messages and state snapshots with specific chat threads.
          </p>
        </div>

        <button
          onClick={() => setIsCreating(!isCreating)}
          className="flex items-center justify-center gap-2 px-4 py-2 border border-[#00f2ff]/60 bg-[#00f2ff]/10 hover:bg-[#00f2ff]/20 text-[#00f2ff] font-mono text-xs font-bold uppercase tracking-widest transition-all shrink-0 min-h-[44px]"
        >
          <PlusCircle className="w-4 h-4" />
          <span>{isCreating ? 'CANCEL' : 'CREATE NEW SESSION'}</span>
        </button>
      </div>

      {/* New Session Drawer / Form */}
      {isCreating && (
        <form
          onSubmit={handleCreate}
          className="hud-panel p-5 border border-[#00f2ff]/40 font-mono text-xs space-y-4 animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between border-b border-[#1a2b3c] pb-2">
            <span className="font-bold text-[#00f2ff] uppercase tracking-wider">Register New Chat Session</span>
            <span className="text-[10px] text-slate-500 uppercase">
              Next ID: session-{String(db.sessions.length + 1).padStart(3, '0')}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 text-[10px] uppercase mb-1">SESSION LABEL</label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder={`Chat Session ${String(db.sessions.length + 1).padStart(3, '0')}`}
                className="w-full px-3 py-2 bg-[#05070a] border border-[#1a2b3c] text-slate-200 focus:outline-none focus:border-[#00f2ff] text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-[10px] uppercase mb-1">NOTES (OPTIONAL)</label>
              <input
                type="text"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="e.g. Migration from Session 001 after context limit"
                className="w-full px-3 py-2 bg-[#05070a] border border-[#1a2b3c] text-slate-200 focus:outline-none focus:border-[#00f2ff] text-xs font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-3 py-2 border border-[#1a2b3c] text-slate-400 hover:text-slate-200 hover:bg-slate-800/30 font-mono text-xs uppercase"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 border border-[#00f2ff]/60 bg-[#00f2ff]/10 hover:bg-[#00f2ff]/20 text-[#00f2ff] font-bold uppercase tracking-wider font-mono text-xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Create &amp; Activate</span>
            </button>
          </div>
        </form>
      )}

      {/* Sessions Grid */}
      <div className="space-y-3 font-mono">
        {db.sessions.map((session) => {
          const isActive = session.id === db.activeSessionId;

          return (
            <div
              key={session.id}
              className={`hud-panel p-4 sm:p-5 border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                isActive
                  ? 'border-[#00f2ff]/60 bg-[#00f2ff]/5 shadow-[0_0_12px_rgba(0,242,255,0.1)]'
                  : 'border-[#1a2b3c] bg-[#0a0f18] hover:border-[#1a2b3c]'
              }`}
            >
              <div className="min-w-0 flex-1 w-full">
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className={`text-sm sm:text-base font-bold uppercase ${isActive ? 'text-[#00f2ff]' : 'text-slate-200'}`}>
                    {session.label}
                  </span>
                  <span className="text-xs text-slate-400 px-2 py-0.5 border border-[#1a2b3c] bg-[#05070a]">
                    {session.id}
                  </span>
                  {isActive && (
                    <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-500/40 px-2 py-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      ACTIVE SESSION
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mt-2">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    Created: {new Date(session.createdAt).toLocaleDateString()}
                  </span>
                  <span className="text-slate-700 hidden xs:inline">•</span>
                  <span>
                    Associated State: <strong className="text-slate-200">v{session.stateVersion ?? 0}</strong>
                  </span>
                  {session.notes && (
                    <>
                      <span className="text-slate-700 hidden sm:inline">•</span>
                      <span className="text-slate-400 italic truncate max-w-xs">{session.notes}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 w-full md:w-auto justify-end pt-2 md:pt-0 border-t md:border-t-0 border-[#1a2b3c]/60 shrink-0">
                {isActive ? (
                  <div className="flex items-center gap-1.5 px-3 py-2 border border-emerald-500/40 bg-emerald-950/30 text-emerald-300 text-xs font-semibold uppercase">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>CURRENT ACTIVE</span>
                  </div>
                ) : (
                  <button
                    onClick={() => setActiveSession(session.id)}
                    className="flex items-center gap-1.5 px-3.5 py-2 border border-[#1a2b3c] bg-[#05070a] hover:border-[#00f2ff]/40 text-[#00f2ff] text-xs font-semibold uppercase tracking-wider transition-colors min-h-[38px]"
                  >
                    <span>SET ACTIVE</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Delete button */}
                <button
                  onClick={() => handleDeleteClick(session)}
                  className={`flex items-center gap-1.5 px-3 py-2 border font-mono text-xs font-semibold uppercase tracking-wider transition-colors min-h-[38px] ${
                    isActive
                      ? 'border-slate-800 bg-[#05070a] text-slate-500 hover:text-slate-400 hover:border-slate-700'
                      : 'border-rose-900/40 bg-rose-950/10 hover:bg-rose-950/30 hover:border-rose-500/50 text-rose-400 hover:text-rose-300'
                  }`}
                  title={isActive ? 'Active session cannot be deleted' : `Delete ${session.label}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>DELETE</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal: Delete Session */}
      {sessionPendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md hud-panel border border-rose-500/50 bg-[#0a0f18] p-5 sm:p-6 font-mono space-y-4 shadow-[0_0_30px_rgba(244,63,94,0.15)]">
            <div className="flex items-center justify-between border-b border-[#1a2b3c] pb-3">
              <div className="flex items-center gap-2 text-rose-400 font-bold uppercase tracking-widest text-sm">
                <Trash2 className="w-4 h-4" />
                <span>DELETE SESSION?</span>
              </div>
              <button
                onClick={() => setSessionPendingDelete(null)}
                disabled={isDeleting}
                className="text-slate-500 hover:text-slate-300 transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p className="text-slate-200 text-sm font-semibold">
                Are you sure you want to delete this chat session?
              </p>
              <div className="p-3 border border-[#1a2b3c] bg-[#05070a] rounded-none space-y-1">
                <p className="text-[#00f2ff] font-bold">{sessionPendingDelete.label}</p>
                <p className="text-slate-500 text-[10px]">ID: {sessionPendingDelete.id}</p>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                This removes the session record only. Authoritative Player State, XP, inventory, quests, and event history will <strong className="text-slate-200">NOT</strong> be deleted.
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-[#1a2b3c]">
              <button
                type="button"
                onClick={() => setSessionPendingDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 border border-[#1a2b3c] text-slate-400 hover:text-slate-200 hover:bg-slate-800/30 text-xs uppercase tracking-wider font-semibold transition-colors"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex items-center gap-2 px-5 py-2 border border-rose-500/60 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-rose-100 text-xs uppercase tracking-wider font-bold transition-all shadow-[0_0_12px_rgba(244,63,94,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'DELETING...' : 'DELETE'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal: Cannot Delete Active Session */}
      {showActiveSessionAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md hud-panel border border-amber-500/50 bg-[#0a0f18] p-5 sm:p-6 font-mono space-y-4 shadow-[0_0_30px_rgba(245,158,11,0.15)]">
            <div className="flex items-center justify-between border-b border-[#1a2b3c] pb-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-widest text-sm">
                <ShieldAlert className="w-4 h-4" />
                <span>ACTIVE SESSION PROTECTED</span>
              </div>
              <button
                onClick={() => setShowActiveSessionAlert(false)}
                className="text-slate-500 hover:text-slate-300 transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <p className="text-slate-200 text-sm font-semibold">
                Cannot delete the active session.
              </p>
              <p className="text-slate-400 text-xs leading-relaxed">
                Create or switch to another session first. The application requires at least one active chat session at all times to associate incoming events and snapshots.
              </p>
            </div>

            <div className="flex justify-end pt-2 border-t border-[#1a2b3c]">
              <button
                type="button"
                onClick={() => setShowActiveSessionAlert(false)}
                className="px-5 py-2 border border-amber-500/50 bg-amber-950/30 hover:bg-amber-900/50 text-amber-300 text-xs uppercase tracking-wider font-bold transition-all"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

