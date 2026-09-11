import pytest
from app.models import Track, PlatformEnum
from app.services.matcher import (
    clean_track_title,
    clean_artist_name,
    calculate_match_score,
    find_best_match
)


def test_clean_track_title():
    assert clean_track_title("In the End (Remastered 2020)") == "in the end"
    assert clean_track_title("Starboy [feat. Daft Punk]") == "starboy"
    assert clean_track_title("Midnight City (Official Audio)") == "midnight city"


def test_clean_artist_name():
    assert clean_artist_name("The Weeknd & Daft Punk") == "the weeknd daft punk"
    assert clean_artist_name("Linkin Park, Jay-Z") == "linkin park jay z"


def test_exact_match_score():
    t1 = Track(
        id="1",
        title="Midnight City",
        artist="M83",
        duration=243,
        platform=PlatformEnum.SPOTIFY
    )
    t2 = Track(
        id="2",
        title="Midnight City",
        artist="M83",
        duration=243,
        platform=PlatformEnum.YANDEX
    )
    score = calculate_match_score(t1, t2)
    assert score == 100.0


def test_remaster_and_duration_match():
    t1 = Track(
        id="1",
        title="In the End",
        artist="Linkin Park",
        duration=216,
        platform=PlatformEnum.SPOTIFY
    )
    t2 = Track(
        id="2",
        title="In the End (2020 Remaster)",
        artist="Linkin Park",
        duration=218,
        platform=PlatformEnum.VK
    )
    score = calculate_match_score(t1, t2)
    assert score >= 90.0


def test_find_best_match_selection():
    source = Track(
        id="1",
        title="Starboy",
        artist="The Weeknd, Daft Punk",
        duration=230,
        platform=PlatformEnum.SPOTIFY
    )
    candidates = [
        Track(id="c1", title="Blinding Lights", artist="The Weeknd", duration=200, platform=PlatformEnum.YANDEX),
        Track(id="c2", title="Starboy", artist="The Weeknd ft. Daft Punk", duration=232, platform=PlatformEnum.YANDEX),
        Track(id="c3", title="Starboy (Live in Paris)", artist="The Weeknd", duration=310, platform=PlatformEnum.YANDEX),
    ]

    best, score = find_best_match(source, candidates)
    assert best is not None
    assert best.id == "c2"
    assert score >= 85.0


if __name__ == "__main__":
    pytest.main(["-v", __file__])
