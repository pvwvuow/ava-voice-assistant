@echo off
rem ============================================================
rem  AVA Voice Assistant - one-command git publisher
rem  Usage:  push.cmd "my update message" [-Release]
rem  (this wrapper bypasses PowerShell ExecutionPolicy)
rem ============================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0push.ps1" %*
