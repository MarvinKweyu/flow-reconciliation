# flow-reconciliation

A flow reconciliation project 

## Project setup
The recommended way to run the project is via docker.

Copy the .env.example, modify it accordingly and run the services.

```bash
cp .env.example .env
docker compose -f docker-compose.local.yml up
```

REST API docs can be accessed via: [localhost:3000/api/docs](localhost:3000/api/docs)

This project comprises of two services:
 - core(nestjs)
 - reconciliation(Python)


The core service handles data persistence while the reconciliation service handles reconciliation. More information can be found under each service's readme file.


To run the tests for each service, you can rely on docker or run it on bare metal. The recommendation is to use docker for a unified and replicable status check across development.

>[!Note]
> We leverage docker networks to communicate between the services

## Run tests inside Docker

### Run tests inside Docker

With docker-compose (uses the dev API service container):

```bash
docker compose -f docker-compose.local.yml run --rm flow-api yarn test          # unit
docker compose -f docker-compose.local.yml run --rm flow-api yarn test:e2e      # e2e
docker compose -f docker-compose.local.yml run --rm flow-api yarn test:cov      # coverage

docker compose -f docker-compose.local.yml run --rm reconciliation pytest   
```


### Run tests on bare metal

```bash
# unit tests
$ yarn run test

# e2e tests
$ yarn run test:e2e

# test coverage
$ yarn run test:cov
```
