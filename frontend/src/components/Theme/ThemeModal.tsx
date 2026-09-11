import React from 'react';
import { X, Moon, Radio, Sparkles, Palette, CheckCircle2 } from 'lucide-react';
import { AppTheme, useTheme } from '../../context/ThemeContext';

interface ThemeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ThemeOption {
  id: AppTheme;
  title: string;
  subtitle: string;
  description: string;
  icon: React.ReactNode;
  previewClass: string;
  badge: string;
}

export const ThemeModal: React.FC<ThemeModalProps> = ({ isOpen, onClose }) => {
  const { theme, setTheme } = useTheme();

  if (!isOpen) return null;

  const themes: ThemeOption[] = [
    {
      id: 'dark',
      title: 'Темный режим (Dark Aesthetic)',
      subtitle: 'True Black OLED & Slate',
      description: 'Черные, глубокие серые и темно-синие оттенки. Экономит заряд батареи OLED-экранов и снижает нагрузку на глаза.',
      icon: <Moon size={20} className="text-blue-400" />,
      previewClass: 'bg-black border-zinc-800 text-white',
      badge: 'Энергосбережение OLED',
    },
    {
      id: 'y2k',
      title: 'Эстетика 2000-х (Y2K / Winamp)',
      subtitle: 'Ретро, пиксель-арт & кислотные акценты',
      description: 'Винтажные элементы интерфейса, пиксельный стиль, кислотный лайм и ретро-вайб в духе культового Winamp и Win98.',
      icon: <Radio size={20} className="text-[#39ff14]" />,
      previewClass: 'bg-[#121216] border-2 border-[#39ff14]/60 text-[#39ff14] font-mono',
      badge: 'Винтажный Winamp',
    },
    {
      id: 'glass',
      title: 'Глассморфизм (Glassmorphism)',
      subtitle: 'Матовое стекло & Неоновые свечения',
      description: 'Эффект матового стекла (backdrop-blur), полупрозрачные карточки, неоновые подсвечивающиеся кнопки и неоновые разделители.',
      icon: <Sparkles size={20} className="text-cyan-400" />,
      previewClass: 'bg-white/10 backdrop-blur-md border border-cyan-400/40 text-cyan-200 shadow-[0_0_15px_rgba(0,240,255,0.2)]',
      badge: 'Неоновое стекло',
    },
    {
      id: 'artwork',
      title: 'Динамические обложки (Artwork-Driven)',
      subtitle: 'Адаптивный фоновый Blur под трек',
      description: 'Интерфейс полностью подстраивается под цвета обложки текущего трека с глубоким кинематографичным размытием.',
      icon: <Palette size={20} className="text-purple-400" />,
      previewClass: 'bg-gradient-to-r from-purple-900/60 to-blue-900/60 backdrop-blur-md border border-purple-400/30 text-purple-200',
      badge: 'Полное погружение',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#12151e] border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Шапка */}
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-600/20 text-purple-400 flex items-center justify-center border border-purple-500/30">
              <Palette size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Темы оформления</h2>
              <p className="text-[11px] text-gray-400">Выберите визуальный стиль плеера</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Список тем */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1 scrollbar-none">
          {themes.map((t) => {
            const isSelected = theme === t.id;
            return (
              <div
                key={t.id}
                onClick={() => {
                  setTheme(t.id);
                }}
                className={`p-3.5 rounded-2xl cursor-pointer transition-all border relative ${
                  isSelected
                    ? 'bg-white/10 border-blue-500 shadow-xl ring-2 ring-blue-500/30'
                    : 'bg-[#181c28] border-white/5 hover:border-white/15'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                      {t.icon}
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white leading-tight">{t.title}</h3>
                      <span className="text-[10px] text-gray-400 block mt-0.5">{t.subtitle}</span>
                    </div>
                  </div>

                  {isSelected ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full flex-shrink-0">
                      <CheckCircle2 size={13} /> Активна
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded-full flex-shrink-0">
                      {t.badge}
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-gray-400 leading-relaxed mb-3">
                  {t.description}
                </p>

                {/* Мини-превью карточки в стиле темы */}
                <div className={`py-2 px-3 rounded-xl text-[11px] flex items-center justify-between transition-all ${t.previewClass}`}>
                  <span className="truncate">Превью стиля карточки трека</span>
                  <span className="text-[10px] opacity-75">3:24</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Кнопка закрытия */}
        <div className="p-4 border-t border-white/5">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition-all active:scale-98"
          >
            Применить
          </button>
        </div>
      </div>
    </div>
  );
};
