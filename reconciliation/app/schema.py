"""
Strawberry GraphQL schema and resolvers.
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional

import strawberry


@strawberry.type
class MatchCandidate:
    """Match candidate with score and explanation."""

    invoice_id: int
    transaction_id: int
    score: float
    factors: list[str]
    recommendation: str


@strawberry.input
class InvoiceInput:
    """Invoice data for matching."""

    id: int
    amount: str  # Decimal as string to preserve precision
    currency: str
    date: Optional[datetime] = None
    description: Optional[str] = None


@strawberry.input
class BankTransactionInput:
    """Bank transaction data for matching."""

    id: int
    amount: str  # Decimal as string
    currency: str
    posted_at: datetime
    description: Optional[str] = None


@strawberry.type
class Query:
    """GraphQL queries."""

    @strawberry.field
    def match_candidates(
        self,
        tenant_id: int,
        invoices: list[InvoiceInput],
        bank_transactions: list[BankTransactionInput],
        min_score: float = 0.70,
    ) -> list[MatchCandidate]:
        """
        Find match candidates between invoices and bank transactions.

        Args:
            tenant_id: Tenant identifier (for scoping, not enforced by this service)
            invoices: List of invoices to match
            bank_transactions: List of bank transactions to match
            min_score: Minimum score threshold (0.0 to 1.0, default 0.70)

        Returns:
            List of MatchCandidate sorted by score (highest first)
        """
        from app.matching import InvoiceData, TransactionData, MatchingEngine

        # Convert inputs to internal data structures
        invoice_data = [
            InvoiceData(
                id=inv.id,
                amount=Decimal(inv.amount),
                currency=inv.currency,
                date=inv.date,
                description=inv.description,
            )
            for inv in invoices
        ]

        txn_data = [
            TransactionData(
                id=txn.id,
                amount=Decimal(txn.amount),
                currency=txn.currency,
                posted_at=txn.posted_at,
                description=txn.description,
            )
            for txn in bank_transactions
        ]

        # Run matching engine
        engine = MatchingEngine()
        matches = engine.find_candidates(invoice_data, txn_data, min_score)

        # Convert to GraphQL types
        return [
            MatchCandidate(
                invoice_id=m.invoice_id,
                transaction_id=m.transaction_id,
                score=m.score,
                factors=m.factors,
                recommendation=m.recommendation,
            )
            for m in matches
        ]

    @strawberry.field
    def health(self) -> str:
        """Health check endpoint."""
        return "ok"


schema = strawberry.Schema(query=Query)
