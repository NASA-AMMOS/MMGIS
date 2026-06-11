# syntax=docker/dockerfile:1.4

# ============================================
# Stage 1: Builder Stage
# ============================================
FROM oraclelinux:8.9 AS builder

# System setup (combined RUN for fewer layers)
RUN dnf -y update && \
    dnf -y install ca-certificates bzip2 curl && \
    update-ca-trust enable && \
    update-ca-trust extract && \
    dnf clean all

ARG TARGETPLATFORM
ARG TARGETARCH
ARG PUBLIC_URL_ARG=
ENV PUBLIC_URL=$PUBLIC_URL_ARG

# Create app directory
WORKDIR /usr/src/app

# Copy dependency manifests ONLY (enables layer caching)
# Any source code change won't invalidate dependency installation
COPY package.json package-lock.json ./
COPY configure/package.json configure/package-lock.json ./configure/
COPY python-environment.yml ./

#############################
# Node.js
#############################

RUN dnf module install -y nodejs:20

#############################
# Python (micromamba)
#############################

# Setup micromamba for Python environment
RUN mkdir -p /opt/micromamba/bin && \
    MICROMAMBA_URL="https://micro.mamba.pm/api/micromamba/linux-64/latest" && \
    if [ "${TARGETARCH}" = "arm64" ]; then \
        MICROMAMBA_URL="https://micro.mamba.pm/api/micromamba/linux-aarch64/latest"; \
    elif [ -z "${TARGETARCH}" ]; then \
        echo "TARGETARCH is empty, defaulting to amd64"; \
    fi && \
    echo "Downloading micromamba for ${TARGETARCH} from: ${MICROMAMBA_URL}" && \
    curl -Ls "${MICROMAMBA_URL}" | tar -C /opt/micromamba -xvj bin/micromamba && \
    MAMBA_ROOT_PREFIX="/opt/micromamba"; /opt/micromamba/bin/micromamba shell init -s bash && \
    echo 'export PATH="/opt/micromamba/bin:$PATH"' >> /root/.bashrc && \
    echo 'export MAMBA_ROOT_PREFIX="/opt/micromamba"' >> /root/.bashrc

# Create Python environment with cache mount (packages reused across builds)
RUN --mount=type=cache,target=/opt/micromamba/pkgs \
    source ~/.bashrc && \
    micromamba env create -y --name mmgis --file=python-environment.yml

#############################
# MMGIS Dependencies
#############################

# Install root npm dependencies with cache mount (npm cache reused across builds)
# Install ALL dependencies (including devDependencies) needed for build
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Install configure npm dependencies with cache mount
WORKDIR /usr/src/app/configure
RUN --mount=type=cache,target=/root/.npm \
    npm ci

WORKDIR /usr/src/app

#############################
# Build (copy source AFTER dependencies installed)
#############################

# Now copy source code - changes here won't invalidate dependency layers
COPY . .

# Resolve per-plugin dependencies (writes plugin-package.json,
# plugin-python-requirements.txt, plugin-conda-deps.txt) and install
# whatever each plugin declared on top of the root deps.
RUN node scripts/resolve-plugin-deps.js

RUN --mount=type=cache,target=/root/.npm \
    node scripts/install-plugin-deps.js

RUN if [ -s plugin-python-requirements.txt ] && grep -qv '^#' plugin-python-requirements.txt; then \
        echo "Installing plugin pip dependencies..." && \
        source ~/.bashrc && \
        micromamba run -n mmgis pip install -r plugin-python-requirements.txt; \
    else \
        echo "No plugin pip dependencies to install."; \
    fi

# Build MMGIS main
RUN npm run build

# Build MMGIS Configure
WORKDIR /usr/src/app/configure
RUN rm -rf build/* && npm run build

WORKDIR /usr/src/app

# ============================================
# Stage 2: Runtime Stage
# ============================================
FROM oraclelinux:8.9 AS runtime

# Runtime dependencies only (smaller, more secure)
RUN dnf -y update && \
    dnf -y install ca-certificates curl && \
    update-ca-trust enable && \
    update-ca-trust extract && \
    dnf module install -y nodejs:20 && \
    dnf clean all

ARG PUBLIC_URL_ARG=
ENV PUBLIC_URL=$PUBLIC_URL_ARG

WORKDIR /usr/src/app

# Copy micromamba and Python environment from builder
COPY --from=builder /opt/micromamba /opt/micromamba
RUN MAMBA_ROOT_PREFIX="/opt/micromamba"; /opt/micromamba/bin/micromamba shell init -s bash && \
    echo 'export PATH="/opt/micromamba/bin:$PATH"' >> /root/.bashrc && \
    echo 'export MAMBA_ROOT_PREFIX="/opt/micromamba"' >> /root/.bashrc

# Copy package files for production dependency installation
COPY --from=builder /usr/src/app/package.json ./package.json
COPY --from=builder /usr/src/app/package-lock.json ./package-lock.json

# Install ONLY production dependencies in runtime (no devDependencies)
RUN --mount=type=cache,target=/root/.npm \
    npm ci --only=production

# Re-install plugin npm deps in the runtime stage. Plugin deps are
# installed in the builder with `--no-save --no-package-lock`, so they
# are NOT recorded in `package.json`/`package-lock.json` and would
# otherwise be lost by the `npm ci` above. Backend plugins that
# `require()` their declared npm deps at runtime would fail without
# this step. (Frontend plugin deps are unaffected because webpack
# bundled them into `./build` during the builder stage.)
COPY --from=builder /usr/src/app/plugin-package.json ./plugin-package.json
COPY --from=builder /usr/src/app/scripts/install-plugin-deps.js ./scripts/install-plugin-deps.js
RUN --mount=type=cache,target=/root/.npm \
    node scripts/install-plugin-deps.js

# Copy built artifacts from builder
COPY --from=builder /usr/src/app/build ./build
COPY --from=builder /usr/src/app/configure/build ./configure/build
COPY --from=builder /usr/src/app/configure/public ./configure/public
# Copy configure package.json for version info (no deps needed)
COPY --from=builder /usr/src/app/configure/package.json ./configure/package.json
# Copy API documentation for Swagger UI
COPY --from=builder /usr/src/app/docs/mmgis-openapi.json ./docs/mmgis-openapi.json

# Copy runtime files (excluding source code that's now compiled)
COPY --from=builder /usr/src/app/API ./API
COPY --from=builder /usr/src/app/scripts ./scripts
COPY --from=builder /usr/src/app/public ./public
COPY --from=builder /usr/src/app/configuration ./configuration
COPY --from=builder /usr/src/app/_docker-entrypoint.sh ./_docker-entrypoint.sh

# Copy additional runtime directories
COPY --from=builder /usr/src/app/views ./views
COPY --from=builder /usr/src/app/spice ./spice
COPY --from=builder /usr/src/app/adjacent-servers ./adjacent-servers
COPY --from=builder /usr/src/app/examples ./examples
COPY --from=builder /usr/src/app/private ./private
COPY --from=builder /usr/src/app/blueprints ./blueprints

RUN chmod 755 _docker-entrypoint.sh

EXPOSE 8888
CMD ["./_docker-entrypoint.sh"]
