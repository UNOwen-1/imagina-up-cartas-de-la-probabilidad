@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Iniciando Despega...
python servidor.py
if errorlevel 1 (
  echo.
  echo No se pudo iniciar el servidor. Verifica que Python este instalado.
  echo Tambien puedes abrir index.html directamente con doble clic ^(modo demo^).
)
pause
