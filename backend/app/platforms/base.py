from abc import ABC, abstractmethod
from typing import List, Optional, Tuple
from app.models import Playlist, Track, PlatformEnum


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
