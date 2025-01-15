#!/bin/bash
###############################################################################
# tipg
python -m dotenv run python -m uvicorn tipg.main:app --port $1
