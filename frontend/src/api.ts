import { AuthConfig, AuthStatus, NetworkInfo, Playlist, Track, TransferTask, Platform } from './types';
import { importPlaylistStandalone } from './services/standaloneImporter';

export function isNativeMobile(): boolean {
  if (typeof window === 'undefined') return false;
  const w = window as any;
  return Boolean(
    w.Capacitor?.isNativePlatform?.() ||
    w.Capacitor ||
    window.location.protocol === 'capacitor:' ||
    (window.location.hostname === 'localhost' && !window.location.port)
  );
}

export function getServerUrl(): string {
  const saved = localStorage.getItem('harmonix_server_url');
  if (saved && saved.trim()) {
    return saved.trim().replace(/\/+$/, '');
  }

  // Если открыто в нативном приложении (Capacitor Android APK)
  if (isNativeMobile()) {
    return 'http://192.168.0.11:8000';
  }

  // Если открыто в браузере мобильного или ПК по локальной сети
  if (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost') {
    const port = window.location.port ? `:${window.location.port}` : '';
    return `${window.location.protocol}//${window.location.hostname}${port}`;
  }

  return 'http://192.168.0.11:8000';
}

export function setServerUrl(url: string) {
  localStorage.setItem('harmonix_server_url', url.trim().replace(/\/+$/, ''));
}

export function getApiBase(): string {
  return `${getServerUrl()}/api`;
}

export async function getNetworkInfo(): Promise<NetworkInfo> {
  const res = await fetch(`${getApiBase()}/network/info`);
  return res.json();
}

export async function getAuthStatus(): Promise<AuthStatus> {
  const res = await fetch(`${getApiBase()}/auth/status`);
  return res.json();
}

export async function getAuthConfig(): Promise<AuthConfig> {
  const res = await fetch(`${getApiBase()}/auth/config`);
  return res.json();
}


export async function saveAuthConfig(config: AuthConfig): Promise<{ status: string; auth_status: AuthStatus }> {
  const res = await fetch(`${getApiBase()}/auth/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return res.json();
}

export async function getPlaylists(platform?: Platform): Promise<Playlist[]> {
  const base = getApiBase();
  const url = platform ? `${base}/playlists?platform=${platform}` : `${base}/playlists`;
  const res = await fetch(url);
  return res.json();
}

export async function getPlaylistTracks(platform: Platform, playlistId: string): Promise<Track[]> {
  const res = await fetch(`${getApiBase()}/playlists/${platform}/${playlistId}/tracks`);
  const tracks: Track[] = await res.json();
  const base = getApiBase().replace(/\/api$/, '');
  // Для APK преобразуем относительный /api/stream/... в полный URL
  return tracks.map(t => ({
    ...t,
    stream_url: t.stream_url?.startsWith('http') ? t.stream_url : `${base}${t.stream_url}`
  }));
}

export async function searchTracks(query: string, platform: Platform = 'yandex'): Promise<Track[]> {
  const res = await fetch(`${getApiBase()}/search?query=${encodeURIComponent(query)}&platform=${platform}`);
  const tracks: Track[] = await res.json();
  const base = getApiBase().replace(/\/api$/, '');
  return tracks.map(t => ({
    ...t,
    stream_url: t.stream_url?.startsWith('http') ? t.stream_url : `${base}${t.stream_url}`
  }));
}

export async function startTransfer(
  source_platform: Platform,
  target_platform: Platform,
  source_playlist_id: string,
  target_playlist_name?: string
): Promise<TransferTask> {
  const res = await fetch(`${getApiBase()}/transfer/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source_platform,
      target_platform,
      source_playlist_id,
      target_playlist_name,
      create_new: true,
    }),
  });
  return res.json();
}

export async function getTransferStatus(taskId: string): Promise<TransferTask> {
  const res = await fetch(`${getApiBase()}/transfer/status/${taskId}`);
  return res.json();
}

export async function confirmTransfer(taskId: string, confirmedTrackIds: string[]): Promise<TransferTask> {
  const res = await fetch(`${getApiBase()}/transfer/${taskId}/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ confirmed_track_ids: confirmedTrackIds }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Ошибка подтверждения' }));
    throw new Error(err.detail || 'Не удалось подтвердить треки');
  }
  return res.json();
}

export async function rejectTransfer(taskId: string): Promise<TransferTask> {
  const res = await fetch(`${getApiBase()}/transfer/${taskId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Ошибка отклонения' }));
    throw new Error(err.detail || 'Не удалось отклонить треки');
  }
  return res.json();
}

export async function importPlaylistByUrl(url: string): Promise<{ playlist: Playlist; tracks: Track[] }> {
  const trimmedUrl = url.trim();
  let lastStandaloneError = '';

  // 1. Попытка автономного импорта прямо на смартфоне (без сервера и ПК)
  try {
    const standalone = await importPlaylistStandalone(trimmedUrl);
    if (standalone && standalone.tracks.length > 0) {
      return standalone;
    }
  } catch (standaloneErr: any) {
    lastStandaloneError = standaloneErr?.message || '';
    if (lastStandaloneError.includes('авторизац') || lastStandaloneError.includes('Настройк') || lastStandaloneError.includes('персональн')) {
      throw standaloneErr;
    }
    console.warn('Standalone import failed, fallback to server:', standaloneErr);
  }

  // 2. Если автономно не получилось или нужен сервер
  let res: Response;
  const server = getServerUrl();
  try {
    res = await fetch(`${getApiBase()}/import/url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: trimmedUrl }),
    });
  } catch (netErr: any) {
    if (lastStandaloneError) {
      throw new Error(lastStandaloneError);
    }
    throw new Error(
      `Не удалось распознать ссылку. Проверьте правильность адреса или откройте доступ в настройках приватности.`
    );
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text().catch(() => '');
    if (lastStandaloneError) {
      throw new Error(lastStandaloneError);
    }
    if (text.includes('<!DOCTYPE') || text.includes('<html')) {
      throw new Error(`Сервер недоступен или вернул страницу. Проверьте адрес сервера в Настройках (сейчас: ${server}).`);
    }
    throw new Error(`Не удалось загрузить плейлист: ${text.slice(0, 80)}`);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Ошибка сервера' }));
    throw new Error(err.detail || 'Не удалось загрузить плейлист');
  }

  const data = await res.json();
  data.tracks = data.tracks.map((t: Track) => ({
    ...t,
    stream_url: t.stream_url?.startsWith('http') ? t.stream_url : `${server}${t.stream_url}`,
  }));
  return data;
}

export function getCoverProxyUrl(coverUrl: string): string {
  const base = getApiBase().replace(/\/api$/, '');
  return `${base}/api/cover-proxy?url=${encodeURIComponent(coverUrl)}`;
}

