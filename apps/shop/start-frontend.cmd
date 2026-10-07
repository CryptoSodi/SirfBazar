@echo off
setlocal
cd /d "%~dp0"

echo Starting SirfBazar merchant frontend...
echo Frontend: http://127.0.0.1:5175
echo Local API: http://127.0.0.1:3001/api
echo.

if not exist "node_modules\vite\bin\vite.js" (
  echo Installing frontend dependencies...
  call npm.cmd ci
  if errorlevel 1 goto :failed
)

call npm.cmd run dev -- --host 127.0.0.1 --port 5175 --strictPort
if errorlevel 1 goto :failed
goto :eof

:failed
echo.
echo Frontend startup failed. Keep this window open and share the error shown above.
pause
exit /b 1
