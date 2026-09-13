import os
import json
import logging
import urllib.parse
from typing import Optional, Dict, Any, List
import httpx

from app.models import PlatformEnum
from app.platforms.manager import manager

logger = logging.getLogger("harmonix.artist")

CACHE_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "artist_cache.json")

# Словарь перевода популярных жанров Яндекс Музыки
GENRE_MAP = {
    "rusrap": "Русский рэп",
    "rap": "Рэп / Хип-хоп",
    "hiphop": "Хип-хоп",
    "pop": "Поп",
    "ruspop": "Русский поп",
    "rock": "Рок",
    "rusrock": "Русский рок",
    "punk": "Панк-рок",
    "altrock": "Альтернативный рок",
    "numetal": "Ню-метал",
    "metal": "Метал",
    "indie": "Инди",
    "indiepop": "Инди-поп",
    "electronic": "Электроника",
    "dance": "Танцевальная",
    "club": "Клубная",
    "house": "Хаус",
    "techno": "Техно",
    "rnb": "R&B / Соул",
    "jazz": "Джаз",
    "blues": "Блюз",
    "classical": "Классика",
    "soundtrack": "Саундтреки",
    "reggae": "Регги",
    "folk": "Фолк",
    "lofi": "Lo-Fi",
    "ambient": "Эмбиент",
}

class ArtistService:
    def __init__(self):
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._ym_client = None
        self._load_cache()

    def _load_cache(self):
        try:
            if os.path.exists(CACHE_FILE):
                with open(CACHE_FILE, "r", encoding="utf-8") as f:
                    self._cache = json.load(f)
        except Exception as e:
            logger.warning(f"Ошибка чтения artist_cache.json: {e}")
            self._cache = {}

    def _save_cache(self):
        try:
            os.makedirs(os.path.dirname(CACHE_FILE), exist_ok=True)
            with open(CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(self._cache, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.warning(f"Ошибка записи artist_cache.json: {e}")

    def _get_ym_client(self):
        ym_adapter = manager.adapters.get(PlatformEnum.YANDEX)
        if ym_adapter and ym_adapter.is_authenticated() and ym_adapter.client:
            return ym_adapter.client
        if self._ym_client is None:
            try:
                from yandex_music import Client
                self._ym_client = Client().init()
            except Exception as e:
                logger.error(f"Не удалось инициализировать анонимный клиент Яндекс Музыки: {e}")
        return self._ym_client

    async def get_artist_info(self, artist_name: str) -> Dict[str, Any]:
        clean_name = artist_name.strip()
        if not clean_name:
            return {}

        cache_key = clean_name.lower()
        if cache_key in self._cache:
            return self._cache[cache_key]

        photo_url: Optional[str] = None
        banner_url: Optional[str] = None
        description: Optional[str] = None
        short_description: Optional[str] = None
        genres: List[str] = []

        # 1. Поиск через Яндекс Музыку (студийное HD фото и официальное био)
        try:
            client = self._get_ym_client()
            if client:
                res = client.search(clean_name, type_="artist")
                if res and res.artists and res.artists.results:
                    art = res.artists.results[0]
                    # Извлекаем фото
                    if art.cover and art.cover.uri:
                        photo_url = f"https://{art.cover.uri.replace('%%', '600x600')}"
                        banner_url = f"https://{art.cover.uri.replace('%%', '1000x1000')}"

                    # Получаем расширенную информацию (жанры, описание)
                    try:
                        brief = client.artists_brief_info(art.id)
                        if brief and brief.artist:
                            if brief.artist.description and brief.artist.description.text:
                                description = brief.artist.description.text.strip()
                            if brief.artist.genres:
                                raw_genres = brief.artist.genres
                                genres = [GENRE_MAP.get(g.lower(), g.capitalize()) for g in raw_genres]
                    except Exception as e:
                        logger.debug(f"Не удалось получить brief_info артиста {clean_name}: {e}")
        except Exception as e:
            logger.debug(f"Поиск в Яндекс Музыке завершился с ошибкой: {e}")

        # 2. Если описание отсутствует — ищем в Википедии (ru.wikipedia.org)
        if not description or len(description) < 40 or not photo_url:
            wiki_data = await self._fetch_wikipedia(clean_name)
            if wiki_data:
                if not description and wiki_data.get("extract"):
                    description = wiki_data.get("extract")
                if not short_description and wiki_data.get("description"):
                    short_description = wiki_data.get("description")
                if not photo_url and wiki_data.get("photo_url"):
                    photo_url = wiki_data.get("photo_url")
                    banner_url = photo_url

        result = {
            "name": clean_name,
            "photo_url": photo_url,
            "banner_url": banner_url,
            "description": description,
            "short_description": short_description,
            "genres": genres,
        }

        # Сохраняем в кэш
        self._cache[cache_key] = result
        self._save_cache()
        return result

    async def _fetch_wikipedia(self, query: str) -> Optional[Dict[str, Any]]:
        headers = {"User-Agent": "HarmonixMusicPlayer/1.0 (https://github.com/deniskolzun13/Harmonix-Music)"}
        async with httpx.AsyncClient(headers=headers, timeout=5.0, follow_redirects=True) as client:
            variants = [
                query,
                f"{query} (музыкант)",
                f"{query} (группа)",
                f"{query} (певец)",
                f"{query} (дуэт)",
            ]

            for v in variants:
                try:
                    enc = urllib.parse.quote(v)
                    url = f"https://ru.wikipedia.org/api/rest_v1/page/summary/{enc}"
                    resp = await client.get(url)
                    if resp.status_code == 200:
                        data = resp.json()
                        extract = data.get("extract", "").strip()
                        if extract and len(extract) > 20:
                            photo = None
                            if "originalimage" in data and "source" in data["originalimage"]:
                                photo = data["originalimage"]["source"]
                            elif "thumbnail" in data and "source" in data["thumbnail"]:
                                photo = data["thumbnail"]["source"]

                            return {
                                "extract": extract,
                                "description": data.get("description"),
                                "photo_url": photo,
                            }
                except Exception:
                    continue

        return None

artist_service = ArtistService()
