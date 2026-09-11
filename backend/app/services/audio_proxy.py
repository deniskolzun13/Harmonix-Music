import logging
import httpx
from fastapi import Request, HTTPException
from fastapi.responses import StreamingResponse
from app.models import PlatformEnum
from app.platforms.manager import manager

logger = logging.getLogger("harmonix.stream")

async def proxy_audio_stream(platform: PlatformEnum, track_id: str, request: Request):
    """
    Проксирует поток аудио с поддержкой HTTP Range (для перемотки в мобильном браузере)
    """
    adapter = manager.get_adapter(platform)
    stream_url = adapter.get_stream_url(track_id)
    if not stream_url:
        demo_adapter = manager.demo_adapters.get(platform)
        if demo_adapter:
            stream_url = demo_adapter.get_stream_url(track_id)
        if not stream_url:
            stream_url = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"

    # Перенаправляем заголовки Range для плавной перемотки
    req_headers = {}
    range_header = request.headers.get("range")
    if range_header:
        req_headers["range"] = range_header

    client = httpx.AsyncClient(follow_redirects=True, timeout=30.0)
    try:
        upstream_req = client.build_request("GET", stream_url, headers=req_headers)
        upstream_resp = await client.send(upstream_req, stream=True)

        async def stream_generator():
            try:
                async for chunk in upstream_resp.aiter_bytes(chunk_size=32 * 1024):
                    yield chunk
            finally:
                await upstream_resp.aclose()
                await client.aclose()

        response_headers = {
            "Content-Type": upstream_resp.headers.get("content-type", "audio/mpeg"),
            "Accept-Ranges": "bytes",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
            "Access-Control-Allow-Headers": "Range, Content-Type",
        }
        if "content-range" in upstream_resp.headers:
            response_headers["Content-Range"] = upstream_resp.headers["content-range"]
        if "content-length" in upstream_resp.headers:
            response_headers["Content-Length"] = upstream_resp.headers["content-length"]

        return StreamingResponse(
            stream_generator(),
            status_code=upstream_resp.status_code,
            headers=response_headers,
        )
    except Exception as e:
        logger.error(f"Ошибка проксирования аудио: {e}")
        await client.aclose()
        raise HTTPException(status_code=502, detail=f"Ошибка стриминга: {str(e)}")
