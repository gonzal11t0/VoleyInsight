@echo off
title VoleyInsight - Restaurador de Tunel
color 0E
echo ========================================
echo    RESTAURADOR DE TUNEL
echo ========================================
echo.
echo Este script cierra el tunel viejo y abre uno nuevo.
echo La URL nueva aparecera en la ventana del tunel.
echo.
echo Cerrando tunel viejo...
taskkill /f /im ssh.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo.
echo Abriendo tunel nuevo...
start "Tunel Serveo" cmd /k "ssh -R 80:localhost:5500 serveo.net"
timeout /t 3 /nobreak >nul
echo.
echo ========================================
echo    TUNEL RENOVADO
echo ========================================
echo.
echo 1. Revisa la ventana "Tunel Serveo"
echo 2. Copia la NUEVA URL
echo 3. Compartila con quien corresponda
echo.
pause