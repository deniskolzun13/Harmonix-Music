import re
import json
import logging
import httpx
from typing import Tuple, List, Optional
from fastapi import HTTPException

from app.models import Playlist, Track, PlatformEnum
from app.platforms.manager import manager

logger = logging.getLogger("harmonix.importer")


class UrlImporterService:
    """
    Сервис распознавания и загрузки плейлистов, альбомов и треков по ссылкам:
    - Яндекс Музыка (music.yandex.ru/users/.../playlists/... или /album/...)
    - ВКонтакте (vk.com/audio?z=audio_playlist... или /music/playlist/...)
    - Spotify (open.spotify.com/playlist/... или /album/...)
    """

    def __init__(self):
        self._ym_client = None

    def _get_ym_client(self):
        # Если авторизован пользовательский адаптер - используем его
        ym_adapter = manager.adapters.get(PlatformEnum.YANDEX)
        if ym_adapter and ym_adapter.is_authenticated():
            return ym_adapter.client

        # Иначе инициализируем анонимный клиент для публичных плейлистов
        if self._ym_client is None:
            try:
                from yandex_music import Client
                self._ym_client = Client().init()
            except Exception as e:
                logger.error(f"Не удалось инициализировать Yandex Music Client: {e}")
        return self._ym_client

    async def import_from_url(self, url: str) -> Tuple[Playlist, List[Track]]:
        clean_url = url.strip()
        if not clean_url:
            raise HTTPException(status_code=400, detail="Укажите ссылку")

        if "yandex." in clean_url or "ya.ru" in clean_url:
            return await self._import_yandex(clean_url)
        elif "vk.com" in clean_url or "vk.ru" in clean_url:
            return await self._import_vk(clean_url)
        elif "spotify.com" in clean_url:
            return await self._import_spotify(clean_url)
        else:
            raise HTTPException(
                status_code=400,
                detail="Неподдерживаемый сервис. Поддерживаются ссылки Яндекс Музыки, VK Музыки и Spotify."
            )

    async def _import_yandex(self, url: str) -> Tuple[Playlist, List[Track]]:
        client = self._get_ym_client()
        if not client:
            raise HTTPException(status_code=503, detail="Сервис Яндекс Музыки временно недоступен")

        # 1. Плейлист пользователя: /users/{user}/playlists/{kind}
        pl_match = re.search(r"/users/([^/]+)/playlists/(\d+)", url)
        if pl_match:
            user_login = pl_match.group(1)
            kind = int(pl_match.group(2))
            try:
                ym_pl = client.users_playlists(kind, user_login)
                if not ym_pl:
                    raise HTTPException(status_code=404, detail="Плейлист Яндекс Музыки не найден или закрыт настройками приватности")
                
                cover = None
                if ym_pl.cover and ym_pl.cover.uri:
                    cover = f"https://{ym_pl.cover.uri.replace('%%', '400x400')}"

                playlist = Playlist(
                    id=f"ym_pl_{kind}",
                    title=ym_pl.title or "Плейлист Яндекс",
                    description=ym_pl.description or f"Автор: {user_login}",
                    cover_url=cover,
                    track_count=ym_pl.track_count or len(ym_pl.tracks or []),
                    platform=PlatformEnum.YANDEX
                )

                tracks = []
                if ym_pl.tracks:
                    track_ids = [t.id for t in ym_pl.tracks]
                    # Яндекс отдает треки батчами до 100
                    for i in range(0, len(track_ids), 100):
                        batch_ids = track_ids[i:i+100]
                        ym_tracks = client.tracks(batch_ids)
                        for t in ym_tracks:
                            if t:
                                tracks.append(self._convert_ym_track(t))

                return playlist, tracks
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Ошибка парсинга плейлиста Яндекс: {e}")
                raise HTTPException(status_code=400, detail=f"Ошибка загрузки плейлиста Яндекс: {str(e)}")

        # 1b. Прямая ссылка на плейлист по UUID или идентификатору: /playlists/([a-zA-Z0-9_.-]+)
        pl_uuid_match = re.search(r"/playlists/([a-zA-Z0-9_.-]+)", url)
        if pl_uuid_match:
            uuid_str = pl_uuid_match.group(1).rstrip('/')
            try:
                ym_pl = None
                try:
                    ym_pl = client.playlist(uuid_str)
                except Exception:
                    pass

                if not ym_pl and uuid_str.isdigit():
                    try:
                        ym_pl = client.users_playlists(int(uuid_str))
                    except Exception:
                        pass

                if not ym_pl and '.' in uuid_str:
                    try:
                        ym_pl = client.playlist(uuid_str.split('.', 1)[1])
                    except Exception:
                        pass

                if not ym_pl:
                    raise HTTPException(
                        status_code=404,
                        detail="Плейлист не найден. Убедитесь, что ссылка скопирована полностью и плейлист открыт в настройках приватности Яндекс Музыки."
                    )

                cover = None
                if ym_pl.cover and ym_pl.cover.uri:
                    cover = f"https://{ym_pl.cover.uri.replace('%%', '400x400')}"

                playlist = Playlist(
                    id=f"ym_pl_{getattr(ym_pl, 'playlist_uuid', None) or uuid_str}",
                    title=ym_pl.title or "Плейлист Яндекс",
                    description=ym_pl.description or "Плейлист Яндекс Музыки",
                    cover_url=cover,
                    track_count=ym_pl.track_count or len(ym_pl.tracks or []),
                    platform=PlatformEnum.YANDEX
                )

                tracks = []
                if ym_pl.tracks:
                    track_ids = []
                    for t in ym_pl.tracks:
                        if hasattr(t, 'id') and t.id:
                            track_ids.append(t.id)
                        elif hasattr(t, 'track_id') and t.track_id:
                            track_ids.append(t.track_id)
                        elif hasattr(t, 'track') and t.track and hasattr(t.track, 'id'):
                            track_ids.append(t.track.id)

                    for i in range(0, len(track_ids), 100):
                        batch_ids = track_ids[i:i+100]
                        ym_tracks = client.tracks(batch_ids)
                        for t in ym_tracks:
                            if t:
                                tracks.append(self._convert_ym_track(t))

                return playlist, tracks
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Ошибка парсинга плейлиста Яндекс по UUID {uuid_str}: {e}")
                raise HTTPException(status_code=400, detail=f"Ошибка загрузки плейлиста: {str(e)}")

        # 2. Альбом с треком: /album/{album_id}/track/{track_id}
        track_match = re.search(r"/album/(\d+)/track/(\d+)", url) or re.search(r"/track/(\d+)", url)
        if track_match:
            track_id = track_match.group(2) if track_match.lastindex and track_match.lastindex >= 2 else track_match.group(1)
            try:
                ym_tracks = client.tracks([int(track_id)])
                if not ym_tracks or not ym_tracks[0]:
                    raise HTTPException(status_code=404, detail="Трек Яндекс Музыки не найден")
                tr = self._convert_ym_track(ym_tracks[0])
                playlist = Playlist(
                    id=f"ym_single_{track_id}",
                    title=f"Трек: {tr.title}",
                    description=f"{tr.artist} • Сингл",
                    cover_url=tr.cover_url,
                    track_count=1,
                    platform=PlatformEnum.YANDEX
                )
                return playlist, [tr]
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Ошибка загрузки трека Яндекс: {str(e)}")

        # 3. Альбом: /album/{album_id}
        album_match = re.search(r"/album/(\d+)", url)
        if album_match:
            album_id = int(album_match.group(1))
            try:
                album = client.albums_with_tracks(album_id)
                if not album:
                    raise HTTPException(status_code=404, detail="Альбом Яндекс Музыки не найден")

                cover = None
                if album.cover_uri:
                    cover = f"https://{album.cover_uri.replace('%%', '400x400')}"

                artists = ", ".join([a.name for a in album.artists]) if album.artists else ""
                tracks = []
                for vol in album.volumes or []:
                    for t in vol:
                        tracks.append(self._convert_ym_track(t))

                playlist = Playlist(
                    id=f"ym_album_{album_id}",
                    title=album.title or "Альбом Яндекс",
                    description=f"Альбом • {artists} ({album.year or ''})",
                    cover_url=cover,
                    track_count=len(tracks),
                    platform=PlatformEnum.YANDEX
                )
                return playlist, tracks
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Ошибка загрузки альбома Яндекс: {str(e)}")

        raise HTTPException(status_code=400, detail="Не удалось распознать ссылку Яндекс Музыки")

    def _convert_ym_track(self, ym_track) -> Track:
        artists = ", ".join([a.name for a in ym_track.artists]) if ym_track.artists else "Неизвестный исполнитель"
        album = ym_track.albums[0].title if ym_track.albums else None
        cover = f"https://{ym_track.cover_uri.replace('%%', '400x400')}" if ym_track.cover_uri else None
        duration = (ym_track.duration_ms or 0) // 1000

        return Track(
            id=str(ym_track.id),
            title=ym_track.title or "Без названия",
            artist=artists,
            album=album,
            duration=duration,
            cover_url=cover,
            platform=PlatformEnum.YANDEX,
            stream_url=f"/api/stream/yandex/{ym_track.id}",
            is_playable=True,
            original_uri=f"yandex:track:{ym_track.id}"
        )

    async def _import_vk(self, url: str) -> Tuple[Playlist, List[Track]]:
        # Паттерн плейлиста VK: audio_playlist-12345_67890 или music/playlist/-12345_67890_accesskey
        pl_match = re.search(r"(?:audio_playlist|music/playlist/)(-?\d+)_(\d+)(?:[_%2F]([a-zA-Z0-9]+))?", url)
        vk_adapter = manager.adapters.get(PlatformEnum.VK)

        if pl_match:
            owner_id = int(pl_match.group(1))
            playlist_id = int(pl_match.group(2))
            access_key = pl_match.group(3)

            if vk_adapter and vk_adapter.is_authenticated():
                params = {"owner_id": owner_id, "playlist_id": playlist_id, "count": 100}
                if access_key:
                    params["access_key"] = access_key
                resp = vk_adapter._call_api("audio.get", params)
                items = resp.get("items", []) if resp else []
                
                # Метаданные плейлиста
                pl_info = vk_adapter._call_api("audio.getPlaylistById", {
                    "owner_id": owner_id,
                    "playlist_id": playlist_id,
                    **({"access_key": access_key} if access_key else {})
                })
                title = "Плейлист VK"
                description = ""
                cover = None
                if pl_info:
                    title = pl_info.get("title", title)
                    description = pl_info.get("description", "")
                    if "photo" in pl_info:
                        cover = pl_info["photo"].get("photo_600") or pl_info["photo"].get("photo_300")

                tracks = [vk_adapter._convert_track(item) for item in items]
                for t in tracks:
                    t.stream_url = f"/api/stream/vk/{t.id}"

                playlist = Playlist(
                    id=f"vk_pl_{owner_id}_{playlist_id}",
                    title=title,
                    description=description,
                    cover_url=cover or "https://vk.com/images/audio_row_placeholder.png",
                    track_count=len(tracks),
                    platform=PlatformEnum.VK
                )
                return playlist, tracks

        # Одиночный аудио-трек VK: audio-12345_67890
        single_match = re.search(r"audio(-?\d+)_(\d+)", url)
        if single_match and vk_adapter and vk_adapter.is_authenticated():
            audio_id = f"{single_match.group(1)}_{single_match.group(2)}"
            resp = vk_adapter._call_api("audio.getById", {"audios": audio_id})
            if resp and len(resp) > 0:
                tr = vk_adapter._convert_track(resp[0])
                tr.stream_url = f"/api/stream/vk/{tr.id}"
                playlist = Playlist(
                    id=f"vk_single_{audio_id}",
                    title=tr.title,
                    description=f"{tr.artist} • Аудиозапись VK",
                    cover_url=tr.cover_url,
                    track_count=1,
                    platform=PlatformEnum.VK
                )
                return playlist, [tr]

        # Если VK не авторизован
        if not (vk_adapter and vk_adapter.is_authenticated()):
            raise HTTPException(
                status_code=400,
                detail="Для загрузки плейлистов ВКонтакте по ссылке требуется подключить токен VK в разделе 'Сервисы'."
            )

        raise HTTPException(status_code=400, detail="Не удалось распознать ссылку VK Музыки")

    async def _import_spotify(self, url: str) -> Tuple[Playlist, List[Track]]:
        # Паттерны: /playlist/{id}, /album/{id}, /track/{id}
        match = re.search(r"open\.spotify\.com/(playlist|album|track)/([a-zA-Z0-9]+)", url)
        if not match:
            raise HTTPException(status_code=400, detail="Неверный формат ссылки Spotify")

        entity_type = match.group(1)
        entity_id = match.group(2)

        # 1. Если подключен официальный Spotify клиент
        sp_adapter = manager.adapters.get(PlatformEnum.SPOTIFY)
        if sp_adapter and sp_adapter.is_authenticated():
            try:
                if entity_type == "playlist":
                    sp_pl = sp_adapter.sp.playlist(entity_id)
                    tracks = []
                    for item in sp_pl.get("tracks", {}).get("items", []):
                        t = item.get("track")
                        if t:
                            tracks.append(sp_adapter._convert_track(t))
                    for t in tracks:
                        t.stream_url = f"/api/stream/spotify/{t.id}"
                    
                    cover = sp_pl.get("images", [{}])[0].get("url") if sp_pl.get("images") else None
                    playlist = Playlist(
                        id=f"spotify_pl_{entity_id}",
                        title=sp_pl.get("name", "Плейлист Spotify"),
                        description=sp_pl.get("description", ""),
                        cover_url=cover,
                        track_count=len(tracks),
                        platform=PlatformEnum.SPOTIFY
                    )
                    return playlist, tracks

                elif entity_type == "album":
                    sp_alb = sp_adapter.sp.album(entity_id)
                    cover = sp_alb.get("images", [{}])[0].get("url") if sp_alb.get("images") else None
                    tracks = []
                    for t in sp_alb.get("tracks", {}).get("items", []):
                        if t:
                            converted = sp_adapter._convert_track(t)
                            if not converted.cover_url:
                                converted.cover_url = cover
                            converted.stream_url = f"/api/stream/spotify/{converted.id}"
                            tracks.append(converted)

                    playlist = Playlist(
                        id=f"spotify_album_{entity_id}",
                        title=sp_alb.get("name", "Альбом Spotify"),
                        description=f"Альбом • {sp_alb.get('artists', [{}])[0].get('name', '')}",
                        cover_url=cover,
                        track_count=len(tracks),
                        platform=PlatformEnum.SPOTIFY
                    )
                    return playlist, tracks

                elif entity_type == "track":
                    t = sp_adapter.sp.track(entity_id)
                    converted = sp_adapter._convert_track(t)
                    converted.stream_url = f"/api/stream/spotify/{converted.id}"
                    playlist = Playlist(
                        id=f"spotify_single_{entity_id}",
                        title=converted.title,
                        description=f"{converted.artist} • Трек Spotify",
                        cover_url=converted.cover_url,
                        track_count=1,
                        platform=PlatformEnum.SPOTIFY
                    )
                    return playlist, [converted]
            except Exception as e:
                logger.warning(f"Ошибка запроса через Spotipy, переключаемся на публичный скрапер: {e}")

        # 2. Публичный Embed Scraper (работает без API токенов для любых публичных плейлистов/альбомов!)
        embed_url = f"https://open.spotify.com/embed/{entity_type}/{entity_id}"
        async with httpx.AsyncClient(headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}, timeout=15.0) as client:
            try:
                resp = await client.get(embed_url)
                if resp.status_code != 200:
                    raise HTTPException(status_code=404, detail="Плейлист или трек Spotify не найден")
                
                m = re.search(r'<script id=.__NEXT_DATA__.[^>]*>(.*?)</script>', resp.text)
                if not m:
                    raise HTTPException(status_code=502, detail="Не удалось распарсить метаданные страницы Spotify")

                next_data = json.loads(m.group(1))
                entity = next_data.get("props", {}).get("pageProps", {}).get("state", {}).get("data", {}).get("entity", {})
                if not entity:
                    raise HTTPException(status_code=404, detail="Не найдены данные плейлиста Spotify")

                title = entity.get("title") or entity.get("name") or "Spotify Музыка"
                subtitle = entity.get("subtitle") or ""
                
                cover_url = None
                cover_art = entity.get("coverArt", {}).get("sources", [])
                if cover_art and len(cover_art) > 0:
                    cover_url = cover_art[0].get("url")

                raw_track_list = entity.get("trackList", [])
                tracks = []
                for item in raw_track_list:
                    t_uri = item.get("uri", "")
                    t_id = t_uri.split(":")[-1] if t_uri else str(len(tracks))
                    t_title = item.get("title") or "Без названия"
                    t_artist = item.get("subtitle") or subtitle or "Неизвестный исполнитель"
                    t_dur_ms = item.get("duration", 0)

                    tracks.append(Track(
                        id=t_id,
                        title=t_title,
                        artist=t_artist,
                        album=title if entity_type == "album" else None,
                        duration=t_dur_ms // 1000 if t_dur_ms else 180,
                        cover_url=cover_url,
                        platform=PlatformEnum.SPOTIFY,
                        stream_url=f"/api/stream/spotify/{t_id}",
                        is_playable=True,
                        original_uri=f"spotify:track:{t_id}"
                    ))

                playlist = Playlist(
                    id=f"spotify_{entity_type}_{entity_id}",
                    title=title,
                    description=subtitle or f"Импортировано из Spotify ({len(tracks)} треков)",
                    cover_url=cover_url,
                    track_count=len(tracks),
                    platform=PlatformEnum.SPOTIFY
                )
                return playlist, tracks

            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Ошибка скрапинга Spotify: {e}")
                raise HTTPException(status_code=400, detail=f"Не удалось извлечь плейлист из Spotify: {str(e)}")


url_importer = UrlImporterService()
