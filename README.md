# FlowRecon

> A Multi-Tenant Invoice Reconciliation engine

FlowRecon is a multi-tenant financial reconciliation engine designed to help organizations reconcile invoices against bank transactions at scale.

The system combines deterministic reconciliation heuristics with an optional AI-assisted explanation layer, while enforcing defense-in-depth tenant isolation using PostgreSQL Row Level Security (RLS). It is intentionally designed as a platform component rather than a monolithic application. Think of it as a '_plug-in_' to the rest of your existing system.

- [FlowRecon](#flowrecon)
  - [Architecture Overview](#architecture-overview)
  - [Project setup](#project-setup)
    - [Running tests](#running-tests)


## Architecture Overview

**Core Backend (Primary)**
- NestJS
- GraphQL (Apollo)
- PostgreSQL
- Drizzle ORM

**Python Backend (Reconciliation Engine)**

- Python 3.13
- Strawberry GraphQL
- SQLAlchemy 2.0
- Alembic
- Deterministic scoring & explanation logic

## Project setup

The recommended way to run the project is via `docker`.

Copy the .env.example, modify it accordingly and run the services.

```bash
cp .env.example .env
docker compose -f docker-compose.local.yml up
```

By default, communication between these services(core and reconcilliation engine) happens through the docker network.

The compose will launch:

- core(nestjs): `http://localhost:3000`
- reconciliation(Python): `http://localhost:8001/graphql`

REST API docs can be accessed via: [127.0.0.1:3000/api/docs](127.0.0.1:3000/api/docs)

The `core service` handles data persistence while the `reconciliation service` handles reconciliation accordingly. More information can be found under each service's readme file.

To run the tests for each service, you can rely on docker or run it on bare metal. The recommendation is to use docker for a unified and replicable status check across development.

### Running tests

With docker-compose (uses the dev API service container):

```bash
docker compose -f docker-compose.local.yml run --rm flow-api yarn test          # unit
docker compose -f docker-compose.local.yml run --rm flow-api yarn test:e2e      # e2e
docker compose -f docker-compose.local.yml run --rm flow-api yarn test:cov      # coverage

docker compose -f docker-compose.local.yml run --rm reconciliation pytest
```