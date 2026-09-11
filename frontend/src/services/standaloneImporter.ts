import { Playlist, Track } from '../types';
import { md5 } from './md5';
import { getServerUrl } from '../api';

export const YM_CLIENT_ID = '23cabbbdc6cd418abb4b39c32c41195d';
export const YM_CLIENT_SECRET = '53bc75238f0c4d08a118e51fe9203300';
const YM_SALT = 'XGRlBW9FXlekgbPrRHuSiA';

export interface YandexDeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_url: string;
  expires_in: number;
  interval: number;
}

/**
 * Запрос кода подтверждения для авторизации (Device Flow)
 * Работает как автономно напрямую через oauth.yandex.ru, так и через сервер
 */
export async function requestYandexDeviceCode(): Promise<YandexDeviceCodeResponse> {
  const deviceId = 'harmonix_' + Math.random().toString(36).substring(2, 12);
  const body = new URLSearchParams({
    client_id: YM_CLIENT_ID,
    device_id: deviceId,
    device_name: 'HarmonixMobile',
  });

  try {
    const res = await fetch('https://oauth.yandex.ru/device/code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Direct requestYandexDeviceCode failed, falling back to server:', err);
  }

  // Запасной вариант через бэкенд
  const base = getServerUrl();
  const res = await fetch(`${base}/api/auth/yandex/device-code`, { method: 'POST' });
  if (!res.ok) {
    throw new Error(`Ошибка запроса кода устройства: HTTP ${res.status}`);
  }
  return await res.json();
}

/**
 * Опрос статуса подтверждения устройства пользователем
 * Возвращает токен при успехе, null если пользователь еще не подтвердил
 */
export async function pollYandexDeviceToken(deviceCode: string): Promise<string | null> {
  const body = new URLSearchParams({
    grant_type: 'device_code',
    code: deviceCode,
    client_id: YM_CLIENT_ID,
    client_secret: YM_CLIENT_SECRET,
  });

  try {
    const res = await fetch('https://oauth.yandex.ru/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (res.status === 400) {
      const data = await res.json().catch(() => ({}));
      if (data.error === 'authorization_pending') {
        return null;
      }
      throw new Error(data.error_description || data.error || 'Ошибка авторизации');
    }

    if (res.ok) {
      const data = await res.json();
      return data.access_token || null;
    }
  } catch (err: any) {
    if (err.message && err.message.includes('authorization_pending')) return null;
    console.warn('Direct pollYandexDeviceToken failed, trying server:', err);
  }

  // Запасной вариант через бэкенд
  const base = getServerUrl();
  const res = await fetch(`${base}/api/auth/yandex/device-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ device_code: deviceCode }),
  });
  if (res.ok) {
    const data = await res.json();
    if (data.status === 'authorized') return data.access_token;
    return null;
  }
  return null;
}

/**
 * Получение прямой ссылки и информации о треке Яндекс Музыки (полный или 30с превью)
 */
export async function getYmTrackDownloadInfo(
  trackId: string
): Promise<{ url: string; isPreview: boolean; bitrate: number }> {
  try {
    const token = localStorage.getItem('harmonix_yandex_token');
    const headers: Record<string, string> = {
      'User-Agent': 'Yandex-Music-API',
      'Accept': 'application/json',
    };
    if (token && token.trim()) {
      headers['Authorization'] = `OAuth ${token.trim()}`;
    }

    const infoResp = await fetch(`https://api.music.yandex.net/tracks/${trackId}/download-info`, {
      headers,
    });
    if (!infoResp.ok) {
      throw new Error(`Ошибка получения метаданных аудио: HTTP ${infoResp.status}`);
    }

    const infoData = await infoResp.json();
    const infos: any[] = infoData.result || [];
    if (!infos.length) {
      throw new Error('Аудиопоток для данного трека недоступен');
    }

    // Приоритет: сначала ищем полный MP3 трек (не превью), отсортированный по максимальному битрейту
    const fullTracks = infos.filter((x) => x.codec === 'mp3' && !x.preview);
    const previewTracks = infos.filter((x) => x.codec === 'mp3' && x.preview);

    let selectedInfo = fullTracks.length > 0
      ? fullTracks.sort((a, b) => (b.bitrateInKbps || 0) - (a.bitrateInKbps || 0))[0]
      : (previewTracks[0] || infos[0]);

    const isPreview = Boolean(selectedInfo.preview);
    const downloadInfoUrl = selectedInfo.downloadInfoUrl;
    if (!downloadInfoUrl) {
      throw new Error('Ссылка downloadInfoUrl не найдена');
    }

    const xmlResp = await fetch(downloadInfoUrl);
    const xmlText = await xmlResp.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'application/xml');

    const host = doc.querySelector('host')?.textContent || '';
    const path = doc.querySelector('path')?.textContent || '';
    const ts = doc.querySelector('ts')?.textContent || '';
    const s = doc.querySelector('s')?.textContent || '';

    if (!host || !path || !ts || !s) {
      throw new Error('Некорректная структура XML шлюза Яндекс');
    }

    const sign = md5(YM_SALT + path.slice(1) + s);
    const url = `https://${host}/get-mp3/${sign}/${ts}${path}`;
    return {
      url,
      isPreview,
      bitrate: selectedInfo.bitrateInKbps || (isPreview ? 128 : 320),
    };
  } catch (err: any) {
    console.warn(`Не удалось получить информацию MP3 для трека ${trackId}:`, err);
    throw err;
  }
}

/**
 * Получение прямой ссылки на воспроизведение MP3 для трека Яндекс Музыки
 * Работает автономно прямо со смартфона без промежуточного сервера.
 */
export async function getDirectYmAudioUrl(trackId: string): Promise<string> {
  const info = await getYmTrackDownloadInfo(trackId);
  return info.url;
}

/**
 * Парсер трека Яндекс Музыки в формат приложения Harmonix
 */
function convertYmTrack(ymTrack: any): Track {
  const artists = (ymTrack.artists || []).map((a: any) => a.name).join(', ') || 'Неизвестный исполнитель';
  const album = ymTrack.albums && ymTrack.albums.length ? ymTrack.albums[0].title : undefined;
  let coverUrl: string | undefined = undefined;

  if (ymTrack.coverUri) {
    coverUrl = `https://${ymTrack.coverUri.replace('%%', '400x400')}`;
  }

  const durationSec = Math.floor((ymTrack.durationMs || 0) / 1000);

  return {
    id: String(ymTrack.id),
    title: ymTrack.title || 'Без названия',
    artist: artists,
    album: album,
    duration: durationSec,
    cover_url: coverUrl,
    platform: 'yandex',
    stream_url: undefined, // разрешается прямо при воспроизведении/скачивании
    is_playable: true,
    original_uri: `yandex:track:${ymTrack.id}`,
  };
}

/**
 * Автономный импорт плейлиста или трека со смартфона без ПК и localhost
 */
export async function importPlaylistStandalone(
  url: string
): Promise<{ playlist: Playlist; tracks: Track[] }> {
  const cleanUrl = url.trim();

  // 1. Яндекс Музыка
  if (cleanUrl.includes('yandex.') || cleanUrl.includes('ya.ru')) {
    return await importYandexStandalone(cleanUrl);
  }

  // 2. Spotify
  if (cleanUrl.includes('spotify.com')) {
    return await importSpotifyStandalone(cleanUrl);
  }

  throw new Error(
    'Неподдерживаемый сервис. Вставьте ссылку на плейлист или трек из Яндекс Музыки или Spotify.'
  );
}

async function importYandexStandalone(
  url: string
): Promise<{ playlist: Playlist; tracks: Track[] }> {
  const token = localStorage.getItem('harmonix_yandex_token');
  const headers: Record<string, string> = {
    'User-Agent': 'Yandex-Music-API',
    'Accept': 'application/json',
  };
  if (token && token.trim()) {
    headers['Authorization'] = `OAuth ${token.trim()}`;
  }

  // А) Плейлист по UUID: /playlists/lk.UUID или /playlists/UUID
  const uuidMatch = url.match(/\/playlists\/([a-zA-Z0-9_.-]+)/);
  if (uuidMatch) {
    const rawUuid = uuidMatch[1].replace(/\/$/, '');
    const cleanUuid = rawUuid.replace(/^lk\./, '');
    const candidates = Array.from(new Set([rawUuid, cleanUuid]));

    for (const u of candidates) {
      for (const base of ['https://api.music.yandex.net/playlist', 'https://api.music.yandex.net/playlists']) {
        try {
          const res = await fetch(`${base}/${u}`, { headers });
          if (res.ok) {
            const json = await res.json();
            const plData = json.result;
            if (plData) {
              return buildYmPlaylistResult(plData);
            }
          }
        } catch (e) {
          console.warn(`Yandex playlist fetch ${base}/${u} failed:`, e);
        }
      }
    }

    if (!token && rawUuid.startsWith('lk.')) {
      throw new Error(
        'Этот плейлист Яндекс Музыки персональный (lk) и требует авторизации. Пожалуйста, войдите в свой аккаунт Яндекс в Настройках приложения (Шестеренка -> "Войти через код на ya.ru/device").'
      );
    }
  }

  // Б) Плейлист пользователя: /users/{user}/playlists/{kind}
  const userPlMatch = url.match(/\/users\/([^/]+)\/playlists\/(\d+)/);
  if (userPlMatch) {
    const userLogin = userPlMatch[1];
    const kind = userPlMatch[2];
    const res = await fetch(`https://api.music.yandex.net/users/${userLogin}/playlists/${kind}`, {
      headers,
    });
    if (res.ok) {
      const json = await res.json();
      if (json.result) {
        return buildYmPlaylistResult(json.result);
      }
    }
  }

  // В) Трек: /album/{albumId}/track/{trackId} или /track/{trackId}
  const trackMatch = url.match(/\/album\/\d+\/track\/(\d+)/) || url.match(/\/track\/(\d+)/);
  if (trackMatch) {
    const trackId = trackMatch[1];
    const res = await fetch(`https://api.music.yandex.net/tracks/${trackId}`, { headers });
    if (res.ok) {
      const json = await res.json();
      const rawTracks = json.result || [];
      if (rawTracks.length > 0) {
        const tr = convertYmTrack(rawTracks[0]);
        const pl: Playlist = {
          id: `ym_single_${tr.id}`,
          title: `Трек: ${tr.title}`,
          description: `${tr.artist} • Сингл`,
          cover_url: tr.cover_url,
          track_count: 1,
          platform: 'yandex',
        };
        return { playlist: pl, tracks: [tr] };
      }
    }
  }

  // Г) Альбом: /album/{albumId}
  const albumMatch = url.match(/\/album\/(\d+)/);
  if (albumMatch) {
    const albumId = albumMatch[1];
    const res = await fetch(`https://api.music.yandex.net/albums/${albumId}/with-tracks`, {
      headers,
    });
    if (res.ok) {
      const json = await res.json();
      const alb = json.result;
      if (alb) {
        const tracks: Track[] = [];
        for (const vol of alb.volumes || []) {
          for (const t of vol) {
            tracks.push(convertYmTrack(t));
          }
        }
        const cover = alb.coverUri ? `https://${alb.coverUri.replace('%%', '400x400')}` : undefined;
        const pl: Playlist = {
          id: `ym_album_${alb.id}`,
          title: alb.title || 'Альбом Яндекс',
          description: `Альбом (${alb.year || ''})`,
          cover_url: cover,
          track_count: tracks.length,
          platform: 'yandex',
        };
        return { playlist: pl, tracks };
      }
    }
  }

  throw new Error(
    'Не удалось распознать ссылку Яндекс Музыки. Убедитесь, что ссылка скопирована полностью и плейлист открыт для публичного доступа.'
  );
}

function buildYmPlaylistResult(plData: any): { playlist: Playlist; tracks: Track[] } {
  let coverUrl: string | undefined = undefined;
  if (plData.cover && plData.cover.uri) {
    coverUrl = `https://${plData.cover.uri.replace('%%', '400x400')}`;
  }

  const rawTracks = plData.tracks || [];
  const tracks: Track[] = [];

  for (const item of rawTracks) {
    const tObj = item.track || item;
    if (tObj && tObj.id) {
      tracks.push(convertYmTrack(tObj));
    }
  }

  const playlist: Playlist = {
    id: `ym_pl_${plData.playlistUuid || plData.kind || Date.now()}`,
    title: plData.title || 'Плейлист Яндекс',
    description: plData.description || 'Импортировано прямо на смартфоне',
    cover_url: coverUrl,
    track_count: tracks.length,
    platform: 'yandex',
  };

  return { playlist, tracks };
}

async function importSpotifyStandalone(
  url: string
): Promise<{ playlist: Playlist; tracks: Track[] }> {
  // Публичный oEmbed endpoint Spotify
  const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
  const resp = await fetch(oembedUrl);
  if (!resp.ok) {
    throw new Error('Spotify: не удалось загрузить метаданные по ссылке');
  }

  const data = await resp.json();
  const playlistTitle = data.title || 'Плейлист Spotify';
  const coverUrl = data.thumbnail_url;

  const pl: Playlist = {
    id: `spot_${Date.now()}`,
    title: playlistTitle,
    description: 'Импортировано из Spotify',
    cover_url: coverUrl,
    track_count: 1,
    platform: 'spotify',
  };

  const tr: Track = {
    id: `spot_tr_${Date.now()}`,
    title: playlistTitle,
    artist: 'Spotify',
    duration: 180,
    cover_url: coverUrl,
    platform: 'spotify',
    is_playable: true,
  };

  return { playlist: pl, tracks: [tr] };
}
