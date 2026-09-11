@echo off
chcp 65001 >nul
title Harmonix Mobile Music & Transfer
echo ========================================================
echo   🎵 Harmonix Mobile Music Player & Transfer
echo ========================================================
echo.

cd /d "%~dp0backend"

if not exist ".venv" (
    echo [1/3] Создание виртуального окружения Python...
    python -m venv .venv
    echo [2/3] Установка зависимостей...
    .\.venv\Scripts\pip install -r requirements.txt
)

echo [3/3] Запуск сервера Harmonix для телефона и ПК...
echo.
echo ========================================================
echo   Приложение доступно в вашей локальной сети Wi-Fi!
echo.
echo   Откройте браузер на телефоне и перейдите по адресу,
echo   указанному ниже, либо отсканируйте QR-код в плеере.
echo ========================================================
echo.

REM Открываем браузер на ПК
start http://localhost:8000

REM Запуск сервера на всех сетевых интерфейсах (0.0.0.0) для доступа с телефона
.\.venv\Scripts\python -m uvicorn app.main:app --host 0.0.0.0 --port 8000

pause
