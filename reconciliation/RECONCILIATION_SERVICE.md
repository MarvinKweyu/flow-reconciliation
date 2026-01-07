# Integration with Reconciliation Service

The reconciliation service is a separate Python application that provides GraphQL API for matching invoices to bank transactions using deterministic heuristics.

## Running Both Services

### Development

```bash
cd flow-project

# Start all services (NestJS API + Reconciliation service)
docker-compose -f docker-compose.local.yml up --build
```

Endpoints:
- NestJS REST/GraphQL: `http://localhost:3000`
- Reconciliation GraphQL: `http://localhost:8000/graphql`

### Production

```bash
docker-compose -f docker-compose.production.yml up --build -d
```

## Reconciliation Service Architecture

**Location:** `reconciliation/`

**Stack:**
- Python 3.13
- Strawberry GraphQL
- SQLAlchemy 2.0
- Uvicorn

**What it does:**
- Receives tenant-scoped invoices and bank transactions
- Computes ranked match candidates using deterministic heuristics
- Returns scores and human-readable explanations
- **Does NOT:** Handle auth, multi-tenancy isolation, persistence, idempotency

**Scoring Heuristics:**
1. **Amount similarity** (50% weight): Tolerance-based with decay beyond 2% diff
2. **Currency match** (20% weight): Exact match required
3. **Date proximity** (30% weight): Preferred within 7 days
4. **Description hints** (bonus): Keyword overlap in memo/description

## GraphQL API

Visit `http://localhost:8000/graphql` for Strawberry GraphQL Playground.

### Query: matchCandidates

```graphql
query {
  matchCandidates(
    tenantId: 1
    invoices: [
      { id: 1, amount: "500.00", currency: "USD", date: "2026-01-05" }
    ]
    bankTransactions: [
      { id: 10, amount: "500.00", currency: "USD", postedAt: "2026-01-05T10:00:00Z" }
    ]
    minScore: 0.70
  ) {
    invoiceId
    transactionId
    score
    factors
    recommendation
  }
}
```

**Response:**
```json
{
  "data": {
    "matchCandidates": [
      {
        "invoiceId": 1,
        "transactionId": 10,
        "score": 1.0,
        "factors": [
          "Exact amount match",
          "Currency match: USD",
          "Same day posting"
        ],
        "recommendation": "Highly recommended match"
      }
    ]
  }
}
```

## Integration Flow

1. NestJS API receives `/tenants/{tenant_id}/reconcile` REST request
2. NestJS fetches invoices and transactions from DB
3. NestJS calls Reconciliation service GraphQL `matchCandidates` query
4. Reconciliation service returns scored candidates
5. NestJS formats response and returns to client (or auto-creates matches)

## Deployment Notes

- Services run on separate ports (3000 for NestJS, 8000 for Python)
- Both connected to same Docker network (`flow`)
- Reconciliation service is stateless (no DB required)
- Suitable for horizontal scaling (stateless GraphQL service)
