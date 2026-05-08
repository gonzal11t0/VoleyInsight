@echo off
title VoleyInsight - Sistema Completo
color 0A
chcp 65001 >nul

cd /d "%~dp0"

:: ========================================
:: INICIO
:: ========================================
echo.
echo ========================================
echo    VOLEYINSIGHT - SISTEMA COMPLETO
echo ========================================
echo    Modo: LOCAL + TUNEL (compartible)
echo ========================================
echo.

:: ========================================
:: VERIFICAR NODE.JS
:: ========================================
echo [1/5] Verificando Node.js...
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
:: INICIAR SERVIDOR LOCAL (puerto 5500)
:: ========================================
echo [2/5] Iniciando servidor local...
start "Servidor Local" cmd /c "npx serve . -p 5500"
timeout /t 3 /nobreak >nul
echo OK Servidor en http://localhost:5500
echo.

:: ========================================
:: INICIAR TRACKER
:: ========================================
echo [3/5] Iniciando tracker...
start "Tracker" cmd /c "npm run tracker"
timeout /t 3 /nobreak >nul
echo OK Tracker iniciado
echo.

:: ========================================
:: INICIAR TUNEL SERVE0
:: ========================================
echo [4/5] Iniciando tunel Serveo...
echo    Espera la URL en la ventana del tunel...
start "Tunel Serveo" cmd /c "ssh -R 80:localhost:5500 serveo.net"
timeout /t 5 /nobreak >nul
echo OK Tunel iniciado
echo.

:: ========================================
:: ABRIR NAVEGADOR
:: ========================================
echo [5/5] Abriendo navegador...
start "" "http://localhost:5500/dashboard/index.html"
start "" "http://localhost:5500/dashboard/anotador.html"
echo OK
echo.

:: ========================================
:: INSTRUCCIONES
:: ========================================
echo ========================================
echo    SISTEMA ACTIVO
echo ========================================
echo.
echo LINKS LOCALES (vos):
echo   Dashboard: http://localhost:5500/dashboard/index.html
echo   Anotador:  http://localhost:5500/dashboard/anotador.html
echo.
echo LINKS PARA COMPARTIR:
echo   Revisa la ventana "Tunel Serveo"
echo   Copia la URL que aparece (ej: https://xxxx.serveo.net)
echo   Compartela con quien quieras
echo.
echo ========================================
echo    IMPORTANTE:
echo ========================================
echo    - NO cierres las 4 ventanas negras
echo    - El tunel da una URL que cualquiera puede usar
echo    - Para cerrar todo: cierra manual las ventanas
echo ========================================
echo.

pause