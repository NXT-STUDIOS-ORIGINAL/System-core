import React, { useState, useEffect } from 'react';
import { SystemEvent } from '../types';
import { useSystemCore } from '../context/SystemCoreContext';
import {
  X,
  Copy,
  Check,
  Calendar,
  Hash,
  Tag,
  Terminal,
  Database,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Cpu,
  Layers,
  Flame,
  ShieldAlert,
  Eye,
  CheckCheck,
} from 'lucide-react';

interface EventDetailModalProps {
  event: SystemEvent | null;
  onClose: () => void;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({ event, onClose }) => {
  const { showToast, retryProcessEvent, markEventAsRead } = useSystemCore();
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Auto-mark as read on mount/event change
  useEffect(() => {
    if (event && (!event.read || event.readStatus === 'UNREAD')) {
      markEventAsRead(event.id);
    }
  }, [event?.id]);

  if (!event) return null;

  const eventSummary = event.summary || 'System message recorded.';
  const importance = event.importance || 'NORMAL';
  const isUnread = !event.read || event.readStatus === 'UNREAD';

  const handleCopyRaw = async () => {
    try {
      await navigator.clipboard.writeText(event.rawSystemMessage || event.rawMessage);
      setCopiedRaw(true);
      showToast('Raw message copied to clipboard', 'success');
      setTimeout(() => setCopiedRaw(false), 2000);
    } catch (err) {
      showToast('Failed to copy to clipboard', 'error');
    }
  };

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(eventSummary);
      setCopiedSummary(true);
      showToast('Event summary copied to clipboard', 'success');
      setTimeout(() => setCopiedSummary(false), 2000);
    } catch (err) {
      showToast('Failed to copy to clipboard', 'error');
    }
  };

  const handleRetryProcessing = async () => {
    setIsRetrying(true);
    try {
      const res = await retryProcessEvent(event.id);
      if (res.success) {
        showToast('Event re-processed successfully with Gemini!', 'success');
      }
    } finally {
      setIsRetrying(false);
    }
  };

  const getImportanceBadge = () => {
    switch (importance) {
      case 'CRITICAL':
        return (
          <span className="px-2 py-0.5 text-[9px] font-mono border border-rose-500/60 bg-rose-500/20 text-rose-300 font-bold flex items-center gap-1 uppercase tracking-wider animate-pulse">
            <Flame className="w-2.5 h-2.5 text-rose-400" />
            CRITICAL EVENT
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-2 py-0.5 text-[9px] font-mono border border-amber-500/60 bg-amber-500/20 text-amber-300 font-bold flex items-center gap-1 uppercase tracking-wider">
            <ShieldAlert className="w-2.5 h-2.5 text-amber-400" />
            HIGH IMPORTANCE
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-2 py-0.5 text-[9px] font-mono border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 font-bold flex items-center gap-1 uppercase">
            MEDIUM
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-[9px] font-mono border border-slate-700 bg-slate-800 text-slate-400 font-medium uppercase">
            NORMAL
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#05070a]/90 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col hud-panel border border-[#00f2ff]/50 overflow-hidden shadow-[0_0_30px_rgba(0,242,255,0.15)]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a2b3c] bg-[#0c1420]">
          <div className="flex items-center gap-3">
            <div className="p-2 border border-[#00f2ff]/40 bg-[#00f2ff]/10 text-[#00f2ff]">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono font-bold text-[#00f2ff] uppercase tracking-[0.2em]">
                  SYSTEM EVENT RECORD
                </span>
                <span className="px-2 py-0.5 text-[9px] font-mono border border-[#1a2b3c] bg-[#05070a] text-slate-300">
                  {event.type}
                </span>
                {getImportanceBadge()}
                {event.processed ? (
                  <span className="px-2 py-0.5 text-[9px] font-mono border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    {event.processingStatus || 'PROCESSED'}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[9px] font-mono border border-amber-500/40 bg-amber-500/10 text-amber-400 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-2.5 h-2.5" />
                    PENDING / UNPROCESSED
                  </span>
                )}
              </div>
              <h2 className="text-sm sm:text-base font-mono font-semibold text-slate-100 truncate mt-0.5">
                {event.id}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white border border-transparent hover:border-[#1a2b3c] transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Metadata strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-5 py-2.5 bg-[#05070a] border-b border-[#1a2b3c] text-xs font-mono">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Calendar className="w-3.5 h-3.5 text-[#00f2ff] shrink-0" />
            <span className="truncate">{event.formattedDate || new Date(event.timestamp).toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <Hash className="w-3.5 h-3.5 text-[#00f2ff] shrink-0" />
            <span>SOURCE: <strong className="text-slate-200">{event.source}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <Cpu className="w-3.5 h-3.5 text-[#00f2ff] shrink-0" />
            <span>ENGINE: <strong className="text-[#00f2ff]">{event.geminiProcessingVersion || 'local-deterministic-engine'}</strong></span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <Database className="w-3.5 h-3.5 text-[#00f2ff] shrink-0" />
            <span>READ STATUS: <strong className="text-emerald-400">READ</strong></span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4 bg-[#0a0f18]">
          {/* Section 1: Event Summary */}
          <div className="p-4 bg-[#0c1420] border border-[#00f2ff]/30 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#00f2ff]" />
                <span className="text-[10px] font-mono font-bold text-[#00f2ff] uppercase tracking-[0.2em]">
                  EVENT SUMMARY
                </span>
              </div>
              <button
                onClick={handleCopySummary}
                className="flex items-center gap-1 text-[10px] font-mono text-slate-400 hover:text-[#00f2ff]"
              >
                {copiedSummary ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedSummary ? 'COPIED' : 'COPY SUMMARY'}</span>
              </button>
            </div>
            <p className="text-xs sm:text-sm font-mono text-slate-100 font-semibold leading-relaxed">
              {eventSummary}
            </p>
          </div>

          {/* Section 2: Structured State Changes Audit */}
          {(event.stateChanges || event.explicitStateChanges) && (event.stateChanges?.length || event.explicitStateChanges?.length || 0) > 0 && (
            <div className="p-4 bg-[#05070a] border border-[#1a2b3c] space-y-2 font-mono text-xs">
              <div className="flex items-center gap-2 text-[#00f2ff] text-[10px] uppercase font-bold tracking-wider">
                <Layers className="w-3.5 h-3.5" />
                <span>Explicit State Changes ({(event.stateChanges || event.explicitStateChanges)?.length})</span>
              </div>
              <div className="space-y-1.5 pt-1">
                {(event.stateChanges || event.explicitStateChanges)?.map((change, idx) => (
                  <div
                    key={idx}
                    className="p-2 bg-[#0c1420] border border-[#1a2b3c] flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 bg-[#05070a] border border-[#00f2ff]/40 text-[#00f2ff] font-bold text-[10px]">
                        {change.operation}
                      </span>
                      <span className="text-slate-300 font-bold">{change.path}</span>
                    </div>
                    <div className="text-[#00f2ff] text-[11px] font-semibold">
                      {typeof change.value === 'object' ? JSON.stringify(change.value) : String(change.value)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 3: Warnings if any */}
          {event.warnings && event.warnings.length > 0 && (
            <div className="p-3 bg-amber-950/30 border border-amber-500/40 font-mono text-xs text-amber-200 space-y-1">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-[10px] uppercase">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Processing Warnings</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-300">
                {event.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Section 4: Full Verbatim Raw Message Payload */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[10px] font-mono font-bold text-slate-400 uppercase tracking-[0.2em]">
                Verbatim System Message Payload (Preserved)
              </label>
              <button
                onClick={handleCopyRaw}
                className="flex items-center gap-1 text-[10px] font-mono text-slate-400 hover:text-[#00f2ff]"
              >
                {copiedRaw ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedRaw ? 'COPIED' : 'COPY RAW'}</span>
              </button>
            </div>
            <div className="relative border border-[#1a2b3c] bg-[#05070a] p-4 font-mono text-xs text-slate-200 leading-relaxed whitespace-pre-wrap break-words max-h-[30vh] overflow-y-auto selection:bg-[#00f2ff]/20 selection:text-[#00f2ff]">
              {event.rawSystemMessage || event.rawMessage}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-t border-[#1a2b3c] bg-[#0c1420]">
          <button
            type="button"
            onClick={handleRetryProcessing}
            disabled={isRetrying}
            className="flex items-center gap-2 px-3.5 py-1.5 border border-[#00f2ff]/40 bg-[#00f2ff]/10 hover:bg-[#00f2ff]/20 text-[#00f2ff] font-mono text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
          >
            {isRetrying ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>PROCESSING...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5" />
                <span>RE-PROCESS WITH GEMINI</span>
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 border border-[#1a2b3c] text-slate-300 hover:bg-slate-800 font-mono text-xs uppercase"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
