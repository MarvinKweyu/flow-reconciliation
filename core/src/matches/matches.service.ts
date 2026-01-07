import { Inject, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DRIZZLE } from '../db/tokens';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { match, invoice, bankTransaction } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { AiExplanationService } from '../ai/ai-explanation.service';
import { PythonReconciliationService } from '../reconciliation/python-reconciliation.service';

@Injectable()
export class MatchesService {
  private readonly logger = new Logger(MatchesService.name);

  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase | null,
    private readonly aiExplanation: AiExplanationService,
    private readonly pythonReconciliation: PythonReconciliationService,
  ) {}

  private ensureDb() {
    if (!this.db) {
      throw new Error('Database not configured. Set DATABASE_URL.');
    }
    return this.db;
  }

  async findCandidates(
    tenantId: number,
    filters: {
      invoiceId?: number;
      bankTransactionId?: number;
      minScore?: number;
    },
  ) {
    const db = this.ensureDb();

    // find invoices and transactions with similar amounts
    const invoiceConditions = [
      eq(invoice.tenantId, tenantId),
      eq(invoice.status, 'open'),
    ];
    if (filters.invoiceId) {
      invoiceConditions.push(eq(invoice.id, filters.invoiceId));
    }

    const txnConditions = [eq(bankTransaction.tenantId, tenantId)];
    if (filters.bankTransactionId) {
      txnConditions.push(eq(bankTransaction.id, filters.bankTransactionId));
    }

    const invoices = await db
      .select()
      .from(invoice)
      .where(and(...invoiceConditions));

    const transactions = await db
      .select()
      .from(bankTransaction)
      .where(and(...txnConditions));

    const candidates: Array<{
      invoiceId: number;
      bankTransactionId: number;
      score: number;
      invoiceAmount: string;
      transactionAmount: string;
      invoiceDate: Date | null;
      transactionDate: Date;
      reason: string;
    }> = [];
    const minScore = filters.minScore ?? 0.7;

    for (const inv of invoices) {
      for (const txn of transactions) {
        const invAmount = parseFloat(inv.amount);
        const txnAmount = parseFloat(txn.amount);

        // Simple score: 1.0 if amounts match exactly, decreasing with difference
        const diff = Math.abs(invAmount - txnAmount);
        const score = Math.max(0, 1 - diff / Math.max(invAmount, txnAmount));

        if (score >= minScore) {
          candidates.push({
            invoiceId: inv.id,
            bankTransactionId: txn.id,
            score,
            invoiceAmount: inv.amount,
            transactionAmount: txn.amount,
            invoiceDate: inv.invoiceDate,
            transactionDate: txn.postedAt,
            reason:
              score === 1
                ? 'Exact amount match'
                : `${(score * 100).toFixed(1)}% match`,
          });
        }
      }
    }

    return candidates.sort((a, b) => b.score - a.score);
  }

  async explainReconciliation(
    tenantId: number,
    invoiceId: number,
    transactionId: number,
  ) {
    const db = this.ensureDb();

    const [inv] = await db
      .select()
      .from(invoice)
      .where(and(eq(invoice.tenantId, tenantId), eq(invoice.id, invoiceId)));

    const [txn] = await db
      .select()
      .from(bankTransaction)
      .where(
        and(
          eq(bankTransaction.tenantId, tenantId),
          eq(bankTransaction.id, transactionId),
        ),
      );

    this.logger.debug(
      `Explaining reconciliation for invoice ${invoiceId} and transaction ${transactionId}`,
    );

    // log the loaded invoice and transaction
    // this.logger.debug('Loaded invoice:', inv);
    // this.logger.debug('Loaded transaction:', txn);

    if (!inv || !txn) {
      throw new NotFoundException('Invoice or transaction not found');
    }

    const invAmount = parseFloat(inv.amount);
    const txnAmount = parseFloat(txn.amount);
    const diff = Math.abs(invAmount - txnAmount);
    const score = Math.max(0, 1 - diff / Math.max(invAmount, txnAmount));

    const factors: string[] = [];
    if (score === 1) {
      factors.push('Amounts match exactly');
    } else if (score >= 0.95) {
      factors.push(`Amounts very close (diff: ${diff.toFixed(2)})`);
    } else {
      factors.push(`Amount difference: ${diff.toFixed(2)}`);
    }

    if (inv.currency !== txn.currency) {
      factors.push(`Currency mismatch: ${inv.currency} vs ${txn.currency}`);
    }

    const recommendation =
      score >= 0.95
        ? 'Highly recommended match'
        : score >= 0.7
          ? 'Possible match - review recommended'
          : 'Low confidence - manual review required';

    return {
      invoiceId,
      transactionId,
      score,
      factors,
      recommendation,
    };
  }

  async reconcile(
    tenantId: number,
    input?: {
      invoiceIds?: number[];
      transactionIds?: number[];
      minScore?: number;
    },
  ) {
    const db = this.ensureDb();
    const minScore = input?.minScore ?? 0.7;

    const candidates = await this.findCandidates(tenantId, {
      minScore,
    });

    const matches: (typeof match.$inferSelect)[] = [];
    const usedInvoices = new Set<number>();
    const usedTransactions = new Set<number>();

    // take highest score matches first
    for (const candidate of candidates) {
      if (
        !usedInvoices.has(candidate.invoiceId) &&
        !usedTransactions.has(candidate.bankTransactionId)
      ) {
        if (
          input?.invoiceIds &&
          !input.invoiceIds.includes(candidate.invoiceId)
        ) {
          continue;
        }
        if (
          input?.transactionIds &&
          !input.transactionIds.includes(candidate.bankTransactionId)
        ) {
          continue;
        }

        const [created] = await db
          .insert(match)
          .values({
            tenantId,
            invoiceId: candidate.invoiceId,
            bankTransactionId: candidate.bankTransactionId,
            score: candidate.score.toFixed(4),
            status: 'proposed',
          })
          .returning();

        matches.push(created);
        usedInvoices.add(candidate.invoiceId);
        usedTransactions.add(candidate.bankTransactionId);
      }
    }

    return {
      matchesCreated: matches.length,
      matches,
    };
  }

  async confirmMatch(tenantId: number, matchId: number) {
    const db = this.ensureDb();

    const [updated] = await db
      .update(match)
      .set({ status: 'confirmed', updatedAt: new Date() })
      .where(and(eq(match.tenantId, tenantId), eq(match.id, matchId)))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Match ${matchId} not found`);
    }

    // Update invoice status to matched
    await db
      .update(invoice)
      .set({ status: 'matched', updatedAt: new Date() })
      .where(eq(invoice.id, updated.invoiceId));

    return updated;
  }

  /**
   * Explain reconciliation with AI fallback to Python deterministic explanation
   * 1. Load invoice and transaction (tenant-scoped)
   * 2. Filter to allowed attributes
   * 3. Try AI explanation
   * 4. Fallback to Python deterministic explanation on error
   */
  async explainWithAiFallback(
    tenantId: number,
    invoiceId: number,
    transactionId: number,
  ) {
    const db = this.ensureDb();

    // load all invoices
    // const allinvoices = await db
    //   .select()
    //   .from(invoice)
    //   .where(and(eq(invoice.tenantId, tenantId)));

    // this.logger.debug('All allinvoices for tenant:', allinvoices);
    this.logger.debug(`Looking for invoice ID: ${invoiceId}`);

    // Load invoice and transaction (tenant-scoped)
    const [inv] = await db
      .select()
      .from(invoice)
      .where(and(eq(invoice.tenantId, tenantId), eq(invoice.id, invoiceId)));

    // fetch all transactions for logging
    const allTransactions = await db
      .select()
      .from(bankTransaction)
      .where(and(eq(bankTransaction.tenantId, tenantId)));

    // log all transactions
    // this.logger.debug('All transactions for tenant:', allTransactions);
    // this.logger.debug(`Looking for transaction ID: ${transactionId}`);

    const [txn] = await db
      .select()
      .from(bankTransaction)
      .where(
        and(
          eq(bankTransaction.tenantId, tenantId),
          eq(bankTransaction.id, transactionId),
        ),
      );

    this.logger.debug(
      `Test:....Explaining reconciliation for invoice ${invoiceId} and transaction ${transactionId}`,
    );

    // log the loaded invoice and transaction
    // this.logger.debug('Loaded invoice:', inv);
    // this.logger.debug('Loaded transaction:', txn);

    if (!inv || !txn) {
      throw new NotFoundException('Invoice or transaction not found');
    }

    if (!inv || !txn) {
      throw new NotFoundException('Invoice or transaction not found');
    }

    // Filter to allowed attributes only
    const invoiceData = {
      id: inv.id,
      amount: inv.amount,
      currency: inv.currency,
      invoiceDate: inv.invoiceDate,
      description: inv.description,
    };

    const transactionData = {
      id: txn.id,
      amount: txn.amount,
      currency: txn.currency,
      postedAt: txn.postedAt,
      description: txn.description,
    };

    const aiExplanation = await this.aiExplanation.explainViaAi({
      invoice: invoiceData,
      transaction: transactionData,
    });

    if (aiExplanation) {
      return {
        invoiceId,
        transactionId,
        explanation: aiExplanation,
        source: 'ai' as const,
      };
    }

    // Fallback to Python deterministic explanation
    this.logger.debug('Falling back to Python reconciliation service');
    const pythonResult = await this.pythonReconciliation.explainViaPython(
      tenantId,
      {
        id: inv.id,
        amount: inv.amount,
        currency: inv.currency,
        date: inv.invoiceDate?.toISOString().split('T')[0],
        description: inv.description,
      },
      {
        id: txn.id,
        amount: txn.amount,
        currency: txn.currency,
        date: txn.postedAt.toISOString().split('T')[0],
        description: txn.description,
      },
    );

    if (pythonResult) {
      return {
        invoiceId,
        transactionId,
        explanation: pythonResult.explanation,
        source: 'python' as const,
        score: pythonResult.score,
        factors: pythonResult.factors,
      };
    }

    // Last resort: simple amount-based explanation
    const invAmount = parseFloat(inv.amount);
    const txnAmount = parseFloat(txn.amount);
    const diff = Math.abs(invAmount - txnAmount);
    const score = Math.max(0, 1 - diff / Math.max(invAmount, txnAmount));

    const factors: any[] = [];
    if (score === 1) {
      factors.push('Amounts match exactly');
    } else if (score >= 0.95) {
      factors.push(`Amounts very close (diff: ${diff.toFixed(2)})`);
    } else {
      factors.push(`Amount difference: ${diff.toFixed(2)}`);
    }

    if (inv.currency !== txn.currency) {
      factors.push(`Currency mismatch: ${inv.currency} vs ${txn.currency}`);
    }

    const recommendation =
      score >= 0.95
        ? 'Highly recommended match'
        : score >= 0.7
          ? 'Possible match - review recommended'
          : 'Low confidence - manual review required';

    const explanation = `
Score: ${(score * 100).toFixed(1)}%
Recommendation: ${recommendation}
Factors: ${factors.join(', ')}
    `.trim();

    return {
      invoiceId,
      transactionId,
      explanation,
      source: 'fallback' as const,
      score,
      factors,
    };
  }
}
