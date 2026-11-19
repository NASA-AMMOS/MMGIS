#!/bin/bash
###############################################################################
# TiTiler-pgSTAC
# The .env beside this script is optional: without it the server starts with
# the environment it was given.
if [ -f .env ]; then
  exec python -m dotenv run python -m uvicorn titiler.pgstac.main:app --port "$1"
else
  exec python -m uvicorn titiler.pgstac.main:app --port "$1"
fi
