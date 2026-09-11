import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_network_info():
    response = client.get("/api/network/info")
    assert response.status_code == 200
    data = response.json()
    assert "local_ip" in data
    assert "mobile_url" in data
    assert "qr_code" in data
    assert data["qr_code"].startswith("data:image/png;base64,")


def test_auth_status():
    response = client.get("/api/auth/status")
    assert response.status_code == 200
    data = response.json()
    assert "yandex" in data
    assert "vk" in data
    assert "spotify" in data


def test_playlists_and_tracks():
    # Проверка получения демо/реальных плейлистов
    response = client.get("/api/playlists?platform=yandex")
    assert response.status_code == 200
    playlists = response.json()
    assert len(playlists) > 0
    pl_id = playlists[0]["id"]

    # Проверка получения треков плейлиста
    tracks_resp = client.get(f"/api/playlists/yandex/{pl_id}/tracks")
    assert tracks_resp.status_code == 200
    tracks = tracks_resp.json()
    assert len(tracks) > 0
    first = tracks[0]
    assert "title" in first
    assert "artist" in first
    assert first["stream_url"].startswith("/api/stream/")


def test_transfer_start_and_status():
    # Запуск тестового переноса из Яндекса в Spotify
    req_body = {
        "source_platform": "yandex",
        "target_platform": "spotify",
        "source_playlist_id": "favorites",
        "target_playlist_name": "Test Transfer Playlist",
        "create_new": True
    }
    resp = client.post("/api/transfer/start", json=req_body)
    assert resp.status_code == 200
    task = resp.json()
    assert "task_id" in task
    assert task["status"] in ["queued", "running", "completed"]

    # Проверка статуса
    status_resp = client.get(f"/api/transfer/status/{task['task_id']}")
    assert status_resp.status_code == 200
    status_data = status_resp.json()
    assert status_data["task_id"] == task["task_id"]


def test_download_apk():
    # Проверка эндпоинта раздачи APK файла
    resp = client.get("/api/download/apk")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/vnd.android.package-archive"
    assert len(resp.content) > 1000000  # Больше 1 МБ


def test_encrypted_auth_config():
    # Проверка безопасного шифрования токенов авторизации
    from app.config import save_auth_config, load_auth_config, AUTH_FILE
    from app.models import AuthConfig

    original = load_auth_config()
    try:
        test_cfg = AuthConfig(yandex_token="super_secret_token_abc_123", vk_token="secret_vk_789")
        save_auth_config(test_cfg)

        # 1. Проверяем, что на диске нет токена в открытом виде
        raw_bytes = AUTH_FILE.read_bytes()
        assert b"super_secret_token_abc_123" not in raw_bytes
        assert b"secret_vk_789" not in raw_bytes

        # 2. Проверяем успешную дешифровку
        loaded = load_auth_config()
        assert loaded.yandex_token == "super_secret_token_abc_123"
        assert loaded.vk_token == "secret_vk_789"
    finally:
        # Восстанавливаем исходную конфигурацию
        save_auth_config(original)


def test_cors_configuration():
    # Проверка безопасного CORS
    from app.config import get_allowed_origins

    allowed = get_allowed_origins()
    assert "http://localhost:5173" in allowed
    assert "http://127.0.0.1:5173" in allowed

    # Запрос с разрешенным Origin
    resp = client.options(
        "/api/network/info",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert resp.status_code == 200
    assert resp.headers.get("access-control-allow-origin") == "http://localhost:5173"
    assert resp.headers.get("access-control-allow-credentials") == "true"

    # Запрос с неразрешенным Origin не должен получать allow-origin
    resp_bad = client.options(
        "/api/network/info",
        headers={
            "Origin": "http://malicious-site.com",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert resp_bad.headers.get("access-control-allow-origin") is None


def test_transfer_persistence_and_history():
    import time
    from app.services.transfer_service import transfer_service
    from app.services.transfer_db import (
        save_task_record,
        save_track_result,
        cleanup_old_transfers,
        load_task_from_db
    )
    from app.models import TransferTask, TransferTrackResult, Track, PlatformEnum

    # 1. Создаем тестовую задачу
    test_task_id = f"test-persist-{int(time.time())}"
    task = TransferTask(
        task_id=test_task_id,
        source_platform=PlatformEnum.YANDEX,
        target_platform=PlatformEnum.SPOTIFY,
        status="completed",
        total=1,
        matched=1,
        failed=0,
        processed=1,
        target_playlist_name="Test Persist PL",
        message="Тестовый перенос завершен"
    )
    save_task_record(task)
    
    src_tr = Track(id="src_1", title="Track 1", artist="Artist 1", platform=PlatformEnum.YANDEX)
    dst_tr = Track(id="dst_1", title="Track 1", artist="Artist 1", platform=PlatformEnum.SPOTIFY)
    res = TransferTrackResult(source_track=src_tr, matched_track=dst_tr, confidence=95.0, status="matched")
    save_track_result(test_task_id, res)

    # 2. Симулируем перезапуск бэкенда (удаляем из памяти)
    transfer_service.tasks.pop(test_task_id, None)

    # 3. Чтение через get_task должно восстановить задачу из SQLite
    loaded = transfer_service.get_task(test_task_id)
    assert loaded is not None
    assert loaded.task_id == test_task_id
    assert loaded.status == "completed"
    assert len(loaded.results) == 1
    assert loaded.results[0].source_track.title == "Track 1"
    assert loaded.results[0].matched_track.title == "Track 1"

    # 4. Проверяем API истории переносов
    resp = client.get("/api/transfer/history?limit=10&offset=0")
    assert resp.status_code == 200
    data = resp.json()
    assert "total" in data
    assert "items" in data
    assert any(it["task_id"] == test_task_id for it in data["items"])

    # 5. Проверяем очистку старых записей (>30 дней)
    old_task_id = "test-old-task-35d"
    old_task = TransferTask(
        task_id=old_task_id,
        source_platform=PlatformEnum.VK,
        target_platform=PlatformEnum.YANDEX,
        status="completed"
    )
    old_timestamp = time.time() - (35 * 86400)
    save_task_record(old_task, created_at=old_timestamp, updated_at=old_timestamp)
    
    deleted_count = cleanup_old_transfers(days=30)
    assert deleted_count >= 1
    assert load_task_from_db(old_task_id) is None
    # Свежая задача должна остаться
    assert load_task_from_db(test_task_id) is not None


def test_rate_limit_retry_and_resilience():
    from app.utils.retry_helper import api_retry, should_retry_exception
    import requests

    # 1. Проверяем should_retry_exception
    err_429 = requests.exceptions.HTTPError("429 Too Many Requests")
    setattr(err_429, "status_code", 429)
    assert should_retry_exception(err_429) is True

    err_conn = ConnectionError("Network unreachable")
    assert should_retry_exception(err_conn) is True

    err_other = ValueError("Some regular validation error")
    assert should_retry_exception(err_other) is False

    # 2. Проверяем работу декоратора api_retry
    call_count = 0

    @api_retry
    def flaky_api_call():
        nonlocal call_count
        call_count += 1
        if call_count < 3:
            raise ConnectionError("Temporary connection failure")
        return "success"

    res = flaky_api_call()
    assert res == "success"
    assert call_count == 3


def test_transfer_confirm_and_reject():
    import time
    from app.services.transfer_service import transfer_service
    from app.services.transfer_db import save_task_record, save_track_result
    from app.models import TransferTask, TransferTrackResult, Track, PlatformEnum

    # 1. Задача для тестирования confirm
    task_id = f"test-review-{int(time.time())}"
    task = TransferTask(
        task_id=task_id,
        source_platform=PlatformEnum.YANDEX,
        target_platform=PlatformEnum.SPOTIFY,
        status="waiting_review",
        total=1,
        matched=0,
        failed=0,
        processed=1,
        target_playlist_name="Review Playlist"
    )
    src_track = Track(id="src_rev_1", title="Remix Song", artist="DJ Test", platform=PlatformEnum.YANDEX)
    matched_track = Track(id="sp_match_1", title="Original Song", artist="DJ Test", platform=PlatformEnum.SPOTIFY)
    pending_res = TransferTrackResult(
        source_track=src_track,
        matched_track=matched_track,
        confidence=72.0,
        status="pending_review"
    )
    task.results.append(pending_res)
    transfer_service.tasks[task_id] = task
    save_task_record(task)
    save_track_result(task_id, pending_res)

    # Подтверждаем трек через API
    resp_confirm = client.post(f"/api/transfer/{task_id}/confirm", json={"confirmed_track_ids": ["sp_match_1"]})
    assert resp_confirm.status_code == 200
    c_data = resp_confirm.json()
    assert c_data["status"] == "completed"
    assert c_data["matched"] == 1
    assert c_data["results"][0]["status"] == "matched"

    # 2. Задача для тестирования reject
    task_id_rej = f"test-reject-{int(time.time())}"
    task_rej = TransferTask(
        task_id=task_id_rej,
        source_platform=PlatformEnum.YANDEX,
        target_platform=PlatformEnum.SPOTIFY,
        status="waiting_review",
        total=1,
        matched=0,
        failed=0,
        processed=1,
        target_playlist_name="Reject Playlist"
    )
    pending_res_rej = TransferTrackResult(
        source_track=src_track,
        matched_track=matched_track,
        confidence=68.0,
        status="pending_review"
    )
    task_rej.results.append(pending_res_rej)
    transfer_service.tasks[task_id_rej] = task_rej
    save_task_record(task_rej)
    save_track_result(task_id_rej, pending_res_rej)

    # Отклоняем спорные совпадения через API
    resp_reject = client.post(f"/api/transfer/{task_id_rej}/reject")
    assert resp_reject.status_code == 200
    r_data = resp_reject.json()
    assert r_data["status"] == "completed"
    assert r_data["failed"] == 1
    assert r_data["results"][0]["status"] == "rejected"

