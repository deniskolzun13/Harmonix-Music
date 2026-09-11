import os
import json
import socket
import io
import base64
import qrcode
from pathlib import Path
from typing import Optional
from app.models import AuthConfig, AuthStatus

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)
AUTH_FILE = DATA_DIR / "auth_config.json"


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


def load_auth_config() -> AuthConfig:
    if AUTH_FILE.exists():
        try:
            with open(AUTH_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return AuthConfig(**data)
        except Exception:
            return AuthConfig()
    return AuthConfig()


def save_auth_config(config: AuthConfig):
    with open(AUTH_FILE, "w", encoding="utf-8") as f:
        json.dump(config.model_dump(), f, ensure_ascii=False, indent=2)
