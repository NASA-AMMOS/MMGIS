# Troubleshooting

## Database Connection Fails

**Symptoms**: Server crashes on startup, "connection refused" errors

**Solutions**:
1. Check `.env` has correct `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`
2. Verify PostgreSQL is running: `docker-compose ps` or `pg_isready`
3. Check PostgreSQL logs: `docker-compose logs db`
4. Ensure PostGIS extension is installed in your PostgreSQL instance
5. If using Docker, ensure `DB_HOST` matches the service name (e.g., `db`)

## WebSocket Connections Not Working

**Symptoms**: Draw Tool sync fails, no real-time updates

**Solutions**:
1. Ensure WebSocket port is not blocked by firewall
2. Check browser console for WebSocket errors
3. Verify authentication is working (WebSocket requires valid session)
4. Review `API/Backend/APIs/Websocket.js` logs
5. Check `ENABLE_MMGIS_WEBSOCKETS=true` in `.env`
6. If behind a proxy, ensure it supports WebSocket upgrade

## Maps Not Rendering

**Symptoms**: Blank map area, no tiles loading

**Solutions**:
1. Check browser console for Leaflet/Cesium errors
2. Verify tile URLs are accessible (test in browser)
3. Check mission configuration in configure interface
4. Ensure layers are enabled and visible
5. Check if bounding box is correctly set for tile layers

## File Upload Fails

**Symptoms**: Error when uploading geodatasets or mission data

**Solutions**:
1. Ensure `Missions/` directory exists and is writable
2. Check file size limits in Express configuration
3. If Docker, ensure volume is mounted correctly

## Build Fails with Webpack Errors

**Symptoms**: `npm run build` fails with compilation errors

**Solutions**:
1. Clear and reinstall: `rm -rf node_modules && npm install`
2. Check for syntax errors in modified files
3. Review `webpack.config.js` for misconfigurations
4. Check Node.js version (requires 22+)

## Configure Page Not Working

**Symptoms**: Blank page or 404 at `/configure`

**Solutions**:
1. Build the configure app: `cd configure && npm install && npm run build && cd ..`
2. Check `HIDE_CONFIG` is not set to `true`
3. Ensure admin account exists (first user is auto-admin)

## `.env` File Issues

**Symptoms**: Server uses wrong defaults, unexpected behavior

**Solutions**:
1. Ensure `.env` exists (not just `sample.env`): `cp sample.env .env`
2. Check for quotes around values — some ENVs are sensitive to quoting
3. `SECRET` must be at least 24 characters
4. Boolean values must be lowercase: `true`/`false`

## Dev Mode Port Confusion

**Symptoms**: App doesn't load at expected URL

**Solutions**:
1. In development mode, browse the app at port **8889** (PORT+1), NOT 8888
2. Port 8888 is the Express API server
3. The webpack dev server on 8889 proxies API requests to 8888

## SPICE Kernel Errors

**Symptoms**: Shade Tool fails, SPICE computation errors

**Solutions**:
1. Verify `SPICE_SCHEDULED_KERNEL_DOWNLOAD=true`
2. Check `/Missions/spice-kernels-conf.json` exists and is valid
3. Verify kernel URLs are accessible
4. Check `/spice/kernels/` directory for downloaded kernels
