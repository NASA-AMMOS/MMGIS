#!/bin/bash
# Load service-specific settings when present; otherwise inherit MMGIS ENVs.
if [ -f .env ]; then
  exec python -m dotenv -f .env run python -m uvicorn stac_fastapi.pgstac.app:app --port "$1"
else
  exec python -m uvicorn stac_fastapi.pgstac.app:app --port "$1"
fi
