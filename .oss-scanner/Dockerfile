# Build image for the Anthropic OSS Scanner (https://github.com/anthropics/oss-scanner).
#
# This is NOT the production image (see /Dockerfile). It keeps the full source tree, dev dependencies,
# tests and a local PostgreSQL/PostGIS at /src so the scanner can build, run and test MMGIS with no
# network access. The scanner builds it with the repository root as the context, using
# .oss-scanner/Dockerfile.dockerignore instead of the production .dockerignore.
#
# Once built: run .oss-scanner/start-mmgis.sh to start PostgreSQL and MMGIS on :8888 with a seeded
# admin, a non-admin user and the Reference Mission.
FROM node:20-bookworm

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl bzip2 git jq openssl procps python3 \
      postgresql-15 postgresql-15-postgis-3 postgresql-contrib \
    && rm -rf /var/lib/apt/lists/*

#############################
# Python (micromamba), same environment as production
#############################

ARG TARGETARCH
ENV MAMBA_ROOT_PREFIX=/opt/micromamba
COPY python-environment.yml /tmp/python-environment.yml
RUN mkdir -p /opt/micromamba/bin && \
    MICROMAMBA_URL="https://micro.mamba.pm/api/micromamba/linux-64/latest" && \
    if [ "${TARGETARCH}" = "arm64" ]; then \
        MICROMAMBA_URL="https://micro.mamba.pm/api/micromamba/linux-aarch64/latest"; \
    fi && \
    curl -Ls "${MICROMAMBA_URL}" | tar -C /opt/micromamba -xj bin/micromamba && \
    /opt/micromamba/bin/micromamba env create -y --name mmgis --file=/tmp/python-environment.yml && \
    /opt/micromamba/bin/micromamba clean -a -y

ENV CONDA_DEFAULT_ENV=mmgis \
    CONDA_PREFIX=/opt/micromamba/envs/mmgis \
    PATH=/opt/micromamba/envs/mmgis/bin:/opt/micromamba/bin:$PATH \
    GDAL_DATA=/opt/micromamba/envs/mmgis/share/gdal \
    GDAL_DRIVER_PATH=/opt/micromamba/envs/mmgis/lib/gdalplugins \
    PROJ_DATA=/opt/micromamba/envs/mmgis/share/proj \
    PROJ_NETWORK=OFF \
    CPL_ZIP_ENCODING=UTF-8

#############################
# MMGIS source, dependencies and build
#############################

# scanner contract: the checkout lives inside the image, at /src
COPY . /src
WORKDIR /src

# Root deps (postinstall also resolves and installs plugin deps), then the Configure app's deps
RUN npm ci && (cd configure && npm ci)

RUN if [ -s plugin-python-requirements.txt ] && grep -qv '^#' plugin-python-requirements.txt; then \
        pip install -r plugin-python-requirements.txt; \
    fi

RUN npm run build && (cd configure && npm run build)

# Chromium for the Playwright E2E suite, which must run offline later
RUN npx playwright install --with-deps chromium && rm -rf /var/lib/apt/lists/*

#############################
# Local PostgreSQL/PostGIS and .env
#############################

# The cluster is local to this sandbox; mmgis is a superuser so init-db.js can create the DB and extensions.
RUN pg_ctlcluster 15 main start && \
    su postgres -c "psql -v ON_ERROR_STOP=1 -c \"CREATE ROLE mmgis WITH LOGIN SUPERUSER PASSWORD 'mmgis'\"" && \
    pg_ctlcluster 15 main stop

RUN cp .oss-scanner/scanner.env .env && \
    echo "SECRET=$(openssl rand -hex 32)" >> .env && \
    pg_ctlcluster 15 main start && \
    node scripts/init-db.js && \
    pg_ctlcluster 15 main stop

# Cheap tests so we know the image works; failures must not abort the build
RUN timeout 900 npm run test:unit || echo "WARNING: unit tests reported failures"
