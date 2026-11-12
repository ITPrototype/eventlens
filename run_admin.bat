@echo off
rem Security logni o'qish uchun Administrator huquqi kerak. Bu fayl o'zini avtomatik yuqoriga ko'taradi.
net session >nul 2>&1
if errorlevel 1 (
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)
call "%~dp0run.bat"
