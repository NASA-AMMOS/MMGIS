FROM node:16.13.2@sha256:7c49a64aba86dd483aa874bc0230c07f282e20741a7c66e426970ecafc149a38 as base

ARG PUBLIC_URL_ARG=
ENV PUBLIC_URL=$PUBLIC_URL_ARG

# Install GDAL with Python bindings
RUN apt-get -y update
RUN apt-get install -y gdal-bin libgdal-dev python3-pip python3-gdal

# Use Python3 for python
RUN rm /usr/bin/python && ln -s /usr/bin/python3 /usr/bin/python

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./

RUN npm install


# 
FROM base as dev

COPY . .

EXPOSE 8888

#
FROM base as prod

# Bundle app source
COPY . .

# build
RUN npm run build

EXPOSE 8888
