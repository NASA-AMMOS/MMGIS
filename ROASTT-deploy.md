# ROASTT deployment

Quickstart guide to deploying Camp to the M2020 ROASTT venue.

## Setup:

* Install AWS command line tools.
* Install Docker.
* Download `awscreds` application from https://github.jpl.nasa.gov/CS3/awscreds/releases

## Deployment

Camp is deployed by building a docker image and pushing to the AWS Elastic Container Registry (ECR). The Camp host is configured to pull images from the ECR. In the steps below we will create a new build and assign a version number (0.1.1 in the example below).

#### Login


```
awscreds   # Enter JPL username/password. This script will print a bunch of values that you need to set as environment variables before continuing
$(aws ecr get-login --no-include-email --region us-gov-west-1)
```

#### Build image

```docker build -t m2020-camp:0.1.1 .```

#### Push to ECR

```
docker tag m2020-camp:0.1.1 718352901043.dkr.ecr.us-gov-west-1.amazonaws.com/camp:0.1.1
docker push 718352901043.dkr.ecr.us-gov-west-1.amazonaws.com/camp:0.1.1
```

#### Update server

On host, edit `docker-compose.yml` and change the version number of the image to match the version that you pushed.

Login in to aws on the server:  
`$(aws ecr get-login --no-include-email --region us-gov-west-1)`

Deploy the new container:

```
> docker-compose down
> docker-compose up -d
```

Removing docker images:
```
> docker images
> docker rmi <imageid>
```
