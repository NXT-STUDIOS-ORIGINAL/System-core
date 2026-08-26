import React, { useState, useMemo } from 'react';
import { useSystemCore } from '../context/SystemCoreContext';
import { generateContextPackage } from '../services/contextGenerator';
import { FileText, Copy, Check, Sliders, Info, Download, ShieldCheck } from 'lucide-react';

export const ContextPackageScreen: React.FC = () => {
  const { db, showToast } = useSystemCore();
  const [recentEventLimit, setRecentEventLimit] = useState<number>(5);
  const [copied, setCopied] = useState<boolean>(false);

  const contextPackageText = useMemo(() => {
    return generateContextPackage(db, { recentEventLimit });
  }, [db, recentEventLimit]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(contextPackageText);
      setCopied(true);
      showToast('System Context Package copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      showToast('Failed to copy to clipboard', 'error');
    }
  };

  const handleDownloadText = () => {
    const blob = new Blob([contextPackageText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `system-context-package-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Context package downloaded', 'info');
  };

  const lineCount = contextPackageText.split('\n').length;
  const charCount = contextPackageText.length;
  const estTokens = Math.round(charCount / 4);

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Title / Info card */}
      <div className="hud-panel p-4 sm:p-5 border border-[#1a2b3c] hud-border-bracket flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#00f2ff] text-[10px] font-mono tracking-[0.2em] uppercase">
            <FileText className="w-3.5 h-3.5" />
            <span>SYSTEM STATE EXPORT ENGINE</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold font-mono text-slate-100 tracking-[0.2em] uppercase mt-1">
            GENERATE CONTEXT
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl font-mono">
            Generates a compact, comprehensive text package representing all persistent System states, events, and variables to seed into ChatGPT.
          </p>
        </div>

        {/* Main Copy Action */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-5 py-2.5 border border-[#00f2ff]/60 bg-[#00f2ff]/10 hover:bg-[#00f2ff]/20 text-[#00f2ff] font-mono text-xs sm:text-sm font-bold tracking-widest uppercase transition-all shadow-[0_0_12px_rgba(0,242,255,0.15)]"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'COPIED TO CLIPBOARD' : 'COPY CONTEXT'}</span>
          </button>

          <button
            onClick={handleDownloadText}
            className="flex items-center gap-1.5 px-3 py-2 border border-[#1a2b3c] bg-[#05070a] hover:border-[#00f2ff]/30 text-slate-300 font-mono text-xs font-bold uppercase transition-colors"
            title="Download TXT file"
          >
            <Download className="w-3.5 h-3.5 text-[#00f2ff]" />
            <span className="hidden sm:inline">TXT</span>
          </button>
        </div>
      </div>

      {/* Controls & Metrics bar */}
      <div className="hud-panel p-4 border border-[#1a2b3c] flex flex-wrap items-center justify-between gap-4 font-mono text-xs">
        <div className="flex items-center gap-3">
          <Sliders className="w-3.5 h-3.5 text-[#00f2ff]" />
          <span className="text-slate-400 text-[11px]">RECENT EVENTS LIMIT:</span>
          <select
            value={recentEventLimit}
            onChange={(e) => setRecentEventLimit(Number(e.target.value))}
            className="px-2.5 py-1 bg-[#05070a] border border-[#1a2b3c] text-[#00f2ff] font-mono focus:outline-none focus:border-[#00f2ff]"
          >
            <option value={3}>3 events</option>
            <option value={5}>5 events (Recommended)</option>
            <option value={10}>10 events</option>
            <option value={20}>20 events</option>
          </select>
        </div>

        <div className="flex items-center gap-4 text-slate-400 text-[11px]">
          <span>
            LINES: <strong className="text-slate-200">{lineCount}</strong>
          </span>
          <span className="text-slate-700">|</span>
          <span>
            CHARS: <strong className="text-slate-200">{charCount}</strong>
          </span>
          <span className="text-slate-700">|</span>
          <span>
            EST. TOKENS: <strong className="text-emerald-400">~{estTokens}</strong>
          </span>
        </div>
      </div>

      {/* Live Generated Preview container */}
      <div className="hud-panel p-5 border border-[#1a2b3c]">
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#1a2b3c]">
          <label className="text-[10px] font-mono text-[#00f2ff] uppercase tracking-[0.2em] font-bold flex items-center gap-2">
            <span>Generated Plain-Text Output</span>
          </label>
          <span className="text-[10px] font-mono text-slate-500">
            Formatted for ChatGPT context limits
          </span>
        </div>

        <div className="relative bg-[#05070a] border border-[#1a2b3c] p-4 sm:p-5 font-mono text-xs sm:text-sm text-slate-300 leading-relaxed overflow-x-auto max-h-[55vh] overflow-y-auto whitespace-pre selection:bg-[#00f2ff]/20 selection:text-[#00f2ff]">
          {contextPackageText}
        </div>

        <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-[11px]">Unpopulated sections cleanly marked as <strong className="text-slate-300">NO DATA</strong>.</span>
          </div>

          <button
            onClick={handleCopy}
            className="text-[#00f2ff] hover:underline font-bold text-[11px] uppercase tracking-wider"
          >
            {copied ? '✓ Copied' : 'Click here to copy full package'}
          </button>
        </div>
      </div>
    </div>
  );
};
