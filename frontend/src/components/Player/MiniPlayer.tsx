import React from 'react';
import { Play, Pause, SkipForward } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { CoverImage } from '../Common/CoverImage';
import { ArtistLinks } from '../Common/ArtistLinks';
import { triggerHaptic } from '../../utils/haptics';

export const MiniPlayer: React.FC = () => {
  const { currentTrack, isPlaying, togglePlay, nextTrack, currentTime, duration, setIsFullPlayerOpen } = usePlayer();

  if (!currentTrack) return null;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const platformBadge = () => {
    switch (currentTrack.platform) {
      case 'yandex':
        return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-600/30 text-red-400 border border-red-500/30">Я</span>;
      case 'vk':
        return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-600/30 text-blue-400 border border-blue-500/30">VK</span>;
      case 'spotify':
        return <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-600/30 text-emerald-400 border border-emerald-500/30">SP</span>;
      default:
        return null;
    }
  };

  return (
    <div className="w-full max-w-md mx-auto px-4 mb-3 pointer-events-auto">
      <div
        onClick={() => { triggerHaptic(); setIsFullPlayerOpen(true); }}
        className="relative flex items-center justify-between p-2.5 bg-zinc-900/80 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] cursor-pointer active:scale-[0.98] transition-all overflow-hidden"
      >
        {/* Полоса прогресса внизу мини-плеера */}
        <div
          className="absolute bottom-0 left-0 h-[3px] bg-white transition-all duration-200 opacity-80"
          style={{ width: `${progressPercent}%` }}
        />

        {/* Обложка и инфо */}
        <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
          <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-white/5 flex-shrink-0 shadow-md">
            <CoverImage
              src={currentTrack.cover_url}
              alt={currentTrack.title}
              className={`w-full h-full object-cover ${isPlaying ? 'scale-105' : ''} transition-transform duration-500`}
              iconSize={20}
              isPlaying={isPlaying}
            />
          </div>

          <div className="min-w-0 flex-1 py-0.5">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-sm font-semibold text-white truncate block tracking-tight">
                {currentTrack.title}
              </span>
              {platformBadge()}
            </div>
            <ArtistLinks
              artist={currentTrack.artist}
              title={currentTrack.title}
              className="text-[11px] text-zinc-400 truncate block font-medium"
            />
          </div>
        </div>

        {/* Кнопки управления */}
        <div className="flex items-center gap-2 flex-shrink-0 pr-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => { triggerHaptic(); togglePlay(); }}
            className="w-10 h-10 rounded-full bg-white text-black hover:bg-zinc-200 active:scale-95 transition-all flex items-center justify-center shadow-lg"
            aria-label={isPlaying ? 'Пауза' : 'Играть'}
          >
            {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-1" />}
          </button>
          <button
            onClick={() => { triggerHaptic(); nextTrack(); }}
            className="w-10 h-10 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 active:scale-95 transition-all flex items-center justify-center"
            aria-label="Следующий трек"
          >
            <SkipForward size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};
