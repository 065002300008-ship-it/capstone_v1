@echo off
setlocal

cd /d "%~dp0"

set "VENV_DIR=venv"

if not exist "%VENV_DIR%\\Scripts\\python.exe" (
  echo [backend] Creating venv...
  python -m venv "%VENV_DIR%"
)

call "%VENV_DIR%\\Scripts\\activate.bat"

python -c "import uvicorn" 1>nul 2>nul
if errorlevel 1 (
  echo [backend] Installing requirements...
  python -m pip install -r requirements.txt
)

echo [backend] Starting FastAPI on http://localhost:8000 ...
python -m uvicorn main:app --reload --port 8000

