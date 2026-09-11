import re
from typing import List, Optional, Tuple
from rapidfuzz import fuzz
from app.models import Track


def clean_track_title(title: str) -> str:
    """
    Очищает название трека от мусорных суффиксов:
    (Remastered 2020), [Official Audio], (feat. ...), etc.
    """
    cleaned = title
    # Удаляем скобки с фитами: (feat. X), [ft. Y]
    cleaned = re.sub(r'[\(\[][^\)\]]*(?:feat|ft)\.?[^\)\]]*[\)\]]', '', cleaned, flags=re.IGNORECASE)
    # Удаляем Remaster, Audio, Video, Lyric, Clip внутри скобок
    cleaned = re.sub(r'[\(\[][^\)\]]*(?:remaster|official|lyric|video|clip|audio)[^\)\]]*[\)\]]', '', cleaned, flags=re.IGNORECASE)
    # Удаляем спецсимволы и лишние пробелы
    cleaned = re.sub(r'[^\w\s]', ' ', cleaned)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip().lower()
    return cleaned


def clean_artist_name(artist: str) -> str:
    """Очищает имена артистов от разделителей и доп. символов"""
    cleaned = re.sub(r'[,\/&]', ' ', artist)
    cleaned = re.sub(r'[^\w\s]', ' ', cleaned)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip().lower()
    return cleaned


def calculate_match_score(source: Track, candidate: Track) -> float:
    """
    Вычисляет процент уверенности сопоставления двух треков от 0.0 до 100.0
    """
    src_title = clean_track_title(source.title)
    cand_title = clean_track_title(candidate.title)
    
    src_artist = clean_artist_name(source.artist)
    cand_artist = clean_artist_name(candidate.artist)

    # Точное совпадение очищенных строк дает 100
    if src_title == cand_title and src_artist == cand_artist:
        return 100.0

    # Сравнение названий (token_set_ratio хорошо работает с перестановками)
    title_score = fuzz.token_set_ratio(src_title, cand_title)
    artist_score = fuzz.token_set_ratio(src_artist, cand_artist)

    # Вес названия чуть важнее, так как у одного артиста много треков
    base_score = (title_score * 0.55) + (artist_score * 0.45)

    # Сверка хронометража, если длительность известна у обоих треков
    if source.duration > 0 and candidate.duration > 0:
        dur_diff = abs(source.duration - candidate.duration)
        if dur_diff <= 4:
            base_score = min(100.0, base_score + 5.0)
        elif dur_diff <= 10:
            pass  # Нормальное расхождение таймингов
        elif dur_diff > 35:
            # Слишком сильная разница (скорее всего караоке, радио-версия или лайв)
            base_score = max(0.0, base_score - 25.0)
        elif dur_diff > 20:
            base_score = max(0.0, base_score - 10.0)

    return round(base_score, 2)


def find_best_match(source: Track, candidates: List[Track], min_confidence: float = 65.0) -> Tuple[Optional[Track], float]:
    """
    Находит лучший подходящий трек среди кандидатов
    """
    if not candidates:
        return None, 0.0

    best_track = None
    best_score = 0.0

    for candidate in candidates:
        score = calculate_match_score(source, candidate)
        if score > best_score:
            best_score = score
            best_track = candidate

    if best_score >= min_confidence:
        return best_track, best_score

    return None, best_score
