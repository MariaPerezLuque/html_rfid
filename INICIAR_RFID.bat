@echo off
echo Iniciando el Servidor de Tarjetas...
:: 1. Inicia el servidor Node.js minimizado para que no moleste
start /min cmd /k "node bridge.js"

:: 2. Espera 2 segundos a que el servidor arranque
timeout /t 2 /nobreak >nul

:: 3. Abre tu HTML en el navegador predeterminado
start index.html

exit