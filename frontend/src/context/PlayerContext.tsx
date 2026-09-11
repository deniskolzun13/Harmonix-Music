import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Track } from '../types';
import { getCachedTrackAudioUrl } from '../services/cacheManager';
import { getDirectYmAudioUrl } from '../services/standaloneImporter';
import { getServerUrl } from '../api';

interface PlayerContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isShuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';
  queue: Track[];
  isFullPlayerOpen: boolean;
  playTrack: (track: Track, newQueue?: Track[]) => void;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  setIsFullPlayerOpen: (open: boolean) => void;
}

const PlayerContext = createContext<PlayerContextType | null>(null);

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1.0);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [queue, setQueue] = useState<Track[]>([]);
  const [isFullPlayerOpen, setIsFullPlayerOpen] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Инициализация Audio элемента
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audioRef.current = audio;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration || 0);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      if (repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play().catch(console.error);
      } else {
        nextTrack();
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [repeatMode]);

  // Интеграция с MediaSession API (Lock Screen и шторка уведомлений телефона)
  useEffect(() => {
    if (!currentTrack || !('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      album: currentTrack.album || 'Harmonix Music',
      artwork: currentTrack.cover_url
        ? [
            { src: currentTrack.cover_url, sizes: '96x96', type: 'image/png' },
            { src: currentTrack.cover_url, sizes: '192x192', type: 'image/png' },
            { src: currentTrack.cover_url, sizes: '512x512', type: 'image/png' },
          ]
        : [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
    });

    navigator.mediaSession.setActionHandler('play', () => {
      audioRef.current?.play().catch(console.error);
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      audioRef.current?.pause();
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      prevTrack();
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      nextTrack();
    });
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined && audioRef.current) {
        audioRef.current.currentTime = details.seekTime;
      }
    });
  }, [currentTrack]);

  // Синхронизация статуса воспроизведения в MediaSession
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }, [isPlaying]);

  const playTrack = (track: Track, newQueue?: Track[]) => {
    if (newQueue) {
      setQueue(newQueue);
    } else if (!queue.some((t) => t.id === track.id)) {
      setQueue((prev) => [...prev, track]);
    }

    setCurrentTrack(track);
    if (audioRef.current) {
      // Если трек сохранен в оффлайн-кэше, используем локальный blob: поток
      getCachedTrackAudioUrl(track.id).then(async (cachedBlobUrl) => {
        if (!audioRef.current) return;
        if (cachedBlobUrl) {
          audioRef.current.src = cachedBlobUrl;
        } else if (track.stream_url && track.stream_url.startsWith('http')) {
          audioRef.current.src = track.stream_url;
        } else if (track.platform === 'yandex') {
          try {
            const direct = await getDirectYmAudioUrl(track.id);
            track.stream_url = direct;
            audioRef.current.src = direct;
          } catch (e) {
            audioRef.current.src = `${getServerUrl()}/api/stream/${track.platform}/${track.id}`;
          }
        } else {
          audioRef.current.src = `${getServerUrl()}/api/stream/${track.platform}/${track.id}`;
        }
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch((err) => {
          console.warn('Автовоспроизведение заблокировано браузером до первого клика:', err);
        });
      });
    }
  };

  const togglePlay = () => {
    if (!audioRef.current || !currentTrack) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(console.error);
    }
  };

  const nextTrack = () => {
    if (!queue.length || !currentTrack) return;
    const currentIndex = queue.findIndex((t) => t.id === currentTrack.id);
    let nextIndex = 0;

    if (isShuffle) {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else {
      nextIndex = currentIndex + 1;
      if (nextIndex >= queue.length) {
        if (repeatMode === 'all') nextIndex = 0;
        else return; // Очередь закончилась
      }
    }

    playTrack(queue[nextIndex]);
  };

  const prevTrack = () => {
    if (!audioRef.current) return;
    // Если трек уже играет больше 3 секунд, перемотать в начало
    if (audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }

    if (!queue.length || !currentTrack) return;
    const currentIndex = queue.findIndex((t) => t.id === currentTrack.id);
    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) {
      prevIndex = queue.length - 1;
    }
    playTrack(queue[prevIndex]);
  };

  const seek = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      setCurrentTime(seconds);
    }
  };

  const setVolume = (val: number) => {
    const clamped = Math.max(0, Math.min(1, val));
    setVolumeState(clamped);
    if (audioRef.current) {
      audioRef.current.volume = clamped;
    }
  };

  const toggleShuffle = () => setIsShuffle((prev) => !prev);

  const toggleRepeat = () => {
    setRepeatMode((prev) => (prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off'));
  };

  return (
    <PlayerContext.Provider
      value={{
        currentTrack,
        isPlaying,
        currentTime,
        duration,
        volume,
        isShuffle,
        repeatMode,
        queue,
        isFullPlayerOpen,
        playTrack,
        togglePlay,
        nextTrack,
        prevTrack,
        seek,
        setVolume,
        toggleShuffle,
        toggleRepeat,
        setIsFullPlayerOpen,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
};

export const usePlayer = () => {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayer must be used within a PlayerProvider');
  return context;
};
