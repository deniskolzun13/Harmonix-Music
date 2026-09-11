import logging
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception,
    before_sleep_log
)

logger = logging.getLogger("harmonix.retry")


def should_retry_exception(exc: BaseException) -> bool:
    """Определяет, нужно ли повторять запрос: 429 Too Many Requests или сетевые ошибки"""
    if isinstance(exc, (ConnectionError, TimeoutError)):
        return True

    exc_name = exc.__class__.__name__
    if any(keyword in exc_name for keyword in ("Connection", "Timeout", "NetworkError", "TimedOut")):
        return True

    # Проверка HTTP 429 в атрибутах исключения (requests, spotipy, httpx)
    status_code = getattr(exc, "status_code", None) or getattr(exc, "http_status", None)
    if status_code == 429:
        return True

    response = getattr(exc, "response", None)
    if response is not None:
        resp_status = getattr(response, "status_code", None)
        if resp_status == 429:
            return True

    # Текстовые маркеры rate-limit в сообщении
    msg = str(exc).lower()
    if any(marker in msg for marker in ("429", "too many requests", "rate limit", "flood control")):
        return True

    return False


def get_retry_after(retry_state) -> float:
    """Извлекает заголовок Retry-After, если он присутствует, иначе вычисляет wait_exponential"""
    exp_wait = wait_exponential(multiplier=1, min=2, max=30)(retry_state)
    if retry_state.outcome and retry_state.outcome.failed:
        exc = retry_state.outcome.exception()
        if exc:
            # Проверяем headers в response или самом исключении (например, в Spotipy)
            response = getattr(exc, "response", None)
            headers = getattr(response, "headers", None) if response else None
            if headers is None:
                headers = getattr(exc, "headers", None)

            if headers and hasattr(headers, "get"):
                retry_after_val = headers.get("Retry-After") or headers.get("retry-after")
                if retry_after_val:
                    try:
                        seconds = float(retry_after_val)
                        logger.info(f"Получен заголовок Retry-After: ожидание {seconds}с")
                        return max(seconds, 1.0)
                    except (ValueError, TypeError):
                        pass

    return exp_wait


api_retry = retry(
    stop=stop_after_attempt(4),
    wait=get_retry_after,
    retry=retry_if_exception(should_retry_exception),
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=True
)
