import logging
import requests
from typing import List, Optional, Tuple
from app.models import Playlist, Track, PlatformEnum
from app.platforms.base import BasePlatformAdapter
from app.utils.retry_helper import api_retry, should_retry_exception

logger = logging.getLogger("harmonix.vk")

VK_API_VERSION = "5.131"
VK_USER_AGENT = "KateMobileAndroid/56 lite-armv7 (Android 4.4.2; SDK 19; x86; unknown; ru)"

class VkMusicAdapter(BasePlatformAdapter):
    platform = PlatformEnum.VK

    def __init__(self, token: Optional[str] = None):
        self.token = token
        self.user_id = None
        self.user_name = None
        if token:
            self._verify_token()

    def update_token(self, token: str):
        self.token = token
        self._verify_token()

    def _call_api(self, method: str, params: dict) -> Optional[dict]:
        if not self.token:
            return None
        url = f"https://api.vk.com/method/{method}"
        full_params = {
            "access_token": self.token,
            "v": VK_API_VERSION,
            **params
        }
        headers = {"User-Agent": VK_USER_AGENT}
        try:
            res = requests.get(url, params=full_params, headers=headers, timeout=10)
            if res.status_code == 429:
                res.raise_for_status()
            data = res.json()
            if "error" in data:
                err_code = data["error"].get("error_code")
                if err_code in (6, 9):  # Код 6: Слишком много запросов в секунду, 9: Flood control
                    raise requests.exceptions.HTTPError(
                        f"VK rate limit (код {err_code}): {data['error'].get('error_msg')}",
                        response=res
                    )
                logger.warning(f"VK API ошибка {method}: {data['error'].get('error_msg')}")
                return None
            return data.get("response")
        except Exception as e:
            if should_retry_exception(e):
                raise
            logger.error(f"Сетевая ошибка при запросе VK API {method}: {e}")
            return None

    def _verify_token(self):
        resp = self._call_api("users.get", {})
        if resp and len(resp) > 0:
            user = resp[0]
            self.user_id = user.get("id")
            first = user.get("first_name", "")
            last = user.get("last_name", "")
            self.user_name = f"{first} {last}".strip() or f"id{self.user_id}"
        else:
            self.user_id = None
            self.user_name = None

    def is_authenticated(self) -> bool:
        return bool(self.token and self.user_id)

    def get_user_info(self) -> Tuple[bool, Optional[str]]:
        if self.is_authenticated():
            return True, self.user_name
        return False, None

    def _convert_track(self, vk_audio: dict) -> Track:
        track_id = f"{vk_audio.get('owner_id')}_{vk_audio.get('id')}"
        album_title = None
        cover_url = None

        album = vk_audio.get("album")
        if isinstance(album, dict):
            album_title = album.get("title")
            thumb = album.get("thumb")
            if isinstance(thumb, dict):
                cover_url = thumb.get("photo_600") or thumb.get("photo_300")

        return Track(
            id=track_id,
            title=vk_audio.get("title", "Без названия"),
            artist=vk_audio.get("artist", "Неизвестный артист"),
            album=album_title,
            duration=vk_audio.get("duration", 0),
            cover_url=cover_url,
            platform=PlatformEnum.VK,
            stream_url=vk_audio.get("url"),
            is_playable=bool(vk_audio.get("url")),
            original_uri=f"vk:audio:{track_id}"
        )

    def get_favorites(self) -> List[Track]:
        if not self.is_authenticated():
            return []
        resp = self._call_api("audio.get", {"owner_id": self.user_id, "count": 100})
        if not resp:
            return []
        items = resp.get("items", [])
        return [self._convert_track(item) for item in items]

    def get_playlists(self) -> List[Playlist]:
        if not self.is_authenticated():
            return []
        result = [
            Playlist(
                id="favorites",
                title="Моя музыка ВКонтакте",
                description="Все добавленные треки со страницы",
                cover_url="https://vk.com/images/audio_row_placeholder.png",
                track_count=0,
                platform=PlatformEnum.VK
            )
        ]
        resp = self._call_api("audio.getPlaylists", {"owner_id": self.user_id, "count": 50})
        if resp and "items" in resp:
            for pl in resp["items"]:
                cover = None
                if "photo" in pl:
                    cover = pl["photo"].get("photo_300")
                result.append(Playlist(
                    id=str(pl.get("id")),
                    title=pl.get("title", "Плейлист"),
                    description=pl.get("description", ""),
                    cover_url=cover,
                    track_count=pl.get("count", 0),
                    platform=PlatformEnum.VK
                ))
        return result

    def get_playlist_tracks(self, playlist_id: str) -> List[Track]:
        if not self.is_authenticated():
            return []
        if playlist_id == "favorites":
            return self.get_favorites()
        resp = self._call_api("audio.get", {
            "owner_id": self.user_id,
            "playlist_id": playlist_id,
            "count": 100
        })
        if not resp:
            return []
        return [self._convert_track(item) for item in resp.get("items", [])]

    @api_retry
    def search_tracks(self, query: str, limit: int = 10) -> List[Track]:
        if not self.is_authenticated():
            return []
        resp = self._call_api("audio.search", {
            "q": query,
            "auto_complete": 1,
            "count": limit
        })
        if not resp:
            return []
        return [self._convert_track(item) for item in resp.get("items", [])]

    def create_playlist(self, title: str, description: str = "") -> Optional[Playlist]:
        if not self.is_authenticated():
            return None
        resp = self._call_api("audio.createPlaylist", {
            "owner_id": self.user_id,
            "title": title,
            "description": description
        })
        if resp and "id" in resp:
            return Playlist(
                id=str(resp["id"]),
                title=title,
                description=description,
                track_count=0,
                platform=PlatformEnum.VK
            )
        return None

    @api_retry
    def add_tracks_to_playlist(self, playlist_id: str, tracks: List[Track]) -> int:
        if not self.is_authenticated() or not tracks:
            return 0
        added = 0
        for tr in tracks:
            try:
                # tr.id имеет формат owner_id_audio_id
                parts = tr.id.split("_")
                if len(parts) == 2:
                    owner_id, audio_id = int(parts[0]), int(parts[1])
                    # Сначала добавляем трек к себе, если он еще не добавлен
                    add_resp = self._call_api("audio.add", {"audio_id": audio_id, "owner_id": owner_id})
                    new_audio_id = add_resp if add_resp else audio_id
                    if playlist_id != "favorites":
                        self._call_api("audio.moveToPlaylist", {
                            "owner_id": self.user_id,
                            "playlist_id": playlist_id,
                            "audio_ids": f"{self.user_id}_{new_audio_id}"
                        })
                    added += 1
            except Exception as e:
                logger.debug(f"Не удалось добавить трек в VK: {e}")
                if should_retry_exception(e):
                    raise
        return added

    def get_stream_url(self, track_id: str) -> Optional[str]:
        if not self.is_authenticated():
            return None
        try:
            parts = track_id.split("_")
            if len(parts) != 2:
                return None
            resp = self._call_api("audio.getById", {"audios": track_id})
            if resp and len(resp) > 0:
                return resp[0].get("url")
        except Exception as e:
            logger.error(f"Ошибка получения аудио VK: {e}")
        return None

    def get_personal_recommendations(self, limit: int = 30) -> List[Track]:
        """Возвращает персональные рекомендации VK Музыки"""
        if not self.is_authenticated():
            return []
        try:
            params = {"user_id": self.user_id, "count": limit}
            resp = self._call_api("audio.getRecommendations", params)
            if not resp:
                return []
            items = resp.get("items", []) if isinstance(resp, dict) else resp
            return [self._convert_track(item) for item in items if isinstance(item, dict)]
        except Exception as e:
            logger.error(f"Ошибка получения рекомендаций VK: {e}")
            return []
