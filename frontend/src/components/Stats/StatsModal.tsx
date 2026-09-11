import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  X,
  Clock,
  Music,
  Crown,
  Trash2,
  Sparkles,
} from 'lucide-react';
import {
  StatPeriod,
  getSummaryStats,
  clearStatsHistory,
} from '../../services/statsService';
import { useBackNavigation } from '../../services/backNavigation';

interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatDurationHuman(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds} сек`;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) {
    return `${hours} ч ${minutes} мин`;
  }
  return `${minutes} мин`;
}

export const StatsModal: React.FC<StatsModalProps> = ({ isOpen, onClose }) => {
  const [period, setPeriod] = useState<StatPeriod>('week');
  const [stats, setStats] = useState(() => getSummaryStats('week'));

  useBackNavigation('stats_modal', isOpen, onClose, 64);

  useEffect(() => {
    if (isOpen) {
      setStats(getSummaryStats(period));
    }
  }, [isOpen, period]);

  if (!isOpen) return null;

  const handleClear = () => {
    if (confirm('Вы уверены, что хотите сбросить историю прослушиваний?')) {
      clearStatsHistory();
      setStats(getSummaryStats(period));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div
        className="w-full max-w-md bg-[#161a23] border border-white/10 rounded-3xl p-6 shadow-2xl text-white select-none animate-slideUp max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center text-white shadow-lg shadow-purple-600/30">
              <TrendingUp size={20} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-base font-bold">Статистика</h3>
                <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Wrapped
                </span>
              </div>
              <p className="text-[11px] text-gray-400">Ваша музыкальная активность</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleClear}
              title="Сбросить историю"
              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:text-red-400 bg-white/5 active:scale-90 transition-all"
            >
              <Trash2 size={15} />
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-white bg-white/5 active:scale-90 transition-all"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Переключатель периода */}
        <div className="flex p-1 rounded-2xl bg-white/5 border border-white/10 mb-4 gap-1">
          {[
            { id: 'today' as StatPeriod, label: 'Сегодня' },
            { id: 'week' as StatPeriod, label: '7 дней' },
            { id: 'month' as StatPeriod, label: '30 дней' },
            { id: 'all' as StatPeriod, label: 'Всё время' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setPeriod(item.id)}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all ${
                period === item.id
                  ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/25'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Метрики */}
        <div className="grid grid-cols-3 gap-2.5 mb-5">
          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-center">
            <Clock size={16} className="text-cyan-400 mx-auto mb-1" />
            <p className="text-xs font-bold text-white truncate">
              {formatDurationHuman(stats.totalSeconds)}
            </p>
            <span className="text-[10px] text-gray-400">Время</span>
          </div>

          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-center">
            <Music size={16} className="text-emerald-400 mx-auto mb-1" />
            <p className="text-xs font-bold text-white truncate">{stats.totalTracks}</p>
            <span className="text-[10px] text-gray-400">Треков</span>
          </div>

          <div className="p-3 rounded-2xl bg-white/5 border border-white/10 text-center">
            <Crown size={16} className="text-amber-400 mx-auto mb-1" />
            <p className="text-xs font-bold text-white truncate">
              {stats.topArtistName || '—'}
            </p>
            <span className="text-[10px] text-gray-400">Топ-артист</span>
          </div>
        </div>

        {/* Топ-5 исполнителей */}
        <div className="mb-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2.5 flex items-center gap-1.5">
            <Sparkles size={14} className="text-purple-400" />
            <span>Любимые исполнители</span>
          </h4>

          {stats.topArtists.length === 0 ? (
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center text-xs text-gray-500">
              Пока нет данных за этот период. Слушайте музыку в Harmonix, и здесь появится статистика!
            </div>
          ) : (
            <div className="space-y-2.5">
              {stats.topArtists.map((a, idx) => (
                <div key={a.artist} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-gray-200 truncate pr-2">
                      <span className="text-gray-500 font-mono mr-1.5">{idx + 1}.</span>
                      {a.artist}
                    </span>
                    <span className="text-[11px] text-gray-400 font-mono flex-shrink-0">
                      {formatDurationHuman(a.totalSeconds)}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                      style={{ width: `${Math.max(5, a.percent)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Топ-5 треков */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2.5">
            Самые прослушиваемые треки
          </h4>

          {stats.topTracks.length === 0 ? (
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center text-xs text-gray-500">
              Нет прослушанных треков
            </div>
          ) : (
            <div className="space-y-1.5">
              {stats.topTracks.map((t, idx) => (
                <div
                  key={`${t.title}-${t.artist}`}
                  className="flex items-center justify-between p-2.5 rounded-2xl bg-white/5 border border-white/5"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="text-xs font-bold text-white truncate">
                      <span className="text-gray-500 font-mono mr-1.5">{idx + 1}.</span>
                      {t.title}
                    </p>
                    <p className="text-[10px] text-gray-400 truncate pl-4">{t.artist}</p>
                  </div>
                  <span className="text-[11px] font-bold text-purple-400 font-mono flex-shrink-0 bg-purple-500/10 px-2 py-0.5 rounded-lg border border-purple-500/20">
                    {t.count}x
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
