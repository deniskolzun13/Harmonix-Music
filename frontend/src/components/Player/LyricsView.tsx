import React, { useState, useEffect, useRef } from 'react';
import { Mic2, Loader2, Music, AlertCircle } from 'lucide-react';
import { Track } from '../../types';
import { fetchLyrics, LyricsData } from '../../services/lyricsService';

interface LyricsViewProps {
  track: Track;
  currentTime: number;
  onSeek: (seconds: number) => void;
}

export const LyricsView: React.FC<LyricsViewProps> = ({ track, currentTime, onSeek }) => {
  const [lyrics, setLyrics] = useState<LyricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeLineRef = useRef<HTMLParagraphElement | null>(null);
  const isUserScrollingRef = useRef<boolean>(false);
  const userScrollTimerRef = useRef<any>(null);

  // Загрузка текста при смене трека
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);
    setLyrics(null);

    fetchLyrics(track)
      .then((data) => {
        if (!isMounted) return;
        if (data && (data.lines.length > 0 || data.plainText || data.instrumental)) {
          setLyrics(data);
        } else {
          setError('Текст песни пока не найден');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError('Не удалось загрузить текст');
        console.error(err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
      if (userScrollTimerRef.current) clearTimeout(userScrollTimerRef.current);
    };
  }, [track.id, track.title, track.artist]);

  // Вычисление текущей активной строки (синхронизированное караоке)
  let activeIndex = -1;
  if (lyrics?.synced && lyrics.lines.length > 0) {
    for (let i = 0; i < lyrics.lines.length; i++) {
      // 0.25s опережение для естественного восприятия пения
      if (currentTime >= lyrics.lines[i].time - 0.25) {
        activeIndex = i;
      } else {
        break;
      }
    }
  }

  // Плавный автоскролл к активной строке
  useEffect(() => {
    if (!isUserScrollingRef.current && activeLineRef.current && containerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeIndex]);

  // Детектор ручной прокрутки пальцем (приостанавливаем автоскролл на 3.5 секунды)
  const handleScroll = () => {
    isUserScrollingRef.current = true;
    if (userScrollTimerRef.current) clearTimeout(userScrollTimerRef.current);
    userScrollTimerRef.current = setTimeout(() => {
      isUserScrollingRef.current = false;
    }, 3500);
  };

  return (
    <div className="w-full h-full max-h-[380px] flex flex-col bg-white/5 rounded-3xl p-4 backdrop-blur-md border border-white/10 shadow-2xl animate-fadeIn overflow-hidden">
      {/* Шапка караоке */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-2 px-1">
        <div className="flex items-center gap-2">
          <Mic2 size={16} className="text-blue-400 animate-pulse" />
          <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">
            {lyrics?.synced ? 'Караоке в такт музыке' : 'Текст песни'}
          </span>
        </div>
        {lyrics?.source && (
          <span className="text-[10px] uppercase font-bold text-blue-400/90 bg-blue-500/20 px-2 py-0.5 rounded-full">
            {lyrics.source === 'lrclib' ? 'LRCLIB' : lyrics.source === 'yandex' ? 'Яндекс' : lyrics.source}
          </span>
        )}
      </div>

      {/* Тело с текстом */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto pr-1 select-none space-y-1 scroll-smooth"
      >
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3 py-12">
            <Loader2 size={32} className="animate-spin text-blue-500" />
            <p className="text-xs font-medium">Поиск и синхронизация текста...</p>
          </div>
        ) : error ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2 py-12 text-center px-4">
            <AlertCircle size={28} className="text-gray-500 mb-1" />
            <p className="text-sm font-semibold text-gray-300">{error}</p>
            <p className="text-xs text-gray-500">
              Для этого трека пока нет текста в открытых базах данных
            </p>
          </div>
        ) : lyrics?.instrumental ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-2 py-12 text-center">
            <Music size={32} className="text-blue-400 mb-1" />
            <p className="text-sm font-semibold text-gray-300">Инструментальная композиция</p>
            <p className="text-xs text-gray-500">Этот трек без слов</p>
          </div>
        ) : lyrics?.synced ? (
          /* Синхронизированные строки (Караоке) */
          <div className="py-16 space-y-3">
            {lyrics.lines.map((line, idx) => {
              const isActive = idx === activeIndex;
              const isPast = idx < activeIndex;

              return (
                <p
                  key={`${line.time}-${idx}`}
                  ref={isActive ? activeLineRef : null}
                  onClick={() => onSeek(line.time)}
                  className={`transition-all duration-300 cursor-pointer rounded-xl px-3 py-1.5 ${
                    isActive
                      ? 'text-white font-bold text-lg md:text-xl scale-[1.02] bg-blue-600/20 border border-blue-500/30 shadow-md text-shadow'
                      : isPast
                      ? 'text-white/40 hover:text-white/70 font-semibold text-base md:text-lg'
                      : 'text-white/30 hover:text-white/60 font-semibold text-base md:text-lg'
                  }`}
                >
                  {line.text}
                </p>
              );
            })}
          </div>
        ) : (
          /* Обычный текст без таймкодов */
          <div className="py-4 space-y-2 text-center">
            {lyrics?.lines.map((line, idx) => (
              <p
                key={idx}
                className="text-gray-300 font-medium text-sm md:text-base leading-relaxed"
              >
                {line.text}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Подсказка внизу */}
      {lyrics?.synced && !loading && (
        <div className="pt-2 border-t border-white/5 text-center">
          <p className="text-[10px] text-gray-500">
            Нажмите на любую строчку, чтобы мгновенно перейти к ней
          </p>
        </div>
      )}
    </div>
  );
};
