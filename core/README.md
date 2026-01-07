

## Core service
> The persistent layer of hte flow-reconciliation app.

To run the project, access teh compose at the root of the project. After running the compose file, you can access the REST API docs via: [localhost:3000/api/docs](localhost:3000/api/docs)

## Database & Drizzle ORM

- Set `DATABASE_URL` in your environment to a PostgreSQL connection string, e.g. `postgres://user:pass@localhost:5432/dbname`.
- Schema is defined in `src/db/schema.ts` with tables:
  - `tenant` - tenants
  - `vendor` - vendors (optional FK to tenant)
  - `invoice` - invoices with FK to tenant and optional vendor
  - `bank_transaction` - bank transactions with FK to tenant
  - `match` - matches linking invoices to bank transactions
- drizzle-kit is configured via `drizzle.config.ts`.

Generate migrations:

```bash
yarn drizzle-kit generate
```

Push schema (apply SQL):

```bash
yarn drizzle-kit push
```
While REST docs are accessible ([localhost:3000/api/docs](localhost:3000/api/docs)), GraphQL can be viewed below with more examples on the file `GRAPHQL_EXAMPLES.md` in this same directory.


## Tenants GraphQL API

- GraphQL:
  - Query: `tenants { id name createdAt updatedAt }`
  - Mutation: `createTenant(input: { name: "Acme" }) { id name }`

## Invoices API

- GraphQL:
  - Query: `invoices(tenantId: 1, filters: { status: OPEN }, pagination: { page: 1, pageSize: 20 }) { items { id amount status } total }`
  - Mutation: `createInvoice(tenantId: 1, input: { amount: "500.00" }) { id amount }`
  - Mutation: `deleteInvoice(tenantId: 1, invoiceId: 1) { id }`

## Bank Transactions API

- GraphQL:
  - Query: `bankTransactions(tenantId: 1, filters: { dateFrom: "2026-01-01" }, pagination: { page: 1 }) { items { id amount postedAt } total }`
  - Mutation: `importBankTransactions(tenantId: 1, input: { transactions: [...] }, idempotencyKey: "key") { imported skipped errors }`

## Matches & Reconciliation API

### REST Endpoints

- `POST /tenants/{tenant_id}/reconcile` – find match candidates
  - Optional body: `{ minScore: 0.7, invoiceIds: [1, 2], transactionIds: [1, 2, 3] }`
  - Returns top candidates per invoice (best 3 matches per invoice)

Example:
```bash
curl -X POST http://localhost:3000/tenants/1/reconcile \
  -H "Content-Type: application/json" \
  -d '{"minScore": 0.8}'
```

Response:
```json
{
  "total": 5,
  "topCandidates": [
    {
      "invoiceId": 1,
      "bankTransactionId": 10,
      "score": 1.0,
      "invoiceAmount": "500.00",
      "transactionAmount": "500.00",
      "reason": "Exact amount match"
    }
  ],
  "summary": {
    "invoicesWithMatches": 3,
    "totalCandidates": 5
  }
}
```

- `POST /tenants/{tenant_id}/matches/{match_id}/confirm` – confirm a proposed match
  - Updates match status to `confirmed`
  - Updates related invoice status to `matched`

Example:
```bash
curl -X POST http://localhost:3000/tenants/1/matches/1/confirm
```

### Reconciliation Design

**Algorithm:** Simple amount-based matching with greedy approach
- Scoring: `score = 1 - (abs(invoiceAmount - transactionAmount) / max(amounts))`
- Candidates filtered by `minScore` threshold (default 0.7)
- Returns **top 3 matches per invoice** to prevent overwhelming users
- Each invoice/transaction pair matched at most once (greedy)
- Higher scores prioritized

**REST Response Structure:**
- `topCandidates`: Filtered list (max 3 per invoice, sorted by score)
- `summary`: Metadata (invoices with matches, total candidate count)

### GraphQL Equivalents

- Query: `matchCandidates(tenantId, filters)` – all candidates (no top-3 limit)
- Query: `explainReconciliation(tenantId, invoiceId, transactionId)` – score breakdown
- Mutation: `reconcile(tenantId, input?)` – auto-create proposed matches in DB
- Mutation: `confirmMatch(tenantId, matchId)` – confirm and update status

Example GraphQL queries:
```graphql
query GetInvoices {
  invoices(tenantId: 1, filters: { status: OPEN, amountMin: "100" }, pagination: { page: 1, pageSize: 10 }) {
    items { id invoiceNumber amount status }
    total
    page
  }
}

mutation CreateInvoice {
  createInvoice(tenantId: 1, input: { amount: "500.00", description: "Office supplies" }) {
    id amount status createdAt
  }
}

query FindMatches {
  matchCandidates(tenantId: 1, filters: { minScore: 0.8 }) {
    invoiceId
    bankTransactionId
    score
    invoiceAmount
    transactionAmount
    reason
  }
}

mutation RunReconciliation {
  reconcile(tenantId: 1, input: { minScore: 0.9 }) {
    matchesCreated
    matches { id invoiceId bankTransactionId score status }
  }
}
```

## Invoices API

- `POST /tenants/{tenant_id}/invoices` – create an invoice
- `GET /tenants/{tenant_id}/invoices` – list invoices with optional filters:
  - `status` (open|matched|paid)
  - `vendorId` (number)
  - `dateFrom` / `dateTo` (ISO date strings)
  - `amountMin` / `amountMax` (numeric strings)
- `DELETE /tenants/{tenant_id}/invoices/{id}` – delete an invoice

Example:
```bash
curl -X POST http://localhost:3000/tenants/1/invoices \
  -H "Content-Type: application/json" \
  -d '{"amount":"500.00","invoiceNumber":"INV-001","description":"Office supplies"}'

curl "http://localhost:3000/tenants/1/invoices?status=open&amountMin=100"
```

## Bank Transactions API

- `POST /tenants/{tenant_id}/bank-transactions/import` – bulk import bank transactions
  - Idempotent: skips transactions with duplicate `externalId` for the same tenant

Example:
```bash
curl -X POST http://localhost:3000/tenants/1/bank-transactions/import \
  -H "Content-Type: application/json" \
  -d '{
    "transactions": [
      {"externalId":"ext123","postedAt":"2026-01-05T10:00:00Z","amount":"500.00","description":"Payment"},
      {"externalId":"ext124","postedAt":"2026-01-06T14:30:00Z","amount":"750.50","description":"Transfer"}
    ]
  }'
```

## AI Model Configuration

- Set `AI_MODEL` env var to control the global model for all clients.
- Default: `GPT-5.1-Codex-Max`.

