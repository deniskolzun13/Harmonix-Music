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

  // 3. Группируем по имени исполнителя (нормализация по нижнему регистру для связывания)
  const artistMap = new Map<string, { displayName: string; cover_url?: string; tracks: Track[] }>();

  for (const track of allTracksMap.values()) {
    const rawArtist = track.artist.trim();
    if (!rawArtist) continue;

    const lowerKey = rawArtist.toLowerCase();
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
        displayName: rawArtist,
        cover_url: track.cover_url,
        tracks: [track],
      });
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
