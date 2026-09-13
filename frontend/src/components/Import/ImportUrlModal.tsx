import React, { useState, useEffect } from 'react';
import {
  X,
  Link,
  Clipboard,
  Download,
  Play,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Music,
  Disc,
} from 'lucide-react';
import { Playlist, Track } from '../../types';
import { importPlaylistByUrl } from '../../api';
import { cacheMultipleTracks, getCachedTrackIds } from '../../services/cacheManager';
import { saveImportedPlaylist } from '../../services/playlistStorage';

interface ImportUrlModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlaylist?: (playlist: Playlist, tracks: Track[]) => void;
  onCacheCompleted?: () => void;
}

export const ImportUrlModal: React.FC<ImportUrlModalProps> = ({
  isOpen,
  onClose,
  onSelectPlaylist,
  onCacheCompleted,
}) => {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importedPlaylist, setImportedPlaylist] = useState<Playlist | null>(null);
  const [importedTracks, setImportedTracks] = useState<Track[]>([]);
  const [cachedTrackIds, setCachedTrackIds] = useState<Set<string>>(new Set());

  // Состояние кэширования
  const [isCaching, setIsCaching] = useState(false);
  const [cacheProgress, setCacheProgress] = useState<{
    current: number;
    total: number;
    title: string;
  } | null>(null);
  const [cacheSuccess, setCacheSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      getCachedTrackIds().then(setCachedTrackIds).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
      }
    } catch {
      // Игнорируем ошибку прав буфера
    }
  };

  const handleImport = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setImportedPlaylist(null);
    setImportedTracks([]);
    setCacheSuccess(false);

    try {
      const res = await importPlaylistByUrl(url.trim());
      setImportedPlaylist(res.playlist);
      setImportedTracks(res.tracks);
      saveImportedPlaylist(res.playlist, res.tracks);
    } catch (err: any) {
      setError(err.message || 'Не удалось распознать ссылку');
    } finally {
      setLoading(false);
    }
  };

  const handleCacheAll = async () => {
    if (!importedTracks.length || isCaching) return;

    // Скачиваем строго только те треки, которых еще нет в оффлайн-кэше
    const toCache = importedTracks.filter((t) => !cachedTrackIds.has(t.id));
    if (toCache.length === 0) {
      setCacheSuccess(true);
      return;
    }

    setIsCaching(true);
    setCacheSuccess(false);
    setCacheProgress({ current: 0, total: toCache.length, title: 'Подготовка...' });

    try {
      await cacheMultipleTracks(
        toCache,
        importedPlaylist?.title || 'Импортированный плейлист',
        (current, total, title) => {
          setCacheProgress({ current, total, title });
        }
      );
      setCacheSuccess(true);
      const updatedIds = await getCachedTrackIds();
      setCachedTrackIds(updatedIds);
      if (onCacheCompleted) {
        onCacheCompleted();
      }
    } catch (err: any) {
      alert('Ошибка при кэшировании: ' + err.message);
    } finally {
      setIsCaching(false);
    }
  };

  const handlePlayNow = () => {
    if (importedPlaylist && importedTracks.length && onSelectPlaylist) {
      onSelectPlaylist(importedPlaylist, importedTracks);
      onClose();
    }
  };


  const getPlatformBadge = (platform?: string) => {
    switch (platform) {
      case 'yandex':
        return <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold">Яндекс Музыка</span>;
      case 'vk':
        return <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-bold">VK Музыка</span>;
      case 'spotify':
        return <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">Spotify</span>;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pt-safe-dialog pb-6 bg-black/80 backdrop-blur-md animate-fadeIn select-none">
      <div className="bg-[#12151e] border border-white/10 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[82vh]">
        {/* Шапка */}
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
              <Link size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Импорт по ссылке</h2>
              <p className="text-[11px] text-gray-400">Яндекс Музыка, ВКонтакте, Spotify</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-gray-300 hover:text-white transition-all shadow"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        {/* Контент со скроллом */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1 scrollbar-none">
          {/* Поле ввода ссылки */}
          <form onSubmit={handleImport} className="space-y-2">
            <div className="relative">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Вставьте ссылку на плейлист или альбом..."
                className="w-full bg-[#181c28] border border-white/10 rounded-2xl py-3 pl-3 pr-24 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePaste}
                  title="Вставить из буфера"
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-[11px] flex items-center gap-1 transition-colors"
                >
                  <Clipboard size={13} />
                  <span className="hidden sm:inline">Вставить</span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all active:scale-98"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Распознавание ссылки...</span>
                </>
              ) : (
                <>
                  <Link size={16} />
                  <span>Загрузить треки</span>
                </>
              )}
            </button>
          </form>

          {/* Ошибка */}
          {error && (
            <div className="bg-red-500/15 border border-red-500/30 rounded-2xl p-3 flex gap-2.5 items-start text-xs text-red-200">
              <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Превью распознанного плейлиста */}
          {importedPlaylist && (
            <div className="space-y-4 animate-fadeIn">
              {/* Карточка плейлиста */}
              <div className="bg-[#181c28] border border-white/10 rounded-2xl p-3 flex gap-3 items-center">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-800 flex-shrink-0 shadow-md">
                  {importedPlaylist.cover_url ? (
                    <img
                      src={importedPlaylist.cover_url}
                      alt={importedPlaylist.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                      <Music size={24} />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    {getPlatformBadge(importedPlaylist.platform)}
                    <span className="text-[11px] text-gray-400">
                      {importedTracks.length} треков
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white truncate">
                    {importedPlaylist.title}
                  </h3>
                  {importedPlaylist.description && (
                    <p className="text-[11px] text-gray-400 truncate mt-0.5">
                      {importedPlaylist.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Прогресс кэширования */}
              {isCaching && cacheProgress && (
                <div className="bg-blue-600/10 border border-blue-500/30 rounded-2xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-blue-300 font-medium">Кэширование на телефон...</span>
                    <span className="text-blue-400 font-mono font-bold">
                      {cacheProgress.current} / {cacheProgress.total}
                    </span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-500 h-full transition-all duration-200"
                      style={{
                        width: `${(cacheProgress.current / cacheProgress.total) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-gray-400 truncate">
                    Сохранение: {cacheProgress.title}
                  </p>
                </div>
              )}

              {/* Успешное сохранение или статус уже сохраненных */}
              {(() => {
                const uncachedCount = importedTracks.filter((t) => !cachedTrackIds.has(t.id)).length;
                const allAlreadyCached = importedTracks.length > 0 && uncachedCount === 0;

                return (
                  <>
                    {(cacheSuccess || allAlreadyCached) && (
                      <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-2xl p-3 flex items-center gap-2 text-xs text-emerald-300">
                        <CheckCircle2 size={16} className="text-emerald-400 flex-shrink-0" />
                        <span>
                          {allAlreadyCached && !cacheSuccess
                            ? 'Все треки этого плейлиста уже сохранены на телефоне!'
                            : 'Все новые треки и обложки успешно сохранены в память телефона!'}
                        </span>
                      </div>
                    )}

                    {/* Кнопки действий */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={handleCacheAll}
                        disabled={isCaching || allAlreadyCached}
                        className={`py-3 px-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                          allAlreadyCached
                            ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 cursor-default'
                            : 'bg-emerald-600 hover:bg-emerald-500 active:scale-98 disabled:opacity-50 text-white shadow-lg shadow-emerald-600/20'
                        }`}
                      >
                        {allAlreadyCached ? (
                          <>
                            <CheckCircle2 size={15} />
                            <span>Все в кэше</span>
                          </>
                        ) : (
                          <>
                            <Download size={15} />
                            <span>
                              {isCaching
                                ? 'Кэширование...'
                                : uncachedCount < importedTracks.length
                                ? `Кэшировать (${uncachedCount})`
                                : 'Кэшировать всё'}
                            </span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={handlePlayNow}
                        className="py-3 px-3 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-98 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all"
                      >
                        <Play size={15} fill="currentColor" />
                        <span>Слушать в плеере</span>
                      </button>
                    </div>
                  </>
                );
              })()}

              {/* Список треков превью */}
              <div>
                <h4 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">
                  Треки ({importedTracks.length})
                </h4>
                <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                  {importedTracks.map((tr, idx) => (
                    <div
                      key={tr.id || idx}
                      className="flex items-center justify-between p-2 rounded-xl bg-white/5 text-xs hover:bg-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                        <div className="w-8 h-8 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0">
                          {tr.cover_url ? (
                            <img src={tr.cover_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-500">
                              <Disc size={14} />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-white font-medium truncate">{tr.title}</p>
                          <p className="text-gray-400 text-[10px] truncate">{tr.artist}</p>
                        </div>
                      </div>
                      <span className="text-gray-500 text-[11px] font-mono">
                        {Math.floor(tr.duration / 60)}:
                        {tr.duration % 60 < 10 ? '0' : ''}
                        {tr.duration % 60}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
