import React from 'react';
import { Music, Settings } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export type TabType = 'player' | 'settings';

interface BottomBarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export const BottomBar: React.FC<BottomBarProps> = ({ activeTab, setActiveTab }) => {
  const { theme, accentColor } = useTheme();

  const tabs = [
    { id: 'player' as TabType, label: 'Плеер', icon: Music },
    { id: 'settings' as TabType, label: 'Настройки', icon: Settings },
  ];

  const getActiveColor = () => {
    if (theme === 'y2k') return '#39ff14';
    if (theme === 'glass') return '#00f0ff';
    if (theme === 'artwork') return accentColor;
    return '#3b82f6';
  };

  return (
    <nav className="w-full theme-card bg-[#12141a]/95 backdrop-blur-lg border-t border-white/10 pb-safe transition-colors duration-300 pointer-events-auto">
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
                isActive ? 'scale-105 font-bold' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
              <span className={`text-[11px] mt-1 font-medium ${isActive ? 'font-semibold' : ''}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
