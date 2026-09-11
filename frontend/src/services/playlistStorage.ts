import { Playlist, Track } from '../types';
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
