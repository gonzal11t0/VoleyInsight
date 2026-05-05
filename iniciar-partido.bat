@echo off
title VoleyInsight - Tracker (solo para datos MetroVóley)

cd /d "%~dp0"

echo ========================================
echo 🏐 VOLEYINSIGHT - MODO TRACKER
echo ========================================
echo.
echo 📡 Este script solo inicia el tracker de MetroVóley.
echo 🌐 El dashboard ya está online en:
echo    https://voleyinsight.onrender.com/dashboard/index.html
echo.
echo ⚠️  IMPORTANTE:
echo    - El tracker debe correr MIENTRAS DURE EL PARTIDO
echo    - Los datos se envían al dashboard online automáticamente
echo    - Podés cerrar esta ventana cuando termine el partido
echo.
echo ========================================
echo.

:: Iniciar solo el tracker
echo [1/1] Iniciando tracker...
start "VoleyInsight Tracker" cmd /k npm run tracker

echo.
echo ✅ Tracker iniciado
echo.
echo 📊 Dashboard online: https://voleyinsight.onrender.com/dashboard/index.html
echo 📝 Anotador online: https://voleyinsight.onrender.com/dashboard/anotador.html
echo.
echo ⚠️  Mantené esta ventana ABIERTA durante el partido
echo.

echo Presiona cualquier tecla para CERRAR TODO (después del partido)...
pause >nul

:: Cerrar tracker al salir
echo Cerrando tracker...
taskkill /f /im node.exe >nul 2>&1
echo ✅ Tracker cerrado