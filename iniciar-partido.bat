@echo off
title VoleyInsight - Inicio Rapido

cd /d "%~dp0"

echo ========================================
echo 🏐 VoleyInsight - INICIO RAPIDO
echo ========================================
echo.

:: Iniciar servidores
echo [1/3] Iniciando servidores...
start "API" cmd /k node server-api.js
timeout /t 2 /nobreak >nul
start "Web" cmd /k npx serve . -p 5500
timeout /t 2 /nobreak >nul
start "Tracker" cmd /k npm start

:: Iniciar Serveo (alternativa a Cloudflare)
echo.
echo [2/3] Generando URL publica con Serveo...
echo.

:: Buscar Git Bash
if exist "C:\Program Files\Git\git-bash.exe" (
    set GITBASH="C:\Program Files\Git\git-bash.exe"
) else if exist "C:\Program Files (x86)\Git\git-bash.exe" (
    set GITBASH="C:\Program Files (x86)\Git\git-bash.exe"
) else (
    echo ❌ No se encontro Git Bash. Descargalo de https://git-scm.com/download/win
    echo.
    echo Mientras tanto, podes acceder localmente:
    echo http://localhost:5500/dashboard/index.html
    pause
    exit /b
)

:: Abrir Git Bash con Serveo
start "Serveo Tunnel" %GITBASH% -c "ssh -R 80:localhost:5500 serveo.net; echo; echo Presiona Enter para cerrar...; read"

echo.
echo ========================================
echo 🟢 SISTEMA INICIADO
echo ========================================
echo.
echo 📡 BUSCA LA URL en la ventana "Serveo Tunnel"
echo    Se ve asi: https://xxxx.serveousercontent.com
echo.
echo 📱 Comparti: [ESA_URL]/dashboard/index.html
echo    Ejemplo: https://xxxx.serveousercontent.com/dashboard/index.html
echo.
echo ⚠️  No cierres las ventanas durante el partido
echo.
echo Presiona cualquier tecla para CERRAR TODO...
pause >nul

:: Cerrar todo al salir
echo Cerrando servicios...
taskkill /f /im node.exe >nul 2>&1
taskkill /f /im ssh.exe >nul 2>&1
echo ✅ Todo cerrado