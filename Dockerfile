FROM oraclelinux:8.9

ARG PUBLIC_URL_ARG=
ENV PUBLIC_URL=$PUBLIC_URL_ARG

# Create app directory
WORKDIR /usr/src/app

# Bundle app source
COPY . .


#############################
# Python
#############################

# micromamba
RUN dnf install -y bzip2
RUN mkdir -p /opt/micromamba/bin
RUN curl -Ls https://micro.mamba.pm/api/micromamba/linux-64/latest | tar -C /opt/micromamba -xvj bin/micromamba
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

##

WORKDIR /usr/src/app/

# 

RUN chmod 755 _docker-entrypoint.sh

EXPOSE 8888
CMD [ "./_docker-entrypoint.sh" ]
