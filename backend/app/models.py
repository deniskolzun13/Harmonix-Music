from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class PlatformEnum(str, Enum):
    YANDEX = "yandex"
    VK = "vk"
    SPOTIFY = "spotify"
    LOCAL = "local"
    YOUTUBE = "youtube"


class Track(BaseModel):
    id: str
    title: str
    artist: str
    album: Optional[str] = None
    duration: int = 0  # in seconds
    cover_url: Optional[str] = None
    platform: PlatformEnum
    stream_url: Optional[str] = None
    is_playable: bool = True
    original_uri: Optional[str] = None


class Playlist(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    cover_url: Optional[str] = None
    track_count: int = 0
    platform: PlatformEnum


class RelatedArtist(BaseModel):
    id: str
    name: str
    cover_url: Optional[str] = None
    genres: List[str] = Field(default_factory=list)
    popularity: Optional[int] = None
    platform: PlatformEnum = PlatformEnum.SPOTIFY


class AuthConfig(BaseModel):
    yandex_token: Optional[str] = None
    vk_token: Optional[str] = None
    spotify_token: Optional[str] = None
    spotify_client_id: Optional[str] = None
    spotify_client_secret: Optional[str] = None
    spotify_refresh_token: Optional[str] = None
    spotify_redirect_uri: Optional[str] = "http://localhost:8000/api/auth/spotify/callback"
    youtube_oauth_json: Optional[str] = None


class AuthStatus(BaseModel):
    yandex: bool = False
    yandex_username: Optional[str] = None
    vk: bool = False
    vk_username: Optional[str] = None
    spotify: bool = False
    spotify_username: Optional[str] = None
    youtube: bool = False
    youtube_username: Optional[str] = None


class TransferRequest(BaseModel):
    source_platform: PlatformEnum
    target_platform: PlatformEnum
    source_playlist_id: str
    target_playlist_name: Optional[str] = None
    create_new: bool = True


class TransferTrackResult(BaseModel):
    source_track: Track
    matched_track: Optional[Track] = None
    confidence: float = 0.0
    status: str = "matched"  # matched, pending_review, rejected, not_found, error
    error_detail: Optional[str] = None


class TransferTask(BaseModel):
    task_id: str
    source_platform: PlatformEnum
    target_platform: PlatformEnum
    status: str = "queued"  # queued, running, waiting_review, completed, failed
    total: int = 0
    processed: int = 0
    matched: int = 0
    failed: int = 0
    target_playlist_url: Optional[str] = None
    target_playlist_name: Optional[str] = None
    target_playlist_id: Optional[str] = None
    results: List[TransferTrackResult] = Field(default_factory=list)
    message: str = "Задача ожидает запуска"


class ConfirmTransferRequest(BaseModel):
    confirmed_track_ids: List[str]


class TransferHistoryItem(BaseModel):
    task_id: str
    source_platform: PlatformEnum
    target_platform: PlatformEnum
    status: str
    total_tracks: int = 0
    matched_tracks: int = 0
    failed_tracks: int = 0
    target_playlist_name: Optional[str] = None
    created_at: float
    updated_at: float


class TransferHistoryResponse(BaseModel):
    total: int
    limit: int
    offset: int
    items: List[TransferHistoryItem]
