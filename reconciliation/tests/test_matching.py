from datetime import datetime
from decimal import Decimal

from app.matching import InvoiceData, TransactionData, MatchingEngine


def test_deterministic_ordering_small_fixture():
    engine = MatchingEngine()

    invoices = [
        InvoiceData(
            id=1, amount=Decimal("100.00"), currency="USD", date=datetime(2024, 1, 1)
        ),
    ]

    transactions = [
        TransactionData(
            id=10,
            amount=Decimal("100.00"),
            currency="USD",
            posted_at=datetime(2024, 1, 1),
        ),
        TransactionData(
            id=11,
            amount=Decimal("92.00"),
            currency="USD",
            posted_at=datetime(2024, 1, 2),
        ),
        TransactionData(
            id=12,
            amount=Decimal("130.00"),
            currency="USD",
            posted_at=datetime(2024, 1, 5),
        ),
    ]

    matches = engine.find_candidates(invoices, transactions, min_score=0.0)

    assert [m.transaction_id for m in matches] == [10, 11, 12]
    assert matches[0].score >= matches[1].score >= matches[2].score


def test_explanation_includes_key_factors():
    engine = MatchingEngine()
    invoice = InvoiceData(
        id=1,
        amount=Decimal("200.00"),
        currency="USD",
        date=datetime(2024, 1, 10),
        description="Consulting services",
    )
    txn = TransactionData(
        id=2,
        amount=Decimal("200.00"),
        currency="USD",
        posted_at=datetime(2024, 1, 10),
        description="Consulting services payment",
    )

    match = engine.compute_match(invoice, txn)

    assert "Exact amount match" in match.factors
    assert any("Currency match" in f for f in match.factors)
    assert any("Same day" in f for f in match.factors)
    assert match.score == 1.0
