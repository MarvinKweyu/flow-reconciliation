# Flow Reconciliation Service

A Python-based reconciliation service that computes ranked match candidates for invoices and bank transactions.

## Features

- **Heuristic-based matching**: Non-AI, deterministic scoring algorithm
- **Ranked candidates**: Returns sorted matches with confidence scores
- **Human-readable explanations**: Each match includes factors contributing to the score
- **Tenant-scoped**: Processes invoices and transactions per tenant
- **Strawberry GraphQL API**: Modern, type-safe GraphQL interface
- **SQLAlchemy 2.0**: ORM for data models and persistence (if needed)
- **Alembic**: Schema migrations

## Architecture

**Input**: Tenant-scoped invoices and bank transactions from NestJS service
**Processing**: Compute match scores based on:
  - Amount similarity (primary factor)
  - Date proximity
  - Currency match
  - Memo/description hints

**Output**: Ranked match candidates with:
  - Score (0.0–1.0)
  - Factors (list of matching criteria met)
  - Recommendation (human-readable summary)

## Setup

```bash
cd reconciliation

# Install dependencies
pip install -e .

# Run migrations (if using DB for caching)
alembic upgrade head

# Start server
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Docker

```bash
# Build
docker build -t flow-reconciliation .

# Run with docker-compose (from parent flow-project)
docker compose up reconciliation
```

## GraphQL API

Visit `http://localhost:8000/graphql` for Strawberry GraphQL Playground.

### Example Query

```graphql
query MatchCandidates {
  matchCandidates(
    tenantId: 1
    invoices: [
      { id: 1, amount: "500.00", currency: "USD", date: "2026-01-05" }
    ]
    bankTransactions: [
      { id: 10, amount: "500.00", currency: "USD", postedAt: "2026-01-05T10:00:00Z" }
    ]
    minScore: 0.7
  ) {
    invoiceId
    transactionId
    score
    factors
    recommendation
  }
}
```

## Non-Features

This service does **NOT**:
- Handle authentication/authorization
- Enforce multi-tenancy isolation (caller responsible)
- Store final match decisions
- Provide idempotency guarantees
- Persist reconciliation state

## Development

```bash
# Run tests
pytest

# Code style
# (configure ruff or black as needed)
```
<!-- 
[tool.setuptools]
packages = ["app"] -->