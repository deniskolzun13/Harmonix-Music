import logging
from typing import List, Optional, Tuple
from app.models import Playlist, Track, PlatformEnum
from app.platforms.base import BasePlatformAdapter
from app.utils.retry_helper import api_retry

logger = logging.getLogger("harmonix.spotify")

class SpotifyAdapter(BasePlatformAdapter):
    platform = PlatformEnum.SPOTIFY

    def __init__(
        self,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
        refresh_token: Optional[str] = None,
        access_token: Optional[str] = None
    ):
        self.client_id = client_id
        self.client_secret = client_secret
        self.refresh_token = refresh_token
        self.access_token = access_token
        self.sp = None
        self.user_id = None
        self.user_name = None
        if self.access_token or (client_id and client_secret and refresh_token):
            self._init_client()

    def update_credentials(
        self,
        client_id: Optional[str] = None,
        client_secret: Optional[str] = None,
        refresh_token: Optional[str] = None,
        access_token: Optional[str] = None
    ):
        self.client_id = client_id
        self.client_secret = client_secret
        self.refresh_token = refresh_token
        self.access_token = access_token
        self._init_client()

    def _init_client(self):
        try:
            import spotipy
            if self.access_token:
                self.sp = spotipy.Spotify(auth=self.access_token)
            else:
                from spotipy.oauth2 import SpotifyOAuth
                auth_manager = SpotifyOAuth(
                    client_id=self.client_id,
                    client_secret=self.client_secret,
                    redirect_uri="http://localhost:8000/api/auth/spotify/callback",
                    scope="user-library-read playlist-read-private playlist-modify-public playlist-modify-private"
                )
                token_info = auth_manager.refresh_access_token(self.refresh_token)
                self.sp = spotipy.Spotify(auth=token_info['access_token'])
            me = self.sp.current_user()
            self.user_id = me['id']
            self.user_name = me.get('display_name') or me['id']
        except Exception as e:
            logger.warning(f"Ошибка инициализации Spotify: {e}")
            self.sp = None
            self.user_id = None
            self.user_name = None

    def is_authenticated(self) -> bool:
        return self.sp is not None and self.user_id is not None

    def get_user_info(self) -> Tuple[bool, Optional[str]]:
        if self.is_authenticated():
            return True, self.user_name
        return False, None

    def _convert_track(self, sp_track: dict) -> Track:
        artists = ", ".join([a["name"] for a in sp_track.get("artists", [])])
        album = sp_track.get("album", {})
        album_name = album.get("name")
        images = album.get("images", [])
        cover_url = images[0]["url"] if images else None

        duration_sec = (sp_track.get("duration_ms") or 0) // 1000
        track_id = sp_track.get("id")

        return Track(
            id=track_id or "",
            title=sp_track.get("name", "Без названия"),
            artist=artists or "Неизвестный исполнитель",
            album=album_name,
            duration=duration_sec,
            cover_url=cover_url,
            platform=PlatformEnum.SPOTIFY,
            stream_url=sp_track.get("preview_url"),
            is_playable=bool(sp_track.get("preview_url")),
            original_uri=sp_track.get("uri") or f"spotify:track:{track_id}"
        )

    def get_favorites(self) -> List[Track]:
        if not self.is_authenticated():
            return []
        try:
            results = self.sp.current_user_saved_tracks(limit=50)
            items = results.get("items", [])
            return [self._convert_track(item["track"]) for item in items if "track" in item]
        except Exception as e:
            logger.error(f"Ошибка получения избранного Spotify: {e}")
            return []

    def get_playlists(self) -> List[Playlist]:
        if not self.is_authenticated():
            return []
        try:
            result = [
                Playlist(
                    id="favorites",
                    title="Любимые треки Spotify",
                    description="Сохранённые треки медиатеки",
                    cover_url="https://misc.scdn.co/liked-songs/liked-songs-300.png",
                    track_count=0,
                    platform=PlatformEnum.SPOTIFY
                )
            ]
            playlists = self.sp.current_user_playlists(limit=50)
            for p in playlists.get("items", []):
                images = p.get("images") or []
                cover = images[0]["url"] if images else None
                result.append(Playlist(
                    id=p["id"],
                    title=p.get("name", "Плейлист"),
                    description=p.get("description", ""),
                    cover_url=cover,
                    track_count=p.get("tracks", {}).get("total", 0),
                    platform=PlatformEnum.SPOTIFY
                ))
            return result
        except Exception as e:
            logger.error(f"Ошибка получения плейлистов Spotify: {e}")
            return []

    def get_playlist_tracks(self, playlist_id: str) -> List[Track]:
        if not self.is_authenticated():
            return []
        if playlist_id == "favorites":
            return self.get_favorites()
        try:
            results = self.sp.playlist_items(playlist_id, limit=100)
            items = results.get("items", [])
            return [self._convert_track(item["track"]) for item in items if item.get("track")]
        except Exception as e:
            logger.error(f"Ошибка получения треков плейлиста Spotify: {e}")
            return []

    @api_retry
    def search_tracks(self, query: str, limit: int = 10) -> List[Track]:
        if not self.is_authenticated():
            return []
        try:
            results = self.sp.search(q=query, type="track", limit=limit)
            items = results.get("tracks", {}).get("items", [])
            return [self._convert_track(t) for t in items]
        except Exception as e:
            logger.error(f"Ошибка поиска в Spotify: {e}")
            raise

    def create_playlist(self, title: str, description: str = "") -> Optional[Playlist]:
        if not self.is_authenticated():
            return None
        try:
            new_pl = self.sp.user_playlist_create(
                user=self.user_id,
                name=title,
                public=False,
                description=description or "Перенесено с помощью Harmonix"
            )
            return Playlist(
                id=new_pl["id"],
                title=new_pl["name"],
                description=new_pl.get("description", ""),
                track_count=0,
                platform=PlatformEnum.SPOTIFY
            )
        except Exception as e:
            logger.error(f"Ошибка создания плейлиста в Spotify: {e}")
            return None

    @api_retry
    def add_tracks_to_playlist(self, playlist_id: str, tracks: List[Track]) -> int:
        if not self.is_authenticated() or not tracks:
            return 0
        try:
            uris = [t.original_uri for t in tracks if t.original_uri]
            # Spotify API принимает пачками до 100 треков
            batch_size = 100
            total_added = 0
            for i in range(0, len(uris), batch_size):
                batch = uris[i:i + batch_size]
                if playlist_id == "favorites":
                    track_ids = [u.split(":")[-1] for u in batch]
                    self.sp.current_user_saved_tracks_add(tracks=track_ids)
                else:
                    self.sp.playlist_add_items(playlist_id=playlist_id, items=batch)
                total_added += len(batch)
            return total_added
        except Exception as e:
            logger.error(f"Ошибка добавления треков в Spotify: {e}")
            raise

    def get_stream_url(self, track_id: str) -> Optional[str]:
        if not self.is_authenticated():
            return None
        try:
            track = self.sp.track(track_id)
            return track.get("preview_url")
        except Exception as e:
            logger.error(f"Ошибка получения аудио Spotify: {e}")
            return None
