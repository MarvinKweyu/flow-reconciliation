from datetime import datetime

from app.schema import schema


def test_graphql_match_candidates_structure():
    query = """
    query Match($tenantId: Int!, $invoices: [InvoiceInput!]!, $txns: [BankTransactionInput!]!, $min: Float) {
      matchCandidates(
        tenantId: $tenantId,
        invoices: $invoices,
        bankTransactions: $txns,
        minScore: $min
      ) {
        invoiceId
        transactionId
        score
        factors
        recommendation
      }
    }
    """

    variables = {
        "tenantId": 1,
        "min": 0.0,
        "invoices": [
            {
                "id": 1,
                "amount": "100.00",
                "currency": "USD",
                "date": "2024-01-01T00:00:00Z",
                "description": "Subscription January",
            }
        ],
        "txns": [
            {
                "id": 2,
                "amount": "100.00",
                "currency": "USD",
                "postedAt": "2024-01-01T00:00:00Z",
                "description": "Subscription Jan",
            }
        ],
    }

    result = schema.execute_sync(query, variable_values=variables)

    assert result.errors is None
    data = result.data["matchCandidates"]
    assert isinstance(data, list)
    assert len(data) == 1
    first = data[0]
    assert first["invoiceId"] == 1
    assert first["transactionId"] == 2
    assert first["score"] == 1.0
    assert "recommendation" in first
    assert isinstance(first["factors"], list)
    assert any("amount" in f.lower() for f in first["factors"])
