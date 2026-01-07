"""
SQLAlchemy models for reconciliation service.
"""

from datetime import datetime
from decimal import Decimal
from sqlalchemy import Column, Integer, String, Numeric, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()


class Invoice(Base):
    """Tenant-scoped invoice record (read-only from NestJS)."""

    __tablename__ = "invoices"

    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, nullable=False, index=True)
    invoice_number = Column(String(255), nullable=True)
    amount = Column(Numeric(15, 2), nullable=False)
    currency = Column(String(3), nullable=False, default="USD")
    invoice_date = Column(DateTime, nullable=True)
    description = Column(Text, nullable=True)
    status = Column(String(50), nullable=False, default="open")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class BankTransaction(Base):
    """Tenant-scoped bank transaction record (read-only from NestJS)."""

    __tablename__ = "bank_transactions"

    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, nullable=False, index=True)
    external_id = Column(String(255), nullable=True, unique=True, index=True)
    posted_at = Column(DateTime, nullable=False)
    amount = Column(Numeric(15, 2), nullable=False)
    currency = Column(String(3), nullable=False, default="USD")
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(
        DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow
    )


class MatchCandidate(Base):
    """Cached match candidate with score and factors."""

    __tablename__ = "match_candidates"

    id = Column(Integer, primary_key=True)
    tenant_id = Column(Integer, nullable=False, index=True)
    invoice_id = Column(Integer, nullable=False)
    transaction_id = Column(Integer, nullable=False)
    score = Column(Numeric(5, 4), nullable=False)
    factors = Column(Text, nullable=True)  # JSON list of matching factors
    recommendation = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
