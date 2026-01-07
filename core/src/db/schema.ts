import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  numeric,
  pgEnum,
} from 'drizzle-orm/pg-core';

export const tenant = pgTable('tenant', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: false })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: false })
    .defaultNow()
    .notNull(),
});

export type TenantRecord = typeof tenant.$inferSelect;
export type NewTenantRecord = typeof tenant.$inferInsert;

// Vendor table (optional for invoices)
export const vendor = pgTable('vendor', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id')
    .notNull()
    .references(() => tenant.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: false })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: false })
    .defaultNow()
    .notNull(),
});

export type VendorRecord = typeof vendor.$inferSelect;
export type NewVendorRecord = typeof vendor.$inferInsert;

export const invoiceStatusEnum = pgEnum('invoice_status', [
  'open',
  'matched',
  'paid',
]);

export const invoice = pgTable('invoice', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id')
    .notNull()
    .references(() => tenant.id, { onDelete: 'cascade' }),
  vendorId: integer('vendor_id').references(() => vendor.id, {
    onDelete: 'set null',
  }),
  invoiceNumber: text('invoice_number'),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('USD'),
  invoiceDate: timestamp('invoice_date', { withTimezone: false }),
  description: text('description'),
  status: invoiceStatusEnum('status').notNull().default('open'),
  createdAt: timestamp('created_at', { withTimezone: false })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: false })
    .defaultNow()
    .notNull(),
});

export type InvoiceRecord = typeof invoice.$inferSelect;
export type NewInvoiceRecord = typeof invoice.$inferInsert;

export const bankTransaction = pgTable('bank_transaction', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id')
    .notNull()
    .references(() => tenant.id, { onDelete: 'cascade' }),
  externalId: text('external_id'),
  postedAt: timestamp('posted_at', { withTimezone: false }).notNull(),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  currency: text('currency').notNull().default('USD'),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: false })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: false })
    .defaultNow()
    .notNull(),
});

export type BankTransactionRecord = typeof bankTransaction.$inferSelect;
export type NewBankTransactionRecord = typeof bankTransaction.$inferInsert;

// Match status enum
export const matchStatusEnum = pgEnum('match_status', [
  'proposed',
  'confirmed',
  'rejected',
]);

export const match = pgTable('match', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id')
    .notNull()
    .references(() => tenant.id, { onDelete: 'cascade' }),
  invoiceId: integer('invoice_id')
    .notNull()
    .references(() => invoice.id, { onDelete: 'cascade' }),
  bankTransactionId: integer('bank_transaction_id')
    .notNull()
    .references(() => bankTransaction.id, { onDelete: 'cascade' }),
  score: numeric('score', { precision: 5, scale: 4 }),
  status: matchStatusEnum('status').notNull().default('proposed'),
  createdAt: timestamp('created_at', { withTimezone: false })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: false })
    .defaultNow()
    .notNull(),
});

export type MatchRecord = typeof match.$inferSelect;
export type NewMatchRecord = typeof match.$inferInsert;
