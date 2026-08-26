import React from 'react';
import { useSystemCore } from '../context/SystemCoreContext';
import {
  Home,
  User,
  History,
  FileText,
  Repeat,
  Radio,
  Settings,
} from 'lucide-react';

export type ScreenType =
  | 'home'
  | 'player'
  | 'events'
  | 'context'
  | 'change_chat'
  | 'sessions'
  | 'settings';

interface NavigationProps {
  activeScreen: ScreenType;
  onNavigate: (screen: ScreenType) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeScreen, onNavigate }) => {
  const { db, unreadEventCount } = useSystemCore();
  const sessionCount = db.sessions.length;

  const navItems = [
    { id: 'home' as ScreenType, label: 'HOME', icon: Home },
    { id: 'player' as ScreenType, label: 'PLAYER', icon: User },
    {
      id: 'events' as ScreenType,
      label: 'EVENTS',
      icon: History,
      badge: unreadEventCount > 0 ? (unreadEventCount > 99 ? '99+' : unreadEventCount) : undefined,
    },
    { id: 'context' as ScreenType, label: 'CONTEXT', icon: FileText },
    { id: 'change_chat' as ScreenType, label: 'CHANGE CHAT', icon: Repeat },
    {
      id: 'sessions' as ScreenType,
      label: 'SESSIONS',
      icon: Radio,
      badge: sessionCount > 1 ? sessionCount : undefined,
    },
    { id: 'settings' as ScreenType, label: 'SETTINGS', icon: Settings },
  ];

  return (
    <nav className="w-full bg-[#0a0f18] border-t sm:border-t-0 sm:border-b border-[#1a2b3c] sticky bottom-0 sm:static z-40">
      <div className="max-w-7xl mx-auto px-2 sm:px-8">
        <div className="flex items-center justify-around sm:justify-start gap-1 sm:gap-2 overflow-x-auto py-1 sm:py-2 scrollbar-none">
          {navItems.map((item) => {
            const isActive = activeScreen === item.id;
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`flex sm:flex-row flex-col items-center justify-center gap-1 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-none font-mono text-[10px] sm:text-[11px] font-bold tracking-widest transition-all whitespace-nowrap min-w-[50px] sm:min-w-0 min-h-[44px] sm:min-h-0 ${
                  isActive
                    ? 'bg-[#00f2ff]/5 text-[#00f2ff] border border-[#00f2ff]/40 shadow-[0_0_10px_rgba(0,242,255,0.1)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30 border border-transparent'
                }`}
              >
                <div className="relative">
                  <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isActive ? 'text-[#00f2ff]' : 'text-slate-400'}`} />
                  {item.badge && (
                    <span className="absolute -top-1.5 -right-2.5 px-1 py-0.2 bg-[#00f2ff] text-slate-950 text-[9px] font-mono font-bold rounded-full min-w-[14px] text-center leading-tight">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
