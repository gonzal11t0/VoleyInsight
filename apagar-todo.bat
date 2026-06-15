@echo off
title VoleyInsight - Apagar Sistema
color 0C
echo ========================================
echo    APAGANDO SISTEMA COMPLETO
echo ========================================
echo.
echo Cerrando ventanas...
echo 1. Cerrando Health Check...
taskkill /f /fi "WINDOWTITLE eq Health Check" >nul 2>&1
echo 2. Cerrando túnel...
taskkill /f /im ssh.exe >nul 2>&1
echo 3. Cerrando tracker...
taskkill /f /im node.exe >nul 2>&1
echo 4. Cerrando servidor local...
taskkill /f /im cmd.exe /fi "WINDOWTITLE eq Servidor Local" >nul 2>&1
echo.
echo ========================================
echo    SISTEMA APAGADO
echo ========================================
echo.
timeout /t 2 /nobreak >nul
exit