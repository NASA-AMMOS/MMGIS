FROM oraclelinux:8.9

RUN dnf -y update
RUN dnf -y install ca-certificates
RUN update-ca-trust enable
RUN update-ca-trust extract
RUN dnf clean all

ARG PUBLIC_URL_ARG=
ENV PUBLIC_URL=$PUBLIC_URL_ARG

# Create app directory
WORKDIR /usr/src/app

# Bundle app source
COPY . .

#############################
# Python
#############################

# Use build arguments to detect target platform (default to amd64 if not provided)
ARG TARGETPLATFORM
ARG TARGETARCH

# micromamba - Platform-specific download
RUN dnf install -y bzip2 curl
RUN mkdir -p /opt/micromamba/bin

# Download correct micromamba binary based on architecture
RUN MICROMAMBA_URL="https://micro.mamba.pm/api/micromamba/linux-64/latest" && \
    if [ "${TARGETARCH}" = "arm64" ]; then \
        MICROMAMBA_URL="https://micro.mamba.pm/api/micromamba/linux-aarch64/latest"; \
    elif [ -z "${TARGETARCH}" ]; then \
        echo "TARGETARCH is empty, defaulting to amd64"; \
    fi && \
    echo "Downloading micromamba for ${TARGETARCH} from: ${MICROMAMBA_URL}" && \
    curl -Ls "${MICROMAMBA_URL}" | tar -C /opt/micromamba -xvj bin/micromamba

RUN MAMBA_ROOT_PREFIX="/opt/micromamba"; /opt/micromamba/bin/micromamba shell init -s bash
RUN echo 'export PATH="/opt/micromamba/bin:$PATH"' >> /root/.bashrc && echo 'export MAMBA_ROOT_PREFIX="/opt/micromamba"' >> /root/.bashrc

RUN source ~/.bashrc && micromamba env create -y --name mmgis --file=python-environment.yml

#############################
# Node
#############################

RUN dnf module install nodejs:20

#############################
# MMGIS
#############################

RUN npm install

# build
RUN npm run build

#############################
# MMGIS Configure
#############################

WORKDIR /usr/src/app/configure

# Clean out configure build folder
RUN rm -rf /usr/src/app/configure/build/*

RUN npm install

# Build Configure Site
RUN npm run build

WORKDIR /usr/src/app/

RUN chmod 755 _docker-entrypoint.sh

EXPOSE 8888
CMD [ "./_docker-entrypoint.sh" ]
