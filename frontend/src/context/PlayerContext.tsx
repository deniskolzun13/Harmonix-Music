import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Track, ArtistSummary } from '../types';
import { getCachedTrackAudioUrl, saveTrackToCache } from '../services/cacheManager';
import { getDirectYmAudioUrl } from '../services/standaloneImporter';
import { getServerUrl } from '../api';
import { findArtistByName } from '../services/playlistStorage';
import { BackgroundAudio } from 'capacitor-background-audio';
import { AudioFocus } from '../plugins/audioFocus';
import { recordPlayback } from '../services/statsService';

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
  shakeToShuffle: boolean;
  setShakeToShuffle: (enabled: boolean) => void;
  playTrack: (track: Track, newQueue?: Track[]) => void;
  addToQueue: (trackOrTracks: Track | Track[]) => void;
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

  // Встряхивание для перемешивания (Shake to Shuffle)
  const [shakeToShuffle, setShakeToShuffleState] = useState<boolean>(() => {
    try {
      return localStorage.getItem('harmonix_shake_to_shuffle') === 'true';
    } catch {
      return false;
    }
  });

  const setShakeToShuffle = (enabled: boolean) => {
    setShakeToShuffleState(enabled);
    try {
      localStorage.setItem('harmonix_shake_to_shuffle', enabled ? 'true' : 'false');
    } catch {}
  };

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const savedVolumeRef = useRef<number>(1.0);
  const isDuckedRef = useRef<boolean>(false);
  const wasPlayingBeforeTransientRef = useRef<boolean>(false);

  // Статистика прослушиваний
  const currentTrackRef = useRef<Track | null>(null);
  const trackPlayStartRef = useRef<number>(0);
  const trackPlaySecondsRef = useRef<number>(0);
  const autoCachedTrackIdRef = useRef<string | null>(null);

  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  const flushPlaybackStats = () => {
    if (trackPlayStartRef.current > 0) {
      const elapsed = (Date.now() - trackPlayStartRef.current) / 1000;
      trackPlaySecondsRef.current += elapsed;
      trackPlayStartRef.current = 0;
    }
    if (trackPlaySecondsRef.current >= 15 && currentTrackRef.current) {
      recordPlayback(
        currentTrackRef.current.id,
        currentTrackRef.current.title,
        currentTrackRef.current.artist,
        trackPlaySecondsRef.current
      );
    }
    trackPlaySecondsRef.current = 0;
  };

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
    audio.playbackRate = playbackRate;
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);

      // Фоновое автокэширование строго некэшированной музыки при прослушивании > 15 секунд
      if (
        audio.currentTime >= 15 &&
        currentTrackRef.current &&
        currentTrackRef.current.id !== autoCachedTrackIdRef.current
      ) {
        const tr = currentTrackRef.current;
        autoCachedTrackIdRef.current = tr.id;
        const autoCacheEnabled = localStorage.getItem('harmonix_auto_cache_played') !== 'false';
        if (autoCacheEnabled && tr.platform !== 'local') {
          saveTrackToCache(tr).catch(() => {});
        }
      }

      // Кроссфейд: плавное затухание громкости в самом конце трека
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
    const handlePlay = () => {
      setIsPlaying(true);
      trackPlayStartRef.current = Date.now();
    };
    const handlePause = () => {
      setIsPlaying(false);
      if (trackPlayStartRef.current > 0) {
        trackPlaySecondsRef.current += (Date.now() - trackPlayStartRef.current) / 1000;
        trackPlayStartRef.current = 0;
      }
    };
    const handleEnded = () => {
      isCrossfadingRef.current = false;
      flushPlaybackStats();
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

    const handleError = () => {
      const err = audio.error;
      console.warn('Audio playback error:', err?.code, err?.message, audio.src);
      // Если прямая ссылка оборвалась, пробуем через серверный прокси
      if (currentTrackRef.current && audio.src && !audio.src.includes('/api/stream/')) {
        const tr = currentTrackRef.current;
        const proxyUrl = `${getServerUrl()}/api/stream/${tr.platform}/${tr.id}`;
        console.info('Retrying via backend stream proxy:', proxyUrl);
        audio.src = proxyUrl;
        audio.play().catch(console.warn);
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.pause();
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
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

  // Управление Audio Focus на Android (приглушение звука и восстановление)
  useEffect(() => {
    let duckHandle: { remove: () => void } | null = null;
    let gainHandle: { remove: () => void } | null = null;

    const setupListeners = async () => {
      // AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK: приглушение звука (навигатор / системный звук)
      duckHandle = await AudioFocus.addListener('audioFocusCanDuck', () => {
        isDuckedRef.current = true;
        if (audioRef.current) {
          audioRef.current.volume = Math.min(0.2, savedVolumeRef.current * 0.2);
        }
      });

      // AUDIOFOCUS_GAIN: фокус возвращен (восстановление нормальной громкости)
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
      duckHandle?.remove();
      gainHandle?.remove();
    };
  }, []);

  const playTrack = (track: Track, newQueue?: Track[]) => {
    broadcastWs({ action: 'play_track', track, queue: newQueue });
    flushPlaybackStats();
    autoCachedTrackIdRef.current = null;
    if (newQueue) {
      setQueue(newQueue);
      if (isShuffle) {
        shuffleQueueRef.current = generateSmartShuffleQueue(newQueue, track.id);
        shufflePointerRef.current = 0;
      }
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
        audioRef.current.volume = savedVolumeRef.current;
        audioRef.current.play().catch((err) => {
          console.warn('Воспроизведение отклонено браузером или устройством:', err);
        });
      });
    }
  };

  const addToQueue = (trackOrTracks: Track | Track[]) => {
    const toAdd = Array.isArray(trackOrTracks) ? trackOrTracks : [trackOrTracks];
    setQueue((prev) => {
      const existingIds = new Set(prev.map((t) => t.id));
      const filtered = toAdd.filter((t) => !existingIds.has(t.id));
      return [...prev, ...filtered];
    });
  };

  const togglePlay = () => {
    broadcastWs({ action: isPlaying ? 'pause' : 'resume' });
    if (!audioRef.current || !currentTrack) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(console.error);
    }
  };

function generateSmartShuffleQueue(tracks: Track[], currentTrackId?: string): Track[] {
  if (tracks.length <= 1) return [...tracks];
  const pool = tracks.filter((t) => t.id !== currentTrackId);

  // 1. Алгоритм Fisher-Yates
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // 2. Распределение по артистам (чтобы один исполнитель не шел подряд)
  const result: Track[] = [];
  while (pool.length > 0) {
    const lastArtist = result.length > 0 ? result[result.length - 1].artist.toLowerCase() : null;
    let chosenIdx = -1;

    for (let i = 0; i < pool.length; i++) {
      if (!lastArtist || pool[i].artist.toLowerCase() !== lastArtist) {
        chosenIdx = i;
        break;
      }
    }

    if (chosenIdx === -1) chosenIdx = 0;
    result.push(pool.splice(chosenIdx, 1)[0]);
  }

  return result;
}

  const shuffleQueueRef = useRef<Track[]>([]);
  const shufflePointerRef = useRef<number>(0);

  const nextTrack = () => {
    broadcastWs({ action: 'next' });
    if (!queue.length || !currentTrack) return;

    if (isShuffle) {
      if (shufflePointerRef.current < shuffleQueueRef.current.length) {
        const nextT = shuffleQueueRef.current[shufflePointerRef.current++];
        playTrack(nextT);
        return;
      } else if (repeatMode === 'all') {
        shuffleQueueRef.current = generateSmartShuffleQueue(queue, currentTrack.id);
        shufflePointerRef.current = 0;
        if (shuffleQueueRef.current.length > 0) {
          const nextT = shuffleQueueRef.current[shufflePointerRef.current++];
          playTrack(nextT);
          return;
        }
      } else {
        return;
      }
    }

    const currentIndex = queue.findIndex((t) => t.id === currentTrack.id);
    let nextIndex = currentIndex + 1;
    if (nextIndex >= queue.length) {
      if (repeatMode === 'all') nextIndex = 0;
      else return; // Очередь закончилась
    }
    playTrack(queue[nextIndex]);
  };

  const prevTrack = () => {
    broadcastWs({ action: 'prev' });
    if (!audioRef.current) return;
    // Если трек уже играет больше 3 секунд, перемотать в начало
    if (audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }

    if (!queue.length || !currentTrack) return;

    if (isShuffle && shufflePointerRef.current > 1) {
      shufflePointerRef.current -= 2;
      const prevT = shuffleQueueRef.current[shufflePointerRef.current++];
      playTrack(prevT);
      return;
    }

    const currentIndex = queue.findIndex((t) => t.id === currentTrack.id);
    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) {
      prevIndex = queue.length - 1;
    }
    playTrack(queue[prevIndex]);
  };

  const seek = (seconds: number) => {
    broadcastWs({ action: 'seek', currentTime: seconds });
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

  const toggleShuffle = () => {
    setIsShuffle((prev) => {
      const next = !prev;
      if (next && queue.length > 0) {
        shuffleQueueRef.current = generateSmartShuffleQueue(queue, currentTrack?.id);
        shufflePointerRef.current = 0;
      }
      return next;
    });
  };

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

  const queueRef = useRef<Track[]>(queue);
  useEffect(() => { queueRef.current = queue; }, [queue]);

  const nextTrackRef = useRef(nextTrack);
  useEffect(() => { nextTrackRef.current = nextTrack; }, [nextTrack]);

  const prevTrackRef = useRef(prevTrack);
  useEffect(() => { prevTrackRef.current = prevTrack; }, [prevTrack]);

  const playTrackRef = useRef(playTrack);
  useEffect(() => { playTrackRef.current = playTrack; }, [playTrack]);

  // --- WebSocket Sync (Spotify Connect Style) ---
  const wsRef = useRef<WebSocket | null>(null);
  const clientIdRef = useRef(Math.random().toString(36).substring(7));
  const isRemoteActionRef = useRef(false);

  useEffect(() => {
    let wsUrl = getServerUrl().replace('http', 'ws');
    if (!wsUrl.endsWith('/')) wsUrl += '/';
    wsUrl += 'api/ws/sync';
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.clientId === clientIdRef.current) return;

        isRemoteActionRef.current = true;
        
        switch (data.action) {
          case 'play_track':
            if (data.track) playTrackRef.current(data.track, data.queue);
            break;
          case 'pause':
            audioRef.current?.pause();
            break;
          case 'resume':
            audioRef.current?.play().catch(() => {});
            break;
          case 'seek':
            if (data.currentTime !== undefined && audioRef.current) {
              audioRef.current.currentTime = data.currentTime;
            }
            break;
          case 'next':
            nextTrackRef.current();
            break;
          case 'prev':
            prevTrackRef.current();
            break;
        }
        
        setTimeout(() => { isRemoteActionRef.current = false; }, 300);
      } catch(e) {}
    };

    return () => ws.close();
  }, []);

  const broadcastWs = (payload: any) => {
    if (isRemoteActionRef.current) return; // Prevent infinite loop
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ clientId: clientIdRef.current, ...payload }));
    }
  };

  // Жест «Встряхнуть для перемешивания» (Shake-to-Shuffle)
  useEffect(() => {
    if (!shakeToShuffle) return;

    let lastX: number | null = null;
    let lastY: number | null = null;
    let lastZ: number | null = null;
    let lastShakeTime = 0;
    const SHAKE_THRESHOLD = 14; // Порог резкого ускорения устройства
    const SHAKE_COOLDOWN = 1200; // Задержка между срабатываниями (мс)

    const handleDeviceMotion = (event: DeviceMotionEvent) => {
      const current = event.accelerationIncludingGravity || event.acceleration;
      if (!current || current.x === null || current.y === null || current.z === null) return;

      const { x, y, z } = current;

      if (lastX !== null && lastY !== null && lastZ !== null) {
        const deltaX = Math.abs(x - lastX);
        const deltaY = Math.abs(y - lastY);
        const deltaZ = Math.abs(z - lastZ);
        const totalDelta = deltaX + deltaY + deltaZ;
        const now = Date.now();

        if (totalDelta > SHAKE_THRESHOLD && now - lastShakeTime > SHAKE_COOLDOWN) {
          lastShakeTime = now;
          // Тактильный виброотклик
          try {
            if ('vibrate' in navigator) {
              navigator.vibrate([40, 60, 40]);
            }
          } catch {}

          // Включаем Shuffle режим и переходим к следующему случайному треку
          setIsShuffle(true);
          if (queueRef.current.length > 0) {
            shuffleQueueRef.current = generateSmartShuffleQueue(queueRef.current, currentTrackRef.current?.id);
            shufflePointerRef.current = 0;
            if (shuffleQueueRef.current.length > 0) {
              const nextT = shuffleQueueRef.current[shufflePointerRef.current++];
              playTrack(nextT);
              return;
            }
          }
          nextTrackRef.current();
        }
      }

      lastX = x;
      lastY = y;
      lastZ = z;
    };

    window.addEventListener('devicemotion', handleDeviceMotion, { passive: true });
    return () => {
      window.removeEventListener('devicemotion', handleDeviceMotion);
    };
  }, [shakeToShuffle]);

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
        shakeToShuffle,
        setShakeToShuffle,
        playTrack,
        addToQueue,
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
