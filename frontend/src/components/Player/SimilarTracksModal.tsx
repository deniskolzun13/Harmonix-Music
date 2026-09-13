import React, { useState, useEffect } from 'react';
import { Radio, Play, Plus, X, Loader2, Music, Check } from 'lucide-react';
import { Track } from '../../types';
import { getYandexSimilarTracks } from '../../api';
import { usePlayer } from '../../context/PlayerContext';
import { CoverImage } from '../Common/CoverImage';
import { useBackNavigation } from '../../services/backNavigation';

interface SimilarTracksModalProps {
  isOpen: boolean;
  onClose: () => void;
  track: Track | null;
}

function formatDuration(sec: number): string {
  if (!sec) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export const SimilarTracksModal: React.FC<SimilarTracksModalProps> = ({ isOpen, onClose, track }) => {
  const { playTrack, addToQueue, currentTrack, isPlaying } = usePlayer();
  const [similarTracks, setSimilarTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedAll, setAddedAll] = useState(false);

  useBackNavigation('similar_tracks_modal', isOpen, onClose, 72);

  useEffect(() => {
    if (!isOpen || !track) {
      setSimilarTracks([]);
      setError(null);
      setAddedAll(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);
    setAddedAll(false);

    getYandexSimilarTracks(track.id, 25)
      .then((tracks) => {
        if (isMounted) {
          setSimilarTracks(tracks);
          setLoading(false);
          if (tracks.length === 0) {
            setError('Не удалось найти похожие треки для этой композиции.');
          }
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Ошибка загрузки похожих треков. Проверьте авторизацию Яндекс.');
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, track]);

  if (!isOpen || !track) return null;

  const handlePlayAll = () => {
    if (similarTracks.length > 0) {
      playTrack(similarTracks[0], similarTracks);
      onClose();
    }
  };

  const handleAddAllToQueue = () => {
    if (similarTracks.length > 0) {
      addToQueue(similarTracks);
      setAddedAll(true);
      setTimeout(() => setAddedAll(false), 2000);
    }
  };

  const handlePlaySingle = (t: Track) => {
    playTrack(t, similarTracks);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-[#161a23] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl animate-slideUp text-white max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Шапка */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Radio size={22} className="animate-pulse" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold truncate">Радио по треку</h3>
              <p className="text-xs text-gray-400 truncate">
                Похожие на <span className="text-white font-medium">{track.title}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-gray-400 hover:text-white rounded-full hover:bg-white/5 active:scale-95 transition-all shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* Быстрые действия */}
        {similarTracks.length > 0 && !loading && (
          <div className="flex items-center gap-2 py-3 border-b border-white/5 shrink-0">
            <button
              onClick={handlePlayAll}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs active:scale-95 transition-all shadow-lg shadow-amber-500/20"
            >
              <Play size={15} fill="currentColor" />
              Включить радио ({similarTracks.length})
            </button>
            <button
              onClick={handleAddAllToQueue}
              disabled={addedAll}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-medium active:scale-95 transition-all shrink-0"
              title="Добавить все треки в очередь"
            >
              {addedAll ? (
                <>
                  <Check size={15} className="text-green-400" />
                  <span className="text-green-400">Добавлено</span>
                </>
              ) : (
                <>
                  <Plus size={15} />
                  <span>В очередь</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* Список похожих треков */}
        <div className="flex-1 overflow-y-auto min-h-[220px] py-2 space-y-1 overscroll-contain">
          {loading && (
            <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-3">
              <Loader2 size={32} className="animate-spin text-amber-400" />
              <span className="text-xs">Ищем похожую музыку в Яндекс...</span>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center justify-center h-48 text-center px-4">
              <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-gray-400 mb-3">
                <Music size={22} />
              </div>
              <p className="text-xs text-gray-300 max-w-xs">{error}</p>
            </div>
          )}

          {!loading && !error && similarTracks.map((t, idx) => {
            const isCurrent = currentTrack?.id === t.id;
            return (
              <div
                key={`${t.id}-${idx}`}
                onClick={() => handlePlaySingle(t)}
                className={`flex items-center gap-3 p-2 rounded-xl transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-amber-500/15 border border-amber-500/30 text-amber-300'
                    : 'hover:bg-white/5 active:bg-white/10 text-white'
                }`}
              >
                <div className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-black/40">
                  <CoverImage src={t.cover_url} alt={t.title} className="w-full h-full object-cover" />
                  {isCurrent && isPlaying && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold truncate ${isCurrent ? 'text-amber-400' : 'text-gray-100'}`}>
                    {t.title}
                  </p>
                  <p className="text-[11px] text-gray-400 truncate mt-0.5">{t.artist}</p>
                </div>

                <span className="text-[11px] text-gray-500 shrink-0 font-mono">
                  {formatDuration(t.duration)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
