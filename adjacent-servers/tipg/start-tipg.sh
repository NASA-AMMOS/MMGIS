#!/bin/bash
###############################################################################
# tipg
# The .env beside this script is optional: without it the server starts with
# the environment it was given.
if [ -f .env ]; then
  exec python -m dotenv run python -m uvicorn tipg.main:app --port "$1"
else
  exec python -m uvicorn tipg.main:app --port "$1"
fi
