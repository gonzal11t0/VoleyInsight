@echo off
title VoleyInsight 
color 0A
chcp 65001 >nul
cd /d "C:\Users\User\Desktop\voley"


:: Matar procesos previos
taskkill /f /im cloudflared.exe >nul 2>&1

:: ========================================
:: INICIO
:: ========================================
echo.
echo ========================================
echo    VOLEYINSIGHT - SISTEMA COMPLETO
echo ========================================
echo    Modo: LOCAL + TUNEL CLOUDFLARE
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
:: INICIAR SERVIDOR API + DASHBOARD (puerto 5501)
:: ========================================
echo [4/6] Iniciando servidor API + WebSocket...
start "API Server" cmd /k "node server-api.js"
timeout /t 3 /nobreak >nul
echo OK Sistema en http://localhost:5501
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
:: INICIAR TUNEL CLOUDFLARE
:: ========================================
echo [6/6] Iniciando túnel Cloudflare...
start "Cloudflare Tunnel" cmd /k "cloudflared tunnel --url http://localhost:5501"
timeout /t 5 /nobreak >nul
echo ========================================
echo    🚀 SISTEMA ACTIVO
echo ========================================
echo.


pause