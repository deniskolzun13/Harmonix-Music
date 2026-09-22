import logging
import json
from typing import List, Optional, Tuple
from app.models import Playlist, Track, PlatformEnum, RelatedArtist
from app.platforms.base import BasePlatformAdapter
from app.utils.retry_helper import api_retry

logger = logging.getLogger("harmonix.youtube")

class YouTubeMusicAdapter(BasePlatformAdapter):
    platform = PlatformEnum.YOUTUBE

    def __init__(self, oauth_json: Optional[str] = None):
        self.oauth_json = oauth_json
        self.yt = None
        self.user_name = None
        if self.oauth_json:
            self._init_client()

    def update_credentials(self, oauth_json: Optional[str] = None):
        self.oauth_json = oauth_json
        self._init_client()

    def _init_client(self):
        try:
            from ytmusicapi import YTMusic
            # If oauth_json is passed, it is either a JSON string of headers or oauth credentials
            self.yt = YTMusic(auth=self.oauth_json)
            playlists = self.yt.get_library_playlists(limit=1)
            self.user_name = "YouTube User"
        except Exception as e:
            logger.warning(f"Ошибка инициализации YouTube Music: {e}")
            self.yt = None
            self.user_name = None

    def is_authenticated(self) -> bool:
        return self.yt is not None

    def get_user_info(self) -> Tuple[bool, Optional[str]]:
        if self.is_authenticated():
            return True, self.user_name
        return False, None

    def _convert_track(self, yt_track: dict) -> Track:
        artists_data = yt_track.get("artists", [])
        artists = ", ".join([a.get("name", "") for a in artists_data if isinstance(a, dict)]) if artists_data else "Неизвестный исполнитель"
        
        album = yt_track.get("album", {})
        album_name = album.get("name") if isinstance(album, dict) else None
        
        thumbnails = yt_track.get("thumbnails", [])
        cover_url = thumbnails[-1].get("url") if thumbnails else None
        
        duration_sec = yt_track.get("duration_seconds", 0)
        track_id = yt_track.get("videoId")

        return Track(
            id=track_id or "",
            title=yt_track.get("title", "Без названия"),
            artist=artists,
            album=album_name,
            duration=duration_sec,
            cover_url=cover_url,
            platform=PlatformEnum.YOUTUBE,
            stream_url=None,
            is_playable=True,
            original_uri=f"youtube:{track_id}"
        )

    def get_favorites(self) -> List[Track]:
        if not self.is_authenticated():
            return []
        try:
            result = self.yt.get_liked_songs(limit=100)
            tracks = result.get("tracks", [])
            return [self._convert_track(t) for t in tracks if t.get("videoId")]
        except Exception as e:
            logger.error(f"Ошибка получения избранного YouTube: {e}")
            return []

    def get_playlists(self) -> List[Playlist]:
        if not self.is_authenticated():
            return []
        try:
            result = [
                Playlist(
                    id="LM",
                    title="Мне нравится (YouTube)",
                    description="Сохранённые треки",
                    cover_url=None,
                    track_count=0,
                    platform=PlatformEnum.YOUTUBE
                )
            ]
            playlists = self.yt.get_library_playlists(limit=50)
            for p in playlists:
                thumbnails = p.get("thumbnails", [])
                cover = thumbnails[-1].get("url") if thumbnails else None
                result.append(Playlist(
                    id=p["playlistId"],
                    title=p.get("title", "Плейлист"),
                    description="",
                    cover_url=cover,
                    track_count=p.get("count", 0) if isinstance(p.get("count"), int) else 0,
                    platform=PlatformEnum.YOUTUBE
                ))
            return result
        except Exception as e:
            logger.error(f"Ошибка получения плейлистов YouTube: {e}")
            return []

    def get_playlist_tracks(self, playlist_id: str) -> List[Track]:
        if not self.is_authenticated():
            return []
        try:
            if playlist_id == "LM":
                results = self.yt.get_liked_songs(limit=200)
                tracks = results.get("tracks", [])
            else:
                results = self.yt.get_playlist(playlist_id, limit=200)
                tracks = results.get("tracks", [])
            return [self._convert_track(t) for t in tracks if t.get("videoId")]
        except Exception as e:
            logger.error(f"Ошибка получения треков плейлиста YouTube: {e}")
            return []

    @api_retry
    def search_tracks(self, query: str, limit: int = 10) -> List[Track]:
        if not self.is_authenticated():
            return []
        try:
            results = self.yt.search(query=query, filter="songs", limit=limit)
            return [self._convert_track(t) for t in results if t.get("videoId")]
        except Exception as e:
            logger.error(f"Ошибка поиска в YouTube: {e}")
            raise

    def create_playlist(self, title: str, description: str = "") -> Optional[Playlist]:
        if not self.is_authenticated():
            return None
        try:
            playlist_id = self.yt.create_playlist(title, description, privacy_status="PRIVATE")
            return Playlist(
                id=playlist_id,
                title=title,
                description=description,
                track_count=0,
                platform=PlatformEnum.YOUTUBE
            )
        except Exception as e:
            logger.error(f"Ошибка создания плейлиста в YouTube: {e}")
            return None

    @api_retry
    def add_tracks_to_playlist(self, playlist_id: str, tracks: List[Track]) -> int:
        if not self.is_authenticated() or not tracks:
            return 0
        try:
            video_ids = [t.id for t in tracks if t.id]
            if playlist_id == "LM":
                for vid in video_ids:
                    self.yt.rate_song(vid, "LIKE")
                return len(video_ids)
            else:
                self.yt.add_playlist_items(playlist_id, video_ids)
                return len(video_ids)
        except Exception as e:
            logger.error(f"Ошибка добавления треков в YouTube: {e}")
            raise

    def get_stream_url(self, track_id: str) -> Optional[str]:
        if not self.is_authenticated():
            return None
        try:
            return f"https://music.youtube.com/watch?v={track_id}"
        except Exception:
            return None
