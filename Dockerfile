FROM node:20

ARG PUBLIC_URL_ARG=
ENV PUBLIC_URL=$PUBLIC_URL_ARG

# Install GDAL with Python bindings
RUN apt-get -y update
RUN apt-get install -y gdal-bin libgdal-dev python3-pip python3-gdal

# Create app directory
WORKDIR /usr/src/app

# Bundle app source
COPY . .

#############################
# MMGIS
#############################

# Install app dependencies
COPY python-requirements.txt ./
RUN rm /usr/lib/python*/EXTERNALLY-MANAGED && \
    pip3 install -r ./python-requirements.txt

# Use python3 for python
RUN ln -s /usr/bin/python3 /usr/bin/python

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
CMD [ "npm", "run", "start:prod" ]
