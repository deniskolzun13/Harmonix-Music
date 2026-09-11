import React, { useState, useEffect } from 'react';
import {
  Play,
  Pause,
  Search,
  Music,
  Download,
  CheckCircle2,
  Trash2,
  Link2,
  HardDrive,
  Loader2,
  Palette,
  Clipboard,
  AlertCircle,
  FolderPlus,
  Mic,
  Plus,
} from 'lucide-react';
import { Track, ArtistSummary } from '../../types';
import { importPlaylistByUrl } from '../../api';
import { usePlayer } from '../../context/PlayerContext';
import { useTheme } from '../../context/ThemeContext';
import { CoverImage } from '../Common/CoverImage';
import {
  getCachedTracks,
  getCachedTrackIds,
  saveTrackToCache,
  deleteCachedTrack,
  clearCache,
  getCacheStats,
  cacheMultipleTracks,
} from '../../services/cacheManager';
import {
  getSavedPlaylists,
  saveImportedPlaylist,
  deleteSavedPlaylist,
  deleteTrackFromPlaylist,
  getArtistsList,
  SavedPlaylistRecord,
} from '../../services/playlistStorage';
import { ImportUrlModal } from '../Import/ImportUrlModal';
import { ThemeModal } from '../Theme/ThemeModal';
import { ArtistCard } from '../Artist/ArtistCard';
import { ArtistDetailModal } from '../Artist/ArtistDetailModal';
import { AddTrackModal } from '../Track/AddTrackModal';
import { useBackNavigation } from '../../services/backNavigation';

function formatDuration(sec: number): string {
  if (!sec) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

type LibraryTab = 'playlists' | 'artists' | 'cached';

interface PlayerMainProps {
  onOpenSettings?: () => void;
}

export const PlayerMain: React.FC<PlayerMainProps> = ({ onOpenSettings }) => {
  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayer();
  const { theme } = useTheme();

  const hasYandexToken = Boolean(localStorage.getItem('harmonix_yandex_token'));

  // Вкладка библиотеки: "Мои плейлисты", "Музыканты" или "Скачанные на телефон"
  const [activeTab, setActiveTab] = useState<LibraryTab>('playlists');

  // Сохраненные плейлисты (импортированные по ссылке)
  const [savedPlaylists, setSavedPlaylists] = useState<SavedPlaylistRecord[]>([]);
  const [activePlaylistId, setActivePlaylistId] = useState<string>('');

  // Быстрый ввод ссылки
  const [quickUrl, setQuickUrl] = useState('');
  const [isQuickImporting, setIsQuickImporting] = useState(false);
  const [quickImportError, setQuickImportError] = useState<string | null>(null);

  // Фильтрация треков внутри плейлиста или кэша
  const [filterQuery, setFilterQuery] = useState('');

  // Скачанные треки (оффлайн)
  const [cachedTracks, setCachedTracks] = useState<Track[]>([]);
  const [cachedTrackIds, setCachedTrackIds] = useState<Set<string>>(new Set());
  const [cacheStats, setCacheStats] = useState<{ count: number; formattedSize: string }>({
    count: 0,
    formattedSize: '0 МБ',
  });
  const [downloadingTrackId, setDownloadingTrackId] = useState<string | null>(null);

  // Массовое кэширование активного плейлиста
  const [isBulkCaching, setIsBulkCaching] = useState(false);
  const [bulkCacheProgress, setBulkCacheProgress] = useState<{ current: number; total: number } | null>(null);

  // Модальные окна
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);

  // Музыканты / Исполнители (Artist state)
  const [selectedArtist, setSelectedArtist] = useState<ArtistSummary | null>(null);
  const [isArtistModalOpen, setIsArtistModalOpen] = useState(false);
  const [artistSearchQuery, setArtistSearchQuery] = useState('');

  // Модальное окно добавления трека (локальный файл / ссылка / вручную)
  const [isAddTrackModalOpen, setIsAddTrackModalOpen] = useState(false);
  const [addTrackDefaultArtist, setAddTrackDefaultArtist] = useState<string | undefined>(undefined);

  // Перехват системного жеста "Назад" для модальных окон и вкладок
  useBackNavigation('add_track_modal', isAddTrackModalOpen, () => setIsAddTrackModalOpen(false), 45);
  useBackNavigation('artist_modal', isArtistModalOpen, () => setIsArtistModalOpen(false), 35);
  useBackNavigation('import_modal', isImportModalOpen, () => setIsImportModalOpen(false), 30);
  useBackNavigation('theme_modal', isThemeModalOpen, () => setIsThemeModalOpen(false), 25);
  useBackNavigation('library_tab', activeTab !== 'playlists', () => setActiveTab('playlists'), 15);

  // Загрузка сохраненных плейлистов из памяти
  const reloadSavedPlaylists = () => {
    const list = getSavedPlaylists();
    setSavedPlaylists(list);
    if (list.length > 0 && !activePlaylistId) {
      setActivePlaylistId(list[0].playlist.id);
    }
  };

  // Загрузка ID кэшированных треков и статистики
  const refreshCacheInfo = async () => {
    try {
      const [ids, stats, tracks] = await Promise.all([
        getCachedTrackIds(),
        getCacheStats(),
        getCachedTracks(),
      ]);
      setCachedTrackIds(ids);
      setCacheStats(stats);
      setCachedTracks(tracks);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    reloadSavedPlaylists();
    refreshCacheInfo();
  }, []);

  // Активный плейлист и его треки
  const currentSavedRecord = savedPlaylists.find((p) => p.playlist.id === activePlaylistId) || savedPlaylists[0];
  const activePlaylist = currentSavedRecord ? currentSavedRecord.playlist : null;
  const activeTracks = currentSavedRecord ? currentSavedRecord.tracks : [];

  // Список всех музыкантов из сохраненных плейлистов и оффлайн-кэша
  const artistsList = getArtistsList(savedPlaylists, cachedTracks);
  const activeSelectedArtist = selectedArtist
    ? artistsList.find((a) => a.name.toLowerCase() === selectedArtist.name.toLowerCase()) || selectedArtist
    : null;

  const displayedArtists = artistSearchQuery.trim()
    ? artistsList.filter((a) => a.name.toLowerCase().includes(artistSearchQuery.toLowerCase()))
    : artistsList;

  // Воспроизведение всех треков списка
  const handlePlayAllTracks = (tracks: Track[]) => {
    if (!tracks || tracks.length === 0) return;
    playTrack(tracks[0], tracks);
  };

  // Перемешать и воспроизвести
  const handleShuffleTracks = (tracks: Track[]) => {
    if (!tracks || tracks.length === 0) return;
    const shuffled = [...tracks].sort(() => Math.random() - 0.5);
    playTrack(shuffled[0], shuffled);
  };

  // Универсальное удаление трека из медиатеки
  const handleDeleteTrackGeneral = async (trackId: string) => {
    for (const rec of savedPlaylists) {
      if (rec.tracks.some((t) => t.id === trackId)) {
        const updated = deleteTrackFromPlaylist(rec.playlist.id, trackId);
        setSavedPlaylists(updated);
      }
    }
    if (cachedTrackIds.has(trackId)) {
      await deleteCachedTrack(trackId);
      await refreshCacheInfo();
    }
  };

  // Быстрая вставка из буфера обмена
  const handlePasteQuickUrl = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setQuickUrl(text.trim());
        setQuickImportError(null);
      }
    } catch (err) {
      console.warn('Clipboard read error:', err);
    }
  };

  // Быстрый импорт по ссылке
  const handleQuickImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickUrl.trim() || isQuickImporting) return;

    setIsQuickImporting(true);
    setQuickImportError(null);

    try {
      const res = await importPlaylistByUrl(quickUrl.trim());
      const updatedList = saveImportedPlaylist(res.playlist, res.tracks);
      setSavedPlaylists(updatedList);
      setActivePlaylistId(res.playlist.id);
      setActiveTab('playlists');
      setQuickUrl('');

      if (res.tracks.length > 0) {
        playTrack(res.tracks[0], res.tracks);
      }
    } catch (err: any) {
      setQuickImportError(err.message || 'Не удалось распознать ссылку');
    } finally {
      setIsQuickImporting(false);
    }
  };

  // Удаление сохраненного плейлиста
  const handleDeletePlaylist = (e: React.MouseEvent, playlistId: string, title: string) => {
    e.stopPropagation();
    if (!confirm(`Удалить плейлист "${title}" из плеера?`)) return;

    const updated = deleteSavedPlaylist(playlistId);
    setSavedPlaylists(updated);
    if (activePlaylistId === playlistId) {
      if (updated.length > 0) {
        setActivePlaylistId(updated[0].playlist.id);
      } else {
        setActivePlaylistId('');
      }
    }
  };

  // Массовое кэширование треков текущего плейлиста
  const handleBulkCacheCurrentPlaylist = async () => {
    if (!activeTracks.length || isBulkCaching) return;

    setIsBulkCaching(true);
    setBulkCacheProgress({ current: 0, total: activeTracks.length });

    try {
      await cacheMultipleTracks(
        activeTracks,
        activePlaylist?.title || 'Плейлист',
        (current, total) => {
          setBulkCacheProgress({ current, total });
        }
      );
      await refreshCacheInfo();
    } catch (err: any) {
      alert('Ошибка при кэшировании: ' + err.message);
    } finally {
      setIsBulkCaching(false);
      setBulkCacheProgress(null);
    }
  };

  // Скачивание отдельного трека в кэш
  const handleDownloadSingleTrack = async (e: React.MouseEvent, track: Track) => {
    e.stopPropagation();
    if (downloadingTrackId || cachedTrackIds.has(track.id)) return;

    setDownloadingTrackId(track.id);
    try {
      await saveTrackToCache(track, activePlaylist?.title);
      await refreshCacheInfo();
    } catch (err: any) {
      alert('Ошибка при сохранении трека: ' + err.message);
    } finally {
      setDownloadingTrackId(null);
    }
  };

  // Удаление отдельного трека из кэша
  const handleDeleteSingleTrack = async (e: React.MouseEvent, trackId: string) => {
    e.stopPropagation();
    try {
      await deleteCachedTrack(trackId);
      await refreshCacheInfo();
    } catch (err: any) {
      alert('Ошибка при удалении трека: ' + err.message);
    }
  };

  // Полная очистка памяти устройства
  const handleClearAllStorage = async () => {
    if (!confirm('Вы уверены, что хотите удалить все скачанные треки с телефона?')) return;
    try {
      await clearCache();
      await refreshCacheInfo();
    } catch (err: any) {
      alert('Ошибка при очистке памяти: ' + err.message);
    }
  };

  // Фильтрация треков для отображения
  const sourceTracks = activeTab === 'cached' ? cachedTracks : activeTracks;
  const displayedTracks = filterQuery.trim()
    ? sourceTracks.filter(
        (t) =>
          t.title.toLowerCase().includes(filterQuery.toLowerCase()) ||
          t.artist.toLowerCase().includes(filterQuery.toLowerCase())
      )
    : sourceTracks;

  // Платформенный значок
  const renderPlatformBadge = (platform?: string) => {
    switch (platform) {
      case 'yandex':
        return (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-bold border border-red-500/30">
            Яндекс Музыка
          </span>
        );
      case 'vk':
        return (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-bold border border-blue-500/30">
            VK Музыка
          </span>
        );
      case 'spotify':
        return (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
            Spotify
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 pt-safe-top pb-44 text-white select-none">
      {/* Шапка приложения */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
            <span>Harmonix</span>
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
              Mobile
            </span>
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">Музыка по ссылкам и оффлайн-кэш на телефоне</p>
        </div>

        {/* Кнопка смены темы, добавления трека и импорта */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsThemeModalOpen(true)}
            title="Выбрать тему оформления"
            className="p-2.5 rounded-2xl theme-card hover:bg-white/10 text-gray-300 hover:text-white transition-all active:scale-95 flex items-center justify-center shadow-lg"
          >
            <Palette size={18} />
          </button>

          <button
            onClick={() => {
              setAddTrackDefaultArtist(undefined);
              setIsAddTrackModalOpen(true);
            }}
            title="Добавить трек (файл MP3, ссылка, вручную)"
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/25 active:scale-95 transition-all"
          >
            <Plus size={15} />
            <span>+ Трек</span>
          </button>

          <button
            onClick={() => setIsImportModalOpen(true)}
            title="Импорт по ссылке"
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold shadow-lg shadow-blue-600/25 active:scale-95 transition-all"
          >
            <Link2 size={15} />
            <span className="hidden sm:inline">Ссылка</span>
          </button>
        </div>
      </div>

      {/* Поле быстрого добавления по ссылке */}
      <form onSubmit={handleQuickImport} className="mb-4">
        <div className="theme-card rounded-2xl p-1.5 flex items-center gap-2 shadow-lg border border-white/10 focus-within:border-blue-500/50 transition-colors">
          <div className="pl-2 text-gray-400 flex items-center">
            <Link2 size={16} />
          </div>
          <input
            type="text"
            value={quickUrl}
            onChange={(e) => {
              setQuickUrl(e.target.value);
              setQuickImportError(null);
            }}
            placeholder="Вставьте ссылку на плейлист (Яндекс, VK, Spotify)..."
            className="w-full bg-transparent py-2 text-xs text-white placeholder-gray-500 focus:outline-none"
          />
          {quickUrl ? (
            <button
              type="button"
              onClick={() => setQuickUrl('')}
              className="text-gray-500 hover:text-white text-xs px-1"
            >
              ✕
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePasteQuickUrl}
              title="Вставить из буфера"
              className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors flex-shrink-0"
            >
              <Clipboard size={14} />
            </button>
          )}
          <button
            type="submit"
            disabled={!quickUrl.trim() || isQuickImporting}
            className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-40 text-white text-xs font-bold transition-all flex items-center gap-1.5 flex-shrink-0 shadow-md shadow-blue-600/20"
          >
            {isQuickImporting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <span>Импорт</span>
            )}
          </button>
        </div>
        {quickImportError && (
          <div className="mt-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl p-2 flex items-center gap-2 animate-fadeIn">
            <AlertCircle size={14} className="flex-shrink-0" />
            <span>{quickImportError}</span>
          </div>
        )}
      </form>

      {/* Информационный баннер Яндекс токена (если не подключен) */}
      {!hasYandexToken && (
        <div className="theme-card bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-red-500/15 border border-amber-500/30 rounded-2xl p-3 mb-5 shadow-lg flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0 mt-0.5">
              <AlertCircle size={17} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-amber-200">
                Яндекс Музыка: демо-режим (30 сек)
              </p>
              <p className="text-[11px] text-gray-300 leading-tight mt-0.5">
                Без токена треки скачиваются по 30 сек. Подключите токен в 1 клик для полных треков (320 kbps)!
              </p>
            </div>
          </div>
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-black text-xs font-bold transition-all shadow-md shadow-amber-500/20 flex-shrink-0"
            >
              Токен
            </button>
          )}
        </div>
      )}

      {/* Основные вкладки плеера: Плейлисты / Музыканты / Скачанные на телефон */}
      <div className="grid grid-cols-3 gap-1.5 mb-5">
        <button
          onClick={() => setActiveTab('playlists')}
          className={`py-2 px-1.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border ${
            activeTab === 'playlists'
              ? theme === 'y2k'
                ? 'bg-[#39ff14] border-[#39ff14] text-black font-mono shadow-[2px_2px_0px_#000]'
                : theme === 'glass'
                ? 'bg-blue-500/30 border-blue-400 text-blue-200 shadow-[0_0_15px_rgba(59,130,246,0.4)] backdrop-blur-md'
                : 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-600/25'
              : 'theme-card text-gray-400 hover:text-white border-white/5'
          }`}
        >
          <Music size={14} />
          <span className="truncate">Плейлисты</span>
          <span className="text-[10px] bg-white/20 px-1 py-0.5 rounded-full font-mono">
            {savedPlaylists.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('artists')}
          className={`py-2 px-1.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border ${
            activeTab === 'artists'
              ? theme === 'y2k'
                ? 'bg-[#39ff14] border-[#39ff14] text-black font-mono shadow-[2px_2px_0px_#000]'
                : theme === 'glass'
                ? 'bg-purple-500/30 border-purple-400 text-purple-200 shadow-[0_0_15px_rgba(168,85,247,0.4)] backdrop-blur-md'
                : 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/25'
              : 'theme-card text-gray-400 hover:text-white border-white/5'
          }`}
        >
          <Mic size={14} />
          <span className="truncate">Музыканты</span>
          <span className="text-[10px] bg-white/20 px-1 py-0.5 rounded-full font-mono">
            {artistsList.length}
          </span>
        </button>

        <button
          onClick={() => {
            setActiveTab('cached');
            refreshCacheInfo();
          }}
          className={`py-2 px-1.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border ${
            activeTab === 'cached'
              ? theme === 'y2k'
                ? 'bg-[#39ff14] border-[#39ff14] text-black font-mono shadow-[2px_2px_0px_#000]'
                : theme === 'glass'
                ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200 shadow-[0_0_15px_rgba(16,185,129,0.4)] backdrop-blur-md'
                : 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/25'
              : 'theme-card text-gray-400 hover:text-white border-white/5'
          }`}
        >
          <HardDrive size={14} />
          <span className="truncate">Скачанные</span>
          {cacheStats.count > 0 && (
            <span className="text-[10px] bg-white/20 px-1 py-0.5 rounded-full font-mono">
              {cacheStats.count}
            </span>
          )}
        </button>
      </div>

      {/* Вкладка 1: МОИ ПЛЕЙЛИСТЫ */}
      {activeTab === 'playlists' && (
        <div className="space-y-4">
          {/* Горизонтальный список сохраненных плейлистов */}
          {savedPlaylists.length > 0 ? (
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Сохраненные плейлисты ({savedPlaylists.length})
                </h2>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
                {savedPlaylists.map((rec) => {
                  const pl = rec.playlist;
                  const isActive = activePlaylistId === pl.id;
                  return (
                    <div
                      key={pl.id}
                      onClick={() => setActivePlaylistId(pl.id)}
                      className={`relative w-36 flex-shrink-0 p-2.5 rounded-2xl cursor-pointer transition-all border group ${
                        isActive
                          ? 'bg-blue-600/20 border-blue-500/50 shadow-xl'
                          : 'theme-card hover:border-white/20'
                      }`}
                    >
                      <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-gray-800 mb-2 shadow-md">
                        <CoverImage
                          src={pl.cover_url}
                          alt={pl.title}
                          iconSize={32}
                          fallbackType="music"
                        />
                        {/* Кнопка удаления плейлиста */}
                        <button
                          onClick={(e) => handleDeletePlaylist(e, pl.id, pl.title)}
                          title="Удалить плейлист"
                          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-lg bg-black/60 hover:bg-red-600 text-white flex items-center justify-center opacity-80 group-hover:opacity-100 transition-all shadow"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <p className="text-xs font-semibold text-white truncate">{pl.title}</p>
                      <div className="flex items-center justify-between mt-1 text-[10px] text-gray-400">
                        <span className="capitalize">{pl.platform || 'Ссылка'}</span>
                        <span>{rec.tracks.length} тр.</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Пустое состояние плейлистов */
            <div className="theme-card rounded-3xl p-6 text-center border border-white/10 my-4 shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 mx-auto flex items-center justify-center mb-3">
                <FolderPlus size={24} />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">Нет добавленных плейлистов</h3>
              <p className="text-xs text-gray-400 mb-4">
                Вставьте ссылку на любой плейлист или трек из Яндекс Музыки, VK или Spotify выше.
              </p>
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold inline-flex items-center gap-2 shadow-lg shadow-blue-600/20"
              >
                <Link2 size={15} />
                <span>Открыть окно импорта по ссылке</span>
              </button>
            </div>
          )}

          {/* Карточка активного плейлиста */}
          {activePlaylist && (
            <div className="theme-card rounded-3xl p-4 border border-white/10 shadow-xl space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 rounded-2xl overflow-hidden bg-gray-800 flex-shrink-0 shadow-md">
                  <CoverImage
                    src={activePlaylist.cover_url}
                    alt={activePlaylist.title}
                    iconSize={24}
                    fallbackType="music"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {renderPlatformBadge(activePlaylist.platform)}
                    <span className="text-[11px] text-gray-400 font-mono">
                      {activeTracks.length} треков
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white truncate leading-tight">
                    {activePlaylist.title}
                  </h3>
                  <p className="text-[11px] text-gray-400 truncate mt-0.5">
                    {activePlaylist.description || 'Импортировано по ссылке'}
                  </p>
                </div>
              </div>

              {/* Кнопка "Кэшировать всё на телефон" */}
              <button
                onClick={handleBulkCacheCurrentPlaylist}
                disabled={isBulkCaching || activeTracks.length === 0}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-98 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
              >
                {isBulkCaching ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>
                      Кэширование на телефон ({bulkCacheProgress?.current} / {bulkCacheProgress?.total})...
                    </span>
                  </>
                ) : (
                  <>
                    <Download size={15} />
                    <span>Кэшировать весь плейлист на телефон</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Вкладка 2: ИСПОЛНИТЕЛИ / МУЗЫКАНТЫ */}
      {activeTab === 'artists' && (
        <div className="space-y-4">
          {/* Поиск музыканта */}
          {artistsList.length > 2 && (
            <div className="relative">
              <input
                type="text"
                value={artistSearchQuery}
                onChange={(e) => setArtistSearchQuery(e.target.value)}
                placeholder="Поиск музыканта или группы..."
                className="w-full theme-card rounded-2xl py-2 pl-9 pr-8 text-xs text-white placeholder-gray-500 focus:outline-none border border-white/10 focus:border-purple-500/50"
              />
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              {artistSearchQuery && (
                <button
                  onClick={() => setArtistSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {/* Сетка карточек музыкантов */}
          {displayedArtists.length === 0 ? (
            <div className="theme-card rounded-3xl p-6 text-center border border-white/10 my-4 shadow-xl">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 mx-auto flex items-center justify-center mb-3">
                <Mic size={24} />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">
                {artistSearchQuery ? 'Музыканты не найдены' : 'Нет карточек музыкантов'}
              </h3>
              <p className="text-xs text-gray-400 mb-4">
                Загрузите MP3 файлы со смартфона или добавьте треки по ссылке — карточки музыкантов сформируются автоматически!
              </p>
              <button
                onClick={() => {
                  setAddTrackDefaultArtist(undefined);
                  setIsAddTrackModalOpen(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 text-white text-xs font-bold inline-flex items-center gap-2 shadow-lg shadow-purple-600/20"
              >
                <Plus size={15} />
                <span>+ Добавить трек</span>
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Музыканты в вашей медиатеке ({displayedArtists.length})
                </h2>
                <button
                  onClick={() => {
                    setAddTrackDefaultArtist(undefined);
                    setIsAddTrackModalOpen(true);
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
                >
                  <Plus size={13} />
                  <span>+ Добавить</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {displayedArtists.map((art) => (
                  <ArtistCard
                    key={art.name}
                    artist={art}
                    onSelectArtist={(a) => {
                      setSelectedArtist(a);
                      setIsArtistModalOpen(true);
                    }}
                    onPlayArtist={(a) => handlePlayAllTracks(a.tracks)}
                    onAddTrack={(a) => {
                      setAddTrackDefaultArtist(a.name);
                      setIsAddTrackModalOpen(true);
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Спейсер для полной прокрутки */}
          <div className="h-36 w-full flex-shrink-0" aria-hidden="true" />
        </div>
      )}

      {/* Вкладка 3: СКАЧАННЫЕ НА ТЕЛЕФОН (ОФФЛАЙН) */}
      {activeTab === 'cached' && (
        <div className="theme-card rounded-3xl p-4 border border-white/10 shadow-xl mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <HardDrive size={22} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-emerald-300">Оффлайн-библиотека</h3>
                <p className="text-xs text-gray-400">
                  {cacheStats.count} треков • {cacheStats.formattedSize} занято
                </p>
              </div>
            </div>
            {cacheStats.count > 0 && (
              <button
                onClick={handleClearAllStorage}
                title="Очистить память устройства"
                className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs transition-colors flex items-center gap-1"
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
          <p className="text-[11px] text-gray-400">
            Все треки из этого раздела сохранены в постоянную память смартфона и играют без интернета.
          </p>
        </div>
      )}

      {/* Фильтр и список треков (отображается для вкладок Плейлисты и Скачанные) */}
      {activeTab !== 'artists' && (
        <>
          {sourceTracks.length > 5 && (
        <div className="relative my-3">
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Фильтр по названию или артисту..."
            className="w-full theme-card rounded-xl py-2 pl-9 pr-8 text-xs text-white placeholder-gray-500 focus:outline-none border border-white/5 focus:border-blue-500/40"
          />
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          {filterQuery && (
            <button
              onClick={() => setFilterQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {/* Список треков */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
            {activeTab === 'cached' ? 'Скачанные треки' : 'Список треков'} ({displayedTracks.length})
          </h4>
        </div>

        {displayedTracks.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-xs theme-card rounded-2xl p-4 border border-white/5">
            {activeTab === 'cached'
              ? 'На телефоне пока нет скачанных треков. Нажмите на иконку загрузки рядом с любым треком или вставьте ссылку на плейлист!'
              : 'В этом плейлисте нет треков'}
          </div>
        ) : (
          <div className="space-y-1.5">
            {displayedTracks.map((track) => {
              const isCurrent = currentTrack?.id === track.id;
              const isCached = cachedTrackIds.has(track.id);
              const isDownloading = downloadingTrackId === track.id;

              return (
                <div
                  key={`${track.platform}-${track.id}`}
                  onClick={() => {
                    if (isCurrent) {
                      togglePlay();
                    } else {
                      playTrack(track, displayedTracks);
                    }
                  }}
                  className={`flex items-center justify-between p-2.5 rounded-2xl cursor-pointer transition-all border ${
                    isCurrent
                      ? 'bg-blue-600/15 border-blue-500/30'
                      : 'theme-card hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                    <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-gray-800 flex-shrink-0 shadow-md">
                      <CoverImage
                        src={track.cover_url}
                        alt={track.title}
                        iconSize={20}
                        isPlaying={isCurrent && isPlaying}
                      />
                      {isCurrent && isPlaying && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <div className="flex gap-0.5 items-end h-4">
                            <span className="w-1 bg-blue-400 animate-pulse h-full" />
                            <span className="w-1 bg-blue-400 animate-pulse h-2" />
                            <span className="w-1 bg-blue-400 animate-pulse h-3" />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-semibold truncate ${
                          isCurrent ? 'text-blue-400' : 'text-white'
                        }`}
                      >
                        {track.title}
                      </p>
                      <p className="text-xs text-gray-400 truncate mt-0.5 flex items-center gap-1.5">
                        <span>{track.artist}</span>
                        {isCached && (
                          <span
                            className={`inline-flex items-center text-[10px] font-medium ${
                              track.isPreview ? 'text-amber-400' : 'text-emerald-400'
                            }`}
                          >
                            • 💾 {track.isPreview ? 'Оффлайн (демо 30 сек)' : 'Оффлайн'}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Кнопки действий с треком */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-gray-500 font-mono hidden sm:inline">
                      {formatDuration(track.duration)}
                    </span>

                    {/* Кнопка кэширования / удаления */}
                    {activeTab === 'cached' ? (
                      <button
                        onClick={(e) => handleDeleteSingleTrack(e, track.id)}
                        title="Удалить из памяти"
                        className="w-8 h-8 rounded-full flex items-center justify-center bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                      >
                        <Trash2 size={13} />
                      </button>
                    ) : (
                      <button
                        onClick={(e) => handleDownloadSingleTrack(e, track)}
                        title={
                          isCached
                            ? track.isPreview
                              ? 'Сохранено 30 сек. Нажмите для обновления'
                              : 'Сохранено на телефоне'
                            : 'Кэшировать на телефон'
                        }
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                          isCached
                            ? track.isPreview
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-white/5 text-gray-400 hover:text-white'
                        }`}
                      >
                        {isDownloading ? (
                          <Loader2 size={13} className="animate-spin text-blue-400" />
                        ) : isCached ? (
                          <CheckCircle2 size={14} />
                        ) : (
                          <Download size={13} />
                        )}
                      </button>
                    )}

                    {/* Кнопка Play/Pause */}
                    <button
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                        isCurrent && isPlaying
                          ? 'bg-blue-600 text-white shadow-md'
                          : 'bg-white/5 text-gray-300 hover:text-white'
                      }`}
                    >
                      {isCurrent && isPlaying ? (
                        <Pause size={14} fill="currentColor" />
                      ) : (
                        <Play size={14} fill="currentColor" className="ml-0.5" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Спейсер для полной прокрутки выше мини-плеера и нижнего бара */}
        <div className="h-36 w-full flex-shrink-0" aria-hidden="true" />
      </div>
    </>
  )}

      {/* Экран музыканта (ArtistDetailModal) */}
      <ArtistDetailModal
        artist={activeSelectedArtist}
        isOpen={isArtistModalOpen}
        onClose={() => setIsArtistModalOpen(false)}
        onPlayTrack={(track, queue) => playTrack(track, queue)}
        onPlayAll={(tracks) => handlePlayAllTracks(tracks)}
        onShufflePlay={(tracks) => handleShuffleTracks(tracks)}
        onAddTrackToArtist={(artistName) => {
          setAddTrackDefaultArtist(artistName);
          setIsAddTrackModalOpen(true);
        }}
        cachedTrackIds={cachedTrackIds}
        onDownloadTrack={(track) => handleDownloadSingleTrack({ stopPropagation: () => {} } as any, track)}
        onDeleteTrack={(trackId) => handleDeleteTrackGeneral(trackId)}
      />

      {/* Модальное окно добавления треков (AddTrackModal) */}
      <AddTrackModal
        isOpen={isAddTrackModalOpen}
        onClose={() => setIsAddTrackModalOpen(false)}
        defaultArtist={addTrackDefaultArtist}
        onTrackAdded={(track) => {
          reloadSavedPlaylists();
          refreshCacheInfo();
          if (track) {
            playTrack(track, [track]);
          }
        }}
      />

      {/* Модальное окно импорта по ссылке */}
      <ImportUrlModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSelectPlaylist={(pl, trs) => {
          const updated = saveImportedPlaylist(pl, trs);
          setSavedPlaylists(updated);
          setActivePlaylistId(pl.id);
          setActiveTab('playlists');
          if (trs.length > 0) {
            playTrack(trs[0], trs);
          }
        }}
        onCacheCompleted={refreshCacheInfo}
      />

      {/* Модальное окно тем оформления */}
      <ThemeModal
        isOpen={isThemeModalOpen}
        onClose={() => setIsThemeModalOpen(false)}
      />
    </div>
  );
};
