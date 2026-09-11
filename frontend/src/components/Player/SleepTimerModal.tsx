import React from 'react';
import { Moon, Clock, Check, X } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { useBackNavigation } from '../../services/backNavigation';

interface SleepTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TIMER_OPTIONS: Array<{ label: string; value: 'off' | 'end_of_track' | number }> = [
  { label: 'Выключен', value: 'off' },
  { label: '15 минут', value: 15 },
  { label: '30 минут', value: 30 },
  { label: '45 минут', value: 45 },
  { label: '60 минут (1 час)', value: 60 },
  { label: 'До конца текущего трека', value: 'end_of_track' },
];

function formatRemaining(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m > 0) {
    return `${m} мин ${s < 10 ? '0' : ''}${s} сек`;
  }
  return `${s} сек`;
}

export const SleepTimerModal: React.FC<SleepTimerModalProps> = ({ isOpen, onClose }) => {
  const { sleepTimerOption, sleepTimerRemaining, setSleepTimer } = usePlayer();

  useBackNavigation('sleep_timer_modal', isOpen, onClose, 70);

  if (!isOpen) return null;

  const handleSelect = (val: 'off' | 'end_of_track' | number) => {
    setSleepTimer(val);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div
        className="w-full sm:max-w-sm bg-[#161a23] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-slideUp text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400">
              <Moon size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold">Таймер сна</h3>
              <p className="text-[11px] text-gray-400">
                {sleepTimerRemaining !== null
                  ? `Осталось: ${formatRemaining(sleepTimerRemaining)}`
                  : sleepTimerOption === 'end_of_track'
                  ? 'Остановится после трека'
                  : 'Плавное затухание перед сном'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        {/* Список опций */}
        <div className="py-3 space-y-1.5">
          {TIMER_OPTIONS.map((opt) => {
            const isSelected = sleepTimerOption === opt.value;

            return (
              <button
                key={String(opt.value)}
                onClick={() => handleSelect(opt.value)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white font-semibold shadow-lg shadow-blue-600/30 scale-[1.01]'
                    : 'bg-white/5 hover:bg-white/10 text-gray-300 font-medium'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Clock size={16} className={isSelected ? 'text-white' : 'text-gray-400'} />
                  <span className="text-sm">{opt.label}</span>
                </div>
                {isSelected && <Check size={18} className="text-white" />}
              </button>
            );
          })}
        </div>

        <div className="pt-2 text-center">
          <p className="text-[11px] text-gray-500">
            Музыка плавно затихнет за 20 секунд до выключения
          </p>
        </div>
      </div>
    </div>
  );
};
