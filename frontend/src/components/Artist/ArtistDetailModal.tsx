import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  Pause,
  Shuffle,
  Plus,
  Download,
  CheckCircle2,
  Trash2,
  Mic,
  Clock,
  Search,
  Loader2,
  Users,
  Info,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Tag,
} from 'lucide-react';
import { ArtistSummary, Track, RelatedArtist, ArtistProfileInfo } from '../../types';
import { CoverImage } from '../Common/CoverImage';
import { ArtistLinks } from '../Common/ArtistLinks';
import { usePlayer } from '../../context/PlayerContext';
import { getCachedTrackIds, saveTrackToCache, deleteCachedTrack, cacheMultipleTracks } from '../../services/cacheManager';
import { useBackNavigation } from '../../services/backNavigation';
import { getSpotifyRelatedArtists } from '../../api';
import { fetchArtistProfile, getCachedArtistProfile } from '../../services/artistService';

interface ArtistDetailModalProps {
  artist: ArtistSummary | null;
  isOpen: boolean;
  onClose: () => void;
  onPlayTrack?: (track: Track, queue: Track[]) => void;
  onPlayAll?: (tracks: Track[]) => void;
  onShufflePlay?: (tracks: Track[]) => void;
  onAddTrackToArtist?: (artistName: string) => void;
  cachedTrackIds?: Set<string>;
  onDownloadTrack?: (track: Track) => void;
  onDeleteTrack?: (trackId: string) => void;
}

function formatDuration(sec: number): string {
  if (!sec) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function formatTotalDurationMinutes(sec: number): string {
  if (!sec) return '0 мин';
  const m = Math.round(sec / 60);
  return `${m} мин`;
}

export const ArtistDetailModal: React.FC<ArtistDetailModalProps> = ({
  artist,
  isOpen,
  onClose,
  onPlayTrack,
  onPlayAll,
  onShufflePlay,
  onAddTrackToArtist,
  cachedTrackIds: propCachedIds,
  onDownloadTrack: propDownload,
  onDeleteTrack: propDelete,
}) => {
  const { currentTrack, isPlaying, togglePlay, playTrack, openArtist } = usePlayer();
  const [filterQuery, setFilterQuery] = useState('');
  const [localCachedIds, setLocalCachedIds] = useState<Set<string>>(new Set());
  const [relatedArtists, setRelatedArtists] = useState<RelatedArtist[]>([]);

  // Профиль музыканта (оригинальное фото, биография, жанры)
  const [artistProfile, setArtistProfile] = useState<ArtistProfileInfo | null>(() =>
    artist?.name ? getCachedArtistProfile(artist.name) : null
  );
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isBioExpanded, setIsBioExpanded] = useState(false);

  // Перехват системного жеста "Назад" на Android для закрытия карточки музыканта
  useBackNavigation('artist_detail_modal', isOpen, onClose, 55);

  useEffect(() => {
    if (isOpen) {
      getCachedTrackIds().then(setLocalCachedIds).catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && artist?.name) {
      // 1. Похожие артисты
      getSpotifyRelatedArtists(artist.name, 10)
        .then((res) => setRelatedArtists(res || []))
        .catch(() => setRelatedArtists([]));

      // 2. Оригинальный профиль музыканта (фото, описание, жанры)
      const cached = getCachedArtistProfile(artist.name);
      if (cached && (cached.photo_url || cached.description)) {
        setArtistProfile(cached);
      } else {
        setIsLoadingProfile(true);
        fetchArtistProfile(artist.name)
          .then((res) => {
            if (res) setArtistProfile(res);
          })
          .catch((e) => console.warn('Ошибка загрузки профиля артиста:', e))
          .finally(() => setIsLoadingProfile(false));
      }
    } else {
      setRelatedArtists([]);
      setArtistProfile(null);
      setIsBioExpanded(false);
    }
  }, [isOpen, artist?.name]);

  if (!isOpen || !artist) return null;

  const cachedTrackIds = propCachedIds || localCachedIds;
  const tracks = artist.tracks || [];
  const filteredTracks = filterQuery.trim()
    ? tracks.filter((t) => t.title.toLowerCase().includes(filterQuery.toLowerCase()))
    : tracks;

  const handlePlayTrack = (track: Track) => {
    if (onPlayTrack) {
      onPlayTrack(track, tracks);
    } else {
      playTrack(track, tracks);
    }
  };

  const handlePlayAll = (allTracks: Track[]) => {
    if (onPlayAll) {
      onPlayAll(allTracks);
    } else if (allTracks.length > 0) {
      playTrack(allTracks[0], allTracks);
    }
  };

  const handleShufflePlay = (allTracks: Track[]) => {
    if (onShufflePlay) {
      onShufflePlay(allTracks);
    } else if (allTracks.length > 0) {
      const shuffled = [...allTracks].sort(() => Math.random() - 0.5);
      playTrack(shuffled[0], shuffled);
    }
  };

  const [isArtistCaching, setIsArtistCaching] = useState(false);
  const uncachedArtistTracks = tracks.filter((t) => !cachedTrackIds.has(t.id));
  const allArtistTracksCached = tracks.length > 0 && uncachedArtistTracks.length === 0;

  const handleDownloadTrack = async (track: Track) => {
    if (cachedTrackIds.has(track.id) && !track.isPreview) return;
    if (propDownload) {
      propDownload(track);
    } else {
      await saveTrackToCache(track);
      setLocalCachedIds((prev) => new Set([...prev, track.id]));
    }
  };

  const handleCacheAllArtistTracks = async () => {
    if (!uncachedArtistTracks.length || isArtistCaching) return;
    setIsArtistCaching(true);
    try {
      await cacheMultipleTracks(
        uncachedArtistTracks,
        `Треки: ${artist.name}`
      );
      const updated = await getCachedTrackIds();
      setLocalCachedIds(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setIsArtistCaching(false);
    }
  };

  const handleDeleteTrack = async (trackId: string) => {
    if (propDelete) {
      propDelete(trackId);
    } else {
      await deleteCachedTrack(trackId);
      setLocalCachedIds((prev) => {
        const next = new Set(prev);
        next.delete(trackId);
        return next;
      });
    }
  };

  const originalPhoto = artistProfile?.photo_url || artist.photo_url;
  const displayCover = originalPhoto || artist.cover_url;
  const bannerUrl = artistProfile?.banner_url || artist.banner_url || displayCover;
  const description = artistProfile?.description || artist.description;
  const shortDesc = artistProfile?.short_description || artist.short_description;
  const genres = (artistProfile?.genres && artistProfile.genres.length > 0)
    ? artistProfile.genres
    : (artist.genres || []);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#0d0f14] text-white overflow-hidden animate-fadeIn select-none">
      {/* 1. Декоративный фоновый размытый баннер (настоящее студийное фото) */}
      {bannerUrl && (
        <div className="absolute top-0 left-0 right-0 h-80 overflow-hidden pointer-events-none z-0">
          <img
            src={bannerUrl}
            alt=""
            className="w-full h-full object-cover blur-[50px] scale-125 opacity-35 brightness-75 transition-all duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0d0f14]/85 to-[#0d0f14]" />
        </div>
      )}

      {/* 2. Верхняя навигационная панель */}
      <div className="relative z-10 px-4 pt-safe-header pb-3 flex items-center justify-between border-b border-white/10 bg-[#0d0f14]/80 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
            <Mic size={16} />
          </div>
          <span className="text-sm font-bold uppercase tracking-wider text-gray-200">
            Музыкант
          </span>
        </div>

        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-gray-300 hover:text-white flex items-center justify-center transition-all shadow-md"
          aria-label="Закрыть"
        >
          <X size={20} />
        </button>
      </div>

      {/* 3. Основной скролл-контейнер */}
      <div className="relative z-10 flex-1 overflow-y-auto px-4 pt-4 pb-44 space-y-5">
        {/* Карточка профиля артиста */}
        <div className="flex flex-col items-center text-center">
          {/* Оригинальный студийный портрет артиста */}
          <div className="relative w-32 h-32 rounded-full p-1 bg-gradient-to-tr from-cyan-500 via-blue-500 to-indigo-600 shadow-2xl shadow-blue-500/20 mb-3 group">
            <div className="w-full h-full rounded-full overflow-hidden bg-[#181a20] flex items-center justify-center relative">
              {displayCover ? (
                <img
                  src={displayCover}
                  alt={artist.name}
                  className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-900 to-indigo-900 text-blue-300">
                  <Mic size={44} />
                </div>
              )}
            </div>
            {originalPhoto && (
              <div
                title="Оригинальное студийное фото"
                className="absolute bottom-0 right-0.5 bg-blue-600 text-white p-1.5 rounded-full border-2 border-[#0d0f14] shadow-md flex items-center justify-center"
              >
                <Sparkles size={12} className="text-cyan-300" />
              </div>
            )}
          </div>

          <h2 className="text-2xl font-black text-white tracking-tight px-4 leading-tight">
            {artist.name}
          </h2>

          {shortDesc && (
            <p className="text-xs text-cyan-400 font-medium mt-1 px-4 max-w-md line-clamp-1">
              {shortDesc}
            </p>
          )}

          {/* Жанры музыканта */}
          {genres.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-1.5 mt-2 px-4 max-w-md">
              {genres.slice(0, 4).map((g) => (
                <span
                  key={g}
                  className="px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-[11px] font-medium text-gray-300 flex items-center gap-1"
                >
                  <Tag size={10} className="text-blue-400" />
                  <span>{g}</span>
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 mt-2 text-xs text-gray-400 font-medium">
            <span className="bg-white/10 px-2.5 py-0.5 rounded-full text-blue-300">
              {artist.trackCount}{' '}
              {artist.trackCount === 1
                ? 'трек'
                : artist.trackCount < 5
                ? 'трека'
                : 'треков'}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {formatTotalDurationMinutes(artist.totalDuration)}
            </span>
          </div>

          {/* Кнопки действий: Слушать всё, Перемешать, Добавить трек */}
          <div className="flex items-center gap-2.5 mt-4 w-full max-w-sm justify-center">
            <button
              onClick={() => handlePlayAll(tracks)}
              disabled={tracks.length === 0}
              className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all"
            >
              <Play size={16} fill="currentColor" />
              <span>Слушать всё</span>
            </button>

            <button
              onClick={() => handleShufflePlay(tracks)}
              disabled={tracks.length === 0}
              title="Перемешать треки"
              className="py-3 px-3.5 rounded-2xl bg-white/10 hover:bg-white/15 active:scale-95 text-white text-xs font-bold transition-all shadow"
            >
              <Shuffle size={16} />
            </button>

            <button
              onClick={handleCacheAllArtistTracks}
              disabled={isArtistCaching || allArtistTracksCached || tracks.length === 0}
              title={
                allArtistTracksCached
                  ? 'Все треки музыканта сохранены'
                  : `Скачать новые (${uncachedArtistTracks.length})`
              }
              className={`py-3 px-3.5 rounded-2xl text-xs font-bold transition-all shadow flex items-center justify-center ${
                allArtistTracksCached
                  ? 'bg-emerald-500/20 text-emerald-400 cursor-default'
                  : 'bg-white/10 hover:bg-white/15 active:scale-95 text-white'
              }`}
            >
              {isArtistCaching ? (
                <Loader2 size={16} className="animate-spin text-blue-400" />
              ) : allArtistTracksCached ? (
                <CheckCircle2 size={16} className="text-emerald-400" />
              ) : (
                <Download size={16} />
              )}
            </button>

            {onAddTrackToArtist && (
              <button
                onClick={() => onAddTrackToArtist(artist.name)}
                className="py-3 px-4 rounded-2xl bg-emerald-600/20 hover:bg-emerald-600/30 active:scale-95 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-all shadow"
              >
                <Plus size={15} />
                <span>+ Трек</span>
              </button>
            )}
          </div>

          {/* Блок оригинального описания и биографии музыканта */}
          {isLoadingProfile && !description ? (
            <div className="w-full max-w-md mx-auto mt-4 px-1">
              <div className="bg-[#151821]/70 backdrop-blur-md border border-white/5 rounded-2xl p-3.5 animate-pulse space-y-2 text-left">
                <div className="h-3 bg-white/10 rounded w-1/4" />
                <div className="h-2.5 bg-white/5 rounded w-full" />
                <div className="h-2.5 bg-white/5 rounded w-5/6" />
              </div>
            </div>
          ) : description ? (
            <div className="w-full max-w-md mx-auto mt-4 px-1 text-left">
              <div className="bg-[#151821]/80 backdrop-blur-md border border-white/10 rounded-2xl p-3.5 shadow-lg transition-all">
                <div className="flex items-center gap-2 mb-1.5">
                  <Info size={14} className="text-cyan-400 flex-shrink-0" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-300">
                    Об исполнителе
                  </h3>
                </div>
                <p
                  className={`text-xs text-gray-300 leading-relaxed whitespace-pre-line ${
                    isBioExpanded ? '' : 'line-clamp-3'
                  }`}
                >
                  {description}
                </p>
                {description.length > 160 && (
                  <button
                    onClick={() => setIsBioExpanded(!isBioExpanded)}
                    className="mt-2 text-xs font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors py-0.5"
                  >
                    <span>{isBioExpanded ? 'Свернуть' : 'Читать полностью'}</span>
                    {isBioExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Поиск внутри треков артиста (если треков много) */}
        {tracks.length > 5 && (
          <div className="relative">
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder={`Поиск треков ${artist.name}...`}
              className="w-full theme-card rounded-xl py-2 pl-9 pr-4 text-xs text-white placeholder-gray-500 focus:outline-none border border-white/10 focus:border-blue-500/50"
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

        {/* Список всех треков музыканта */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Дискография ({filteredTracks.length})
            </h3>
          </div>

          {filteredTracks.length === 0 ? (
            <div className="theme-card rounded-2xl p-6 text-center border border-white/5 text-gray-500 text-xs">
              {filterQuery ? 'Треки не найдены по запросу' : 'У этого артиста пока нет треков'}
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredTracks.map((track, idx) => {
                const isCurrent = currentTrack?.id === track.id;
                const isCached = cachedTrackIds.has(track.id);

                return (
                  <div
                    key={`${track.platform}-${track.id}-${idx}`}
                    onClick={() => {
                      if (isCurrent) {
                        togglePlay();
                      } else {
                        handlePlayTrack(track);
                      }
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-2xl cursor-pointer transition-all border ${
                      isCurrent
                        ? 'bg-blue-600/20 border-blue-500/40 shadow-lg'
                        : 'theme-card hover:bg-white/5 border-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                      <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-gray-800 flex-shrink-0 shadow-md">
                        <CoverImage
                          src={track.cover_url || artist.cover_url}
                          alt={track.title}
                          iconSize={18}
                          isPlaying={isCurrent && isPlaying}
                        />
                        {isCurrent && isPlaying && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <div className="flex gap-0.5 items-end h-3.5">
                              <span className="w-0.5 bg-blue-400 animate-pulse h-full" />
                              <span className="w-0.5 bg-blue-400 animate-pulse h-2" />
                              <span className="w-0.5 bg-blue-400 animate-pulse h-2.5" />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-xs font-semibold truncate ${
                            isCurrent ? 'text-blue-400 font-bold' : 'text-white'
                          }`}
                        >
                          {track.title}
                        </p>
                        <p className="text-[11px] text-gray-400 truncate mt-0.5 flex items-center gap-1.5">
                          <ArtistLinks artist={track.artist} title={track.title} />
                          {isCached && (
                            <span className="text-emerald-400 text-[10px]">
                              • 💾 Оффлайн
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-gray-500 font-mono">
                        {formatDuration(track.duration)}
                      </span>

                      {/* Кнопка оффлайн скачивания */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadTrack(track);
                        }}
                        disabled={isCached && !track.isPreview}
                        title={
                          isCached
                            ? track.isPreview
                              ? 'Сохранено 30 сек. Нажмите для обновления'
                              : 'Уже сохранено на телефоне'
                            : 'Кэшировать на телефон'
                        }
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                          isCached
                            ? track.isPreview
                              ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 cursor-pointer'
                              : 'bg-emerald-500/20 text-emerald-400 cursor-default'
                            : 'bg-white/5 text-gray-400 hover:text-white cursor-pointer'
                        }`}
                      >
                        {isCached ? <CheckCircle2 size={13} /> : <Download size={13} />}
                      </button>

                      {/* Кнопка Play/Pause */}
                      <button
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                          isCurrent && isPlaying
                            ? 'bg-blue-600 text-white'
                            : 'bg-white/10 text-gray-300 hover:text-white'
                        }`}
                      >
                        {isCurrent && isPlaying ? (
                          <Pause size={12} fill="currentColor" />
                        ) : (
                          <Play size={12} fill="currentColor" className="ml-0.5" />
                        )}
                      </button>

                      {/* Удаление трека (если передано) */}
                      {propDelete && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Удалить трек "${track.title}"?`)) {
                              handleDeleteTrack(track.id);
                            }
                          }}
                          title="Удалить трек"
                          className="w-7 h-7 rounded-full flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Похожие исполнители от Spotify */}
          {relatedArtists.length > 0 && (
            <div className="mt-6 pt-4 border-t border-white/10 pb-4">
              <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3 px-1 flex items-center gap-2">
                <Users size={14} className="text-emerald-400" />
                Похожие исполнители (Spotify)
              </h4>
              <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar overscroll-x-contain">
                {relatedArtists.map((rel) => (
                  <div
                    key={rel.id}
                    onClick={() => openArtist(rel.name)}
                    className="flex-shrink-0 w-24 p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-center cursor-pointer group"
                  >
                    <div className="w-14 h-14 mx-auto rounded-full overflow-hidden mb-2 bg-black/40 border border-white/10 group-hover:border-emerald-500/50 transition-all shadow-md">
                      {rel.cover_url ? (
                        <img src={rel.cover_url} alt={rel.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-emerald-400 bg-emerald-500/10">
                          <Users size={18} />
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] font-semibold text-white truncate group-hover:text-emerald-300 transition-colors">
                      {rel.name}
                    </p>
                    <p className="text-[9px] text-gray-400 truncate mt-0.5">
                      {rel.genres?.[0] || 'Артист'}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
