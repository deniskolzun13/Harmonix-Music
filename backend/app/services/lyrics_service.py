import logging
import re
from typing import Optional, Dict, Any
import httpx
from app.models import PlatformEnum
from app.platforms.manager import manager

logger = logging.getLogger("harmonix.lyrics")

# In-memory кэш для мгновенной отдачи при повторных запросах
_lyrics_cache: Dict[str, Dict[str, Any]] = {}


def _clean_track_info(title: str, artist: str) -> tuple[str, str]:
    """Удаляет скобки (feat, remix, live) и берет первого исполнителя при дуэтах"""
    clean_title = re.sub(r'[\(\[\{].*?[\)\]\}]', '', title).strip()
    clean_title = re.sub(r'\s{2,}', ' ', clean_title)

    clean_artist = re.split(r'[,&/]|\bfeat\.?\b|\bft\.?\b|\bwith\b|\bуч\.?\b', artist, flags=re.IGNORECASE)[0].strip()
    return clean_title or title, clean_artist or artist


async def get_lyrics(
    artist: str,
    title: str,
    album: Optional[str] = None,
    duration: Optional[int] = None,
    track_id: Optional[str] = None,
    platform: Optional[str] = None
) -> Dict[str, Any]:
    cache_key = f"{artist.lower().strip()}::{title.lower().strip()}"
    if cache_key in _lyrics_cache:
        return _lyrics_cache[cache_key]

    headers = {
        "User-Agent": "HarmonixMusicPlayer/1.0 (https://github.com/deniskolzun13/Harmonix-Music)"
    }

    # 1. Запрос в LRCLIB (прямой поиск)
    async with httpx.AsyncClient(timeout=5.0, headers=headers) as client:
        params: Dict[str, Any] = {"artist_name": artist, "track_name": title}
        if album:
            params["album_name"] = album
        if duration:
            params["duration"] = str(duration)

        try:
            resp = await client.get("https://lrclib.net/api/get", params=params)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("syncedLyrics") or data.get("plainLyrics"):
                    result = {
                        "synced_lyrics": data.get("syncedLyrics"),
                        "plain_lyrics": data.get("plainLyrics"),
                        "source": "lrclib",
                        "instrumental": data.get("instrumental", False)
                    }
                    _lyrics_cache[cache_key] = result
                    return result
        except Exception as e:
            logger.debug(f"LRCLIB direct fetch error for {artist} - {title}: {e}")

        # 2. Попытка с очищенным именем и артистом
        clean_title, clean_artist = _clean_track_info(title, artist)
        if clean_title != title or clean_artist != artist:
            try:
                clean_params = {"artist_name": clean_artist, "track_name": clean_title}
                resp = await client.get("https://lrclib.net/api/get", params=clean_params)
                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("syncedLyrics") or data.get("plainLyrics"):
                        result = {
                            "synced_lyrics": data.get("syncedLyrics"),
                            "plain_lyrics": data.get("plainLyrics"),
                            "source": "lrclib",
                            "instrumental": data.get("instrumental", False)
                        }
                        _lyrics_cache[cache_key] = result
                        return result
            except Exception as e:
                logger.debug(f"LRCLIB clean fetch error for {clean_artist} - {clean_title}: {e}")

    # 3. Fallback на Яндекс Музыку, если трек из Яндекса
    if platform == PlatformEnum.YANDEX.value and track_id:
        try:
            ym_adapter = manager.adapters.get(PlatformEnum.YANDEX)
            if ym_adapter and ym_adapter.client:
                tracks = ym_adapter.client.tracks([track_id])
                if tracks and tracks[0]:
                    supplement = tracks[0].get_supplement()
                    if supplement and supplement.lyrics:
                        plain = supplement.lyrics.full_lyrics or supplement.lyrics.lyrics
                        if plain:
                            result = {
                                "synced_lyrics": None,
                                "plain_lyrics": plain,
                                "source": "yandex",
                                "instrumental": False
                            }
                            _lyrics_cache[cache_key] = result
                            return result
        except Exception as e:
            logger.warning(f"Ошибка получения текста из Яндекс Музыки: {e}")

    # Ничего не найдено
    empty_result = {
        "synced_lyrics": None,
        "plain_lyrics": None,
        "source": None,
        "instrumental": False
    }
    _lyrics_cache[cache_key] = empty_result
    return empty_result
