import { Track } from '../types';
import { getServerUrl } from '../api';

export interface LyricLine {
  time: number; // время в секундах
  text: string;
}

export interface LyricsData {
  synced: boolean;
  lines: LyricLine[];
  plainText?: string;
  source?: string;
  instrumental?: boolean;
}

const memoryCache = new Map<string, LyricsData>();

export function parseLrc(lrcText: string): LyricLine[] {
  if (!lrcText) return [];
  const lines = lrcText.split('\n');
  const result: LyricLine[] = [];
  const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Извлекаем все метки времени в строке
    let match: RegExpExecArray | null;
    const timestamps: number[] = [];
    timeRegex.lastIndex = 0;

    while ((match = timeRegex.exec(line)) !== null) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const msStr = match[3] || '0';
      const milliseconds = parseInt(msStr.padEnd(3, '0').slice(0, 3), 10);
      timestamps.push(minutes * 60 + seconds + milliseconds / 1000);
    }

    const text = line.replace(timeRegex, '').trim();
    // Добавляем строчку для каждой метки времени
    for (const time of timestamps) {
      result.push({ time, text: text || '♪' });
    }
  }

  return result.sort((a, b) => a.time - b.time);
}

export async function fetchLyrics(track: Track): Promise<LyricsData | null> {
  const cacheKey = `${track.artist.toLowerCase().trim()}::${track.title.toLowerCase().trim()}`;
  if (memoryCache.has(cacheKey)) {
    return memoryCache.get(cacheKey)!;
  }

  const base = getServerUrl();
  const params = new URLSearchParams({
    artist: track.artist,
    title: track.title,
    ...(track.album ? { album: track.album } : {}),
    ...(track.duration ? { duration: String(track.duration) } : {}),
    ...(track.id ? { track_id: track.id } : {}),
    ...(track.platform ? { platform: track.platform } : {}),
  });

  try {
    // 1. Запрос через бэкенд Harmonix
    const resp = await fetch(`${base}/api/lyrics?${params.toString()}`);
    if (resp.ok) {
      const data = await resp.json();
      if (data.synced_lyrics) {
        const parsed = parseLrc(data.synced_lyrics);
        const res: LyricsData = {
          synced: true,
          lines: parsed,
          plainText: data.plain_lyrics,
          source: data.source,
          instrumental: Boolean(data.instrumental),
        };
        memoryCache.set(cacheKey, res);
        return res;
      }

      if (data.plain_lyrics) {
        const plainLines = data.plain_lyrics
          .split('\n')
          .map((l: string) => l.trim())
          .filter(Boolean)
          .map((text: string, idx: number) => ({ time: idx, text }));

        const res: LyricsData = {
          synced: false,
          lines: plainLines,
          plainText: data.plain_lyrics,
          source: data.source,
          instrumental: Boolean(data.instrumental),
        };
        memoryCache.set(cacheKey, res);
        return res;
      }

      if (data.instrumental) {
        const res: LyricsData = {
          synced: false,
          lines: [],
          source: data.source,
          instrumental: true,
        };
        memoryCache.set(cacheKey, res);
        return res;
      }
    }
  } catch (err) {
    console.warn('Backend lyrics request failed, trying direct LRCLIB fetch:', err);
  }

  // 2. Запасной прямой запрос к LRCLIB API при оффлайн бэкенде
  try {
    const directResp = await fetch(
      `https://lrclib.net/api/get?artist_name=${encodeURIComponent(track.artist)}&track_name=${encodeURIComponent(track.title)}`
    );
    if (directResp.ok) {
      const data = await directResp.json();
      if (data.syncedLyrics) {
        const parsed = parseLrc(data.syncedLyrics);
        const res: LyricsData = {
          synced: true,
          lines: parsed,
          plainText: data.plainLyrics,
          source: 'lrclib',
          instrumental: Boolean(data.instrumental),
        };
        memoryCache.set(cacheKey, res);
        return res;
      }
      if (data.plainLyrics) {
        const plainLines = data.plainLyrics
          .split('\n')
          .map((l: string) => l.trim())
          .filter(Boolean)
          .map((text: string, idx: number) => ({ time: idx, text }));

        const res: LyricsData = {
          synced: false,
          lines: plainLines,
          plainText: data.plainLyrics,
          source: 'lrclib',
          instrumental: Boolean(data.instrumental),
        };
        memoryCache.set(cacheKey, res);
        return res;
      }
    }
  } catch (e) {
    console.warn('Direct LRCLIB fetch failed:', e);
  }

  return null;
}
