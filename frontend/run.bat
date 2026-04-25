@echo off
setlocal

cd /d "%~dp0"

if not exist "node_modules" (
  echo [frontend] Installing dependencies...
  npm.cmd install
)

echo [frontend] Starting Next.js on http://localhost:3000 ...
npm.cmd run dev

