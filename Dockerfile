FROM node:10

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN mkdir ./API
COPY API/package*.json ./API/

RUN npm install
RUN cd API && npm install

# Bundle app source
COPY . .

# Install PHP and GDAL
RUN apt-get update
RUN apt-get install -y php7.0-cli php-db php-sqlite3 gdal-bin libgdal-dev python-pip python-gdal

EXPOSE 8888
CMD [ "node", "./server.js" ]
