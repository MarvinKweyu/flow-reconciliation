import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '../db/tokens';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { bankTransaction } from '../db/schema';
import { eq, and, gte, lte, like, count, sql } from 'drizzle-orm';
import { BankTransactionItemDto } from './dto/bank-transaction-item.dto';

@Injectable()
export class BankTransactionsService {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: NodePgDatabase | null,
  ) {}

  private ensureDb() {
    if (!this.db) {
      throw new Error('Database not configured. Set DATABASE_URL.');
    }
    return this.db;
  }

  async bulkImport(tenantId: number, transactions: BankTransactionItemDto[]) {
    const db = this.ensureDb();
    const results = {
      imported: 0,
      skipped: 0,
      errors: [] as string[],
    };

    for (const txn of transactions) {
      try {
        // Idempotency: check if external_id already exists for this tenant
        if (txn.externalId) {
          const [existing] = await db
            .select()
            .from(bankTransaction)
            .where(
              and(
                eq(bankTransaction.tenantId, tenantId),
                eq(bankTransaction.externalId, txn.externalId),
              ),
            )
            .limit(1);

          if (existing) {
            results.skipped++;
            continue;
          }
        }

        await db.insert(bankTransaction).values({
          tenantId,
          externalId: txn.externalId,
          postedAt: new Date(txn.postedAt),
          amount: txn.amount,
          currency: txn.currency ?? 'USD',
          description: txn.description,
        });

        results.imported++;
      } catch (error) {
        results.errors.push(
          `Failed to import transaction: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    return results;
  }

  async findAll(tenantId: number) {
    const db = this.ensureDb();
    return db
      .select()
      .from(bankTransaction)
      .where(eq(bankTransaction.tenantId, tenantId))
      .orderBy(bankTransaction.postedAt);
  }

  async findAllPaginated(
    tenantId: number,
    filters: {
      dateFrom?: string;
      dateTo?: string;
      amountMin?: string;
      amountMax?: string;
      description?: string;
    },
    page: number = 1,
    pageSize: number = 20,
  ) {
    const db = this.ensureDb();
    const conditions = [eq(bankTransaction.tenantId, tenantId)];

    if (filters.dateFrom) {
      conditions.push(
        gte(bankTransaction.postedAt, new Date(filters.dateFrom)),
      );
    }

    if (filters.dateTo) {
      conditions.push(lte(bankTransaction.postedAt, new Date(filters.dateTo)));
    }

    if (filters.amountMin) {
      conditions.push(
        sql`${bankTransaction.amount}::numeric >= ${filters.amountMin}::numeric`,
      );
    }

    if (filters.amountMax) {
      conditions.push(
        sql`${bankTransaction.amount}::numeric <= ${filters.amountMax}::numeric`,
      );
    }

    if (filters.description) {
      conditions.push(
        like(bankTransaction.description, `%${filters.description}%`),
      );
    }

    const whereClause = and(...conditions);
    const offset = (page - 1) * pageSize;

    const [items, [{ value: total }]] = await Promise.all([
      db
        .select()
        .from(bankTransaction)
        .where(whereClause)
        .orderBy(bankTransaction.postedAt)
        .limit(pageSize)
        .offset(offset),
      db.select({ value: count() }).from(bankTransaction).where(whereClause),
    ]);

    return { items, total, page, pageSize };
  }
}
