#!/bin/bash
###############################################################################
# tipg
dotenv run python -m uvicorn tipg.main:app --port $1
