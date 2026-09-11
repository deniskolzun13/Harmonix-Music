import React, { useState, useEffect } from 'react';
import { ArrowRight, CheckCircle2, AlertCircle, RefreshCw, Sparkles, Music2, Link2 } from 'lucide-react';
import { Platform, Playlist, TransferTask } from '../../types';
import { getPlaylists, startTransfer, getTransferStatus } from '../../api';
import { ImportUrlModal } from '../Import/ImportUrlModal';

export const TransferHub: React.FC = () => {
  const [sourcePlatform, setSourcePlatform] = useState<Platform>('yandex');
  const [targetPlatform, setTargetPlatform] = useState<Platform>('spotify');
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>('favorites');
  const [targetPlaylistName, setTargetPlaylistName] = useState<string>('');
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [activeTask, setActiveTask] = useState<TransferTask | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Загружаем плейлисты выбранного источника
  useEffect(() => {
    async function load() {
      setLoadingPlaylists(true);
      try {
        const data = await getPlaylists(sourcePlatform);
        setPlaylists(data);
        if (data.length > 0) {
          setSelectedPlaylistId(data[0].id);
          setTargetPlaylistName(`[${sourcePlatform.toUpperCase()}] ${data[0].title}`);
        }
      } catch (err) {
        console.error('Ошибка загрузки плейлистов:', err);
      } finally {
        setLoadingPlaylists(false);
      }
    }
    load();
  }, [sourcePlatform]);

  // Периодический опрос статуса активной задачи
  useEffect(() => {
    let timer: any = null;
    if (activeTask && (activeTask.status === 'running' || activeTask.status === 'queued')) {
      timer = setInterval(async () => {
        try {
          const updated = await getTransferStatus(activeTask.task_id);
          setActiveTask(updated);
          if (updated.status === 'completed' || updated.status === 'failed') {
            setIsTransferring(false);
          }
        } catch (err) {
          console.error(err);
        }
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [activeTask]);

  const handleStartTransfer = async () => {
    if (sourcePlatform === targetPlatform) {
      alert('Выберите разные платформы для источника и назначения!');
      return;
    }

    try {
      setIsTransferring(true);
      const task = await startTransfer(
        sourcePlatform,
        targetPlatform,
        selectedPlaylistId,
        targetPlaylistName
      );
      setActiveTask(task);
    } catch (err) {
      alert('Не удалось начать перенос: ' + String(err));
      setIsTransferring(false);
    }
  };

  const platforms: { id: Platform; label: string; color: string; badgeBg: string }[] = [
    { id: 'yandex', label: 'Яндекс Музыка', color: '#fc3f1d', badgeBg: 'bg-red-500/20 text-red-400 border-red-500/30' },
    { id: 'vk', label: 'VK Музыка', color: '#0077ff', badgeBg: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    { id: 'spotify', label: 'Spotify', color: '#1ed760', badgeBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  ];

  const progressPercent =
    activeTask && activeTask.total > 0
      ? Math.round((activeTask.processed / activeTask.total) * 100)
      : 0;

  return (
    <div className="max-w-md mx-auto px-4 pt-6 pb-28 text-white select-none">
      {/* Шапка */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Sparkles size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Центр переноса</h1>
            <p className="text-xs text-gray-400">Миграция треков между Яндекс, VK и Spotify</p>
          </div>
        </div>
        <button
          onClick={() => setIsImportModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-[#151821] hover:bg-white/10 border border-white/10 text-white text-xs font-bold transition-all active:scale-95"
        >
          <Link2 size={15} />
          <span>По ссылке</span>
        </button>
      </div>

      {/* Выбор Откуда ➔ Куда */}
      <div className="bg-[#151821] border border-white/10 rounded-3xl p-4 shadow-xl mb-6">
        <div className="grid grid-cols-2 gap-3 items-center relative">
          {/* Источник */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2 block">
              Откуда
            </label>
            <div className="space-y-1.5">
              {platforms.map((p) => (
                <button
                  key={`src-${p.id}`}
                  onClick={() => setSourcePlatform(p.id)}
                  disabled={isTransferring}
                  className={`w-full py-2.5 px-3 rounded-xl text-xs font-semibold text-left transition-all border ${
                    sourcePlatform === p.id
                      ? 'bg-white/10 border-blue-500 text-white shadow-md'
                      : 'bg-white/5 border-transparent text-gray-400 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Стрелка перехода по центру */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#1e222f] border border-white/10 flex items-center justify-center z-10 shadow-lg text-blue-400">
            <ArrowRight size={16} />
          </div>

          {/* Назначение */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2 block text-right">
              Куда
            </label>
            <div className="space-y-1.5">
              {platforms.map((p) => (
                <button
                  key={`tgt-${p.id}`}
                  onClick={() => setTargetPlatform(p.id)}
                  disabled={isTransferring}
                  className={`w-full py-2.5 px-3 rounded-xl text-xs font-semibold text-right transition-all border ${
                    targetPlatform === p.id
                      ? 'bg-white/10 border-blue-500 text-white shadow-md'
                      : 'bg-white/5 border-transparent text-gray-400 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Выбор плейлиста */}
        <div className="mt-5 pt-4 border-t border-white/5">
          <label className="text-xs font-semibold text-gray-300 mb-2 block flex items-center justify-between">
            <span>Плейлист для переноса</span>
            {loadingPlaylists && <RefreshCw size={12} className="animate-spin text-blue-400" />}
          </label>
          <select
            value={selectedPlaylistId}
            onChange={(e) => {
              setSelectedPlaylistId(e.target.value);
              const found = playlists.find((p) => p.id === e.target.value);
              if (found) {
                setTargetPlaylistName(`[${sourcePlatform.toUpperCase()}] ${found.title}`);
              }
            }}
            disabled={isTransferring || loadingPlaylists}
            className="w-full bg-[#0d0f15] border border-white/10 rounded-xl py-2.5 px-3 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {playlists.map((pl) => (
              <option key={pl.id} value={pl.id} className="bg-gray-900">
                {pl.title} ({pl.track_count} треков)
              </option>
            ))}
          </select>
        </div>

        {/* Название целевого плейлиста */}
        <div className="mt-3">
          <label className="text-xs font-semibold text-gray-300 mb-1.5 block">
            Название в {targetPlatform.toUpperCase()}
          </label>
          <input
            type="text"
            value={targetPlaylistName}
            onChange={(e) => setTargetPlaylistName(e.target.value)}
            disabled={isTransferring}
            className="w-full bg-[#0d0f15] border border-white/10 rounded-xl py-2 px-3 text-sm text-white focus:outline-none focus:border-blue-500 placeholder-gray-600"
            placeholder="Название нового плейлиста"
          />
        </div>

        {/* Кнопка запуска */}
        <button
          onClick={handleStartTransfer}
          disabled={isTransferring || sourcePlatform === targetPlatform}
          className={`w-full mt-5 py-3.5 rounded-2xl font-bold text-sm shadow-xl flex items-center justify-center gap-2 active:scale-98 transition-all ${
            isTransferring || sourcePlatform === targetPlatform
              ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/25'
          }`}
        >
          {isTransferring ? (
            <>
              <RefreshCw size={18} className="animate-spin" />
              <span>Перенос выполняется...</span>
            </>
          ) : (
            <>
              <Sparkles size={18} />
              <span>Запустить перенос треков</span>
            </>
          )}
        </button>
      </div>

      {/* Экран прогресса активной задачи */}
      {activeTask && (
        <div className="bg-[#151821] border border-white/10 rounded-3xl p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Music2 size={16} className="text-blue-400" />
              <span>Прогресс миграции</span>
            </h3>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                activeTask.status === 'completed'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : activeTask.status === 'failed'
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-blue-500/20 text-blue-400'
              }`}
            >
              {activeTask.status === 'completed'
                ? 'Готово'
                : activeTask.status === 'failed'
                ? 'Ошибка'
                : `${progressPercent}%`}
            </span>
          </div>

          {/* Полоса прогресса */}
          <div className="w-full bg-gray-800 h-2.5 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <p className="text-xs text-gray-300 mb-4">{activeTask.message}</p>

          {/* Статистика */}
          <div className="grid grid-cols-3 gap-2 mb-4 text-center">
            <div className="bg-white/5 p-2 rounded-xl">
              <span className="text-xs text-gray-400 block">Всего</span>
              <span className="text-sm font-bold text-white">{activeTask.total}</span>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-2 rounded-xl">
              <span className="text-xs text-emerald-400 block">Найдено</span>
              <span className="text-sm font-bold text-emerald-300">{activeTask.matched}</span>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 p-2 rounded-xl">
              <span className="text-xs text-red-400 block">Не найдено</span>
              <span className="text-sm font-bold text-red-300">{activeTask.failed}</span>
            </div>
          </div>

          {/* Список перенесённых треков */}
          {activeTask.results.length > 0 && (
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {activeTask.results.map((res, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2 rounded-xl bg-white/5 text-xs"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="text-white font-medium truncate">
                      {res.source_track.artist} - {res.source_track.title}
                    </p>
                    {res.matched_track && (
                      <p className="text-[11px] text-gray-400 truncate">
                        ➔ {res.matched_track.artist} - {res.matched_track.title}
                      </p>
                    )}
                  </div>
                  <div>
                    {res.status === 'matched' ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded">
                        <CheckCircle2 size={12} /> {Math.round(res.confidence)}%
                      </span>
                    ) : res.status === 'low_confidence' ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded">
                        {Math.round(res.confidence)}%
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-500/20 px-1.5 py-0.5 rounded">
                        <AlertCircle size={12} /> 0%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Модальное окно импорта по ссылке */}
      <ImportUrlModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />
    </div>
  );
};
