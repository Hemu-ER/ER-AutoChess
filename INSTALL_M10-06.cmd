@echo off
chcp 65001 >nul
cd /d "%~dp0"
node "%~dp0INSTALL_M10-06.cjs"
if errorlevel 1 (
  echo.
  echo 설치가 중단됐습니다. 위 오류를 확인해 주세요.
) else (
  echo.
  echo 설치 후 게임 서버를 재시작하고 Ctrl+F5로 새로고침해 주세요.
)
pause
