import logging
from typing import List, Optional, Tuple
from app.models import Playlist, Track, PlatformEnum, RelatedArtist
from app.platforms.base import BasePlatformAdapter

logger = logging.getLogger("harmonix.demo")

# Открытые аудиодорожки для демонстрационного воспроизведения и тестирования
DEMO_TRACKS_YANDEX = [
    Track(
        id="demo_ym_1",
        title="Midnight City",
        artist="M83",
        album="Hurry Up, We're Dreaming",
        duration=243,
        cover_url="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=400&fit=crop",
        platform=PlatformEnum.YANDEX,
        stream_url="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        is_playable=True,
        original_uri="yandex:track:demo_1"
    ),
    Track(
        id="demo_ym_2",
        title="Starboy",
        artist="The Weeknd, Daft Punk",
        album="Starboy",
        duration=230,
        cover_url="https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=400&fit=crop",
        platform=PlatformEnum.YANDEX,
        stream_url="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
        is_playable=True,
        original_uri="yandex:track:demo_2"
    ),
    Track(
        id="demo_ym_3",
        title="In the End",
        artist="Linkin Park",
        album="Hybrid Theory",
        duration=216,
        cover_url="https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop",
        platform=PlatformEnum.YANDEX,
        stream_url="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
        is_playable=True,
        original_uri="yandex:track:demo_3"
    ),
    Track(
        id="demo_ym_4",
        title="Где нас нет",
        artist="Oxxxymiron",
        album="Горгород",
        duration=264,
        cover_url="https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=400&h=400&fit=crop",
        platform=PlatformEnum.YANDEX,
        stream_url="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
        is_playable=True,
        original_uri="yandex:track:demo_4"
    ),
    Track(
        id="demo_ym_5",
        title="Комета",
        artist="JONY",
        album="Список твоих мыслей",
        duration=168,
        cover_url="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&h=400&fit=crop",
        platform=PlatformEnum.YANDEX,
        stream_url="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
        is_playable=True,
        original_uri="yandex:track:demo_5"
    ),
]

DEMO_TRACKS_VK = [
    Track(
        id="demo_vk_1",
        title="Midnight City (Radio Edit)",
        artist="M83",
        album="Midnight City EP",
        duration=240,
        cover_url="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=400&fit=crop",
        platform=PlatformEnum.VK,
        stream_url="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        is_playable=True,
        original_uri="vk:audio:demo_vk_1"
    ),
    Track(
        id="demo_vk_2",
        title="Starboy [feat. Daft Punk]",
        artist="The Weeknd",
        album="Starboy Deluxe",
        duration=230,
        cover_url="https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=400&fit=crop",
        platform=PlatformEnum.VK,
        stream_url="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
        is_playable=True,
        original_uri="vk:audio:demo_vk_2"
    ),
    Track(
        id="demo_vk_3",
        title="In the End (2020 Remaster)",
        artist="Linkin Park",
        album="Hybrid Theory 20th",
        duration=216,
        cover_url="https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop",
        platform=PlatformEnum.VK,
        stream_url="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
        is_playable=True,
        original_uri="vk:audio:demo_vk_3"
    ),
    Track(
        id="demo_vk_4",
        title="Где нас нет",
        artist="Oxxxymiron",
        album="Горгород",
        duration=264,
        cover_url="https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=400&h=400&fit=crop",
        platform=PlatformEnum.VK,
        stream_url="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
        is_playable=True,
        original_uri="vk:audio:demo_vk_4"
    ),
    Track(
        id="demo_vk_5",
        title="Комета",
        artist="JONY",
        album="Список твоих мыслей",
        duration=168,
        cover_url="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&h=400&fit=crop",
        platform=PlatformEnum.VK,
        stream_url="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
        is_playable=True,
        original_uri="vk:audio:demo_vk_5"
    ),
]

DEMO_TRACKS_SPOTIFY = [
    Track(
        id="demo_sp_1",
        title="Midnight City",
        artist="M83",
        album="Hurry Up, We're Dreaming",
        duration=243,
        cover_url="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=400&fit=crop",
        platform=PlatformEnum.SPOTIFY,
        stream_url="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        is_playable=True,
        original_uri="spotify:track:demo_sp_1"
    ),
    Track(
        id="demo_sp_2",
        title="Starboy",
        artist="The Weeknd, Daft Punk",
        album="Starboy",
        duration=230,
        cover_url="https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=400&fit=crop",
        platform=PlatformEnum.SPOTIFY,
        stream_url="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
        is_playable=True,
        original_uri="spotify:track:demo_sp_2"
    ),
    Track(
        id="demo_sp_3",
        title="In the End",
        artist="Linkin Park",
        album="Hybrid Theory",
        duration=216,
        cover_url="https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop",
        platform=PlatformEnum.SPOTIFY,
        stream_url="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
        is_playable=True,
        original_uri="spotify:track:demo_sp_3"
    ),
]

class DemoPlatformAdapter(BasePlatformAdapter):
    def __init__(self, platform: PlatformEnum):
        self.platform = platform
        self.playlists = [
            Playlist(
                id="favorites",
                title=f"Любимые треки ({platform.value.upper()})",
                description="Демонстрационный плейлист для мгновенного тестирования",
                cover_url="https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=400&fit=crop",
                track_count=5,
                platform=platform
            ),
            Playlist(
                id="hits",
                title=f"Топ Хиты ({platform.value.upper()})",
                description="Популярные треки",
                cover_url="https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=400&fit=crop",
                track_count=3,
                platform=platform
            )
        ]
        self.tracks_db = (
            DEMO_TRACKS_YANDEX if platform == PlatformEnum.YANDEX
            else DEMO_TRACKS_VK if platform == PlatformEnum.VK
            else DEMO_TRACKS_SPOTIFY
        )

    def is_authenticated(self) -> bool:
        return True

    def get_user_info(self) -> Tuple[bool, Optional[str]]:
        return True, f"Демо Режим ({self.platform.value})"

    def get_playlists(self) -> List[Playlist]:
        return self.playlists

    def get_playlist_tracks(self, playlist_id: str) -> List[Track]:
        return self.tracks_db

    def get_favorites(self) -> List[Track]:
        return self.tracks_db

    def search_tracks(self, query: str, limit: int = 10) -> List[Track]:
        q = query.lower()
        results = [
            t for t in self.tracks_db
            if q in t.title.lower() or q in t.artist.lower()
        ]
        return results if results else self.tracks_db[:limit]

    def create_playlist(self, title: str, description: str = "") -> Optional[Playlist]:
        new_pl = Playlist(
            id=f"custom_{len(self.playlists) + 1}",
            title=title,
            description=description,
            track_count=0,
            platform=self.platform
        )
        self.playlists.append(new_pl)
        return new_pl

    def add_tracks_to_playlist(self, playlist_id: str, tracks: List[Track]) -> int:
        for t in tracks:
            # Создаем копию под платформу
            adapted = Track(
                id=f"{self.platform.value}_{t.id}",
                title=t.title,
                artist=t.artist,
                album=t.album,
                duration=t.duration,
                cover_url=t.cover_url,
                platform=self.platform,
                stream_url="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
                is_playable=True,
                original_uri=f"{self.platform.value}:{t.id}"
            )
            self.tracks_db.append(adapted)
        return len(tracks)

    def get_stream_url(self, track_id: str) -> Optional[str]:
        for t in self.tracks_db:
            if t.id == track_id and t.stream_url:
                return t.stream_url
        return "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"

    def get_wave_tracks(self, limit: int = 20) -> List[Track]:
        return self.tracks_db[:limit]

    def get_similar_tracks(self, track_id: str, limit: int = 20) -> List[Track]:
        return [t for t in self.tracks_db if t.id != track_id][:limit]

    def get_personal_recommendations(self, limit: int = 30) -> List[Track]:
        return self.tracks_db[:limit]

    def get_related_artists(self, artist_id_or_name: str, limit: int = 15) -> List[RelatedArtist]:
        return [
            RelatedArtist(id="rel_1", name="The Weeknd", genres=["r&b", "pop"], popularity=95, platform=PlatformEnum.SPOTIFY),
            RelatedArtist(id="rel_2", name="Daft Punk", genres=["electro", "synthpop"], popularity=88, platform=PlatformEnum.SPOTIFY),
            RelatedArtist(id="rel_3", name="M83", genres=["shoegaze", "synthpop"], popularity=80, platform=PlatformEnum.SPOTIFY),
            RelatedArtist(id="rel_4", name="Linkin Park", genres=["rock", "alternative"], popularity=92, platform=PlatformEnum.SPOTIFY),
        ][:limit]
