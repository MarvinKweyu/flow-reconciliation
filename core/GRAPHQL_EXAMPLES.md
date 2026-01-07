# GraphQL API Examples

Visit http://localhost:3000/graphql for the GraphQL Playground.

## Queries

### List Tenants
```graphql
query ListTenants {
  tenants {
    id
    name
    createdAt
    updatedAt
  }
}
```

### List Invoices (with filters and pagination)
```graphql
query ListInvoices {
  invoices(
    tenantId: 1
    filters: {
      status: OPEN
      amountMin: "100"
      amountMax: "1000"
      dateFrom: "2026-01-01"
      dateTo: "2026-12-31"
    }
    pagination: { page: 1, pageSize: 20 }
  ) {
    items {
      id
      invoiceNumber
      amount
      currency
      status
      vendorId
      description
      invoiceDate
      createdAt
    }
    total
    page
    pageSize
  }
}
```

### List Bank Transactions (with filters and pagination)
```graphql
query ListBankTransactions {
  bankTransactions(
    tenantId: 1
    filters: {
      dateFrom: "2026-01-01"
      dateTo: "2026-01-31"
      amountMin: "100"
      description: "payment"
    }
    pagination: { page: 1, pageSize: 10 }
  ) {
    items {
      id
      externalId
      postedAt
      amount
      currency
      description
      createdAt
    }
    total
    page
    pageSize
  }
}
```

### Find Match Candidates
```graphql
query FindMatchCandidates {
  matchCandidates(tenantId: 1, filters: { minScore: 0.7 }) {
    invoiceId
    bankTransactionId
    score
    invoiceAmount
    transactionAmount
    invoiceDate
    transactionDate
    reason
  }
}
```

### Explain Reconciliation
```graphql
query ExplainMatch {
  explainReconciliation(tenantId: 1, invoiceId: 1, transactionId: 1) {
    invoiceId
    transactionId
    score
    factors
    recommendation
  }
}
```

## Mutations

### Create Tenant
```graphql
mutation CreateTenant {
  createTenant(input: { name: "Acme Corporation" }) {
    id
    name
    createdAt
    updatedAt
  }
}
```

### Create Invoice
```graphql
mutation CreateInvoice {
  createInvoice(
    tenantId: 1
    input: {
      amount: "500.00"
      currency: "USD"
      invoiceNumber: "INV-001"
      description: "Office supplies"
      invoiceDate: "2026-01-05"
      status: OPEN
      vendorId: 1
    }
  ) {
    id
    invoiceNumber
    amount
    currency
    status
    description
    createdAt
  }
}
```

### Delete Invoice
```graphql
mutation DeleteInvoice {
  deleteInvoice(tenantId: 1, invoiceId: 1) {
    id
    invoiceNumber
    amount
    status
  }
}
```

### Import Bank Transactions
```graphql
mutation ImportTransactions {
  importBankTransactions(
    tenantId: 1
    idempotencyKey: "import-2026-01-07"
    input: {
      transactions: [
        {
          externalId: "ext-123"
          postedAt: "2026-01-05T10:30:00Z"
          amount: "500.00"
          currency: "USD"
          description: "Payment received"
        }
        {
          externalId: "ext-124"
          postedAt: "2026-01-06T14:15:00Z"
          amount: "750.50"
          currency: "USD"
          description: "Wire transfer"
        }
      ]
    }
  ) {
    imported
    skipped
    errors
  }
}
```

### Run Reconciliation
```graphql
mutation RunReconciliation {
  reconcile(
    tenantId: 1
    input: {
      minScore: 0.9
      invoiceIds: [1, 2, 3]
      transactionIds: [1, 2, 3]
    }
  ) {
    matchesCreated
    matches {
      id
      invoiceId
      bankTransactionId
      score
      status
      createdAt
    }
  }
}
```

### Confirm Match
```graphql
mutation ConfirmMatch {
  confirmMatch(tenantId: 1, matchId: 1) {
    id
    invoiceId
    bankTransactionId
    score
    status
    updatedAt
  }
}
```

## Example Workflow

1. **Create a tenant**
2. **Create invoices** for that tenant
3. **Import bank transactions** (idempotent via externalId)
4. **Find match candidates** to see potential reconciliation pairs
5. **Explain specific matches** to understand the score
6. **Run reconciliation** to automatically create proposed matches
7. **Confirm matches** to finalize them and update invoice status

## Using Variables

```graphql
mutation CreateInvoiceWithVariables($tenantId: Int!, $input: CreateInvoiceInput!) {
  createInvoice(tenantId: $tenantId, input: $input) {
    id
    amount
    status
  }
}
```

Variables:
```json
{
  "tenantId": 1,
  "input": {
    "amount": "500.00",
    "description": "Consulting services"
  }
}
```
