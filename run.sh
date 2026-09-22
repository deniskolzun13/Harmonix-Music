#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/backend"

if [ ! -d ".venv" ]; then
    echo "[1/3] Создание виртуального окружения Python..."
    python3 -m venv .venv
    echo "[2/3] Установка зависимостей..."
    ./.venv/bin/pip install -r requirements.txt
fi

echo "[3/3] Запуск сервера Harmonix..."
echo "========================================================"
echo "  Сервер доступен по адресу: http://localhost:8000"
echo "  Для доступа с мобильного устройства в сети Wi-Fi: http://<ваш-ip>:8000"
echo "========================================================"

exec ./.venv/bin/python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
