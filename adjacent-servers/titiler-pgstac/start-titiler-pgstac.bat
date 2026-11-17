:: ###############################################################################
:: TiTiler-pgSTAC
:: The .env beside this script is optional: without it the server starts with
:: the environment it was given.
if exist .env (
  python -m dotenv run python -m uvicorn titiler.pgstac.main:app --port %1
) else (
  python -m uvicorn titiler.pgstac.main:app --port %1
)
