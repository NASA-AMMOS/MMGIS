#!/bin/bash
# Load service-specific settings when present; otherwise inherit MMGIS ENVs.
if [ -f .env ]; then
  exec python -m dotenv -f .env run python -m uvicorn titiler.application.main:app --port "$1"
else
  exec python -m uvicorn titiler.application.main:app --port "$1"
fi
