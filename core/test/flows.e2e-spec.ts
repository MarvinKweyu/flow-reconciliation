import { Test } from '@nestjs/testing';
import { INestApplication, NotFoundException } from '@nestjs/common';
import * as request from 'supertest';
import { InvoicesController } from '../src/invoices/invoices.controller';
import { InvoicesService } from '../src/invoices/invoices.service';
import { BankTransactionsController } from '../src/bank-transactions/bank-transactions.controller';
import { BankTransactionsService } from '../src/bank-transactions/bank-transactions.service';
import { MatchesController } from '../src/matches/matches.controller';
import { MatchesService } from '../src/matches/matches.service';

type InvoiceRecord = {
  id: number;
  tenantId: number;
  vendorId?: number | null;
  amount: string;
  currency: string;
  invoiceDate?: Date | null;
  description?: string | null;
  status: string;
};

type BankTxnRecord = {
  id: number;
  tenantId: number;
  externalId?: string | null;
  postedAt: Date;
  amount: string;
  currency: string;
  description?: string | null;
};

type MatchRecord = {
  id: number;
  tenantId: number;
  invoiceId: number;
  bankTransactionId: number;
  score?: number;
  status: string;
};

class InMemoryDb {
  invoices: InvoiceRecord[] = [];
  bankTxns: BankTxnRecord[] = [];
  matches: MatchRecord[] = [];
  vendorsByTenant: Map<number, Map<string, number>> = new Map();
}

class FakeInvoicesService {
  constructor(private readonly db: InMemoryDb) {}

  private nextId() {
    return this.db.invoices.length + 1;
  }

  async create(tenantId: number, dto: any) {
    let vendorId = dto.vendorId ?? null;
    if (!vendorId && dto.vendorName) {
      const vendorMap = this.db.vendorsByTenant.get(tenantId) ?? new Map();
      this.db.vendorsByTenant.set(tenantId, vendorMap);
      if (vendorMap.has(dto.vendorName)) {
        vendorId = vendorMap.get(dto.vendorName)!;
      } else {
        vendorId = vendorMap.size + 1;
        vendorMap.set(dto.vendorName, vendorId);
      }
    }

    const record: InvoiceRecord = {
      id: this.nextId(),
      tenantId,
      vendorId,
      amount: dto.amount,
      currency: dto.currency ?? 'USD',
      invoiceDate: dto.invoiceDate ? new Date(dto.invoiceDate) : null,
      description: dto.description ?? null,
      status: dto.status ?? 'open',
    };
    this.db.invoices.push(record);
    return record;
  }

  async findAll(tenantId: number, filters: any) {
    return this.db.invoices
      .filter((inv) => inv.tenantId === tenantId)
      .filter((inv) => !filters.status || inv.status === filters.status)
      .filter((inv) => !filters.vendorId || inv.vendorId === filters.vendorId);
  }

  async findAllPaginated(
    tenantId: number,
    filters: any,
    page = 1,
    pageSize = 20,
  ) {
    const items = await this.findAll(tenantId, filters);
    const start = (page - 1) * pageSize;
    const pageItems = items.slice(start, start + pageSize);
    return { items: pageItems, total: items.length, page, pageSize } as any;
  }

  async delete(tenantId: number, invoiceId: number) {
    const idx = this.db.invoices.findIndex(
      (inv) => inv.id === invoiceId && inv.tenantId === tenantId,
    );
    if (idx === -1) {
      throw new NotFoundException('Invoice not found');
    }
    const [removed] = this.db.invoices.splice(idx, 1);
    return removed;
  }
}

class FakeBankTransactionsService {
  constructor(private readonly db: InMemoryDb) {}

  private nextId() {
    return this.db.bankTxns.length + 1;
  }

  async bulkImport(tenantId: number, txns: any[]) {
    const results = { imported: 0, skipped: 0, errors: [] as string[] };
    for (const txn of txns) {
      const exists =
        txn.externalId &&
        this.db.bankTxns.find(
          (t) => t.tenantId === tenantId && t.externalId === txn.externalId,
        );
      if (exists) {
        results.skipped += 1;
        continue;
      }
      this.db.bankTxns.push({
        id: this.nextId(),
        tenantId,
        externalId: txn.externalId ?? null,
        postedAt: new Date(txn.postedAt),
        amount: txn.amount,
        currency: txn.currency ?? 'USD',
        description: txn.description ?? null,
      });
      results.imported += 1;
    }
    return results;
  }
}

class FakeMatchesService {
  constructor(private readonly db: InMemoryDb) {}

  aiMode: 'ai' | 'python' | 'fallback' = 'ai';

  private nextId() {
    return this.db.matches.length + 1;
  }

  async findCandidates(tenantId: number, filters: { minScore?: number }) {
    const invoices = this.db.invoices.filter((i) => i.tenantId === tenantId);
    const txns = this.db.bankTxns.filter((t) => t.tenantId === tenantId);
    const minScore = filters.minScore ?? 0.7;
    const cands = [] as any[];
    for (const inv of invoices) {
      for (const txn of txns) {
        const invAmt = parseFloat(inv.amount);
        const txnAmt = parseFloat(txn.amount);
        const score = Math.max(
          0,
          1 - Math.abs(invAmt - txnAmt) / Math.max(invAmt, txnAmt),
        );
        if (score >= minScore) {
          cands.push({
            invoiceId: inv.id,
            bankTransactionId: txn.id,
            score,
            invoiceAmount: inv.amount,
            transactionAmount: txn.amount,
            invoiceDate: inv.invoiceDate,
            transactionDate: txn.postedAt,
            reason: 'amount-based',
          });
        }
      }
    }
    return cands.sort((a, b) => b.score - a.score);
  }

  seedMatch(match: Partial<MatchRecord>) {
    const id = this.nextId();
    const record: MatchRecord = {
      id,
      tenantId: match.tenantId!,
      invoiceId: match.invoiceId!,
      bankTransactionId: match.bankTransactionId!,
      status: match.status ?? 'proposed',
      score: match.score ?? 0.9,
    };
    this.db.matches.push(record);
    return record;
  }

  async explainWithAiFallback(
    tenantId: number,
    invoiceId: number,
    transactionId: number,
  ) {
    const inv = this.db.invoices.find(
      (i) => i.id === invoiceId && i.tenantId === tenantId,
    );
    const txn = this.db.bankTxns.find(
      (t) => t.id === transactionId && t.tenantId === tenantId,
    );
    if (!inv || !txn) throw new Error('Not found');

    if (this.aiMode === 'ai') {
      return {
        invoiceId,
        transactionId,
        explanation: 'AI says good match',
        source: 'ai' as const,
      };
    }
    if (this.aiMode === 'python') {
      return {
        invoiceId,
        transactionId,
        explanation: 'Python fallback explanation',
        source: 'python' as const,
        score: 0.88,
        factors: ['amount closish'],
      };
    }
    return {
      invoiceId,
      transactionId,
      explanation: 'Simple heuristic',
      source: 'fallback' as const,
      score: 0.5,
      factors: ['low score'],
    };
  }

  async confirmMatch(tenantId: number, matchId: number) {
    const match = this.db.matches.find(
      (m) => m.id === matchId && m.tenantId === tenantId,
    );
    if (!match) throw new Error('Not found');
    match.status = 'confirmed';
    const inv = this.db.invoices.find((i) => i.id === match.invoiceId);
    if (inv) inv.status = 'matched';
    return match;
  }
}

describe('Tenant flows (e2e with fakes)', () => {
  let app: INestApplication;
  let db: InMemoryDb;
  let matchesService: FakeMatchesService;
  let invoicesService: FakeInvoicesService;
  let bankTxService: FakeBankTransactionsService;

  beforeAll(async () => {
    db = new InMemoryDb();
    invoicesService = new FakeInvoicesService(db);
    bankTxService = new FakeBankTransactionsService(db);
    matchesService = new FakeMatchesService(db);

    const moduleRef = await Test.createTestingModule({
      controllers: [
        InvoicesController,
        BankTransactionsController,
        MatchesController,
      ],
      providers: [
        { provide: InvoicesService, useValue: invoicesService },
        { provide: BankTransactionsService, useValue: bankTxService },
        { provide: MatchesService, useValue: matchesService },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

//   beforeEach(async () => {
//     // Clear test data
//     await db.execute(sql`DELETE FROM matches WHERE tenant_id = 1`);
//     await db.execute(sql`DELETE FROM bank_transactions WHERE tenant_id = 1`);
//     await db.execute(sql`DELETE FROM invoices WHERE tenant_id = 1`);
//   });

  afterAll(async () => {
    await app.close();
  });

  it('creates invoices (implicit vendor upsert)', async () => {
    const res = await request(app.getHttpServer())
      .post('/tenants/1/invoices')
      .send({ amount: '100.00', currency: 'USD', vendorName: 'Acme' })
      .expect(201);
    expect(res.body.id).toBe(1);
    expect(res.body.vendorId).toBe(1);
  });

  it('lists invoices with status filter', async () => {
    await request(app.getHttpServer())
      .post('/tenants/1/invoices')
      .send({ amount: '200.00', status: 'paid', vendorName: 'Beta' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .get('/tenants/1/invoices')
      .query({ status: 'paid' })
      .expect(200);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].amount).toBe('200.00');
  });

  it('deletes invoices and enforces tenant isolation (RLS equivalent)', async () => {
    const created = await request(app.getHttpServer())
      .post('/tenants/1/invoices')
      .send({ amount: '300.00' })
      .expect(201);

    // delete as owning tenant
    await request(app.getHttpServer())
      .delete(`/tenants/1/invoices/${created.body.id}`)
      .expect(200);

    // cross-tenant delete should fail
    await request(app.getHttpServer())
      .delete(`/tenants/2/invoices/${created.body.id}`)
      .expect(404); // mimics RLS / tenant scoping block
  });

  it('imports bank transactions with idempotency', async () => {
    const payload = {
      transactions: [
        {
          externalId: 'ext-1',
          postedAt: '2024-01-01T00:00:00Z',
          amount: '100.00',
          currency: 'USD',
          description: 'First',
        },
        {
          externalId: 'ext-1',
          postedAt: '2024-01-02T00:00:00Z',
          amount: '101.00',
          currency: 'USD',
          description: 'Dup',
        },
      ],
    };

    const res = await request(app.getHttpServer())
      .post('/tenants/1/bank-transactions/import')
      .send(payload)
      .expect(201);

    expect(res.body.imported).toBe(1);
    expect(res.body.skipped).toBe(1);
  });

  it('reconciliation returns ranked candidates', async () => {
    // invoice 400, tx 400 and 350
    const inv = await request(app.getHttpServer())
      .post('/tenants/1/invoices')
      .send({ amount: '400.00' })
      .expect(201);

    console.log('Created invoice ID:', inv.body.id); // Debug

    await bankTxService.bulkImport(1, [
      { postedAt: '2024-01-03T00:00:00Z', amount: '400.00' },
      { postedAt: '2024-01-04T00:00:00Z', amount: '350.00' },
    ]);

    const res = await request(app.getHttpServer())
      .post('/tenants/1/reconcile')
      .send({ minScore: 0.5 })
      .expect(201);

    console.log('Full response body:', JSON.stringify(res.body, null, 2)); // Debug

    const [first, second] = res.body.topCandidates;
    console.log('First candidate:', first); // Debug
    console.log('Second candidate:', second); // Debug

    expect(first.bankTransactionId).not.toBe(second.bankTransactionId);
    expect(first.score).toBeGreaterThan(second.score);
    expect(first.invoiceId).toBe(inv.body.id);
  });

  it('confirming a match updates status and invoice', async () => {
    const inv = await request(app.getHttpServer())
      .post('/tenants/1/invoices')
      .send({ amount: '500.00' })
      .expect(201);
    const [txn] = db.bankTxns;
    const match = matchesService.seedMatch({
      tenantId: 1,
      invoiceId: inv.body.id,
      bankTransactionId: txn?.id ?? 1,
      status: 'proposed',
    });

    const res = await request(app.getHttpServer())
      .post(`/tenants/1/matches/${match.id}/confirm`)
      .expect(201);

    expect(res.body.status).toBe('confirmed');
    const updatedInvoice = db.invoices.find((i) => i.id === inv.body.id);
    expect(updatedInvoice?.status).toBe('matched');
  });

  it('AI explanation endpoint returns AI then Python fallback', async () => {
    // reuse last invoice/txn
    const inv = db.invoices[0];
    const txn = db.bankTxns[0];
    matchesService.aiMode = 'ai';
    const aiRes = await request(app.getHttpServer())
      .get('/tenants/1/reconcile/explain')
      .query({ invoiceId: inv.id, transactionId: txn.id })
      .expect(200);
    expect(aiRes.body.source).toBe('ai');

    matchesService.aiMode = 'python';
    const pyRes = await request(app.getHttpServer())
      .get('/tenants/1/reconcile/explain')
      .query({ invoiceId: inv.id, transactionId: txn.id })
      .expect(200);
    expect(pyRes.body.source).toBe('python');
  });
});
