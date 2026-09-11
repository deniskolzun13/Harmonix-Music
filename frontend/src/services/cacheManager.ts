import { Track, Platform } from '../types';
import { getServerUrl } from '../api';
import { getYmTrackDownloadInfo } from './standaloneImporter';

const DB_NAME = 'HarmonixMusicCache';
const DB_VERSION = 1;
const STORE_NAME = 'cached_tracks';

export interface CachedTrackRecord {
  id: string;
  platform: Platform;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  coverDataUrl?: string;
  audioBlob: Blob;
  sizeBytes: number;
  cachedAt: number;
  playlistTitle?: string;
  isPreview?: boolean;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Проверяет, сохранен ли трек в локальном оффлайн-кэше
 */
export async function isTrackCached(trackId: string): Promise<boolean> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(trackId);
      req.onsuccess = () => resolve(Boolean(req.result));
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Возвращает список всех ID сохраненных треков
 */
export async function getCachedTrackIds(): Promise<Set<string>> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAllKeys();
      req.onsuccess = () => resolve(new Set(req.result.map(String)));
      req.onerror = () => resolve(new Set());
    });
  } catch {
    return new Set();
  }
}

/**
 * Сохраняет аудиофайл и обложку трека в локальное хранилище телефона
 */
export async function saveTrackToCache(
  track: Track,
  playlistTitle?: string
): Promise<void> {
  const base = getServerUrl();
  let isPreview = false;
  
  // 1. Формируем URL стрима
  let streamUrl = track.stream_url || '';
  if (!streamUrl || (!streamUrl.startsWith('http') && !streamUrl.startsWith('blob:'))) {
    if (track.platform === 'yandex') {
      try {
        const info = await getYmTrackDownloadInfo(track.id);
        streamUrl = info.url;
        track.stream_url = streamUrl;
        isPreview = info.isPreview;
      } catch (e) {
        console.warn('Standalone getYmTrackDownloadInfo failed, trying server proxy:', e);
      }
    }
  }

  if (!streamUrl || (!streamUrl.startsWith('http') && !streamUrl.startsWith('blob:'))) {
    if (streamUrl.startsWith('/')) {
      streamUrl = `${base}${streamUrl}`;
    } else {
      streamUrl = `${base}/api/stream/${track.platform}/${track.id}`;
    }
  }

  // 2. Скачиваем аудиофайл
  const audioResp = await fetch(streamUrl);
  if (!audioResp.ok) {
    throw new Error(`Не удалось загрузить аудио: HTTP ${audioResp.status}`);
  }
  const audioBlob = await audioResp.blob();

  // Если размер аудиофайла меньше 750 КБ (30 сек превью ~ 480 КБ), то это ознакомительный фрагмент
  if (audioBlob.size < 750000) {
    isPreview = true;
  }

  // 3. Скачиваем обложку
  let coverDataUrl: string | undefined = undefined;
  if (track.cover_url) {
    try {
      let coverResp = await fetch(track.cover_url);
      if (!coverResp.ok && !track.cover_url.startsWith('data:') && !track.cover_url.startsWith('blob:')) {
        const coverFetchUrl = `${base}/api/cover-proxy?url=${encodeURIComponent(track.cover_url)}`;
        coverResp = await fetch(coverFetchUrl);
      }
      if (coverResp.ok) {
        const coverBlob = await coverResp.blob();
        coverDataUrl = await blobToDataUrl(coverBlob);
      }
    } catch (err) {
      console.warn('Не удалось загрузить обложку для кэша:', err);
    }
  }

  // 4. Записываем в IndexedDB
  const record: CachedTrackRecord = {
    id: track.id,
    platform: track.platform,
    title: track.title,
    artist: track.artist,
    album: track.album,
    duration: track.duration,
    coverDataUrl,
    audioBlob,
    sizeBytes: audioBlob.size,
    cachedAt: Date.now(),
    playlistTitle,
    isPreview,
  };

  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Пакетное кэширование списка треков с коллбэком прогресса
 */
export async function cacheMultipleTracks(
  tracks: Track[],
  playlistTitle?: string,
  onProgress?: (current: number, total: number, title: string) => void
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;
  const total = tracks.length;

  for (let i = 0; i < total; i++) {
    const track = tracks[i];
    if (onProgress) {
      onProgress(i + 1, total, track.title);
    }
    try {
      await saveTrackToCache(track, playlistTitle);
      success++;
    } catch (e) {
      console.error(`Ошибка при кэшировании трека "${track.title}":`, e);
      failed++;
    }
  }

  return { success, failed };
}

/**
 * Возвращает локальный blob: URL для трека, если он сохранен в кэше
 */
export async function getCachedTrackAudioUrl(trackId: string): Promise<string | null> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(trackId);
      req.onsuccess = () => {
        if (req.result && req.result.audioBlob) {
          resolve(URL.createObjectURL(req.result.audioBlob));
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Возвращает все скачанные треки как готовые к воспроизведению объекты Track
 */
export async function getCachedTracks(): Promise<Track[]> {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const records: CachedTrackRecord[] = req.result || [];
        // Создаем готовые Track с blob: ссылками
        const tracks: Track[] = records.map((rec) => ({
          id: rec.id,
          title: rec.title,
          artist: rec.artist,
          album: rec.album || rec.playlistTitle,
          duration: rec.duration,
          cover_url: rec.coverDataUrl || undefined,
          platform: 'local',
          stream_url: URL.createObjectURL(rec.audioBlob),
          is_playable: true,
          original_uri: `local:cached:${rec.id}`,
          isPreview: rec.isPreview,
        }));
        resolve(tracks);
      };

      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Ошибка получения кэшированных треков:', err);
    return [];
  }
}

/**
 * Удаляет трек из локального кэша
 */
export async function deleteCachedTrack(trackId: string): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(trackId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Полностью очищает оффлайн кэш музыки
 */
export async function clearCache(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Возвращает статистику кэша (количество треков и общий размер в байтах/мегабайтах)
 */
export async function getCacheStats(): Promise<{
  count: number;
  totalSizeBytes: number;
  formattedSize: string;
}> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();

      req.onsuccess = () => {
        const records: CachedTrackRecord[] = req.result || [];
        const count = records.length;
        const totalSizeBytes = records.reduce((acc, r) => acc + (r.sizeBytes || 0), 0);
        const mb = (totalSizeBytes / (1024 * 1024)).toFixed(1);
        resolve({
          count,
          totalSizeBytes,
          formattedSize: `${mb} МБ`,
        });
      };

      req.onerror = () =>
        resolve({
          count: 0,
          totalSizeBytes: 0,
          formattedSize: '0 МБ',
        });
    });
  } catch {
    return { count: 0, totalSizeBytes: 0, formattedSize: '0 МБ' };
  }
}
