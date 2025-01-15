#!/bin/bash
###############################################################################
# TiTiler
python -m dotenv run python -m uvicorn titiler.application.main:app --port $1