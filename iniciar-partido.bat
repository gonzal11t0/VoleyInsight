@echo off
title VoleyInsight - Sistema Completo
color 0A
chcp 65001 >nul

cd /d "%~dp0"

:: Matar procesos previos
taskkill /f /im cloudflared.exe >nul 2>&1
taskkill /f /im ssh.exe >nul 2>&1

:: ========================================
:: INICIO
:: ========================================
echo.
echo ========================================
echo    VOLEYINSIGHT - SISTEMA COMPLETO
echo ========================================
echo    Modo: LOCAL + TUNEL (Cloudflare + Serveo)
echo ========================================
echo.

:: ========================================
:: VERIFICAR NODE.JS
:: ========================================
echo [1/6] Verificando Node.js...
where node >nul 2>&1
if %errorlevel%==0 (
    echo OK Node.js instalado
) else (
    echo ERROR: Node.js no instalado
    pause
    exit /b
)
echo.

:: ========================================
:: VERIFICAR CLOUDFLARED
:: ========================================
echo [2/6] Verificando Cloudflared...
where cloudflared >nul 2>&1
if %errorlevel%==0 (
    echo OK Cloudflared instalado
) else (
    echo ERROR: Cloudflared no encontrado
    echo    Descargar de: https://github.com/cloudflare/cloudflared/releases
    pause
    exit /b
)
echo.

:: ========================================
:: INICIAR SERVIDOR LOCAL (puerto 5500)
:: ========================================
echo [3/6] Iniciando servidor local...
start "Servidor Local" cmd /k "npx serve . -p 5500"
timeout /t 3 /nobreak >nul
echo OK Servidor en http://localhost:5500
echo.

:: ========================================
:: INICIAR SERVIDOR API (puerto 3002)
:: ========================================
echo [4/6] Iniciando servidor API + WebSocket...
start "API Server" cmd /k "node server-api.js"
timeout /t 3 /nobreak >nul
echo OK API en http://localhost:3002
echo.

:: ========================================
:: INICIAR TRACKER
:: ========================================
echo [5/6] Iniciando tracker...
start "Tracker" cmd /k "npm run tracker"
timeout /t 3 /nobreak >nul
echo OK Tracker iniciado
echo.

:: ========================================
:: INICIAR TUNEL CLOUDFLARE (Dashboard)
:: ========================================
echo [6/6] Iniciando túneles...
echo    Iniciando Cloudflare Tunnel para Dashboard...
start "Cloudflare Tunnel" cmd /k "cloudflared tunnel --url http://localhost:5500"
timeout /t 5 /nobreak >nul

:: ========================================
:: INICIAR TUNEL SERVEO (API)
:: ========================================
echo    Iniciando Serveo Tunnel para API...
start "Serveo API" cmd /k "ssh -R 80:localhost:3002 serveo.net"
timeout /t 5 /nobreak >nul

:: ========================================
:: NO ABRIR NAVEGADOR
:: ========================================
echo.
echo ========================================
echo    🚀 SISTEMA ACTIVO
echo ========================================
echo.
echo 📡 CONSOLAS ABIERTAS:
echo    - Servidor Local (puerto 5500)
echo    - API Server (puerto 3002)
echo    - Tracker
echo    - Cloudflare Tunnel (Dashboard)
echo    - Serveo Tunnel (API)
echo.
echo 📱 PARA COMPARTIR:
echo    Revisa la ventana "Cloudflare Tunnel"
echo    Busca una URL como: https://xxxx.trycloudflare.com
echo    Compartir: https://xxxx.trycloudflare.com/dashboard/index.html
echo.
echo 🔌 URL DE LA API (para api_url.txt):
echo    Revisa la ventana "Serveo API"
echo    Busca una URL como: https://xxxx.serveo.net
echo    Copiala en data/api_url.txt
echo.
echo ========================================
echo    IMPORTANTE:
echo ========================================
echo    - NO cierres las 5 ventanas negras
echo    - Copia la URL de Serveo a data/api_url.txt
echo    - Los puntos se guardan en localStorage de cada dispositivo
echo    - Para ver los mismos puntos, que anote UNA sola persona
echo ========================================
echo.

pause