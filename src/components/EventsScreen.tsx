import React, { useState } from 'react';
import { useSystemCore } from '../context/SystemCoreContext';
import { SystemEvent, EventImportance } from '../types';
import {
  History,
  Search,
  Copy,
  Check,
  ChevronRight,
  Calendar,
  Tag,
  Terminal,
  Filter,
  Trash2,
  Sparkles,
  Download,
  CheckCheck,
  Flame,
  ShieldAlert,
  AlertCircle,
  Eye,
} from 'lucide-react';

interface EventsScreenProps {
  onOpenSystemInput: () => void;
  onSelectEvent: (event: SystemEvent) => void;
}

export const EventsScreen: React.FC<EventsScreenProps> = ({
  onOpenSystemInput,
  onSelectEvent,
}) => {
  const { db, markEventsAsRead, markEventAsRead, unreadEventCount, showToast } = useSystemCore();
  const [searchQuery, setSearchQuery] = useState('');
  const [importanceFilter, setImportanceFilter] = useState<string>('all');
  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredEvents = db.events.filter((evt) => {
    // Importance filter
    if (importanceFilter !== 'all') {
      const evtImp = evt.importance || 'NORMAL';
      if (evtImp !== importanceFilter) return false;
    }

    // Read status filter
    const isUnread = !evt.read || evt.readStatus === 'UNREAD';
    if (readFilter === 'unread' && !isUnread) return false;
    if (readFilter === 'read' && isUnread) return false;

    // Search query
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      evt.id.toLowerCase().includes(query) ||
      evt.source.toLowerCase().includes(query) ||
      (evt.summary && evt.summary.toLowerCase().includes(query)) ||
      (evt.rawSystemMessage && evt.rawSystemMessage.toLowerCase().includes(query)) ||
      evt.rawMessage.toLowerCase().includes(query) ||
      (evt.importance && evt.importance.toLowerCase().includes(query))
    );
  });

  const handleCopyRaw = async (evt: SystemEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(evt.rawSystemMessage || evt.rawMessage);
      setCopiedId(evt.id);
      showToast(`Copied event [${evt.id}] raw message`, 'success');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      showToast('Failed to copy', 'error');
    }
  };

  const handleSelectEvent = (evt: SystemEvent) => {
    markEventAsRead(evt.id);
    onSelectEvent(evt);
  };

  const handleExportEventsJSON = () => {
    const blob = new Blob([JSON.stringify(db.events, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `system-events-log-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Exported events log JSON', 'info');
  };

  const renderImportanceBadge = (importance?: EventImportance | string) => {
    switch (importance) {
      case 'CRITICAL':
        return (
          <span className="px-1.5 py-0.5 border border-rose-500/60 bg-rose-500/20 text-rose-300 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-[0_0_8px_rgba(244,63,94,0.2)]">
            <Flame className="w-2.5 h-2.5 text-rose-400" />
            CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="px-1.5 py-0.5 border border-amber-500/60 bg-amber-500/20 text-amber-300 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1">
            <ShieldAlert className="w-2.5 h-2.5 text-amber-400" />
            HIGH
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="px-1.5 py-0.5 border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 text-[9px] font-bold uppercase">
            MEDIUM
          </span>
        );
      default:
        return (
          <span className="px-1.5 py-0.5 border border-slate-700 bg-slate-800/80 text-slate-400 text-[9px] uppercase font-medium">
            NORMAL
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="hud-panel p-4 sm:p-5 border border-[#1a2b3c] hud-border-bracket flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#00f2ff] text-[10px] font-mono tracking-[0.2em] uppercase">
            <History className="w-3.5 h-3.5" />
            <span>SESSION READING &amp; IMMUTABLE EVENT MEMORY</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold font-mono text-slate-100 tracking-[0.2em] uppercase mt-1">
            EVENTS ARCHIVE ({db.events.length})
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl font-mono">
            Verbatim ChatGPT inputs preserved permanently with event summaries, importance tags, and state change audits.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {unreadEventCount > 0 && (
            <button
              onClick={() => markEventsAsRead()}
              className="flex items-center gap-1.5 px-3 py-2 border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors"
              title="Mark all unread events as read"
            >
              <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>MARK READ ({unreadEventCount})</span>
            </button>
          )}

          {db.events.length > 0 && (
            <button
              onClick={handleExportEventsJSON}
              className="flex items-center gap-1.5 px-3 py-2 border border-[#1a2b3c] bg-[#05070a] hover:bg-[#00f2ff]/5 hover:border-[#00f2ff]/30 text-slate-300 font-mono text-[11px] font-bold uppercase tracking-wider transition-colors"
              title="Export raw events as JSON"
            >
              <Download className="w-3.5 h-3.5 text-[#00f2ff]" />
              <span>EXPORT JSON</span>
            </button>
          )}

          <button
            onClick={onOpenSystemInput}
            className="flex items-center gap-2 px-4 py-2 border border-[#00f2ff]/60 bg-[#00f2ff]/10 hover:bg-[#00f2ff]/20 text-[#00f2ff] font-bold font-mono text-[11px] uppercase tracking-widest transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>RECORD NEW EVENT</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="hud-panel p-4 border border-[#1a2b3c] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 font-mono text-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events by ID, summary, or raw text..."
            className="w-full pl-9 pr-3 py-2 bg-[#05070a] border border-[#1a2b3c] text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#00f2ff] text-xs font-mono"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 justify-end">
          {/* Importance Filter */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[11px]">IMPORTANCE:</span>
            <select
              value={importanceFilter}
              onChange={(e) => setImportanceFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-[#05070a] border border-[#1a2b3c] text-[#00f2ff] font-mono text-xs focus:outline-none focus:border-[#00f2ff]"
            >
              <option value="all">All Importance</option>
              <option value="CRITICAL">Critical Only</option>
              <option value="HIGH">High Importance</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low / Normal</option>
            </select>
          </div>

          {/* Read Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-[11px]">STATUS:</span>
            <select
              value={readFilter}
              onChange={(e) => setReadFilter(e.target.value as any)}
              className="px-2.5 py-1.5 bg-[#05070a] border border-[#1a2b3c] text-[#00f2ff] font-mono text-xs focus:outline-none focus:border-[#00f2ff]"
            >
              <option value="all">All Events</option>
              <option value="unread">Unread Only</option>
              <option value="read">Read</option>
            </select>
          </div>
        </div>
      </div>

      {/* Events List */}
      {filteredEvents.length === 0 ? (
        <div className="hud-panel p-12 text-center border border-[#1a2b3c]">
          <Terminal className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold font-mono text-slate-300 uppercase tracking-wider">
            {db.events.length === 0 ? 'No events recorded in system log' : 'No matching events found'}
          </h3>
          <p className="text-xs text-slate-500 font-mono mt-1 max-w-md mx-auto">
            {db.events.length === 0
              ? 'Paste your first ChatGPT message via [ SYSTEM INPUT ] to begin logging raw timeline records.'
              : 'Try clearing your search query or adjusting the filters.'}
          </p>
          {db.events.length === 0 && (
            <button
              onClick={onOpenSystemInput}
              className="mt-4 px-4 py-2 border border-[#00f2ff]/60 bg-[#00f2ff]/10 hover:bg-[#00f2ff]/20 text-[#00f2ff] font-bold font-mono text-xs uppercase"
            >
              RECORD EVENT NOW
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5 font-mono">
          {filteredEvents.map((evt) => {
            const isCopied = copiedId === evt.id;
            const isUnread = !evt.read || evt.readStatus === 'UNREAD';
            const importance = evt.importance || 'NORMAL';

            // Distinctive border styling based on importance and read status
            let borderStyle = 'border-[#1a2b3c] hover:border-[#00f2ff]/40 hover:bg-[#0c1420]';
            if (isUnread) {
              borderStyle = 'border-[#00f2ff]/60 bg-[#00f2ff]/5 hover:bg-[#00f2ff]/10 shadow-[0_0_15px_rgba(0,242,255,0.08)]';
            } else if (importance === 'CRITICAL') {
              borderStyle = 'border-rose-500/40 bg-rose-950/10 hover:bg-rose-950/20 hover:border-rose-500/60';
            } else if (importance === 'HIGH') {
              borderStyle = 'border-amber-500/30 bg-amber-950/10 hover:bg-amber-950/20 hover:border-amber-500/50';
            }

            return (
              <div
                key={evt.id}
                onClick={() => handleSelectEvent(evt)}
                className={`group hud-panel p-4 sm:p-5 border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer ${borderStyle}`}
              >
                <div className="min-w-0 flex-1">
                  {/* Metadata line */}
                  <div className="flex flex-wrap items-center gap-2 mb-2 text-[10px] text-slate-400">
                    <span className="px-2 py-0.5 border border-[#00f2ff]/30 text-[#00f2ff] bg-[#00f2ff]/5 font-bold">
                      {evt.id}
                    </span>

                    {/* Unread Pill */}
                    {isUnread && (
                      <span className="px-1.5 py-0.5 bg-[#00f2ff] text-slate-950 text-[9px] font-bold uppercase tracking-wider animate-pulse">
                        UNREAD
                      </span>
                    )}

                    {/* Importance Badge */}
                    {renderImportanceBadge(evt.importance)}

                    {/* State Changes Indicator */}
                    {evt.stateChangesApplied && (
                      <span className="px-1.5 py-0.5 border border-emerald-500/40 text-emerald-400 bg-emerald-500/10 text-[9px] font-bold uppercase">
                        STATE UPDATED
                      </span>
                    )}

                    <span className="text-slate-700">•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-[#00f2ff]" />
                      {evt.formattedDate || new Date(evt.timestamp).toLocaleString()}
                    </span>
                    <span className="text-slate-700">•</span>
                    <span className="text-slate-300 font-semibold">SOURCE: {evt.source}</span>
                    <span className="text-slate-700">•</span>
                    <span className="text-slate-500">{(evt.rawSystemMessage || evt.rawMessage).length} chars</span>
                  </div>

                  {/* Summary Preview */}
                  {evt.summary && (
                    <div className={`mb-2 p-2 text-xs font-semibold ${
                      importance === 'CRITICAL'
                        ? 'bg-rose-950/30 border-l-2 border-rose-500 text-rose-100'
                        : importance === 'HIGH'
                        ? 'bg-amber-950/30 border-l-2 border-amber-500 text-amber-100'
                        : 'bg-[#0c1420] border-l-2 border-[#00f2ff] text-slate-100'
                    }`}>
                      {evt.summary}
                    </div>
                  )}

                  {/* Raw message preview snippet */}
                  <p className="text-[11px] text-slate-400 font-mono line-clamp-2 leading-relaxed break-words bg-[#05070a] p-2 border border-[#1a2b3c]">
                    {evt.rawSystemMessage || evt.rawMessage}
                  </p>
                </div>

                {/* Right actions */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    onClick={(e) => handleCopyRaw(evt, e)}
                    className="p-2 border border-[#1a2b3c] bg-[#05070a] hover:border-[#00f2ff]/30 text-slate-300 hover:text-[#00f2ff] transition-colors"
                    title="Copy raw message"
                  >
                    {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  </button>

                  <div className="p-2 text-slate-600 group-hover:text-[#00f2ff] transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
