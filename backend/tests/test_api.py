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

