import React, { useState, useEffect } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { PlayerProvider, usePlayer } from './context/PlayerContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { BottomBar, TabType } from './components/Navigation/BottomBar';
import { MiniPlayer } from './components/Player/MiniPlayer';
import { FullPlayerModal } from './components/Player/FullPlayerModal';
import { PlayerMain } from './components/Player/PlayerMain';
import { AccountsModal } from './components/Settings/AccountsModal';
import { useBackNavigation } from './services/backNavigation';

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('player');
  const { theme } = useTheme();
  const { currentTrack } = usePlayer();

  // Настройка строки состояния Android: прозрачность и светлые иконки
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
      StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
    }
  }, []);

  // При жесте "Назад" со вкладки настроек возвращаемся на плеер
  useBackNavigation('app_settings_tab', activeTab === 'settings', () => setActiveTab('player'), 5);

  return (
    <div className="h-full w-full relative text-white flex flex-col overflow-hidden select-none transition-colors duration-500">
      {/* 1. Динамический Blur-фон для темы Artwork-Driven */}
      {theme === 'artwork' && currentTrack?.cover_url && (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
          <img
            src={currentTrack.cover_url}
            alt=""
            onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
            className="w-full h-full object-cover blur-[90px] scale-135 opacity-40 transition-all duration-1000 ease-out"
          />
          <div className="absolute inset-0 bg-black/60" />
        </div>
      )}

      {/* 2. Неоновые светящиеся сферы для темы Glassmorphism */}
      {theme === 'glass' && (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-cyan-500/20 rounded-full blur-[110px]" />
          <div className="absolute top-1/2 -right-32 w-96 h-96 bg-blue-600/20 rounded-full blur-[110px]" />
          <div className="absolute -bottom-32 left-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[110px]" />
        </div>
      )}

      {/* 3. Ретро-сетка для темы Y2K */}
      {theme === 'y2k' && (
        <div
          className="fixed inset-0 pointer-events-none z-0 opacity-15 bg-[radial-gradient(#39ff14_1px,transparent_1px)] [background-size:20px_20px]"
          aria-hidden="true"
        />
      )}

      {/* Экран активной вкладки: Плеер или Настройки (единственный скролл-контейнер) */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative z-10 overscroll-contain">
        {activeTab === 'player' && <PlayerMain onOpenSettings={() => setActiveTab('settings')} />}
        {activeTab === 'settings' && <AccountsModal />}
      </main>

      {/* Полноэкранный плеер */}
      <FullPlayerModal />

      {/* Закрепленный блок снизу: Мини-плеер + Нижняя панель навигации */}
      <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none flex flex-col justify-end items-center">
        <MiniPlayer />
        <BottomBar activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <PlayerProvider>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </PlayerProvider>
  );
};

export default App;
