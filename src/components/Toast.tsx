import React from 'react';
import { useSystemCore } from '../context/SystemCoreContext';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useSystemCore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        let borderClass = 'border-[#00f2ff]/60 bg-[#0c1420]/95 text-[#00f2ff] shadow-[0_0_15px_rgba(0,242,255,0.15)]';
        let Icon = CheckCircle2;

        if (toast.type === 'error') {
          borderClass = 'border-rose-500/60 bg-[#0c1420]/95 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.15)]';
          Icon = AlertCircle;
        } else if (toast.type === 'warning') {
          borderClass = 'border-amber-500/60 bg-[#0c1420]/95 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.15)]';
          Icon = AlertTriangle;
        } else if (toast.type === 'info') {
          borderClass = 'border-[#00f2ff]/40 bg-[#0c1420]/95 text-slate-200 shadow-[0_0_15px_rgba(0,242,255,0.1)]';
          Icon = Info;
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 border font-mono backdrop-blur-md transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 ${borderClass}`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Icon className="w-4 h-4 shrink-0" />
              <span className="text-xs font-mono uppercase tracking-wider leading-tight truncate">{toast.message}</span>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="p-1 text-slate-400 hover:text-white transition-colors shrink-0"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
