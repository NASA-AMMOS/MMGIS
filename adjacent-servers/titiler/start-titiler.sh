#!/bin/bash
###############################################################################
# TiTiler
dotenv run python -m uvicorn titiler.application.main:app --port $1