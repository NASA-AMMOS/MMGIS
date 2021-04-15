FROM node:12

# Install PHP and GDAL
RUN apt-get update
RUN apt-get install -y php7.0-cli php-db php-sqlite3 gdal-bin libgdal-dev python-pip python-gdal

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
