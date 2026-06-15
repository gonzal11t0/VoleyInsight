@echo off
title VoleyInsight - Health Check (Túnel)
color 0D
cd /d "%~dp0"

:: ========================================
:: CONFIGURACIÓN
:: ========================================
set LOG_FILE=health_check.log
set CHECK_INTERVAL_SEC=300
set TUNEL_WINDOW=Tunel Serveo
set TUNEL_PORT=5500
set LOCALHOST_URL=http://localhost:5500/dashboard/index.html

:: ========================================
:: INICIO
:: ========================================
echo.
echo ========================================
echo    HEALTH CHECK - MONITOREO DE TUNEL
echo ========================================
echo.
echo 📡 Verificando estado cada 5 minutos...
echo 📝 Log guardado en: %LOG_FILE%
echo.
echo Presiona CTRL+C para detener el monitoreo
echo ========================================
echo.

:loop
:: Registrar fecha/hora
set TIMESTAMP=%date% %time%

:: Verificar si el servidor local responde
echo %TIMESTAMP% - 🔍 Verificando servidor local... >> %LOG_FILE%
curl -s -o nul -w "%%{http_code}" %LOCALHOST_URL% > temp_status.txt
set /p HTTP_CODE=<temp_status.txt

if "%HTTP_CODE%"=="200" (
    echo %TIMESTAMP% - ✅ Servidor local OK (HTTP %HTTP_CODE%) >> %LOG_FILE%
) else (
    echo %TIMESTAMP% - ❌ Servidor local FALLÓ (HTTP %HTTP_CODE%) >> %LOG_FILE%
    echo %TIMESTAMP% - 🚨 Servidor local no responde. Verificar ventana "Servidor Local" >> %LOG_FILE%
)

:: Verificar si el túnel está corriendo (ventana abierta)
tasklist /fi "WINDOWTITLE eq %TUNEL_WINDOW%" | find "cmd.exe" >nul
if %errorlevel%==0 (
    echo %TIMESTAMP% - ✅ Ventana del túnel encontrada >> %LOG_FILE%
) else (
    echo %TIMESTAMP% - ❌ Ventana del túnel NO encontrada >> %LOG_FILE%
    echo %TIMESTAMP% - 🔄 Intentando reiniciar el túnel... >> %LOG_FILE%
    
    :: Cerrar túneles viejos
    taskkill /f /im ssh.exe >nul 2>&1
    
    :: Abrir túnel nuevo
    start "%TUNEL_WINDOW%" cmd /k "ssh -R 80:localhost:5500 serveo.net"
    
    echo %TIMESTAMP% - ✅ Túnel reiniciado >> %LOG_FILE%
)

:: Esperar 5 minutos
echo %TIMESTAMP% - ⏳ Próxima verificación en 5 minutos... >> %LOG_FILE%
timeout /t %CHECK_INTERVAL_SEC% /nobreak >nul

goto loop