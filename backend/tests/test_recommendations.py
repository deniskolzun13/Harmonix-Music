import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_yandex_wave_endpoint():
    response = client.get("/api/recommendations/yandex/wave?limit=10")
    assert response.status_code == 200
    tracks = response.json()
    assert isinstance(tracks, list)
    if len(tracks) > 0:
        first = tracks[0]
        assert "title" in first
        assert "artist" in first
        assert "stream_url" in first
        assert first["stream_url"].startswith("/api/stream/")


def test_yandex_similar_endpoint():
    response = client.get("/api/recommendations/yandex/similar/demo_ym_1?limit=5")
    assert response.status_code == 200
    tracks = response.json()
    assert isinstance(tracks, list)
    if len(tracks) > 0:
        first = tracks[0]
        assert "title" in first
        assert "artist" in first
        assert "stream_url" in first
        assert first["stream_url"].startswith("/api/stream/")


def test_vk_personal_recommendations_endpoint():
    response = client.get("/api/recommendations/vk/personal?limit=10")
    assert response.status_code == 200
    tracks = response.json()
    assert isinstance(tracks, list)
    if len(tracks) > 0:
        first = tracks[0]
        assert "title" in first
        assert "artist" in first
        assert "stream_url" in first
        assert first["stream_url"].startswith("/api/stream/")


def test_spotify_related_artists_endpoint():
    response = client.get("/api/recommendations/spotify/related-artists?artist=The%20Weeknd&limit=5")
    assert response.status_code == 200
    artists = response.json()
    assert isinstance(artists, list)
    if len(artists) > 0:
        first = artists[0]
        assert "id" in first
        assert "name" in first
        assert "genres" in first
        assert "platform" in first
