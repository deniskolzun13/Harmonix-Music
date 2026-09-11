import { Playlist, Track, ArtistSummary } from '../types';
import { getApiBase } from '../api';

export interface SavedPlaylistRecord {
  playlist: Playlist;
  tracks: Track[];
  addedAt: number;
}

const STORAGE_KEY = 'harmonix_saved_playlists';

function resolveStreamUrl(streamUrl?: string): string | undefined {
  if (!streamUrl) return undefined;
  if (streamUrl.startsWith('http') || streamUrl.startsWith('blob:') || streamUrl.startsWith('data:')) {
    return streamUrl;
  }
  const base = getApiBase().replace(/\/api$/, '');
  return `${base}${streamUrl}`;
}

const INITIAL_DEMO_PLAYLISTS: SavedPlaylistRecord[] = [
  {
    playlist: {
      id: 'demo_yandex_hits',
      title: 'Яндекс Музыка: Популярные треки',
      description: 'Импортировано по ссылке (Демо-плейлист)',
      cover_url: 'https://avatars.yandex.net/get-music-content/118633/2c3886f7.a.12345/400x400',
      track_count: 3,
      platform: 'yandex',
    },
    tracks: [
      {
        id: '1',
        title: 'Комета',
        artist: 'JONY',
        album: 'Список твоих мыслей',
        duration: 161,
        cover_url: 'https://avatars.yandex.net/get-music-content/118633/2c3886f7.a.12345/400x400',
        platform: 'yandex',
        stream_url: '/api/stream/yandex/1',
        is_playable: true,
      },
      {
        id: '2',
        title: 'Где прошла ты',
        artist: 'Кравц & Гио Пика',
        album: '1000 лет',
        duration: 172,
        cover_url: 'https://avatars.yandex.net/get-music-content/2383984/d702381f.a.23847/400x400',
        platform: 'yandex',
        stream_url: '/api/stream/yandex/2',
        is_playable: true,
      },
      {
        id: '3',
        title: 'По барам',
        artist: 'ANNA ASTI',
        album: 'Феникс',
        duration: 238,
        cover_url: 'https://avatars.yandex.net/get-music-content/5082104/167b54a0.a.21402/400x400',
        platform: 'yandex',
        stream_url: '/api/stream/yandex/3',
        is_playable: true,
      },
    ],
    addedAt: Date.now() - 10000,
  },
];

export function getSavedPlaylists(): SavedPlaylistRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let list: SavedPlaylistRecord[];
    if (!raw) {
      list = INITIAL_DEMO_PLAYLISTS;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } else {
      const parsed = JSON.parse(raw);
      list = Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_DEMO_PLAYLISTS;
    }

    return list.map((item) => ({
      ...item,
      tracks: item.tracks.map((t) => ({
        ...t,
        stream_url: resolveStreamUrl(t.stream_url),
      })),
    }));
  } catch (e) {
    console.error('Ошибка чтения плейлистов из localStorage:', e);
    return INITIAL_DEMO_PLAYLISTS;
  }
}

export function saveImportedPlaylist(playlist: Playlist, tracks: Track[]): SavedPlaylistRecord[] {
  try {
    const normalizedTracks = tracks.map((t) => ({
      ...t,
      stream_url: resolveStreamUrl(t.stream_url),
    }));

    const current = getSavedPlaylists().filter((p) => p.playlist.id !== playlist.id);
    const updated: SavedPlaylistRecord[] = [
      { playlist, tracks: normalizedTracks, addedAt: Date.now() },
      ...current,
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch (e) {
    console.error('Ошибка сохранения плейлиста в localStorage:', e);
    return getSavedPlaylists();
  }
}

export function deleteSavedPlaylist(playlistId: string): SavedPlaylistRecord[] {
  try {
    const current = getSavedPlaylists().filter((p) => p.playlist.id !== playlistId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    return current;
  } catch (e) {
    console.error('Ошибка удаления плейлиста из localStorage:', e);
    return [];
  }
}

/**
 * Добавляет отдельный трек в указанный плейлист или в специальный плейлист "Добавленные треки"
 */
export function addCustomTrack(track: Track, targetPlaylistId?: string): SavedPlaylistRecord[] {
  try {
    const normalizedTrack: Track = {
      ...track,
      stream_url: resolveStreamUrl(track.stream_url),
    };

    const current = getSavedPlaylists();
    let targetIndex = -1;

    if (targetPlaylistId) {
      targetIndex = current.findIndex((p) => p.playlist.id === targetPlaylistId);
    }

    // Если целевой плейлист не найден, ищем или создаем "Добавленные треки"
    if (targetIndex === -1) {
      targetIndex = current.findIndex((p) => p.playlist.id === 'my_uploaded_tracks');
    }

    if (targetIndex >= 0) {
      const targetRecord = current[targetIndex];
      // Проверяем, нет ли уже такого трека
      const exists = targetRecord.tracks.some((t) => t.id === normalizedTrack.id);
      const newTracks = exists
        ? targetRecord.tracks.map((t) => (t.id === normalizedTrack.id ? normalizedTrack : t))
        : [normalizedTrack, ...targetRecord.tracks];

      targetRecord.tracks = newTracks;
      targetRecord.playlist.track_count = newTracks.length;
      if (!targetRecord.playlist.cover_url && normalizedTrack.cover_url) {
        targetRecord.playlist.cover_url = normalizedTrack.cover_url;
      }
    } else {
      // Создаем новый плейлист "Добавленные треки"
      const newRecord: SavedPlaylistRecord = {
        playlist: {
          id: 'my_uploaded_tracks',
          title: 'Добавленные треки',
          description: 'Треки, добавленные с устройства или по ссылке',
          cover_url: normalizedTrack.cover_url,
          track_count: 1,
          platform: normalizedTrack.platform || 'local',
        },
        tracks: [normalizedTrack],
        addedAt: Date.now(),
      };
      current.unshift(newRecord);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    return current;
  } catch (e) {
    console.error('Ошибка добавления трека в плейлист:', e);
    return getSavedPlaylists();
  }
}

/**
 * Удаляет трек из конкретного сохраненного плейлиста
 */
export function deleteTrackFromPlaylist(playlistId: string, trackId: string): SavedPlaylistRecord[] {
  try {
    const current = getSavedPlaylists();
    const record = current.find((p) => p.playlist.id === playlistId);
    if (record) {
      record.tracks = record.tracks.filter((t) => t.id !== trackId);
      record.playlist.track_count = record.tracks.length;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    }
    return current;
  } catch (e) {
    console.error('Ошибка удаления трека из плейлиста:', e);
    return getSavedPlaylists();
  }
}

const KNOWN_DUOS_AND_BANDS = new Set([
  'artik & asti',
  'hammali & navai',
  'simon & garfunkel',
  'kool & the gang',
  'earth, wind & fire',
  'florence + the machine',
  'mumford & sons',
  'above & beyond',
  'crosby, stills, nash & young',
  'bob marley & the wailers',
  'tom petty and the heartbreakers',
  'marina and the diamonds',
  'iron & wine',
  'hall & oates',
  'blood, sweat & tears',
  'chase & status',
]);

/**
 * Разбивает строку исполнителей (например "MiyaGi, Andy Panda", "Eminem feat. Rihanna", "Баста & Гуф")
 * на массив отдельных имен музыкантов.
 */
export function splitArtistNames(raw: string): string[] {
  if (!raw || !raw.trim()) return [];
  const trimmed = raw.trim();
  if (KNOWN_DUOS_AND_BANDS.has(trimmed.toLowerCase())) {
    return [trimmed];
  }

  // 1. Заменяем (feat. ...) / [ft. ...] / (при уч. ...)
  let normalized = trimmed.replace(
    /[\(\[\{]\s*(?:feat\.?|ft\.?|featuring|with|vs\.?|при\s+уч\.?|уч\.?)\s+([^\)\]\}]+)[\)\]\}]/gi,
    ', $1'
  );

  // 2. Заменяем разделители: feat / ft / featuring / with / vs / при уч
  normalized = normalized.replace(
    /(?:^|[\s,;([{/])(?:feat\.?|ft\.?|featuring|with|vs\.?|при\s+уч\.?|уч\.?)\s+/gi,
    ', '
  );

  // 3. Заменяем слэши с пробелами (AC/DC не трогаем, т.к. без пробелов)
  normalized = normalized.replace(/\s+\/+\s+/g, ', ');

  // 4. Заменяем точки с запятой
  normalized = normalized.replace(/;+/g, ', ');

  const rawChunks = normalized.split(',').map((s) => s.trim()).filter(Boolean);
  const result: string[] = [];

  for (const chunk of rawChunks) {
    if (KNOWN_DUOS_AND_BANDS.has(chunk.toLowerCase())) {
      result.push(chunk);
      continue;
    }
    // Проверяем & или and с пробелами
    if (/\s+(?:&|and)\s+/i.test(chunk)) {
      const subParts = chunk.split(/\s+(?:&|and)\s+/i).map((s) => s.trim()).filter(Boolean);
      result.push(...subParts);
    } else {
      result.push(chunk);
    }
  }

  // Очистка и дедупликация
  const seen = new Set<string>();
  const finalArtists: string[] = [];
  for (const a of result) {
    const clean = a.replace(/^[("'[{\s]+|[)"'}\]\s]+$/g, '').trim();
    if (!clean) continue;
    const lower = clean.toLowerCase();
    if (lower === 'feat' || lower === 'ft' || lower === 'vs' || lower === 'with') continue;
    if (!seen.has(lower)) {
      seen.add(lower);
      finalArtists.push(clean);
    }
  }

  return finalArtists.length > 0 ? finalArtists : [trimmed];
}

/**
 * Извлекает всех артистов трека (из поля artist, а также из названия трека, если там указан feat/ft).
 */
export function extractAllTrackArtists(track: Track): string[] {
  const result = new Set<string>();

  if (track.artist) {
    for (const name of splitArtistNames(track.artist)) {
      result.add(name);
    }
  }

  if (track.title) {
    const titleMatch = track.title.match(
      /[\(\[\{]\s*(?:feat\.?|ft\.?|featuring|with|vs\.?|при\s+уч\.?|уч\.?)\s+([^\)\]\}]+)[\)\]\}]/i
    );
    if (titleMatch && titleMatch[1]) {
      for (const name of splitArtistNames(titleMatch[1])) {
        result.add(name);
      }
    }
  }

  return Array.from(result);
}

/**
 * Собирает и группирует всех музыкантов из сохраненных плейлистов и оффлайн-кэша
 */
export function getArtistsList(
  playlists: SavedPlaylistRecord[],
  cachedTracks: Track[] = []
): ArtistSummary[] {
  const allTracksMap = new Map<string, Track>();

  // 1. Добавляем треки из плейлистов
  for (const pl of playlists) {
    for (const track of pl.tracks) {
      if (track && track.artist) {
        allTracksMap.set(`${track.platform}-${track.id}`, track);
      }
    }
  }

  // 2. Добавляем треки из оффлайн-кэша
  for (const track of cachedTracks) {
    if (track && track.artist) {
      const key = `${track.platform}-${track.id}`;
      if (!allTracksMap.has(key)) {
        allTracksMap.set(key, track);
      }
    }
  }

  // 3. Группируем по каждому отдельному исполнителю (трек с несколькими артистами засчитывается каждому!)
  const artistMap = new Map<string, { displayName: string; cover_url?: string; tracks: Track[] }>();

  for (const track of allTracksMap.values()) {
    const trackArtists = extractAllTrackArtists(track);
    if (trackArtists.length === 0) continue;

    for (const artistName of trackArtists) {
      const lowerKey = artistName.toLowerCase();
      const existing = artistMap.get(lowerKey);

      if (existing) {
        // Добавляем трек, если его еще нет
        if (!existing.tracks.some((t) => t.id === track.id)) {
          existing.tracks.push(track);
        }
        // Берем лучшую обложку
        if (!existing.cover_url && track.cover_url) {
          existing.cover_url = track.cover_url;
        }
      } else {
        artistMap.set(lowerKey, {
          displayName: artistName,
          cover_url: track.cover_url,
          tracks: [track],
        });
      }
    }
  }

  // 4. Формируем итоговый массив
  const result: ArtistSummary[] = [];
  for (const item of artistMap.values()) {
    const totalDuration = item.tracks.reduce((acc, t) => acc + (t.duration || 0), 0);
    result.push({
      name: item.displayName,
      cover_url: item.cover_url,
      trackCount: item.tracks.length,
      totalDuration,
      tracks: item.tracks,
    });
  }

  // Сортируем: сначала те, у кого больше треков, затем по алфавиту
  result.sort((a, b) => b.trackCount - a.trackCount || a.name.localeCompare(b.name));

  return result;
}

/**
 * Находит или динамически формирует данные музыканта по его имени
 */
export function findArtistByName(
  artistName: string,
  extraTracks: Track[] = [],
  cachedTracks: Track[] = []
): ArtistSummary {
  const cleanName = artistName.trim();
  const lowerName = cleanName.toLowerCase();
  const savedPlaylists = getSavedPlaylists();
  const allArtists = getArtistsList(savedPlaylists, cachedTracks);

  let found = allArtists.find((a) => a.name.trim().toLowerCase() === lowerName);

  // Если не найдено точное совпадение (например передали составную строку "Баста, Гуф"),
  // ищем среди отдельных составляющих
  if (!found) {
    const parts = splitArtistNames(cleanName);
    for (const p of parts) {
      found = allArtists.find((a) => a.name.trim().toLowerCase() === p.toLowerCase());
      if (found) break;
    }
  }

  let tracks = found ? [...found.tracks] : [];
  let cover_url = found?.cover_url;

  // Добавляем треки из контекста (например текущий трек или очередь воспроизведения)
  for (const t of extraTracks) {
    if (!t) continue;
    const tArtists = extractAllTrackArtists(t);
    const matches = tArtists.some(
      (a: string) => a.toLowerCase() === lowerName || (found && a.toLowerCase() === found.name.toLowerCase())
    );
    if (matches) {
      if (!tracks.some((x) => x.id === t.id)) {
        tracks.push(t);
        if (!cover_url && t.cover_url) {
          cover_url = t.cover_url;
        }
      }
    }
  }

  const totalDuration = tracks.reduce((acc, t) => acc + (t.duration || 0), 0);

  return {
    name: found ? found.name : cleanName,
    cover_url: cover_url,
    trackCount: tracks.length,
    totalDuration,
    tracks,
  };
}

