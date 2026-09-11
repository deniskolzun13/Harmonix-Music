@echo off
chcp 65001 >nul
title Harmonix - Сборка Android APK
echo ========================================================
echo   📦 Сборка нативного Android APK для Harmonix
echo ========================================================
echo.

set "JAVA_HOME=%~dp0tools\jdk21\jdk-21.0.2+13"
set "ANDROID_HOME=%~dp0tools\android-sdk"

cd /d "%~dp0frontend"
echo [1/3] Сборка интерфейса Vite...
call npm run build

echo [2/3] Синхронизация с Android проектом...
call npx cap sync android

cd /d "%~dp0frontend\android"
echo [3/3] Компиляция APK через Gradle...
call .\gradlew.bat assembleDebug

copy /y "%~dp0frontend\android\app\build\outputs\apk\debug\app-debug.apk" "%~dp0Harmonix_Player.apk" >nul

echo.
echo ========================================================
echo   ✅ Сборка успешно завершена!
echo   Файл готов: Harmonix_Player.apk
echo ========================================================
pause
