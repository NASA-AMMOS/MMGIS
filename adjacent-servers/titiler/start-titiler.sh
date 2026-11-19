#!/bin/bash
###############################################################################
# TiTiler
# The .env beside this script is optional: without it the server starts with
# the environment it was given.
if [ -f .env ]; then
  exec python -m dotenv run python -m uvicorn titiler.application.main:app --port "$1"
else
  exec python -m uvicorn titiler.application.main:app --port "$1"
fi
