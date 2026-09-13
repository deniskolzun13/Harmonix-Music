import React from 'react';
import { Play, Mic, Plus } from 'lucide-react';
import { ArtistSummary } from '../../types';
import { CoverImage } from '../Common/CoverImage';
import { getCachedArtistProfile } from '../../services/artistService';

interface ArtistCardProps {
  artist: ArtistSummary;
  onSelectArtist: (artist: ArtistSummary) => void;
  onPlayArtist: (artist: ArtistSummary) => void;
  onAddTrack?: (artist: ArtistSummary) => void;
}

function formatDurationMinutes(sec: number): string {
  if (!sec) return '0 мин';
  const m = Math.round(sec / 60);
  return `${m} мин`;
}

export const ArtistCard: React.FC<ArtistCardProps> = ({
  artist,
  onSelectArtist,
  onPlayArtist,
  onAddTrack,
}) => {
  const profile = getCachedArtistProfile(artist.name);
  const photoUrl = artist.photo_url || profile?.photo_url || artist.cover_url;
  const genres = artist.genres || profile?.genres;
  return (
    <div
      onClick={() => onSelectArtist(artist)}
      className="theme-card rounded-3xl p-4 border border-white/10 hover:border-blue-500/40 transition-all duration-300 cursor-pointer group flex flex-col items-center text-center relative overflow-hidden shadow-lg hover:shadow-blue-500/10 hover:-translate-y-1 active:scale-98"
    >
      {/* Декоративное фоновое размытие */}
      <div className="absolute -top-10 -right-10 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl pointer-events-none group-hover:bg-blue-500/20 transition-all" />

      {/* Круглый аватар музыканта */}
      <div className="relative w-24 h-24 mb-3 rounded-full p-1 bg-gradient-to-tr from-blue-500/40 via-purple-500/40 to-indigo-500/40 group-hover:from-blue-500 group-hover:to-indigo-500 transition-all shadow-xl">
        <div className="w-full h-full rounded-full overflow-hidden bg-[#181a20] relative flex items-center justify-center">
          {photoUrl ? (
            <CoverImage
              src={photoUrl}
              alt={artist.name}
              iconSize={28}
              fallbackType="music"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-900/50 to-indigo-900/50 text-blue-300">
              <Mic size={30} />
            </div>
          )}
        </div>

        {/* Быстрая кнопка Play на аватаре */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlayArtist(artist);
          }}
          title={`Слушать ${artist.name}`}
          className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-90 text-white flex items-center justify-center shadow-lg shadow-blue-600/50 transition-all transform group-hover:scale-110"
        >
          <Play size={14} fill="currentColor" className="ml-0.5" />
        </button>
      </div>

      {/* Имя музыканта */}
      <h3 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors truncate max-w-full px-1">
        {artist.name}
      </h3>

      {/* Бейдж жанра музыканта */}
      {genres && genres.length > 0 && (
        <span className="inline-block text-[10px] text-blue-300/90 font-medium px-2 py-0.5 mt-1 rounded-full bg-blue-500/10 border border-blue-500/20 truncate max-w-[90%]">
          {genres[0]}
        </span>
      )}

      {/* Количество треков и длительность */}
      <p className="text-[11px] text-gray-400 mt-1 font-medium">
        {artist.trackCount}{' '}
        {artist.trackCount === 1
          ? 'трек'
          : artist.trackCount < 5
          ? 'трека'
          : 'треков'}{' '}
        • {formatDurationMinutes(artist.totalDuration)}
      </p>

      {/* Кнопка быстрого добавления трека именно этому исполнителю */}
      {onAddTrack && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddTrack(artist);
          }}
          className="mt-3 px-3 py-1 rounded-xl bg-white/5 hover:bg-white/15 active:scale-95 text-gray-300 hover:text-white text-[11px] font-medium flex items-center gap-1.5 transition-all border border-white/5 group-hover:border-white/10"
        >
          <Plus size={12} className="text-blue-400" />
          <span>+ Трек</span>
        </button>
      )}
    </div>
  );
};
