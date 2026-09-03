@echo off
title D'Limp - Inicializador

cd /d C:\catalogo-dlimp

echo ================================================
echo          D'LIMP - INICIANDO SISTEMA
echo ================================================
echo.

echo Iniciando API - porta 3000...
start "D'Limp API - 3000" cmd /k "cd /d C:\catalogo-dlimp && node .\admin-api\server.js"

timeout /t 2 /nobreak >nul

echo Iniciando Admin - porta 3100...
start "D'Limp Admin - 3100" cmd /k "cd /d C:\catalogo-dlimp && node .\admin\server.js"

timeout /t 2 /nobreak >nul

echo Abrindo sistema no navegador...
start "" "http://localhost:3100"

echo.
echo ================================================
echo          D'LIMP INICIADO
echo ================================================
echo.
echo API:    http://localhost:3000
echo Admin:  http://localhost:3100
echo.
echo Esta janela pode ser fechada.
echo Os servidores continuam funcionando.
echo.

pause