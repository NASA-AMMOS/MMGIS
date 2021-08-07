FROM node:12

# Install GDAL with Python bindings
RUN apt-get update
RUN apt-get install -y gdal-bin libgdal-dev python3-pip python3-gdal

# Use Python3 for python
RUN rm /usr/bin/python && ln -s /usr/bin/python3 /usr/bin/python

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./

RUN npm install

# Bundle app source
COPY . .

# build
RUN npm run build

EXPOSE 8888
CMD [ "npm", "run", "start:prod" ]
