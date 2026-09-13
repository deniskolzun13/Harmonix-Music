import { ArtistProfileInfo } from '../types';
import { getServerUrl } from '../api';

const CACHE_PREFIX = 'harmonix_artist_profile_';

/**
 * Синхронно возвращает закэшированный профиль артиста (для мгновенного рендера без задержек)
 */
export function getCachedArtistProfile(artistName: string): ArtistProfileInfo | null {
  if (!artistName) return null;
  const key = CACHE_PREFIX + artistName.trim().toLowerCase();
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Ошибка чтения кэша профиля артиста:', e);
  }
  return null;
}

/**
 * Сохраняет профиль артиста в локальный кэш
 */
export function saveCachedArtistProfile(profile: ArtistProfileInfo): void {
  if (!profile || !profile.name) return;
  const key = CACHE_PREFIX + profile.name.trim().toLowerCase();
  try {
    localStorage.setItem(key, JSON.stringify(profile));
  } catch (e) {
    console.warn('Ошибка сохранения кэша профиля артиста:', e);
  }
}

/**
 * Получает оригинальные данные музыканта:
 * 1. Из локального кэша устройства (если уже открывался ранее).
 * 2. С сервера Harmonix API (/api/artist/info).
 * 3. Резервный источник: напрямую из Википедии (для автономного мобильного режима).
 */
export async function fetchArtistProfile(artistName: string): Promise<ArtistProfileInfo | null> {
  const cleanName = artistName.trim();
  if (!cleanName) return null;

  // 1. Проверяем локальный кэш
  const cached = getCachedArtistProfile(cleanName);
  if (cached && (cached.photo_url || cached.description)) {
    return cached;
  }

  // 2. Запрос к бэкенду Harmonix
  try {
    const serverUrl = getServerUrl();
    const resp = await fetch(`${serverUrl}/api/artist/info?name=${encodeURIComponent(cleanName)}`);
    if (resp.ok) {
      const data: ArtistProfileInfo = await resp.json();
      if (data && (data.photo_url || data.description)) {
        saveCachedArtistProfile(data);
        return data;
      }
    }
  } catch (err) {
    console.info('Бэкенд Harmonix недоступен, пробуем резервный поиск в Википедии:', err);
  }

  // 3. Резервный поиск напрямую в Википедии (если бэкенд выключен или оффлайн)
  try {
    const variants = [
      cleanName,
      `${cleanName} (музыкант)`,
      `${cleanName} (группа)`,
      `${cleanName} (певец)`,
    ];

    for (const query of variants) {
      try {
        const wikiUrl = `https://ru.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
        const wikiResp = await fetch(wikiUrl);
        if (wikiResp.ok) {
          const wikiData = await wikiResp.json();
          if (wikiData.extract && wikiData.extract.length > 20) {
            const photo = wikiData.originalimage?.source || wikiData.thumbnail?.source || undefined;
            const profile: ArtistProfileInfo = {
              name: cleanName,
              photo_url: photo,
              banner_url: photo,
              description: wikiData.extract,
              short_description: wikiData.description || undefined,
              genres: [],
            };
            saveCachedArtistProfile(profile);
            return profile;
          }
        }
      } catch {}
    }
  } catch (wikiErr) {
    console.warn('Ошибка резервного запроса к Википедии:', wikiErr);
  }

  return null;
}
