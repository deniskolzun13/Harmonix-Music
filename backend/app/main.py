import logging
from fastapi import FastAPI, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional

from pathlib import Path
import httpx
from pydantic import BaseModel
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response

from app.models import (
    PlatformEnum,
    AuthConfig,
    AuthStatus,
    Playlist,
    Track,
    TransferRequest,
    TransferTask,
    TransferHistoryResponse,
    ConfirmTransferRequest
)
from app.config import get_local_ip, generate_qr_code_base64, get_allowed_origins
from app.platforms.manager import manager
from app.services.transfer_service import transfer_service
from app.services.transfer_db import get_transfer_history, init_transfer_db, cleanup_old_transfers
from app.services.audio_proxy import proxy_audio_stream
from app.services.url_importer import url_importer
from app.services.lyrics_service import get_lyrics

class ImportUrlRequest(BaseModel):
    url: str

FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("harmonix.api")

app = FastAPI(title="Harmonix Mobile Music & Transfer API", version="1.0.0")

# Безопасный CORS для локального фронтенда Vite и мобильных клиентов
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    """Инициализация базы данных и очистка старых записей переноса (>30 дней)"""
    init_transfer_db()
    cleanup_old_transfers(days=30)


@app.get("/api/network/info")
def get_network_info():
    """Возвращает локальный IP и сгенерированный QR-код для мобильного телефона"""
    ip = get_local_ip()
    port = 8000 if FRONTEND_DIST.exists() else 5173
    mobile_frontend_url = f"http://{ip}:{port}"
    qr_code = generate_qr_code_base64(mobile_frontend_url)
    return {
        "local_ip": ip,
        "port": port,
        "mobile_url": mobile_frontend_url,
        "qr_code": qr_code
    }


@app.get("/api/download/apk")
def download_apk():
    """Скачивание скомпилированного APK файла на Android смартфон"""
    apk_path = Path(__file__).resolve().parent.parent.parent / "Harmonix_Player.apk"
    if not apk_path.exists():
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="APK файл не найден")
    return FileResponse(
        path=str(apk_path),
        filename="Harmonix_Player.apk",
        media_type="application/vnd.android.package-archive"
    )



@app.get("/api/auth/status", response_model=AuthStatus)
def get_auth_status():
    """Проверяет статусы авторизации сервисов"""
    return manager.get_auth_status()


@app.get("/api/auth/config", response_model=AuthConfig)
def get_auth_config():
    """Возвращает текущую конфигурацию авторизации"""
    return manager.config



class DeviceTokenRequest(BaseModel):
    device_code: str


@app.post("/api/auth/yandex/device-code")
def get_yandex_device_code():
    """Запрос кода авторизации Yandex Device Flow"""
    try:
        from yandex_music import Client
        client = Client()
        code = client.request_device_code()
        return {
            "device_code": code.device_code,
            "user_code": code.user_code,
            "verification_url": code.verification_url,
            "expires_in": code.expires_in,
            "interval": code.interval
        }
    except Exception as e:
        logger.error(f"Ошибка запроса device-code Яндекс: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/auth/yandex/device-token")
def get_yandex_device_token(req: DeviceTokenRequest):
    """Опрос статуса подтверждения кода авторизации Yandex Device Flow"""
    try:
        from yandex_music import Client
        client = Client()
        token = client.poll_device_token(req.device_code)
        if token:
            manager.update_tokens(AuthConfig(yandex_token=token.access_token))
            return {
                "status": "authorized",
                "access_token": token.access_token
            }
        return {"status": "pending"}
    except Exception as e:
        logger.error(f"Ошибка опроса device-token Яндекс: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/api/auth/save")
def save_auth(config: AuthConfig):
    """Сохраняет токены и обновляет адаптеры"""
    manager.update_tokens(config)
    return {"status": "ok", "auth_status": manager.get_auth_status()}


@app.get("/api/playlists", response_model=List[Playlist])
def get_all_playlists(platform: Optional[PlatformEnum] = None):
    """Возвращает список плейлистов одного или всех сервисов"""
    result = []
    platforms = [platform] if platform else [PlatformEnum.YANDEX, PlatformEnum.VK, PlatformEnum.SPOTIFY]
    for p in platforms:
        adapter = manager.get_adapter(p)
        playlists = adapter.get_playlists()
        result.extend(playlists)
    return result


@app.get("/api/playlists/{platform}/{playlist_id}/tracks", response_model=List[Track])
def get_playlist_tracks(platform: PlatformEnum, playlist_id: str):
    """Возвращает треки выбранного плейлиста"""
    adapter = manager.get_adapter(platform)
    tracks = adapter.get_playlist_tracks(playlist_id)
    # Назначаем stream_url через наш локальный аудио-прокси для бесконфликтного мобильного воспроизведения
    for t in tracks:
        t.stream_url = f"/api/stream/{t.platform.value}/{t.id}"
    return tracks


@app.get("/api/search", response_model=List[Track])
def search_tracks(query: str, platform: PlatformEnum = PlatformEnum.YANDEX):
    """Поиск треков на платформе"""
    adapter = manager.get_adapter(platform)
    tracks = adapter.search_tracks(query, limit=20)
    for t in tracks:
        t.stream_url = f"/api/stream/{t.platform.value}/{t.id}"
    return tracks


@app.get("/api/stream/{platform}/{track_id}")
async def stream_audio(platform: PlatformEnum, track_id: str, request: Request):
    """Проксирование аудио с поддержкой перемотки (HTTP Range)"""
    return await proxy_audio_stream(platform, track_id, request)


@app.post("/api/transfer/start", response_model=TransferTask)
async def start_transfer(req: TransferRequest):
    """Запуск задачи миграции треков"""
    return await transfer_service.start_transfer(req)


@app.get("/api/transfer/history", response_model=TransferHistoryResponse)
def get_transfer_history_endpoint(limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0)):
    """Список прошлых переносов с пагинацией"""
    return get_transfer_history(limit=limit, offset=offset)


@app.get("/api/transfer/status/{task_id}", response_model=TransferTask)
def get_transfer_status(task_id: str):
    """Получение статуса и прогресса переноса"""
    task = transfer_service.get_task(task_id)
    if not task:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Задача переноса не найдена")
    return task


@app.post("/api/transfer/{task_id}/confirm", response_model=TransferTask)
async def confirm_transfer(task_id: str, req: ConfirmTransferRequest):
    """Подтверждение выбранных спорных треков и завершение переноса"""
    task = await transfer_service.confirm_task(task_id, req.confirmed_track_ids)
    if not task:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Задача переноса не найдена")
    return task


@app.post("/api/transfer/{task_id}/reject", response_model=TransferTask)
async def reject_transfer(task_id: str):
    """Отклонение всех спорных треков и завершение переноса"""
    task = await transfer_service.reject_task(task_id)
    if not task:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Задача переноса не найдена")
    return task


@app.post("/api/import/url")
async def import_url(req: ImportUrlRequest):
    """Распознавание и загрузка плейлиста или треков по прямой ссылке"""
    playlist, tracks = await url_importer.import_from_url(req.url)
    return {
        "playlist": playlist,
        "tracks": tracks
    }


@app.get("/api/cover-proxy")
async def proxy_cover(url: str = Query(...)):
    """Проксирование обложек для гарантированной загрузки в IndexedDB на телефоне без CORS"""
    try:
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
        async with httpx.AsyncClient(headers=headers, follow_redirects=True, timeout=10.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                content_type = resp.headers.get("content-type", "image/jpeg")
                return Response(content=resp.content, media_type=content_type)
    except Exception as e:
        logger.warning(f"Ошибка проксирования обложки {url}: {e}")
    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail="Не удалось загрузить обложку")


@app.get("/api/lyrics")
async def get_track_lyrics_endpoint(
    artist: str = Query(...),
    title: str = Query(...),
    album: Optional[str] = Query(None),
    duration: Optional[int] = Query(None),
    track_id: Optional[str] = Query(None),
    platform: Optional[str] = Query(None)
):
    """Получение синхронизированного караоке-текста (LRC) или обычного текста песни"""
    return await get_lyrics(
        artist=artist,
        title=title,
        album=album,
        duration=duration,
        track_id=track_id,
        platform=platform
    )


# Раздача мобильного фронтенда (PWA)
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")

