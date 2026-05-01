# Deployment Checklist

## Pre-Deployment

- [ ] All tests pass (`npm test`)
- [ ] ESLint passes with no errors
- [ ] Production build succeeds (`npm run build`)
- [ ] Configure page built (`cd configure && npm run build`)
- [ ] Environment variables configured in `.env`
- [ ] Database initialized (`node scripts/init-db.js`)

## Environment Configuration

- [ ] `NODE_ENV=production`
- [ ] `SECRET` set to strong random string (min 24 chars, use `openssl rand -hex 64`)
- [ ] `AUTH` mode configured (`local` or `csso` for production)
- [ ] `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS` set
- [ ] `TITILER_ALLOWED_URL_PATTERNS` configured for SSRF protection
- [ ] `FRAME_ANCESTORS` set if embedding in iframes

## Docker Deployment

- [ ] `docker-compose.yml` created from sample
- [ ] `POSTGRES_PASSWORD` set in db service
- [ ] `Missions/` directory mounted as volume
- [ ] SSL certificates mounted if using HTTPS
- [ ] Unused adjacent services removed from compose file
- [ ] `docker build -t mmgis .` succeeds
- [ ] `docker-compose up -d` starts all services

## Post-Deployment

- [ ] Admin account created via `/configure` first signup
- [ ] Mission created and configured
- [ ] Map loads and layers display correctly
- [ ] WebSocket connections working (if enabled)
- [ ] Adjacent services accessible (if enabled)
- [ ] Short links working (if enabled)
- [ ] Authentication flow tested

## Security

- [ ] No default/sample passwords in production
- [ ] `SECRET` is unique and not from sample.env
- [ ] DB credentials are not hardcoded anywhere
- [ ] `HIDE_CONFIG=true` if configure page shouldn't be public
- [ ] HTTPS enabled or behind HTTPS proxy
- [ ] `TITILER_ALLOWED_URL_PATTERNS` restricts to trusted sources
