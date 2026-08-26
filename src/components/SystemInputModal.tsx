import React, { useState, useRef, useMemo } from 'react';
import { useSystemCore } from '../context/SystemCoreContext';
import { parseSystemMessage } from '../services/stateParser';
import {
  Sparkles,
  Clipboard,
  Trash2,
  ArrowLeft,
  Terminal,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Layers,
} from 'lucide-react';

interface SystemInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessNavigate?: () => void;
}

export const SystemInputModal: React.FC<SystemInputModalProps> = ({
  isOpen,
  onClose,
  onSuccessNavigate,
}) => {
  const { addSystemEvent, checkIsDuplicate, activeSession, showToast } = useSystemCore();
  const [rawText, setRawText] = useState('');
  const [source, setSource] = useState('ChatGPT');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Live parse preview
  const parsedPreview = useMemo(() => {
    if (!rawText.trim()) return null;
    return parseSystemMessage(rawText);
  }, [rawText]);

  if (!isOpen) return null;

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setRawText((prev) => (prev ? prev + '\n' + text : text));
        showToast('Pasted clipboard contents', 'info');
      } else {
        showToast('Clipboard is empty', 'warning');
      }
    } catch (err) {
      showToast('Clipboard read access denied. Use Ctrl+V / Command+V directly.', 'warning');
      textareaRef.current?.focus();
    }
  };

  const handleClear = () => {
    setRawText('');
    setShowDuplicateWarning(false);
  };

  const initiateProcess = () => {
    const trimmed = rawText.trim();
    if (!trimmed) {
      showToast('Please paste or type a System message first.', 'warning');
      textareaRef.current?.focus();
      return;
    }

    // Check for duplicate message
    const duplicate = checkIsDuplicate(trimmed);
    if (duplicate) {
      setShowDuplicateWarning(true);
      return;
    }

    executeProcess(false);
  };

  const executeProcess = async (bypassDuplicate: boolean = false) => {
    const trimmed = rawText.trim();
    if (!trimmed) return;

    setIsProcessing(true);
    setShowDuplicateWarning(false);

    try {
      const result = await addSystemEvent(trimmed, {
        source: source.trim() || 'ChatGPT',
        type: 'system_input',
        tags: ['chatgpt_payload', 'system_input'],
        metadata: {
          charLength: trimmed.length,
          lineCount: trimmed.split('\n').length,
          sessionId: activeSession?.id,
          sessionLabel: activeSession?.label,
          processedAt: new Date().toISOString(),
          bypassedDuplicate: bypassDuplicate,
        },
      });

      setRawText('');
      setIsProcessing(false);
      onClose();

      if (onSuccessNavigate) {
        onSuccessNavigate();
      }
    } catch (err) {
      setIsProcessing(false);
      showToast('Failed to process message into storage.', 'error');
    }
  };

  const charCount = rawText.length;
  const lineCount = rawText ? rawText.split('\n').length : 0;
  const wordCount = rawText ? rawText.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#05070a]/90 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl max-h-[95vh] flex flex-col hud-panel border border-[#00f2ff]/50 overflow-hidden shadow-[0_0_30px_rgba(0,242,255,0.15)]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a2b3c] bg-[#0c1420]">
          <div className="flex items-center gap-3">
            <div className="p-2 border border-[#00f2ff]/40 bg-[#00f2ff]/10 text-[#00f2ff]">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold font-mono text-slate-100 tracking-[0.2em] uppercase">
                  SYSTEM INPUT
                </h2>
                <span className="px-2 py-0.5 text-[9px] font-mono border border-[#00f2ff]/40 text-[#00f2ff] bg-[#00f2ff]/5 uppercase tracking-wider font-bold">
                  STATE &amp; MEMORY EXTRACTION
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Ingests raw System messages, preserves original text, extracts state deltas, and updates rolling memory.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-slate-400 hover:text-[#00f2ff] border border-transparent hover:border-[#1a2b3c] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>BACK</span>
          </button>
        </div>

        {/* Source & Session metadata strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-2.5 bg-[#05070a] border-b border-[#1a2b3c] text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[10px] uppercase">SOURCE:</span>
            <input
              type="text"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="px-2 py-1 bg-[#0a0f18] border border-[#1a2b3c] text-[#00f2ff] text-xs font-mono focus:outline-none focus:border-[#00f2ff] w-28"
              placeholder="ChatGPT"
            />
          </div>

          <div className="flex items-center gap-3 text-slate-400 text-[11px]">
            <span>
              SESSION: <strong className="text-[#00f2ff]">{activeSession?.label || 'Session 001'}</strong>
            </span>
            <span className="text-slate-700">|</span>
            <span>
              LINES: <strong className="text-slate-200">{lineCount}</strong>
            </span>
            <span className="text-slate-700">|</span>
            <span>
              CHARS: <strong className="text-slate-200">{charCount}</strong>
            </span>
            <span className="text-slate-700">|</span>
            <span>
              WORDS: <strong className="text-slate-200">{wordCount}</strong>
            </span>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="p-4 sm:p-5 flex-1 flex flex-col min-h-[260px] overflow-y-auto space-y-3 bg-[#0a0f18]">
          {/* Duplicate Warning Prompt */}
          {showDuplicateWarning && (
            <div className="p-4 bg-amber-950/40 border border-amber-500/60 font-mono text-xs text-amber-200 space-y-2 animate-in fade-in duration-150">
              <div className="flex items-center gap-2 font-bold text-amber-400 uppercase tracking-wider text-sm">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                <span>Duplicate System Message Detected</span>
              </div>
              <p className="text-slate-300">
                This exact System message appears to have already been recorded in your event history. Re-processing may duplicate additive stat changes (e.g. XP or stat points).
              </p>
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => executeProcess(true)}
                  className="px-4 py-2 border border-amber-500 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold uppercase tracking-wider text-xs"
                >
                  PROCESS ANYWAY
                </button>
                <button
                  type="button"
                  onClick={() => setShowDuplicateWarning(false)}
                  className="px-4 py-2 border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs"
                >
                  CANCEL
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <label className="text-[10px] font-mono text-[#00f2ff] uppercase tracking-[0.2em] font-bold flex items-center gap-2">
              <span>Paste System Output from ChatGPT</span>
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePasteClipboard}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#05070a] hover:bg-[#00f2ff]/5 border border-[#1a2b3c] hover:border-[#00f2ff]/40 text-[#00f2ff] font-mono text-xs font-medium transition-colors"
              >
                <Clipboard className="w-3.5 h-3.5" />
                <span>PASTE CLIPBOARD</span>
              </button>

              <button
                type="button"
                onClick={handleClear}
                disabled={!rawText}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-[#05070a] hover:bg-rose-950/40 border border-[#1a2b3c] hover:border-rose-500/40 text-slate-400 hover:text-rose-300 font-mono text-xs transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>CLEAR</span>
              </button>
            </div>
          </div>

          <div className="relative flex-1 flex flex-col min-h-[200px]">
            <textarea
              ref={textareaRef}
              value={rawText}
              onChange={(e) => {
                setRawText(e.target.value);
                if (showDuplicateWarning) setShowDuplicateWarning(false);
              }}
              placeholder={`Paste ChatGPT System message here, e.g.:

[STATE UPDATE]
XP: +120
Level: 5
Strength: +1
Quest Completed: Morning Training
New Skill: Sprint

[MEMORY]
The player completed his first major training milestone.`}
              className="w-full flex-1 min-h-[200px] p-4 bg-[#05070a] border border-[#1a2b3c] text-slate-200 placeholder-slate-600 font-mono text-xs sm:text-sm leading-relaxed focus:outline-none focus:border-[#00f2ff] resize-y"
              autoFocus
            />
          </div>

          {/* Real-time Extracted Changes Summary */}
          {parsedPreview && (parsedPreview.stateChanges.hasChanges || parsedPreview.memoryEntry) && (
            <div className="p-3 bg-[#05070a] border border-[#1a2b3c] font-mono text-xs space-y-1.5">
              <div className="flex items-center gap-2 text-[#00f2ff] text-[10px] uppercase font-bold tracking-wider">
                <Layers className="w-3.5 h-3.5" />
                <span>Detected State &amp; Memory Extraction</span>
              </div>
              <div className="text-slate-300 text-[11px] leading-relaxed">
                {parsedPreview.memoryEntry?.summary}
              </div>
              {parsedPreview.stateChanges.rawParsedLines && parsedPreview.stateChanges.rawParsedLines.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {parsedPreview.stateChanges.rawParsedLines.map((line, i) => (
                    <span key={i} className="px-2 py-0.5 bg-[#0c1420] border border-[#1a2b3c] text-[#00f2ff] text-[10px]">
                      {line}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="p-2.5 bg-[#05070a] border border-[#1a2b3c] text-[11px] font-mono text-slate-400 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-[#00f2ff] shrink-0 mt-0.5" />
            <span>
              <strong>Zero Data Loss Guarantee:</strong> This message will be saved intact in the raw event database. Extracted state deltas will update Player State and rolling Recent Memory.
            </span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-t border-[#1a2b3c] bg-[#0c1420]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-[#1a2b3c] text-slate-300 hover:bg-slate-800 font-mono text-xs font-semibold tracking-wider transition-colors"
          >
            CANCEL
          </button>

          <button
            type="button"
            onClick={initiateProcess}
            disabled={isProcessing || !rawText.trim()}
            className="flex items-center gap-2 px-6 py-2.5 border border-[#00f2ff]/60 bg-[#00f2ff]/10 hover:bg-[#00f2ff]/20 active:scale-95 text-[#00f2ff] font-mono text-xs sm:text-sm font-bold tracking-widest uppercase transition-all shadow-[0_0_12px_rgba(0,242,255,0.15)] disabled:opacity-50 disabled:pointer-events-none"
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-[#00f2ff] border-t-transparent rounded-full animate-spin"></div>
                <span>UPDATING STATE...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>PROCESS &amp; UPDATE STATE</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
