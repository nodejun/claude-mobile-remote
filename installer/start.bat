@echo off
chcp 65001 >nul 2>&1
title Claude Code Mobile - PC Agent
cd /d "%~dp0"

echo ============================================
echo   Claude Code Mobile - PC Agent
echo   서버를 시작합니다...
echo ============================================
echo.

node.exe dist\main.js

if errorlevel 1 (
    echo.
    echo [오류] 서버 시작에 실패했습니다.
    echo 문제가 지속되면 재설치해 주세요.
    pause
)
