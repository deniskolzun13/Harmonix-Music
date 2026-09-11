import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Track, ArtistSummary } from '../types';
import { getCachedTrackAudioUrl } from '../services/cacheManager';
import { getDirectYmAudioUrl } from '../services/standaloneImporter';
import { getServerUrl } from '../api';
import { findArtistByName } from '../services/playlistStorage';
import { BackgroundAudio } from 'capacitor-background-audio';
import { AudioFocus } from '../plugins/audioFocus';
import { equalizer } from '../services/audioEqualizer';

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
  selectedArtist: ArtistSummary | null;
  isArtistModalOpen: boolean;
  sleepTimerOption: 'off' | 'end_of_track' | number;
  sleepTimerRemaining: number | null;
  setSleepTimer: (option: 'off' | 'end_of_track' | number) => void;
  playbackRate: number;
  setPlaybackRate: (rate: number) => void;
  crossfadeSeconds: number;
  setCrossfadeSeconds: (sec: number) => void;
  playTrack: (track: Track, newQueue?: Track[]) => void;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  setIsFullPlayerOpen: (open: boolean) => void;
  openArtist: (artistName: string) => void;
  closeArtist: () => void;
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
  const [selectedArtist, setSelectedArtist] = useState<ArtistSummary | null>(null);
  const [isArtistModalOpen, setIsArtistModalOpen] = useState(false);

  // Состояния таймера сна (Sleep Timer)
  const [sleepTimerOption, setSleepTimerOption] = useState<'off' | 'end_of_track' | number>('off');
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState<number | null>(null);
  const sleepTimerOptionRef = useRef<'off' | 'end_of_track' | number>('off');

  useEffect(() => {
    sleepTimerOptionRef.current = sleepTimerOption;
  }, [sleepTimerOption]);

  // Скорость воспроизведения (Playback Rate)
  const [playbackRate, setPlaybackRateState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('harmonix_playback_rate');
      return saved ? parseFloat(saved) : 1.0;
    } catch {
      return 1.0;
    }
  });

  const setPlaybackRate = (rate: number) => {
    setPlaybackRateState(rate);
    try {
      localStorage.setItem('harmonix_playback_rate', rate.toString());
    } catch {}
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
  };

  // Кроссфейд (секунды плавного перехода между треками)
  const [crossfadeSeconds, setCrossfadeSecondsState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('harmonix_crossfade');
      return saved ? parseInt(saved, 10) : 0;
    } catch {
      return 0;
    }
  });

  const crossfadeSecondsRef = useRef<number>(0);
  useEffect(() => {
    crossfadeSecondsRef.current = crossfadeSeconds;
  }, [crossfadeSeconds]);

  const isCrossfadingRef = useRef<boolean>(false);

  const setCrossfadeSeconds = (sec: number) => {
    setCrossfadeSecondsState(sec);
    try {
      localStorage.setItem('harmonix_crossfade', sec.toString());
    } catch {}
  };

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const savedVolumeRef = useRef<number>(1.0);
  const isDuckedRef = useRef<boolean>(false);
  const wasPlayingBeforeTransientRef = useRef<boolean>(false);

  const openArtist = (artistName: string) => {
    if (!artistName || !artistName.trim()) return;
    const allContextTracks: Track[] = [...queue];
    if (currentTrack && !allContextTracks.some((t) => t.id === currentTrack.id)) {
      allContextTracks.push(currentTrack);
    }
    const summary = findArtistByName(artistName, allContextTracks);
    setSelectedArtist(summary);
    setIsArtistModalOpen(true);
  };

  const closeArtist = () => {
    setIsArtistModalOpen(false);
  };

  // Инициализация Audio элемента
  useEffect(() => {
    const audio = new Audio();
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';
    audio.playbackRate = playbackRate;
    audioRef.current = audio;

    // Инициализация Web Audio API эквалайзера и усиления баса
    equalizer.init(audio);

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);

      // Кроссфейд: плавное затухание громкости в конце трека
      const cf = crossfadeSecondsRef.current;
      if (
        cf > 0 &&
        audio.duration > cf * 2 &&
        audio.currentTime >= audio.duration - cf &&
        !isCrossfadingRef.current &&
        repeatMode !== 'one'
      ) {
        isCrossfadingRef.current = true;
        const startVol = audio.volume;
        const fadeStepMs = 100;
        const totalSteps = (cf * 1000) / fadeStepMs;
        const volStep = startVol / Math.max(1, totalSteps);
        let step = 0;
        const fadeTimer = setInterval(() => {
          step++;
          if (audioRef.current) {
            audioRef.current.volume = Math.max(0, startVol - step * volStep);
          }
          if (step >= totalSteps || !audioRef.current || audioRef.current.paused) {
            clearInterval(fadeTimer);
          }
        }, fadeStepMs);
      }
    };

    const handleLoadedMetadata = () => setDuration(audio.duration || 0);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      isCrossfadingRef.current = false;
      // Если включен режим «до конца текущего трека» — останавливаем воспроизведение
      if (sleepTimerOptionRef.current === 'end_of_track') {
        audio.pause();
        setIsPlaying(false);
        setSleepTimerOption('off');
        setSleepTimerRemaining(null);
        return;
      }

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

  // Управление нативным foreground service для фонового воспроизведения и кнопок в шторке Android
  useEffect(() => {
    if (isPlaying && currentTrack) {
      BackgroundAudio.enable({
        title: currentTrack.title,
        artist: currentTrack.artist,
        isPlaying: true,
      }).catch((err) => {
        console.warn('BackgroundAudio enable error:', err);
      });
    } else if (!isPlaying && currentTrack) {
      // Обновляем кнопку в шторке на "Играть" при паузе
      BackgroundAudio.update({
        title: currentTrack.title,
        artist: currentTrack.artist,
        isPlaying: false,
      }).catch(() => {});
    } else {
      BackgroundAudio.disable().catch((err) => {
        console.warn('BackgroundAudio disable error:', err);
      });
    }

    return () => {
      if (!currentTrack) {
        BackgroundAudio.disable().catch(() => {});
      }
    };
  }, [isPlaying, currentTrack?.id, currentTrack?.title, currentTrack?.artist]);

  // Слушатель нажатий на кнопки в шторке Android (Предыдущий / Играть / Следующий)
  useEffect(() => {
    let subHandle: { remove: () => void } | null = null;

    BackgroundAudio.addListener('mediaAction', (data: { action: string }) => {
      if (data.action === 'prev') {
        prevTrack();
      } else if (data.action === 'togglePlay') {
        togglePlay();
      } else if (data.action === 'next') {
        nextTrack();
      }
    })
      .then((handle) => {
        subHandle = handle;
      })
      .catch((err) => {
        console.warn('BackgroundAudio mediaAction listener error:', err);
      });

    return () => {
      subHandle?.remove();
    };
  }, [currentTrack, isPlaying, queue]);

  // Управление Audio Focus на Android (входящие звонки, голосовые подсказки, сторонние плееры)
  useEffect(() => {
    let lossHandle: { remove: () => void } | null = null;
    let transHandle: { remove: () => void } | null = null;
    let duckHandle: { remove: () => void } | null = null;
    let gainHandle: { remove: () => void } | null = null;

    const setupListeners = async () => {
      // AUDIOFOCUS_LOSS: полная потеря фокуса (запуск другого плеера)
      lossHandle = await AudioFocus.addListener('audioFocusLoss', () => {
        wasPlayingBeforeTransientRef.current = false;
        audioRef.current?.pause();
      });

      // AUDIOFOCUS_LOSS_TRANSIENT: временная потеря (входящий телефонный звонок)
      transHandle = await AudioFocus.addListener('audioFocusLossTransient', () => {
        if (audioRef.current && !audioRef.current.paused) {
          wasPlayingBeforeTransientRef.current = true;
          audioRef.current.pause();
        }
      });

      // AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK: приглушение звука (навигатор / системный звук)
      duckHandle = await AudioFocus.addListener('audioFocusCanDuck', () => {
        isDuckedRef.current = true;
        if (audioRef.current) {
          audioRef.current.volume = Math.min(0.2, savedVolumeRef.current * 0.2);
        }
      });

      // AUDIOFOCUS_GAIN: фокус возвращен
      gainHandle = await AudioFocus.addListener('audioFocusGain', () => {
        if (isDuckedRef.current) {
          isDuckedRef.current = false;
          if (audioRef.current) {
            audioRef.current.volume = savedVolumeRef.current;
          }
        }
        if (wasPlayingBeforeTransientRef.current) {
          wasPlayingBeforeTransientRef.current = false;
          audioRef.current?.play().catch(console.error);
        }
      });
    };

    setupListeners().catch(console.warn);

    return () => {
      lossHandle?.remove();
      transHandle?.remove();
      duckHandle?.remove();
      gainHandle?.remove();
      AudioFocus.abandonAudioFocus().catch(() => {});
    };
  }, []);

  // Запрос / освобождение Audio Focus в зависимости от воспроизведения
  useEffect(() => {
    if (isPlaying) {
      AudioFocus.requestAudioFocus().catch(console.warn);
    } else if (!wasPlayingBeforeTransientRef.current) {
      AudioFocus.abandonAudioFocus().catch(console.warn);
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
        } else if (track.stream_url && (track.stream_url.startsWith('http') || track.stream_url.startsWith('blob:'))) {
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
        audioRef.current.playbackRate = playbackRate;
        audioRef.current.currentTime = 0;
        isCrossfadingRef.current = false;

        if (crossfadeSecondsRef.current > 0) {
          const targetVol = savedVolumeRef.current;
          audioRef.current.volume = 0;
          audioRef.current.play().then(() => {
            let inStep = 0;
            const inSteps = 10;
            const inTimer = setInterval(() => {
              inStep++;
              if (audioRef.current) {
                audioRef.current.volume = Math.min(targetVol, (inStep / inSteps) * targetVol);
              }
              if (inStep >= inSteps) clearInterval(inTimer);
            }, 100);
          }).catch((err) => {
            console.warn('Автовоспроизведение заблокировано браузером до первого клика:', err);
          });
        } else {
          audioRef.current.volume = savedVolumeRef.current;
          audioRef.current.play().catch((err) => {
            console.warn('Автовоспроизведение заблокировано браузером до первого клика:', err);
          });
        }
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
    savedVolumeRef.current = clamped;
    if (audioRef.current) {
      audioRef.current.volume = isDuckedRef.current ? Math.min(0.2, clamped * 0.2) : clamped;
    }
  };

  const toggleShuffle = () => setIsShuffle((prev) => !prev);

  const toggleRepeat = () => {
    setRepeatMode((prev) => (prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off'));
  };

  // Логика обратного отсчета таймера сна и плавного затухания (Fade Out)
  useEffect(() => {
    if (!isPlaying || typeof sleepTimerOption !== 'number' || sleepTimerRemaining === null) {
      return;
    }

    const interval = setInterval(() => {
      setSleepTimerRemaining((prev) => {
        if (prev === null || prev <= 1) {
          // Время вышло — выключаем музыку и восстанавливаем уровень громкости
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.volume = savedVolumeRef.current;
          }
          setIsPlaying(false);
          setSleepTimerOption('off');
          return null;
        }

        const nextVal = prev - 1;
        // Плавное затухание (fade out) за последние 20 секунд
        if (nextVal <= 20 && audioRef.current) {
          const ratio = Math.max(0, nextVal / 20);
          audioRef.current.volume = savedVolumeRef.current * ratio;
        }

        return nextVal;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, sleepTimerOption, sleepTimerRemaining]);

  const setSleepTimer = (option: 'off' | 'end_of_track' | number) => {
    setSleepTimerOption(option);
    if (option === 'off') {
      setSleepTimerRemaining(null);
      if (audioRef.current) {
        audioRef.current.volume = savedVolumeRef.current;
      }
    } else if (option === 'end_of_track') {
      setSleepTimerRemaining(null);
      if (audioRef.current) {
        audioRef.current.volume = savedVolumeRef.current;
      }
    } else if (typeof option === 'number') {
      setSleepTimerRemaining(option * 60);
      if (audioRef.current) {
        audioRef.current.volume = savedVolumeRef.current;
      }
    }
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
        selectedArtist,
        isArtistModalOpen,
        sleepTimerOption,
        sleepTimerRemaining,
        setSleepTimer,
        playbackRate,
        setPlaybackRate,
        crossfadeSeconds,
        setCrossfadeSeconds,
        playTrack,
        togglePlay,
        nextTrack,
        prevTrack,
        seek,
        setVolume,
        toggleShuffle,
        toggleRepeat,
        setIsFullPlayerOpen,
        openArtist,
        closeArtist,
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
