import logging
from typing import List, Optional, Tuple
from app.models import Playlist, Track, PlatformEnum
from app.platforms.base import BasePlatformAdapter
from app.utils.retry_helper import api_retry

logger = logging.getLogger("harmonix.yandex")

class YandexMusicAdapter(BasePlatformAdapter):
    platform = PlatformEnum.YANDEX

    def __init__(self, token: Optional[str] = None):
        self.token = token
        self.client = None
        self._me = None
        if token:
            self._init_client()

    def _init_client(self):
        try:
            from yandex_music import Client
            self.client = Client(self.token).init()
            self._me = self.client.me
        except Exception as e:
            logger.warning(f"Ошибка инициализации Яндекс Музыки: {e}")
            self.client = None
            self._me = None

    def update_token(self, token: str):
        self.token = token
        self._init_client()

    def is_authenticated(self) -> bool:
        return self.client is not None and self._me is not None

    def get_user_info(self) -> Tuple[bool, Optional[str]]:
        if not self.is_authenticated():
            return False, None
        try:
            name = (
                self._me.account.full_name
                or self._me.account.display_name
                or self._me.account.login
                or "Яндекс Пользователь"
            )
            return True, name
        except Exception:
            return True, "Пользователь Яндекс"

    def _convert_track(self, ym_track) -> Track:
        artists = ", ".join([a.name for a in ym_track.artists]) if ym_track.artists else "Неизвестный исполнитель"
        album = ym_track.albums[0].title if ym_track.albums else None
        
        cover_url = None
        if ym_track.cover_uri:
            cover_url = f"https://{ym_track.cover_uri.replace('%%', '400x400')}"

        duration_sec = (ym_track.duration_ms or 0) // 1000

        return Track(
            id=str(ym_track.id),
            title=ym_track.title or "Без названия",
            artist=artists,
            album=album,
            duration=duration_sec,
            cover_url=cover_url,
            platform=PlatformEnum.YANDEX,
            is_playable=True,
            original_uri=f"yandex:track:{ym_track.id}"
        )

    def get_favorites(self) -> List[Track]:
        if not self.is_authenticated():
            return []
        try:
            likes = self.client.users_likes_tracks()
            if not likes:
                return []
            tracks_ids = [t.id for t in likes.tracks[:200]]  # до 200 последних
            ym_tracks = self.client.tracks(tracks_ids)
            return [self._convert_track(t) for t in ym_tracks if t]
        except Exception as e:
            logger.error(f"Ошибка получения избранного Яндекс: {e}")
            return []

    def get_playlists(self) -> List[Playlist]:
        if not self.is_authenticated():
            return []
        try:
            result = [
                Playlist(
                    id="favorites",
                    title="Любимые треки (Мне нравится)",
                    description="Все отмеченные лайком треки",
                    cover_url="https://music.yandex.ru/blocks/playlist-cover/playlist-cover_like_light.png",
                    track_count=len(self.client.users_likes_tracks().tracks or []),
                    platform=PlatformEnum.YANDEX
                )
            ]
            user_playlists = self.client.users_playlists_list()
            for p in user_playlists:
                cover = None
                if p.cover and p.cover.uri:
                    cover = f"https://{p.cover.uri.replace('%%', '400x400')}"
                result.append(Playlist(
                    id=str(p.kind),
                    title=p.title or "Плейлист",
                    description=p.description or "",
                    cover_url=cover,
                    track_count=p.track_count or 0,
                    platform=PlatformEnum.YANDEX
                ))
            return result
        except Exception as e:
            logger.error(f"Ошибка получения плейлистов Яндекс: {e}")
            return []

    def get_playlist_tracks(self, playlist_id: str) -> List[Track]:
        if not self.is_authenticated():
            return []
        if playlist_id == "favorites":
            return self.get_favorites()
        try:
            pl = self.client.users_playlists(int(playlist_id), self._me.account.uid)
            if not pl or not pl.tracks:
                return []
            track_ids = [t.id for t in pl.tracks]
            ym_tracks = self.client.tracks(track_ids)
            return [self._convert_track(t) for t in ym_tracks if t]
        except Exception as e:
            logger.error(f"Ошибка получения треков плейлиста Яндекс {playlist_id}: {e}")
            return []

    @api_retry
    def search_tracks(self, query: str, limit: int = 10) -> List[Track]:
        if not self.is_authenticated():
            return []
        try:
            search_res = self.client.search(query, type_="track")
            if not search_res or not search_res.tracks:
                return []
            return [self._convert_track(t) for t in search_res.tracks.results[:limit]]
        except Exception as e:
            logger.error(f"Ошибка поиска Яндекс Музыка: {e}")
            raise

    def create_playlist(self, title: str, description: str = "") -> Optional[Playlist]:
        if not self.is_authenticated():
            return None
        try:
            pl = self.client.users_playlists_create(title)
            return Playlist(
                id=str(pl.kind),
                title=pl.title,
                description=description,
                track_count=0,
                platform=PlatformEnum.YANDEX
            )
        except Exception as e:
            logger.error(f"Ошибка создания плейлиста Яндекс: {e}")
            return None

    @api_retry
    def add_tracks_to_playlist(self, playlist_id: str, tracks: List[Track]) -> int:
        if not self.is_authenticated() or not tracks:
            return 0
        added = 0
        try:
            kind = int(playlist_id)
            for tr in tracks:
                try:
                    # В яндексе требуется передать id трека и id альбома
                    # Найдем трек в клиенте для получения album_id
                    ym_t = self.client.tracks([tr.id])[0]
                    album_id = ym_t.albums[0].id if ym_t.albums else None
                    if album_id:
                        self.client.users_playlists_insert_track(kind, ym_t.id, album_id)
                        added += 1
                except Exception as ex:
                    logger.debug(f"Не удалось добавить трек {tr.id} в Яндекс: {ex}")
                    raise
            return added
        except Exception as e:
            logger.error(f"Ошибка добавления треков в Яндекс: {e}")
            raise

    def get_stream_url(self, track_id: str) -> Optional[str]:
        if not self.is_authenticated():
            return None
        try:
            ym_tracks = self.client.tracks([track_id])
            if not ym_tracks:
                return None
            track = ym_tracks[0]
            download_info = track.get_download_info()
            if not download_info:
                return None
            # Предпочитаем mp3 с максимальным битрейтом
            mp3_infos = [d for d in download_info if d.codec == 'mp3']
            selected_info = sorted(mp3_infos or download_info, key=lambda x: x.bitrate_in_kbps, reverse=True)[0]
            return selected_info.get_direct_link()
        except Exception as e:
            logger.error(f"Ошибка получения прямой ссылки аудио Яндекс: {e}")
            return None

    def get_wave_tracks(self, limit: int = 20) -> List[Track]:
        """Возвращает поток персональных треков («Моя волна»)"""
        if not self.is_authenticated():
            return []
        try:
            station_res = self.client.rotor_station_tracks('user:onyourwave')
            if not station_res or not station_res.sequence:
                return []
            tracks = []
            for item in station_res.sequence:
                if item.track:
                    tracks.append(self._convert_track(item.track))
                if len(tracks) >= limit:
                    break
            return tracks
        except Exception as e:
            logger.error(f"Ошибка получения «Моей волны» Яндекс: {e}")
            return []

    def get_similar_tracks(self, track_id: str, limit: int = 20) -> List[Track]:
        """Возвращает треки, похожие на указанный трек"""
        if not self.is_authenticated():
            return []
        try:
            sim = self.client.tracks_similar(track_id)
            if not sim or not sim.similar_tracks:
                return []
            return [self._convert_track(t) for t in sim.similar_tracks[:limit] if t]
        except Exception as e:
            logger.error(f"Ошибка получения похожих треков Яндекс: {e}")
            return []
