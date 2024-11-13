FROM node:20

ARG PUBLIC_URL_ARG=
ENV PUBLIC_URL=$PUBLIC_URL_ARG

# Create app directory
WORKDIR /usr/src/app

# Bundle app source
COPY . .

#############################
# Python
#############################


RUN curl -Ls https://micro.mamba.pm/api/micromamba/linux-64/latest | tar -C  -xvj bin/micromamba
RUN eval "$(micromamba shell hook --shell bash)"
RUN echo 'export PATH="/opt/micromamba/bin:$PATH"' >> /root/.bashrc && echo 'export MAMBA_ROOT_PREFIX="/opt/micromamba"' >> /root/.bashrc

RUN . ~/.bashrc && micromamba env create -y --name mmgis --file=python-environment.yml
RUN . ~/.bashrc && micromamba activate mmgis

#RUN mkdir -p /opt/micromamba/bin
#RUN curl -Ls https://micro.mamba.pm/api/micromamba/linux-64/latest | tar -C /opt/micromamba -xvj bin/micromamba
#RUN MAMBA_ROOT_PREFIX="/opt/micromamba"; /opt/micromamba/bin/micromamba shell hook -s posix
#RUN echo 'export PATH="/opt/micromamba/bin:$PATH"' >> /root/.bashrc && echo 'export MAMBA_ROOT_PREFIX="/opt/micromamba"' >> /root/.bashrc

#COPY python-environment.yml ./
#RUN . ~/.bashrc && micromamba env create -y --name mmgis --file=python-environment.yml
#RUN . ~/.bashrc && /opt/micromamba/bin/micromamba shell init -s bash -r /opt/micromamba
#RUN . ~/.bashrc && micromamba activate mmgis

#RUN mkdir -p /opt/micromamba/bin
#ENV MAMBA_ROOT_PREFIX="/opt/micromamba"
#RUN curl -Ls https://micro.mamba.pm/api/micromamba/linux-64/latest | tar -C /opt/micromamba -xvj bin/micromamba
#RUN /opt/micromamba/bin/micromamba shell init -s bash -r /opt/micromamba/bin/micromamba

#RUN /opt/micromamba/bin/micromamba env create -y --name mmgis --file=python-environment.yml
#RUN /opt/micromamba/bin/micromamba activate mmgis


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

EXPOSE 8888
CMD [ "npm", "run", "start:prod-docker" ]
