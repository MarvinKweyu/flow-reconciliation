"""
Matching heuristics and scoring logic.
"""

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Optional


@dataclass
class InvoiceData:
    """Input invoice record."""

    id: int
    amount: Decimal
    currency: str
    date: Optional[datetime] = None
    description: Optional[str] = None


@dataclass
class TransactionData:
    """Input bank transaction record."""

    id: int
    amount: Decimal
    currency: str
    posted_at: datetime
    description: Optional[str] = None


@dataclass
class MatchScore:
    """Result of matching two records."""

    invoice_id: int
    transaction_id: int
    score: float  # 0.0 to 1.0
    factors: list[str]
    recommendation: str


class MatchingEngine:
    """Deterministic matching heuristics."""

    def __init__(self, amount_tolerance: float = 0.02, date_tolerance_days: int = 7):
        """
        Args:
            amount_tolerance: Acceptable difference as % of max amount (default 2%)
            date_tolerance_days: Days invoice date can differ from transaction (default 7)
        """
        self.amount_tolerance = amount_tolerance
        self.date_tolerance_days = date_tolerance_days

    def compute_match(
        self,
        invoice: InvoiceData,
        transaction: TransactionData,
    ) -> MatchScore:
        """Compute match score between an invoice and transaction."""
        factors = []
        component_scores = []

        # 1. Amount match (primary)
        amount_score = self._score_amount(invoice.amount, transaction.amount)
        component_scores.append(("amount", amount_score, 0.5))
        if amount_score >= 0.99:
            factors.append("Exact amount match")
        elif amount_score >= 0.95:
            factors.append(f"Amount very close ({amount_score:.1%} match)")
        elif amount_score >= 0.70:
            factors.append(f"Amount reasonable ({amount_score:.1%} match)")

        # 2. Currency match
        if invoice.currency == transaction.currency:
            component_scores.append(("currency", 1.0, 0.2))
            factors.append(f"Currency match: {invoice.currency}")
        else:
            component_scores.append(("currency", 0.0, 0.2))
            factors.append(
                f"Currency mismatch: {invoice.currency} vs {transaction.currency}"
            )

        # 3. Date proximity (if available)
        if invoice.date and transaction.posted_at:
            date_score = self._score_date(invoice.date, transaction.posted_at)
            component_scores.append(("date", date_score, 0.3))
            days_diff = abs((transaction.posted_at.date() - invoice.date.date()).days)
            if days_diff == 0:
                factors.append("Same day posting")
            elif days_diff <= 3:
                factors.append(f"Posted {days_diff} day(s) apart")
            elif days_diff <= self.date_tolerance_days:
                factors.append(f"Posted {days_diff} day(s) apart (within tolerance)")
            else:
                factors.append(f"Posted {days_diff} day(s) apart (outside tolerance)")

        # 4. Description/memo hints (simple heuristic)
        desc_score = self._score_description(
            invoice.description, transaction.description
        )
        if desc_score > 0.5:
            component_scores.append(
                ("description", desc_score, 0.0)
            )  # Bonus, not weighted
            if invoice.description and transaction.description:
                factors.append("Description hints match")

        # Compute weighted average
        if component_scores:
            weighted_sum = sum(score * weight for _, score, weight in component_scores)
            weight_sum = sum(weight for _, _, weight in component_scores)
            final_score = weighted_sum / weight_sum if weight_sum > 0 else 0.0
        else:
            final_score = 0.0

        # Generate recommendation
        if final_score >= 0.95:
            recommendation = "Highly recommended match"
        elif final_score >= 0.80:
            recommendation = "Strong match - confirm recommended"
        elif final_score >= 0.70:
            recommendation = "Possible match - manual review recommended"
        elif final_score >= 0.50:
            recommendation = "Weak match - unlikely but possible"
        else:
            recommendation = "Very weak match - unlikely"

        return MatchScore(
            invoice_id=invoice.id,
            transaction_id=transaction.id,
            score=round(final_score, 4),
            factors=factors,
            recommendation=recommendation,
        )

    def _score_amount(self, invoice_amount: Decimal, txn_amount: Decimal) -> float:
        """Score based on amount similarity."""
        if invoice_amount == 0 or txn_amount == 0:
            return 0.0 if invoice_amount != txn_amount else 1.0

        diff = abs(float(invoice_amount) - float(txn_amount))
        max_amount = max(float(invoice_amount), float(txn_amount))

        # If difference is within tolerance, perfect score; otherwise decay
        diff_pct = diff / max_amount
        if diff_pct <= self.amount_tolerance:
            return 1.0
        else:
            # Linear decay: at 10% difference, score is ~0.7; at 50%, score is 0
            return max(0.0, 1.0 - (diff_pct / 0.5))

    def _score_date(self, invoice_date: datetime, txn_date: datetime) -> float:
        """Score based on date proximity."""
        days_diff = abs((txn_date.date() - invoice_date.date()).days)

        if days_diff == 0:
            return 1.0
        elif days_diff <= 3:
            return 0.95
        elif days_diff <= self.date_tolerance_days:
            return 0.75
        else:
            # Decay beyond tolerance
            return max(0.0, 0.75 - (days_diff - self.date_tolerance_days) * 0.05)

    def _score_description(
        self,
        invoice_desc: Optional[str],
        txn_desc: Optional[str],
    ) -> float:
        """Score based on description/memo similarity (basic keyword match)."""
        if not invoice_desc or not txn_desc:
            return 0.5  # Neutral if missing

        inv_words = set(invoice_desc.lower().split())
        txn_words = set(txn_desc.lower().split())

        # Jaccard similarity
        if not inv_words or not txn_words:
            return 0.0

        intersection = len(inv_words & txn_words)
        union = len(inv_words | txn_words)

        return intersection / union if union > 0 else 0.0

    def find_candidates(
        self,
        invoices: list[InvoiceData],
        transactions: list[TransactionData],
        min_score: float = 0.70,
    ) -> list[MatchScore]:
        """Find all match candidates above min_score, sorted by score descending."""
        candidates = []

        for invoice in invoices:
            for transaction in transactions:
                match = self.compute_match(invoice, transaction)
                if match.score >= min_score:
                    candidates.append(match)

        # Sort by score descending
        return sorted(candidates, key=lambda m: m.score, reverse=True)
