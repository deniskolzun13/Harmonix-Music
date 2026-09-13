export type Platform = 'yandex' | 'vk' | 'spotify' | 'local';

export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  cover_url?: string;
  platform: Platform;
  stream_url?: string;
  is_playable: boolean;
  original_uri?: string;
  isPreview?: boolean;
}

export interface Playlist {
  id: string;
  title: string;
  description?: string;
  cover_url?: string;
  track_count: number;
  platform: Platform;
}

export interface AuthStatus {
  yandex: boolean;
  yandex_username?: string;
  vk: boolean;
  vk_username?: string;
  spotify: boolean;
  spotify_username?: string;
}

export interface AuthConfig {
  yandex_token?: string;
  vk_token?: string;
  spotify_token?: string;
  spotify_client_id?: string;
  spotify_client_secret?: string;
  spotify_refresh_token?: string;
}

export interface NetworkInfo {
  local_ip: string;
  port: number;
  mobile_url: string;
  qr_code: string;
}

export interface TransferTrackResult {
  source_track: Track;
  matched_track?: Track;
  confidence: number;
  status: 'matched' | 'low_confidence' | 'pending_review' | 'rejected' | 'not_found' | 'error';
  error_detail?: string;
}

export interface TransferTask {
  task_id: string;
  source_platform: Platform;
  target_platform: Platform;
  status: 'queued' | 'running' | 'waiting_review' | 'completed' | 'failed';
  total: number;
  processed: number;
  matched: number;
  failed: number;
  target_playlist_url?: string;
  target_playlist_name?: string;
  target_playlist_id?: string;
  created_at?: string;
  results: TransferTrackResult[];
  message: string;
}

export interface TransferHistoryResponse {
  total: number;
  limit: number;
  offset: number;
  items: TransferTask[];
}

export interface ArtistSummary {
  name: string;
  cover_url?: string;
  photo_url?: string;
  banner_url?: string;
  description?: string;
  short_description?: string;
  genres?: string[];
  trackCount: number;
  totalDuration: number;
  tracks: Track[];
}

export interface ArtistProfileInfo {
  name: string;
  photo_url?: string;
  banner_url?: string;
  description?: string;
  short_description?: string;
  genres?: string[];
}

export interface RelatedArtist {
  id: string;
  name: string;
  cover_url?: string;
  genres: string[];
  popularity?: number;
  platform: Platform;
}
