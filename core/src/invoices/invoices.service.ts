import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DRIZZLE } from '../db/tokens';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { invoice, vendor } from '../db/schema';
import { eq, and, gte, lte, sql, count } from 'drizzle-orm';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { ListInvoicesDto } from './dto/list-invoices.dto';

@Injectable()
export class InvoicesService {
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

  async create(tenantId: number, dto: CreateInvoiceDto) {
    const db = this.ensureDb();
    // Resolve vendor (upsert by name if vendorId not provided)
    let resolvedVendorId: number | undefined = dto.vendorId;
    if (!resolvedVendorId && dto.vendorName) {
      const [existing] = await db
        .select()
        .from(vendor)
        .where(
          and(eq(vendor.tenantId, tenantId), eq(vendor.name, dto.vendorName)),
        )
        .limit(1);

      if (existing) {
        resolvedVendorId = existing.id;
      } else {
        const [createdVendor] = await db
          .insert(vendor)
          .values({ tenantId, name: dto.vendorName })
          .returning();
        resolvedVendorId = createdVendor.id;
      }
    }

    const [created] = await db
      .insert(invoice)
      .values({
        tenantId,
        vendorId: resolvedVendorId,
        invoiceNumber: dto.invoiceNumber,
        amount: dto.amount,
        currency: dto.currency ?? 'USD',
        invoiceDate: dto.invoiceDate ? new Date(dto.invoiceDate) : null,
        description: dto.description,
        status: dto.status ?? 'open',
      })
      .returning();
    return created;
  }

  async findAll(tenantId: number, filters: ListInvoicesDto) {
    const db = this.ensureDb();
    const conditions = [eq(invoice.tenantId, tenantId)];

    if (filters.status) {
      conditions.push(eq(invoice.status, filters.status));
    }

    if (filters.vendorId) {
      conditions.push(eq(invoice.vendorId, filters.vendorId));
    }

    if (filters.dateFrom) {
      conditions.push(gte(invoice.invoiceDate, new Date(filters.dateFrom)));
    }

    if (filters.dateTo) {
      conditions.push(lte(invoice.invoiceDate, new Date(filters.dateTo)));
    }

    if (filters.amountMin) {
      conditions.push(
        sql`${invoice.amount}::numeric >= ${filters.amountMin}::numeric`,
      );
    }

    if (filters.amountMax) {
      conditions.push(
        sql`${invoice.amount}::numeric <= ${filters.amountMax}::numeric`,
      );
    }

    return db
      .select()
      .from(invoice)
      .where(and(...conditions))
      .orderBy(invoice.id);
  }

  async findAllPaginated(
    tenantId: number,
    filters: ListInvoicesDto,
    page: number = 1,
    pageSize: number = 20,
  ) {
    const db = this.ensureDb();
    const conditions = [eq(invoice.tenantId, tenantId)];

    if (filters.status) {
      conditions.push(eq(invoice.status, filters.status));
    }

    if (filters.vendorId) {
      conditions.push(eq(invoice.vendorId, filters.vendorId));
    }

    if (filters.dateFrom) {
      conditions.push(gte(invoice.invoiceDate, new Date(filters.dateFrom)));
    }

    if (filters.dateTo) {
      conditions.push(lte(invoice.invoiceDate, new Date(filters.dateTo)));
    }

    if (filters.amountMin) {
      conditions.push(
        sql`${invoice.amount}::numeric >= ${filters.amountMin}::numeric`,
      );
    }

    if (filters.amountMax) {
      conditions.push(
        sql`${invoice.amount}::numeric <= ${filters.amountMax}::numeric`,
      );
    }

    const whereClause = and(...conditions);
    const offset = (page - 1) * pageSize;

    const [items, [{ value: total }]] = await Promise.all([
      db
        .select()
        .from(invoice)
        .where(whereClause)
        .orderBy(invoice.id)
        .limit(pageSize)
        .offset(offset),
      db.select({ value: count() }).from(invoice).where(whereClause),
    ]);

    return { items, total, page, pageSize };
  }

  async delete(tenantId: number, invoiceId: number) {
    const db = this.ensureDb();
    const [deleted] = await db
      .delete(invoice)
      .where(and(eq(invoice.tenantId, tenantId), eq(invoice.id, invoiceId)))
      .returning();

    if (!deleted) {
      throw new NotFoundException(
        `Invoice ${invoiceId} not found for tenant ${tenantId}`,
      );
    }

    return deleted;
  }
}
