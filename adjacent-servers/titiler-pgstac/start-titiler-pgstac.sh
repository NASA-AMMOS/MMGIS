#!/bin/bash
###############################################################################
# TiTiler-pgSTAC
python -m dotenv run python -m uvicorn titiler.pgstac.main:app --port $1
