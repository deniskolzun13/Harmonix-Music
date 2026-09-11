import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_import_invalid_url():
    resp = client.post("/api/import/url", json={"url": "https://unknown-service.com/playlist/123"})
    assert resp.status_code == 400
    assert "Неподдерживаемый сервис" in resp.json()["detail"]


def test_import_empty_url():
    resp = client.post("/api/import/url", json={"url": "   "})
    assert resp.status_code == 400


def test_import_yandex_album():
    # Реальный публичный альбом в Яндекс Музыке
    resp = client.post("/api/import/url", json={"url": "https://music.yandex.ru/album/27686520"})
    assert resp.status_code == 200
    data = resp.json()
    assert "playlist" in data
    assert "tracks" in data
    assert len(data["tracks"]) > 0
    assert data["playlist"]["platform"] == "yandex"
    assert data["tracks"][0]["title"] != ""
    assert data["tracks"][0]["stream_url"].startswith("/api/stream/yandex/")


def test_import_spotify_playlist():
    # Публичный плейлист Spotify
    resp = client.post("/api/import/url", json={"url": "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M"})
    assert resp.status_code == 200
    data = resp.json()
    assert "playlist" in data
    assert "tracks" in data
    assert data["playlist"]["platform"] == "spotify"
    assert len(data["tracks"]) > 0
    assert data["tracks"][0]["title"] != ""
    assert data["tracks"][0]["artist"] != ""
    assert data["tracks"][0]["stream_url"].startswith("/api/stream/spotify/")


from unittest.mock import patch, AsyncMock

def test_cover_proxy():
    # Мок ответа httpx для независимости от внешних сетей
    fake_img_content = b"\xff\xd8\xff\xe0\x00\x10JFIF"
    mock_resp = AsyncMock()
    mock_resp.status_code = 200
    mock_resp.headers = {"content-type": "image/jpeg"}
    mock_resp.content = fake_img_content

    with patch("httpx.AsyncClient.get", return_value=mock_resp):
        resp = client.get("/api/cover-proxy", params={"url": "https://example.com/cover.jpg"})
        assert resp.status_code == 200
        assert resp.headers["content-type"] == "image/jpeg"
        assert resp.content == fake_img_content
