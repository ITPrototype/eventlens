@echo off
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python topilmadi. https://www.python.org dan o'rnating ^(Add to PATH belgisini yoqing^).
  pause
  exit /b 1
)
if not exist ".venv\Scripts\python.exe" (
  echo Virtual muhit yaratilmoqda...
  python -m venv .venv
)
call ".venv\Scripts\activate.bat"
pip install -q -r requirements.txt
python app.py
pause
