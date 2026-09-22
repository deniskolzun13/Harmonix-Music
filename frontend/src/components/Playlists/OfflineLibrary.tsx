import React, { useEffect, useState } from 'react';
import { HardDrive, Play, Trash2, Shuffle } from 'lucide-react';
import { Track } from '../../types';
import { getCachedTracks, clearCache } from '../../services/cacheManager';
import { usePlayer } from '../../context/PlayerContext';
import { CoverImage } from '../Common/CoverImage';

export const OfflineLibrary: React.FC = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const { playTrack, currentTrack } = usePlayer();

  const loadTracks = async () => {
    setLoading(true);
    const cached = await getCachedTracks();
    // Исключаем превью
    setTracks(cached.filter((t) => !t.isPreview));
    setLoading(false);
  };

  useEffect(() => {
    loadTracks();
  }, []);

  const handlePlayTrack = (track: Track) => {
    playTrack(track, tracks);
  };

  const handlePlayAll = () => {
    if (tracks.length > 0) {
      playTrack(tracks[0], tracks);
    }
  };

  const handleClear = async () => {
    if (confirm('Вы уверены, что хотите удалить все сохраненные треки?')) {
      await clearCache();
      loadTracks();
    }
  };

  return (
    <div className="pt-safe-top pb-44 px-4">
      <div className="flex items-center justify-between mb-6 pt-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-600/20 flex items-center justify-center">
            <HardDrive size={22} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Офлайн</h1>
            <p className="text-xs text-gray-400">{tracks.length} треков доступно без сети</p>
          </div>
        </div>
        {tracks.length > 0 && (
          <button
            onClick={handleClear}
            className="p-2 bg-white/5 hover:bg-red-500/10 rounded-full text-gray-400 hover:text-red-400 transition-colors"
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="animate-spin w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full"></div>
        </div>
      ) : tracks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <HardDrive size={48} className="text-zinc-700 mb-4" />
          <h2 className="text-lg font-bold text-white mb-2">Пусто</h2>
          <p className="text-sm text-gray-400 max-w-[250px]">
            Вы еще не скачали ни одного трека.
          </p>
        </div>
      ) : (
        <>
          <div className="flex gap-2 mb-4">
            <button
              onClick={handlePlayAll}
              className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-2xl flex items-center justify-center gap-2 font-bold text-white text-sm"
            >
              <Play size={16} className="fill-white" />
              Слушать все
            </button>
            <button
              onClick={() => {
                const shuffled = [...tracks].sort(() => Math.random() - 0.5);
                if (shuffled.length > 0) playTrack(shuffled[0], shuffled);
              }}
              className="px-4 py-3 bg-white/10 hover:bg-white/15 rounded-2xl flex items-center justify-center text-white"
            >
              <Shuffle size={18} />
            </button>
          </div>

          <div className="space-y-2">
            {tracks.map((track) => {
              const isPlaying = currentTrack?.id === track.id;
              return (
                <div
                  key={track.id}
                  onClick={() => handlePlayTrack(track)}
                  className={`flex items-center gap-3 p-2 rounded-xl transition-colors cursor-pointer ${
                    isPlaying ? 'bg-emerald-500/10' : 'hover:bg-white/5'
                  }`}
                >
                  <div className="w-12 h-12 flex-shrink-0">
                    <CoverImage src={track.cover_url} alt={track.title} className="w-full h-full rounded-lg" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${isPlaying ? 'text-emerald-400' : 'text-white'}`}>
                      {track.title}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{track.artist}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
