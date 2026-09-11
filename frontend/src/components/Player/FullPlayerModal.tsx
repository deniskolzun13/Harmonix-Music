import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  Volume2,
  VolumeX,
  ListMusic,
  Heart,
  Mic2,
  Moon,
  Sliders,
  Activity,
} from 'lucide-react';
import { usePlayer } from '../../context/PlayerContext';
import { CoverImage } from '../Common/CoverImage';
import { ArtistLinks } from '../Common/ArtistLinks';
import { useBackNavigation } from '../../services/backNavigation';
import { LyricsView } from './LyricsView';
import { AudioVisualizer } from './AudioVisualizer';
import { SleepTimerModal } from './SleepTimerModal';
import { EqualizerModal } from './EqualizerModal';
import { extractCoverPalette, ExtractedPalette } from '../../services/colorExtractor';

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export const FullPlayerModal: React.FC = () => {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isShuffle,
    repeatMode,
    queue,
    isFullPlayerOpen,
    togglePlay,
    nextTrack,
    prevTrack,
    seek,
    setVolume,
    toggleShuffle,
    toggleRepeat,
    setIsFullPlayerOpen,
    playTrack,
    sleepTimerOption,
    sleepTimerRemaining,
    playbackRate,
    setPlaybackRate,
  } = usePlayer();

  const RATES = [0.75, 1.0, 1.25, 1.5, 2.0];
  const cyclePlaybackRate = () => {
    const idx = RATES.indexOf(playbackRate);
    const nextRate = idx === -1 || idx === RATES.length - 1 ? RATES[0] : RATES[idx + 1];
    setPlaybackRate(nextRate);
  };

  const [showQueue, setShowQueue] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showVisualizer, setShowVisualizer] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isSleepTimerOpen, setIsSleepTimerOpen] = useState(false);
  const [isEqualizerOpen, setIsEqualizerOpen] = useState(false);

  // Адаптивный цвет фона под обложку
  const [palette, setPalette] = useState<ExtractedPalette | null>(null);

  useEffect(() => {
    if (currentTrack?.cover_url) {
      extractCoverPalette(currentTrack.cover_url).then(setPalette);
    } else {
      setPalette(null);
    }
  }, [currentTrack?.cover_url]);

  // Обработка системного жеста "Назад" для очереди, текста, визуализатора и плеера
  useBackNavigation('player_visualizer', isFullPlayerOpen && showVisualizer, () => setShowVisualizer(false), 68);
  useBackNavigation('player_lyrics', isFullPlayerOpen && showLyrics, () => setShowLyrics(false), 65);
  useBackNavigation('player_queue', isFullPlayerOpen && showQueue, () => setShowQueue(false), 60);
  useBackNavigation('full_player_modal', isFullPlayerOpen && !showQueue && !showLyrics && !showVisualizer, () => setIsFullPlayerOpen(false), 50);

  const toggleVisualizer = () => {
    setShowVisualizer((prev) => !prev);
    if (showLyrics) setShowLyrics(false);
    if (showQueue) setShowQueue(false);
  };

  const toggleLyrics = () => {
    setShowLyrics((prev) => !prev);
    if (showQueue) setShowQueue(false);
    if (showVisualizer) setShowVisualizer(false);
  };

  const toggleQueue = () => {
    setShowQueue((prev) => !prev);
    if (showLyrics) setShowLyrics(false);
    if (showVisualizer) setShowVisualizer(false);
  };

  // Анимация перелистывания треков: 'next' | 'prev' | null
  const [switchAnim, setSwitchAnim] = useState<'next' | 'prev' | null>(null);

  // Жест свайпа вниз для закрытия плеера (drag down)
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);

  // Жест горизонтального свайпа по обложке (track skip)
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);

  // Сброс анимации перелистывания трека
  useEffect(() => {
    if (switchAnim) {
      const timer = setTimeout(() => setSwitchAnim(null), 320);
      return () => clearTimeout(timer);
    }
  }, [switchAnim]);

  // Обработчики кнопок со сдвигом трека
  const handleNextTrack = () => {
    setSwitchAnim('next');
    nextTrack();
  };

  const handlePrevTrack = () => {
    setSwitchAnim('prev');
    prevTrack();
  };

  // Жест закрытия свайпом вниз по верхней панели
  const handleSheetTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleSheetTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - dragStartY.current;
    if (diff > 0) {
      setDragY(diff);
    } else {
      setDragY(0);
    }
  };

  const handleSheetTouchEnd = () => {
    setIsDragging(false);
    if (dragY > 90) {
      // Закрываем плеер
      setIsFullPlayerOpen(false);
    }
    setDragY(0);
  };

  // Жест горизонтального свайпа по обложке
  const handleCoverTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleCoverTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const diffX = touchEndX - touchStartX.current;
    const diffY = touchEndY - touchStartY.current;

    // Горизонтальный свайп с приоритетом над вертикальным
    if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
      if (diffX < 0) {
        // Свайп влево -> следующий трек
        handleNextTrack();
      } else {
        // Свайп вправо -> предыдущий трек
        handlePrevTrack();
      }
    }
  };

  if (!currentTrack) return null;

  const platformName = {
    yandex: 'Яндекс Музыка',
    vk: 'VK Музыка',
    spotify: 'Spotify',
    local: 'Локальный файл',
  }[currentTrack.platform];

  // Стили для анимации поднятия и опускания
  const transformStyle = isDragging
    ? `translateY(${dragY}px)`
    : isFullPlayerOpen
    ? 'translateY(0%)'
    : 'translateY(100%)';

  const opacityStyle = isFullPlayerOpen ? 1 : 0;
  const pointerEventsClass = isFullPlayerOpen ? 'pointer-events-auto' : 'pointer-events-none';

  return (
    <div
      style={{
        transform: transformStyle,
        opacity: opacityStyle,
        transition: isDragging ? 'none' : 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.25s ease',
      }}
      className={`fixed inset-0 z-50 flex flex-col bg-[#0d0f15] text-white select-none ${pointerEventsClass}`}
    >
      {/* Адаптивный живой градиент под цвета обложки */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-1000 ease-in-out"
        style={{
          background: palette
            ? `radial-gradient(circle at 50% 30%, ${palette.primary} 0%, ${palette.secondary} 48%, #0d0f15 88%)`
            : undefined,
        }}
      />
      {/* Размытый фоновый цвет от обложки */}
      {currentTrack.cover_url && (
        <div
          className="absolute inset-0 opacity-20 filter blur-3xl pointer-events-none bg-cover bg-center transition-all duration-1000"
          style={{ backgroundImage: `url(${currentTrack.cover_url})` }}
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#0d0f15]/75 to-[#0d0f15] pointer-events-none" />

      {/* Верхняя ручка для свайпа вниз (Drag Indicator) */}
      <div
        onTouchStart={handleSheetTouchStart}
        onTouchMove={handleSheetTouchMove}
        onTouchEnd={handleSheetTouchEnd}
        className="relative z-20 w-full pt-safe-handle pb-2 cursor-grab active:cursor-grabbing flex justify-center items-center"
      >
        <div className="w-12 h-1.5 bg-white/30 rounded-full hover:bg-white/50 transition-colors shadow-sm" />
      </div>

      {/* Верхняя панель заголовка */}
      <div
        onTouchStart={handleSheetTouchStart}
        onTouchMove={handleSheetTouchMove}
        onTouchEnd={handleSheetTouchEnd}
        className="relative z-10 flex items-center justify-between px-6 pt-1 pb-3"
      >
        <button
          onClick={() => setIsFullPlayerOpen(false)}
          className="w-11 h-11 rounded-full flex items-center justify-center text-gray-200 hover:text-white bg-white/10 active:scale-90 transition-all shadow-md"
          aria-label="Свернуть плеер"
        >
          <ChevronDown size={26} />
        </button>
        <div className="text-center">
          <span className="text-[10px] uppercase tracking-widest text-gray-400 font-medium">
            Воспроизведение из
          </span>
          <p className="text-xs font-semibold text-blue-400">{platformName}</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Кнопка таймера сна */}
          <button
            onClick={() => setIsSleepTimerOpen(true)}
            className={`relative w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-md ${
              sleepTimerOption !== 'off'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-amber-500/20'
                : 'text-gray-200 hover:text-white bg-white/10'
            }`}
            aria-label="Таймер сна"
            title="Таймер сна"
          >
            <Moon size={19} />
            {sleepTimerRemaining !== null && (
              <span className="absolute -bottom-1 -right-1 bg-amber-500 text-black font-extrabold text-[9px] px-1 rounded-full leading-tight shadow">
                {Math.ceil(sleepTimerRemaining / 60)}м
              </span>
            )}
            {sleepTimerOption === 'end_of_track' && (
              <span className="absolute -bottom-1 -right-1 bg-amber-500 text-black font-extrabold text-[9px] px-1 rounded-full leading-tight shadow">
                1т
              </span>
            )}
          </button>

          {/* Кнопка караоке / текста песни */}
          <button
            onClick={toggleLyrics}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-md ${
              showLyrics
                ? 'bg-blue-600 text-white shadow-blue-600/30 ring-2 ring-blue-400/50'
                : 'text-gray-200 hover:text-white bg-white/10'
            }`}
            aria-label="Текст песни и караоке"
            title="Текст песни и караоке"
          >
            <Mic2 size={20} />
          </button>

          {/* Кнопка живого визуализатора звука */}
          <button
            onClick={toggleVisualizer}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-md ${
              showVisualizer
                ? 'bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-cyan-500/30 ring-2 ring-cyan-400/50'
                : 'text-gray-200 hover:text-white bg-white/10'
            }`}
            aria-label="Живой визуализатор звука"
            title="Живой визуализатор звука (Спектр / Волна)"
          >
            <Activity size={20} />
          </button>

          {/* Кнопка очереди */}
          <button
            onClick={toggleQueue}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-md ${
              showQueue ? 'bg-blue-600 text-white shadow-blue-600/30' : 'text-gray-200 hover:text-white bg-white/10'
            }`}
            aria-label="Очередь воспроизведения"
            title="Очередь воспроизведения"
          >
            <ListMusic size={22} />
          </button>
        </div>
      </div>

      {/* Основной контент (Обложка со свайпом, Очередь, Караоке или Визуализатор) */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8 min-h-0">
        {showQueue ? (
          /* Список очередей */
          <div className="w-full h-full max-h-[380px] bg-white/5 rounded-3xl p-4 overflow-y-auto backdrop-blur-md border border-white/10 shadow-2xl animate-fadeIn">
            <h3 className="text-sm font-semibold text-gray-300 mb-3 px-2">Далее в очереди ({queue.length})</h3>
            <div className="space-y-2">
              {queue.map((t, idx) => (
                <div
                  key={`${t.id}-${idx}`}
                  onClick={() => playTrack(t)}
                  className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-colors ${
                    t.id === currentTrack.id ? 'bg-blue-600/30 border border-blue-500/40 text-blue-400' : 'hover:bg-white/5 text-gray-300'
                  }`}
                >
                  <span className="text-xs text-gray-500 w-4 text-center">{idx + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{t.title}</p>
                    <ArtistLinks
                      artist={t.artist}
                      title={t.title}
                      className="text-xs text-gray-400 truncate mt-0.5 block"
                    />
                  </div>
                  <span className="text-xs text-gray-500">{formatTime(t.duration)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : showLyrics ? (
          /* Синхронизированный текст караоке */
          <LyricsView
            track={currentTrack}
            currentTime={currentTime}
            onSeek={seek}
          />
        ) : showVisualizer ? (
          /* Живой аудио-визуализатор спектра и волны */
          <div className="w-full max-w-[320px] aspect-square rounded-3xl overflow-hidden p-3 bg-black/40 border border-white/10 backdrop-blur-xl shadow-2xl my-auto animate-fadeIn">
            <AudioVisualizer isPlaying={isPlaying} />
          </div>
        ) : (
          /* Крупная обложка с поддержкой свайпов влево/вправо */
          <div
            onTouchStart={handleCoverTouchStart}
            onTouchEnd={handleCoverTouchEnd}
            className={`relative w-full max-w-[300px] aspect-square rounded-3xl overflow-hidden shadow-2xl border border-white/10 my-auto cursor-grab active:scale-[0.98] transition-transform select-none ${
              switchAnim === 'next' ? 'animate-track-next' : switchAnim === 'prev' ? 'animate-track-prev' : ''
            }`}
          >
            <CoverImage
              src={currentTrack.cover_url}
              alt={currentTrack.title}
              iconSize={80}
              isPlaying={isPlaying}
              fallbackType="disc"
              className="w-full h-full object-cover"
            />
          </div>
        )}
      </div>

      {/* Нижний блок: название, ползунок, кнопки управления */}
      <div className="relative z-10 px-8 pb-12 pt-2 max-w-md mx-auto w-full">
        {/* Название трека и кнопка лайка с анимацией смены трека */}
        <div
          className={`flex items-center justify-between mb-4 transition-all ${
            switchAnim === 'next' ? 'animate-track-next' : switchAnim === 'prev' ? 'animate-track-prev' : ''
          }`}
        >
          <div className="min-w-0 flex-1 pr-4">
            <h2 className="text-xl font-bold text-white truncate">{currentTrack.title}</h2>
            <ArtistLinks
              artist={currentTrack.artist}
              title={currentTrack.title}
              className="text-sm text-gray-400 truncate mt-1 block"
            />
          </div>
          <button
            onClick={() => setIsLiked(!isLiked)}
            className={`p-2 rounded-full active:scale-90 transition-transform ${
              isLiked ? 'text-red-500' : 'text-gray-400 hover:text-white'
            }`}
            aria-label="Нравится"
          >
            <Heart size={24} fill={isLiked ? 'currentColor' : 'none'} />
          </button>
        </div>

        {/* Слайдер перемотки */}
        <div className="mb-4">
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={currentTime}
            onChange={(e) => seek(Number(e.target.value))}
            className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none"
          />
          <div className="flex justify-between text-xs text-gray-400 font-mono mt-2">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Кнопки воспроизведения */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={toggleShuffle}
            className={`p-2 transition-colors active:scale-90 ${
              isShuffle ? 'text-blue-500' : 'text-gray-400 hover:text-white'
            }`}
            aria-label="Случайный порядок"
          >
            <Shuffle size={20} />
          </button>

          <button
            onClick={handlePrevTrack}
            className="p-3 text-gray-200 hover:text-white active:scale-90 transition-transform"
            aria-label="Предыдущий трек"
          >
            <SkipBack size={28} />
          </button>

          <button
            onClick={togglePlay}
            className="w-16 h-16 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-xl shadow-blue-600/40 active:scale-95 transition-all"
            aria-label={isPlaying ? 'Пауза' : 'Воспроизведение'}
          >
            {isPlaying ? <Pause size={28} fill="white" /> : <Play size={28} fill="white" className="ml-1" />}
          </button>

          <button
            onClick={handleNextTrack}
            className="p-3 text-gray-200 hover:text-white active:scale-90 transition-transform"
            aria-label="Следующий трек"
          >
            <SkipForward size={28} />
          </button>

          <button
            onClick={toggleRepeat}
            className={`p-2 transition-colors active:scale-90 ${
              repeatMode !== 'off' ? 'text-blue-500' : 'text-gray-400 hover:text-white'
            }`}
            aria-label="Режим повтора"
          >
            {repeatMode === 'one' ? <Repeat1 size={20} /> : <Repeat size={20} />}
          </button>
        </div>

        {/* Регулировка громкости и эквалайзер */}
        <div className="flex items-center gap-3 px-2">
          <button
            onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
            className="text-gray-400 hover:text-white active:scale-90 transition-transform"
            aria-label="Вкл/выкл звук"
          >
            {volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-gray-400 focus:outline-none"
          />
          {/* Регулировка скорости воспроизведения */}
          <button
            onClick={cyclePlaybackRate}
            className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-bold text-gray-300 active:scale-90 transition-all"
            title="Скорость воспроизведения (нажмите для смены)"
          >
            {playbackRate}x
          </button>
          <button
            onClick={() => setIsEqualizerOpen(true)}
            className="text-gray-400 hover:text-blue-400 active:scale-90 transition-all p-1"
            aria-label="Эквалайзер"
            title="Эквалайзер, Бас и Студия звука"
          >
            <Sliders size={18} />
          </button>
        </div>
      </div>

      {/* Модальное окно таймера сна */}
      <SleepTimerModal
        isOpen={isSleepTimerOpen}
        onClose={() => setIsSleepTimerOpen(false)}
      />

      {/* Модальное окно эквалайзера */}
      <EqualizerModal
        isOpen={isEqualizerOpen}
        onClose={() => setIsEqualizerOpen(false)}
      />
    </div>
  );
};
