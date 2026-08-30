@echo off
setlocal
title AVA - Push and Build EXE
cd /d "%~dp0"

echo.
echo  ==============================================
echo    AVA Voice Assistant - One-Click Publisher
echo    Push + Auto Build EXE on GitHub Releases
echo  ==============================================
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo  [ERROR] Git not found. Install "Git for Windows" first.
  echo.
  pause
  exit /b 1
)

REM Remove a broken global git proxy if it exists (ignore errors).
git config --global --unset http.proxy >nul 2>nul

set "MSG="
set /p MSG=  Commit message (press Enter for default):
if "%MSG%"=="" set "MSG=AVA update"

echo.
echo  [*] Publishing your changes and requesting the EXE build...
echo  ------------------------------------------------------------
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0release.ps1" -Message "%MSG%"
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" (
  echo  [ERROR] Publish failed - read the messages above.
  echo  Tip: if you see "port 443" or proxy errors, check your internet / VPN.
) else (
  echo  ------------------------------------------------------------
  echo   [OK] All done! GitHub Actions is building your installer.
  echo.
  echo   Watch the build:
  echo   https://github.com/pvwvuow/ava-voice-assistant/actions
  echo.
  echo   In about 5 minutes, download the EXE from:
  echo   https://github.com/pvwvuow/ava-voice-assistant/releases/latest
  echo  ------------------------------------------------------------
)
echo.
pause
endlocal
exit /b %RC%
