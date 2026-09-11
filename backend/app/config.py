import os
import json
import socket
import io
import base64
import logging
import qrcode
from pathlib import Path
from typing import Optional
from cryptography.fernet import Fernet, InvalidToken
from app.models import AuthConfig, AuthStatus

logger = logging.getLogger("harmonix.config")

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)
AUTH_FILE = DATA_DIR / "auth_config.json"
SECRET_KEY_FILE = DATA_DIR / ".secret_key"


def get_local_ip() -> str:
    """Определяет локальный IP-адрес компьютера в сети Wi-Fi/LAN"""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        # Не выполняет реальный запрос, но определяет локальный интерфейс
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip


def get_allowed_origins() -> list[str]:
    """
    Формирует безопасный список разрешенных CORS Origins для локальной разработки и мобильного доступа.
    Включает localhost, 127.0.0.1, локальный IP и мобильное WebView окружение.
    """
    origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "capacitor://localhost",
        "http://localhost",
    ]
    local_ip = get_local_ip()
    if local_ip not in ("127.0.0.1", "localhost"):
        origins.append(f"http://{local_ip}:5173")
        origins.append(f"http://{local_ip}:8000")

    # Возможность расширить origins через переменную окружения HARMONIX_ALLOWED_ORIGINS
    extra = os.getenv("HARMONIX_ALLOWED_ORIGINS")
    if extra:
        for item in extra.split(","):
            cleaned = item.strip()
            if cleaned and cleaned not in origins:
                origins.append(cleaned)

    return origins


def generate_qr_code_base64(url: str) -> str:
    """Генерирует QR-код в виде data URL base64 для мобильного сопряжения"""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=8,
        border=2,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    return f"data:image/png;base64,{img_str}"


def get_secret_key() -> bytes:
    """
    Возвращает ключ шифрования для токенов.
    Берет из переменной HARMONIX_SECRET_KEY или генерирует и сохраняет в .secret_key.
    """
    env_key = os.getenv("HARMONIX_SECRET_KEY")
    if env_key and env_key.strip():
        return env_key.strip().encode("utf-8")

    if SECRET_KEY_FILE.exists():
        try:
            return SECRET_KEY_FILE.read_text(encoding="utf-8").strip().encode("utf-8")
        except Exception as e:
            logger.error(f"Не удалось прочитать .secret_key: {e}")

    new_key = Fernet.generate_key()
    try:
        SECRET_KEY_FILE.write_text(new_key.decode("utf-8"), encoding="utf-8")
    except Exception as e:
        logger.error(f"Не удалось сохранить локальный ключ шифрования: {e}")

    logger.warning(
        "ВНИМАНИЕ: Переменная окружения HARMONIX_SECRET_KEY не задана. "
        "Сгенерирован локальный ключ в backend/data/.secret_key. "
        "Для продакшена обязательно вынесите ключ в переменную окружения!"
    )
    return new_key


def load_auth_config() -> AuthConfig:
    """
    Загружает и расшифровывает конфигурацию авторизации.
    При ошибке дешифровки возвращает дефолтный AuthConfig без утечки данных.
    """
    if not AUTH_FILE.exists():
        return AuthConfig()

    raw_bytes = AUTH_FILE.read_bytes()
    if not raw_bytes:
        return AuthConfig()

    fernet = Fernet(get_secret_key())

    # 1. Попытка дешифровки через Fernet
    try:
        decrypted_bytes = fernet.decrypt(raw_bytes)
        data = json.loads(decrypted_bytes.decode("utf-8"))
        return AuthConfig(**data)
    except (InvalidToken, Exception) as dec_err:
        # 2. Проверка на случай миграции с открытого JSON
        try:
            raw_text = raw_bytes.decode("utf-8")
            legacy_data = json.loads(raw_text)
            legacy_config = AuthConfig(**legacy_data)
            logger.info("Обнаружен незашифрованный auth_config.json. Автоматическое шифрование...")
            save_auth_config(legacy_config)
            return legacy_config
        except Exception:
            logger.warning(
                f"Ошибка дешифровки auth_config.json ({type(dec_err).__name__}). "
                "Конфигурация сброшена на значения по умолчанию."
            )
            return AuthConfig()


def save_auth_config(config: AuthConfig):
    """
    Шифрует и сохраняет конфигурацию авторизации на диск.
    Токены нигде не логируются.
    """
    fernet = Fernet(get_secret_key())
    payload = json.dumps(config.model_dump(), ensure_ascii=False, indent=2).encode("utf-8")
    encrypted_bytes = fernet.encrypt(payload)
    AUTH_FILE.write_bytes(encrypted_bytes)
