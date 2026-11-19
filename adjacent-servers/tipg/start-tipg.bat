:: ###############################################################################
:: tipg
:: The .env beside this script is optional: without it the server starts with
:: the environment it was given.
if exist .env (
  python -m dotenv run python -m uvicorn tipg.main:app --port %1
) else (
  python -m uvicorn tipg.main:app --port %1
)
