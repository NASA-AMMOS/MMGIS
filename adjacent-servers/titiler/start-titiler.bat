@echo off
if exist .env (
  python -m dotenv -f .env run python -m uvicorn titiler.application.main:app --port %1
) else (
  python -m uvicorn titiler.application.main:app --port %1
)
exit /b %errorlevel%
