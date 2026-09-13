from abc import ABC, abstractmethod
from typing import List, Optional, Tuple
from app.models import Playlist, Track, PlatformEnum, RelatedArtist


class BasePlatformAdapter(ABC):
    platform: PlatformEnum

    @abstractmethod
    def is_authenticated(self) -> bool:
        """Проверяет, авторизован ли адаптер"""
        pass

    @abstractmethod
    def get_user_info(self) -> Tuple[bool, Optional[str]]:
        """Возвращает статус авторизации и имя пользователя"""
        pass

    @abstractmethod
    def get_playlists(self) -> List[Playlist]:
        """Возвращает список плейлистов пользователя"""
        pass

    @abstractmethod
    def get_playlist_tracks(self, playlist_id: str) -> List[Track]:
        """Возвращает треки из конкретного плейлиста"""
        pass

    @abstractmethod
    def get_favorites(self) -> List[Track]:
        """Возвращает избранные треки пользователя"""
        pass

    @abstractmethod
    def search_tracks(self, query: str, limit: int = 10) -> List[Track]:
        """Ищет треки по запросу"""
        pass

    @abstractmethod
    def create_playlist(self, title: str, description: str = "") -> Optional[Playlist]:
        """Создает новый плейлист в сервисе"""
        pass

    @abstractmethod
    def add_tracks_to_playlist(self, playlist_id: str, tracks: List[Track]) -> int:
        """Добавляет треки в плейлист. Возвращает количество успешно добавленных."""
        pass

    @abstractmethod
    def get_stream_url(self, track_id: str) -> Optional[str]:
        """Возвращает прямую ссылку на аудиопоток для воспроизведения"""
        pass

    def get_wave_tracks(self, limit: int = 20) -> List[Track]:
        """Возвращает поток персональных треков («Моя волна»)"""
        return []

    def get_similar_tracks(self, track_id: str, limit: int = 20) -> List[Track]:
        """Возвращает треки, похожие на указанный трек"""
        return []

    def get_personal_recommendations(self, limit: int = 30) -> List[Track]:
        """Возвращает персональные рекомендации пользователя"""
        return []

    def get_related_artists(self, artist_id_or_name: str, limit: int = 15) -> List[RelatedArtist]:
        """Возвращает похожих исполнителей"""
        return []
