@echo off
cd /d "%~dp0"
node INSTALL_M10-07.cjs
if errorlevel 1 (
 echo [FAIL] Safe install aborted. No source files were overwritten.
 pause
 exit /b 1
)
echo [OK] Review tests and back up before pushing to GitHub.
pause
