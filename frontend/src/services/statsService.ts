export interface PlaybackStatEntry {
  trackId: string;
  title: string;
  artist: string;
  durationSeconds: number;
  timestamp: number;
}

const STORAGE_KEY = 'harmonix_playback_stats';
const MAX_ENTRIES = 5000;

export function getStatsHistory(): PlaybackStatEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function recordPlayback(
  trackId: string,
  title: string,
  artist: string,
  durationSeconds: number
): void {
  if (durationSeconds < 15) return; // Игнорируем быстрые пропуски

  try {
    const history = getStatsHistory();
    const entry: PlaybackStatEntry = {
      trackId,
      title,
      artist,
      durationSeconds: Math.round(durationSeconds),
      timestamp: Date.now(),
    };

    history.unshift(entry);
    if (history.length > MAX_ENTRIES) {
      history.length = MAX_ENTRIES;
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (e) {
    console.error('Ошибка записи статистики:', e);
  }
}

export type StatPeriod = 'today' | 'week' | 'month' | 'all';

function getPeriodCutoff(period: StatPeriod): number {
  const now = Date.now();
  switch (period) {
    case 'today':
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      return startOfDay.getTime();
    case 'week':
      return now - 7 * 24 * 60 * 60 * 1000;
    case 'month':
      return now - 30 * 24 * 60 * 60 * 1000;
    case 'all':
    default:
      return 0;
  }
}

export function getFilteredStats(period: StatPeriod): PlaybackStatEntry[] {
  const cutoff = getPeriodCutoff(period);
  return getStatsHistory().filter((entry) => entry.timestamp >= cutoff);
}

export function getSummaryStats(period: StatPeriod) {
  const entries = getFilteredStats(period);
  const totalSeconds = entries.reduce((acc, e) => acc + e.durationSeconds, 0);
  const totalTracks = entries.length;

  // Топ исполнителей
  const artistMap = new Map<string, { count: number; totalSeconds: number }>();
  // Топ треков
  const trackMap = new Map<string, { title: string; artist: string; count: number; totalSeconds: number }>();

  for (const e of entries) {
    // Артист
    const curArtist = artistMap.get(e.artist) || { count: 0, totalSeconds: 0 };
    curArtist.count += 1;
    curArtist.totalSeconds += e.durationSeconds;
    artistMap.set(e.artist, curArtist);

    // Трек
    const trackKey = `${e.title}___${e.artist}`;
    const curTrack = trackMap.get(trackKey) || { title: e.title, artist: e.artist, count: 0, totalSeconds: 0 };
    curTrack.count += 1;
    curTrack.totalSeconds += e.durationSeconds;
    trackMap.set(trackKey, curTrack);
  }

  const topArtists = Array.from(artistMap.entries())
    .map(([artist, data]) => ({
      artist,
      count: data.count,
      totalSeconds: data.totalSeconds,
      percent: totalSeconds > 0 ? Math.round((data.totalSeconds / totalSeconds) * 100) : 0,
    }))
    .sort((a, b) => b.totalSeconds - a.totalSeconds)
    .slice(0, 5);

  const topTracks = Array.from(trackMap.values())
    .sort((a, b) => b.count - a.count || b.totalSeconds - a.totalSeconds)
    .slice(0, 5);

  return {
    totalSeconds,
    totalTracks,
    topArtists,
    topTracks,
    topArtistName: topArtists[0]?.artist || null,
  };
}

export function clearStatsHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
