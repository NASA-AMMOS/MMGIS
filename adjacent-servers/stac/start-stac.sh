#!/bin/bash
###############################################################################
# STAC
python -m dotenv run python -m uvicorn stac_fastapi.pgstac.app:app --port $1