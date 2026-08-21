@echo off
setlocal
title VoleyInsight
color 0A
cd /d "%~dp0"

rem Cerrar tuneles anteriores
taskkill /f /im cloudflared.exe >nul 2>&1

echo.
echo ========================================
echo    VOLEYINSIGHT - SISTEMA COMPLETO
echo ========================================
echo    Modo: LOCAL + TUNEL CLOUDFLARE
echo ========================================
echo.

echo [1/4] Verificando Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js no instalado
    pause
    exit /b 1
)
echo OK Node.js instalado
echo.

echo [2/4] Verificando Cloudflared...
where cloudflared >nul 2>&1
if errorlevel 1 (
    echo ERROR: Cloudflared no encontrado
    echo Descargar desde: https://github.com/cloudflare/cloudflared/releases
    pause
    exit /b 1
)
echo OK Cloudflared instalado
echo.

echo [3/4] Iniciando servidor API, Dashboard y WebSocket...
start "API Server" cmd /k "node server-api.js"
timeout /t 3 /nobreak >nul
echo OK Sistema en http://localhost:5501
echo.

echo [4/4] Iniciando tracker...
start "Tracker" cmd /k "npm run tracker"
timeout /t 3 /nobreak >nul
echo OK Tracker iniciado
echo.

echo Iniciando tunel Cloudflare...
start "Cloudflare Tunnel" cmd /k "cloudflared tunnel --url http://localhost:5501"
timeout /t 5 /nobreak >nul

echo ========================================
echo    SISTEMA ACTIVO
echo ========================================
echo.
pause
endlocal
