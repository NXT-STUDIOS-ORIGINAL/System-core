import React, { useState } from 'react';
import { SystemCoreProvider } from './context/SystemCoreContext';
import { Header } from './components/Header';
import { Navigation, ScreenType } from './components/Navigation';
import { HomeScreen } from './components/HomeScreen';
import { PlayerScreen } from './components/PlayerScreen';
import { EventsScreen } from './components/EventsScreen';
import { ContextPackageScreen } from './components/ContextPackageScreen';
import { ChangeChatScreen } from './components/ChangeChatScreen';
import { SessionsScreen } from './components/SessionsScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { SystemInputModal } from './components/SystemInputModal';
import { EventDetailModal } from './components/EventDetailModal';
import { ToastContainer } from './components/Toast';
import { SystemEvent } from './types';

function MainApp() {
  const [activeScreen, setActiveScreen] = useState<ScreenType>('home');
  const [isInputModalOpen, setIsInputModalOpen] = useState<boolean>(false);
  const [selectedEvent, setSelectedEvent] = useState<SystemEvent | null>(null);

  const handleNavigate = (screen: ScreenType) => {
    setActiveScreen(screen);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#05070a] text-slate-300 font-sans border-2 sm:border-4 border-[#0c1420] selection:bg-[#00f2ff]/20 selection:text-[#00f2ff]">
      {/* Top HUD Header */}
      <Header
        activeScreen={activeScreen}
        onOpenSystemInput={() => setIsInputModalOpen(true)}
      />

      {/* Navigation (Desktop Top Bar / Tablet / Mobile Bar) */}
      <Navigation
        activeScreen={activeScreen}
        onNavigate={handleNavigate}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 pb-24 sm:pb-10">
        {activeScreen === 'home' && (
          <HomeScreen
            onOpenSystemInput={() => setIsInputModalOpen(true)}
            onNavigate={handleNavigate}
            onSelectEvent={(evt) => setSelectedEvent(evt)}
          />
        )}

        {activeScreen === 'player' && <PlayerScreen />}

        {activeScreen === 'events' && (
          <EventsScreen
            onOpenSystemInput={() => setIsInputModalOpen(true)}
            onSelectEvent={(evt) => setSelectedEvent(evt)}
          />
        )}

        {activeScreen === 'context' && <ContextPackageScreen />}

        {activeScreen === 'change_chat' && <ChangeChatScreen />}

        {activeScreen === 'sessions' && <SessionsScreen />}

        {activeScreen === 'settings' && <SettingsScreen />}
      </main>

      {/* System Input Dedicated Modal */}
      <SystemInputModal
        isOpen={isInputModalOpen}
        onClose={() => setIsInputModalOpen(false)}
        onSuccessNavigate={() => setActiveScreen('events')}
      />

      {/* Event Details Inspector Modal */}
      <EventDetailModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />

      {/* HUD Toast Notifications */}
      <ToastContainer />
    </div>
  );
}

export default function App() {
  return (
    <SystemCoreProvider>
      <MainApp />
    </SystemCoreProvider>
  );
}
