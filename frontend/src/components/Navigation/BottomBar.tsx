import React from 'react';
import { Music, Settings, HardDrive } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export type TabType = 'player' | 'offline' | 'settings';

interface BottomBarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export const BottomBar: React.FC<BottomBarProps> = ({ activeTab, setActiveTab }) => {
  useTheme();

  const tabs = [
    { id: 'player' as TabType, label: 'Плеер', icon: Music },
    { id: 'offline' as TabType, label: 'Сохранённые', icon: HardDrive },
    { id: 'settings' as TabType, label: 'Настройки', icon: Settings },
  ];

  const getActiveColor = () => {
    return '#ffffff';
  };

  return (
    <nav className="w-full bg-zinc-950/80 backdrop-blur-2xl border-t border-white/5 pb-safe transition-colors duration-300 pointer-events-auto">
      <div className="flex items-center justify-around h-16 max-w-md mx-auto px-6">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const activeStyle = isActive
            ? { color: getActiveColor() }
            : undefined;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={activeStyle}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-all duration-200 ${
                isActive ? 'scale-105 font-bold' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              <span className={`text-[11px] mt-1 tracking-tight ${isActive ? 'font-semibold text-white' : 'font-medium'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
