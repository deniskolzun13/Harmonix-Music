import React, { useState } from 'react';
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
} from 'lucide-react';
import { ArtistSummary, Track } from '../../types';
import { CoverImage } from '../Common/CoverImage';
import { usePlayer } from '../../context/PlayerContext';

interface ArtistDetailModalProps {
  artist: ArtistSummary | null;
  isOpen: boolean;
  onClose: () => void;
  onPlayTrack: (track: Track, queue: Track[]) => void;
  onPlayAll: (tracks: Track[]) => void;
  onShufflePlay: (tracks: Track[]) => void;
  onAddTrackToArtist: (artistName: string) => void;
  cachedTrackIds: Set<string>;
  onDownloadTrack: (track: Track) => void;
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
  cachedTrackIds,
  onDownloadTrack,
  onDeleteTrack,
}) => {
  const { currentTrack, isPlaying, togglePlay } = usePlayer();
  const [filterQuery, setFilterQuery] = useState('');

  if (!isOpen || !artist) return null;

  const tracks = artist.tracks || [];
  const filteredTracks = filterQuery.trim()
    ? tracks.filter((t) => t.title.toLowerCase().includes(filterQuery.toLowerCase()))
    : tracks;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0d0f14] text-white overflow-hidden animate-fadeIn select-none">
      {/* 1. Декоративный фоновый размытый баннер */}
      {artist.cover_url && (
        <div className="absolute top-0 left-0 right-0 h-72 overflow-hidden pointer-events-none opacity-30 z-0">
          <img
            src={artist.cover_url}
            alt=""
            className="w-full h-full object-cover blur-[60px] scale-125"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0d0f14]/80 to-[#0d0f14]" />
        </div>
      )}

      {/* 2. Верхняя навигационная панель */}
      <div className="relative z-10 px-4 pt-4 pb-2 flex items-center justify-between border-b border-white/10 bg-[#0d0f14]/60 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
            <Mic size={15} />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
            Музыкант
          </span>
        </div>

        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-gray-300 hover:text-white flex items-center justify-center transition-all shadow-md"
        >
          <X size={18} />
        </button>
      </div>

      {/* 3. Основной скролл-контейнер */}
      <div className="relative z-10 flex-1 overflow-y-auto px-4 pt-4 pb-44 space-y-5">
        {/* Карточка профиля артиста */}
        <div className="flex flex-col items-center text-center">
          {/* Крупный аватар */}
          <div className="relative w-32 h-32 rounded-full p-1.5 bg-gradient-to-tr from-blue-500 via-indigo-500 to-purple-500 shadow-2xl mb-3.5">
            <div className="w-full h-full rounded-full overflow-hidden bg-[#181a20] flex items-center justify-center">
              {artist.cover_url ? (
                <CoverImage
                  src={artist.cover_url}
                  alt={artist.name}
                  iconSize={36}
                  fallbackType="music"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-900 to-indigo-900 text-blue-300">
                  <Mic size={44} />
                </div>
              )}
            </div>
          </div>

          <h2 className="text-2xl font-black text-white tracking-tight px-4 leading-tight">
            {artist.name}
          </h2>

          <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-400 font-medium">
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
          <div className="flex items-center gap-2.5 mt-5 w-full max-w-sm justify-center">
            <button
              onClick={() => onPlayAll(tracks)}
              disabled={tracks.length === 0}
              className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 disabled:opacity-40 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all"
            >
              <Play size={16} fill="currentColor" />
              <span>Слушать всё</span>
            </button>

            <button
              onClick={() => onShufflePlay(tracks)}
              disabled={tracks.length === 0}
              title="Перемешать треки"
              className="py-3 px-3.5 rounded-2xl bg-white/10 hover:bg-white/15 active:scale-95 text-white text-xs font-bold transition-all shadow"
            >
              <Shuffle size={16} />
            </button>

            <button
              onClick={() => onAddTrackToArtist(artist.name)}
              className="py-3 px-4 rounded-2xl bg-emerald-600/20 hover:bg-emerald-600/30 active:scale-95 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1.5 transition-all shadow"
            >
              <Plus size={15} />
              <span>+ Трек</span>
            </button>
          </div>
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
                        onPlayTrack(track, tracks);
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
                          <span>{track.album || artist.name}</span>
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
                          onDownloadTrack(track);
                        }}
                        title={isCached ? 'Сохранено на телефоне' : 'Кэшировать на телефон'}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                          isCached
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-white/5 text-gray-400 hover:text-white'
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
                      {onDeleteTrack && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Удалить трек "${track.title}"?`)) {
                              onDeleteTrack(track.id);
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
        </div>
      </div>
    </div>
  );
};
