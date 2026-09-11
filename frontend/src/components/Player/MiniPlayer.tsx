import React from 'react';
import { Play, Pause, SkipForward } from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { CoverImage } from '../Common/CoverImage';

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
    <div className="w-full max-w-md mx-auto px-3 mb-2 pointer-events-auto">
      <div
        onClick={() => setIsFullPlayerOpen(true)}
        className="relative flex items-center justify-between p-2.5 theme-card bg-[#181b24]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl cursor-pointer active:scale-[0.99] transition-transform overflow-hidden"
      >
        {/* Полоса прогресса внизу мини-плеера */}
        <div
          className="absolute bottom-0 left-0 h-[2.5px] bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-200"
          style={{ width: `${progressPercent}%` }}
        />

        {/* Обложка и инфо */}
        <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
          <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-white/5 flex-shrink-0 shadow-md">
            <CoverImage
              src={currentTrack.cover_url}
              alt={currentTrack.title}
              className={`w-full h-full object-cover ${isPlaying ? 'scale-105' : ''} transition-transform duration-500`}
              iconSize={20}
              isPlaying={isPlaying}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-white truncate block">
                {currentTrack.title}
              </span>
              {platformBadge()}
            </div>
            <p className="text-xs text-gray-400 truncate mt-0.5">{currentTrack.artist}</p>
          </div>
        </div>

        {/* Кнопки управления */}
        <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-90 transition-all flex items-center justify-center text-white shadow-lg shadow-blue-600/30"
            aria-label={isPlaying ? 'Пауза' : 'Играть'}
          >
            {isPlaying ? <Pause size={18} fill="white" /> : <Play size={18} fill="white" className="ml-0.5" />}
          </button>
          <button
            onClick={nextTrack}
            className="w-8 h-8 rounded-full text-gray-400 hover:text-white active:scale-90 transition-all flex items-center justify-center"
            aria-label="Следующий трек"
          >
            <SkipForward size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};
