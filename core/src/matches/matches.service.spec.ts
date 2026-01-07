import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { DRIZZLE } from '../db/tokens';
import { AiExplanationService } from '../ai/ai-explanation.service';
import { PythonReconciliationService } from '../reconciliation/python-reconciliation.service';

describe('MatchesService', () => {
  let service: MatchesService;
  let mockDb: any;
  let mockAiExplanation: jest.Mocked<AiExplanationService>;
  let mockPythonReconciliation: jest.Mocked<PythonReconciliationService>;

  beforeEach(async () => {
    // Mock Drizzle database
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      returning: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    };

    mockAiExplanation = {
      explainViaAi: jest.fn(),
    } as any;

    mockPythonReconciliation = {
      explainViaPython: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchesService,
        {
          provide: DRIZZLE,
          useValue: mockDb,
        },
        {
          provide: AiExplanationService,
          useValue: mockAiExplanation,
        },
        {
          provide: PythonReconciliationService,
          useValue: mockPythonReconciliation,
        },
      ],
    }).compile();

    service = module.get<MatchesService>(MatchesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findCandidates', () => {
    beforeEach(() => {
      mockDb.select.mockReturnValue(mockDb);
      mockDb.from.mockReturnValue(mockDb);
      mockDb.where.mockReturnValue(mockDb);
    });

    it('should return candidates sorted by score descending', async () => {
      const mockInvoices = [
        { id: 1, tenantId: 1, amount: '100.00', status: 'open' },
      ];

      const mockTransactions = [
        { id: 10, tenantId: 1, amount: '100.00', postedAt: new Date() },
        { id: 11, tenantId: 1, amount: '90.00', postedAt: new Date() },
        { id: 12, tenantId: 1, amount: '110.00', postedAt: new Date() },
      ];

      mockDb.where.mockResolvedValueOnce(mockInvoices);
      mockDb.where.mockResolvedValueOnce(mockTransactions);

      const result = await service.findCandidates(1, { minScore: 0.7 });

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].score).toBeGreaterThanOrEqual(result[1]?.score || 0);
      expect(result[0].bankTransactionId).toBe(10); // Exact match should be first
    });

    it('should filter by minScore threshold', async () => {
      const mockInvoices = [
        { id: 1, tenantId: 1, amount: '100.00', status: 'open' },
      ];

      const mockTransactions = [
        { id: 10, tenantId: 1, amount: '100.00', postedAt: new Date() },
        { id: 11, tenantId: 1, amount: '50.00', postedAt: new Date() }, // Low score
      ];

      mockDb.where.mockResolvedValueOnce(mockInvoices);
      mockDb.where.mockResolvedValueOnce(mockTransactions);

      const result = await service.findCandidates(1, { minScore: 0.9 });

      expect(result).toHaveLength(1);
      expect(result[0].score).toBeGreaterThanOrEqual(0.9);
    });

    it('should only match open invoices', async () => {
      const mockInvoices = [
        { id: 1, tenantId: 1, amount: '100.00', status: 'open' },
      ];

      const mockTransactions = [
        { id: 10, tenantId: 1, amount: '100.00', postedAt: new Date() },
      ];

      mockDb.where.mockResolvedValueOnce(mockInvoices);
      mockDb.where.mockResolvedValueOnce(mockTransactions);

      await service.findCandidates(1, {});

      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should filter by specific invoiceId when provided', async () => {
      const mockInvoices = [
        { id: 5, tenantId: 1, amount: '100.00', status: 'open' },
      ];

      const mockTransactions = [
        { id: 10, tenantId: 1, amount: '100.00', postedAt: new Date() },
      ];

      mockDb.where.mockResolvedValueOnce(mockInvoices);
      mockDb.where.mockResolvedValueOnce(mockTransactions);

      const result = await service.findCandidates(1, { invoiceId: 5 });

      expect(result[0].invoiceId).toBe(5);
    });

    it('should assign correct reason for exact match', async () => {
      const mockInvoices = [
        { id: 1, tenantId: 1, amount: '100.00', status: 'open' },
      ];

      const mockTransactions = [
        { id: 10, tenantId: 1, amount: '100.00', postedAt: new Date() },
      ];

      mockDb.where.mockResolvedValueOnce(mockInvoices);
      mockDb.where.mockResolvedValueOnce(mockTransactions);

      const result = await service.findCandidates(1, {});

      expect(result[0].reason).toBe('Exact amount match');
    });
  });

  describe('explainReconciliation', () => {
    beforeEach(() => {
      mockDb.select.mockReturnValue(mockDb);
      mockDb.from.mockReturnValue(mockDb);
      mockDb.where.mockReturnValue(mockDb);
    });

    it('should return explanation with score and factors', async () => {
      const mockInvoice = {
        id: 1,
        tenantId: 1,
        amount: '100.00',
        currency: 'USD',
      };

      const mockTransaction = {
        id: 10,
        tenantId: 1,
        amount: '100.00',
        currency: 'USD',
        postedAt: new Date(),
      };

      mockDb.where.mockResolvedValueOnce([mockInvoice]);
      mockDb.where.mockResolvedValueOnce([mockTransaction]);

      const result = await service.explainReconciliation(1, 1, 10);

      expect(result.score).toBe(1);
      expect(result.factors).toContain('Amounts match exactly');
      expect(result.recommendation).toBe('Highly recommended match');
    });

    it('should throw NotFoundException when invoice not found', async () => {
      mockDb.where.mockResolvedValueOnce([]);
      mockDb.where.mockResolvedValueOnce([{ id: 10 }]);

      await expect(service.explainReconciliation(1, 999, 10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when transaction not found', async () => {
      mockDb.where.mockResolvedValueOnce([{ id: 1 }]);
      mockDb.where.mockResolvedValueOnce([]);

      await expect(service.explainReconciliation(1, 1, 999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should identify currency mismatch', async () => {
      const mockInvoice = {
        id: 1,
        tenantId: 1,
        amount: '100.00',
        currency: 'USD',
      };

      const mockTransaction = {
        id: 10,
        tenantId: 1,
        amount: '100.00',
        currency: 'EUR',
        postedAt: new Date(),
      };

      mockDb.where.mockResolvedValueOnce([mockInvoice]);
      mockDb.where.mockResolvedValueOnce([mockTransaction]);

      const result = await service.explainReconciliation(1, 1, 10);

      expect(result.factors).toContain('Currency mismatch: USD vs EUR');
    });
  });

  describe('reconcile', () => {
    beforeEach(() => {
      mockDb.select.mockReturnValue(mockDb);
      mockDb.from.mockReturnValue(mockDb);
      mockDb.where.mockReturnValue(mockDb);
      mockDb.insert.mockReturnValue(mockDb);
      mockDb.values.mockReturnValue(mockDb);
      mockDb.returning.mockReturnValue(mockDb);
    });

    it('should create proposed matches for top candidates', async () => {
      const mockInvoices = [
        { id: 1, tenantId: 1, amount: '100.00', status: 'open' },
        { id: 2, tenantId: 1, amount: '200.00', status: 'open' },
      ];

      const mockTransactions = [
        { id: 10, tenantId: 1, amount: '100.00', postedAt: new Date() },
        { id: 11, tenantId: 1, amount: '200.00', postedAt: new Date() },
      ];

      mockDb.where.mockResolvedValueOnce(mockInvoices);
      mockDb.where.mockResolvedValueOnce(mockTransactions);

      const mockCreatedMatch = {
        id: 1,
        tenantId: 1,
        invoiceId: 1,
        bankTransactionId: 10,
        score: '1.0000',
        status: 'proposed',
      };

      mockDb.returning.mockResolvedValue([mockCreatedMatch]);

      const result = await service.reconcile(1, { minScore: 0.9 });

      expect(result.matchesCreated).toBeGreaterThan(0);
      expect(result.matches[0].status).toBe('proposed');
    });

    it('should use greedy matching (no duplicate usage)', async () => {
      const mockInvoices = [
        { id: 1, tenantId: 1, amount: '100.00', status: 'open' },
        { id: 2, tenantId: 1, amount: '100.00', status: 'open' },
      ];

      const mockTransactions = [
        { id: 10, tenantId: 1, amount: '100.00', postedAt: new Date() },
      ];

      mockDb.where.mockResolvedValueOnce(mockInvoices);
      mockDb.where.mockResolvedValueOnce(mockTransactions);

      const mockMatch = {
        id: 1,
        tenantId: 1,
        invoiceId: 1,
        bankTransactionId: 10,
        status: 'proposed',
      };

      mockDb.returning.mockResolvedValue([mockMatch]);

      const result = await service.reconcile(1, {});

      // Should only create 1 match despite 2 invoices matching same transaction
      expect(result.matchesCreated).toBe(1);
    });

    it('should filter by invoiceIds when provided', async () => {
      const mockInvoices = [
        { id: 1, tenantId: 1, amount: '100.00', status: 'open' },
        { id: 2, tenantId: 1, amount: '100.00', status: 'open' },
      ];

      const mockTransactions = [
        { id: 10, tenantId: 1, amount: '100.00', postedAt: new Date() },
        { id: 11, tenantId: 1, amount: '100.00', postedAt: new Date() },
      ];

      mockDb.where.mockResolvedValueOnce(mockInvoices);
      mockDb.where.mockResolvedValueOnce(mockTransactions);

      const mockMatch = {
        id: 1,
        tenantId: 1,
        invoiceId: 1,
        bankTransactionId: 10,
        status: 'proposed',
      };

      mockDb.returning.mockResolvedValue([mockMatch]);

      await service.reconcile(1, { invoiceIds: [1] });

      expect(mockDb.values).toHaveBeenCalled();
    });
  });

  describe('confirmMatch', () => {
    beforeEach(() => {
      mockDb.update.mockReturnValue(mockDb);
      mockDb.set.mockReturnValue(mockDb);
      mockDb.where.mockReturnValue(mockDb);
      mockDb.returning.mockReturnValue(mockDb);
    });

    it('should update match status to confirmed', async () => {
      const mockUpdatedMatch = {
        id: 1,
        tenantId: 1,
        invoiceId: 1,
        bankTransactionId: 10,
        status: 'confirmed',
      };

      mockDb.returning.mockResolvedValueOnce([mockUpdatedMatch]);
      mockDb.set.mockReturnValue(mockDb);
      mockDb.where.mockReturnValue(mockDb);

      const result = await service.confirmMatch(1, 1);

      expect(result.status).toBe('confirmed');
      expect(mockDb.update).toHaveBeenCalledTimes(2); // match + invoice
    });

    it('should update related invoice status to matched', async () => {
      const mockUpdatedMatch = {
        id: 1,
        tenantId: 1,
        invoiceId: 5,
        bankTransactionId: 10,
        status: 'confirmed',
      };

      mockDb.returning.mockResolvedValueOnce([mockUpdatedMatch]);
      mockDb.set.mockReturnValue(mockDb);
      mockDb.where.mockReturnValue(mockDb);

      await service.confirmMatch(1, 1);

      expect(mockDb.update).toHaveBeenCalledTimes(2);
      expect(mockDb.set).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'matched' }),
      );
    });

    it('should throw NotFoundException when match not found', async () => {
      mockDb.returning.mockResolvedValue([]);

      await expect(service.confirmMatch(1, 999)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.confirmMatch(1, 999)).rejects.toThrow(
        'Match 999 not found',
      );
    });

    it('should enforce tenant isolation', async () => {
      mockDb.returning.mockResolvedValue([]);

      await expect(service.confirmMatch(2, 1)).rejects.toThrow(
        NotFoundException,
      );

      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe('explainWithAiFallback', () => {
    const mockInvoice = {
      id: 1,
      tenantId: 1,
      amount: '100.00',
      currency: 'USD',
      invoiceDate: new Date('2024-01-01'),
      description: 'Test invoice',
    };

    const mockTransaction = {
      id: 10,
      tenantId: 1,
      amount: '100.00',
      currency: 'USD',
      postedAt: new Date('2024-01-01'),
      description: 'Test transaction',
    };

    beforeEach(() => {
      mockDb.select.mockReturnValue(mockDb);
      mockDb.from.mockReturnValue(mockDb);
      mockDb.where.mockReturnValue(mockDb);
    });

    it('should return AI explanation when available', async () => {
      mockDb.where.mockResolvedValueOnce([mockInvoice]);
      mockDb.where.mockResolvedValueOnce([]); // allTransactions query
      mockDb.where.mockResolvedValueOnce([mockTransaction]);

      mockAiExplanation.explainViaAi.mockResolvedValue(
        'AI says this is a perfect match',
      );

      const result = await service.explainWithAiFallback(1, 1, 10);

      expect(result.source).toBe('ai');
      expect(result.explanation).toBe('AI says this is a perfect match');
      expect(mockAiExplanation.explainViaAi).toHaveBeenCalled();
    });

    it('should fallback to Python when AI returns null', async () => {
      mockDb.where.mockResolvedValueOnce([mockInvoice]);
      mockDb.where.mockResolvedValueOnce([]);
      mockDb.where.mockResolvedValueOnce([mockTransaction]);

      mockAiExplanation.explainViaAi.mockResolvedValue(null);
      mockPythonReconciliation.explainViaPython.mockResolvedValue({
        score: 0.95,
        factors: ['Amount match', 'Currency match'],
        explanation: 'Python deterministic match',
      });

      const result = await service.explainWithAiFallback(1, 1, 10);

      expect(result.source).toBe('python');
      expect(result.explanation).toBe('Python deterministic match');
      expect(mockPythonReconciliation.explainViaPython).toHaveBeenCalled();
    });

    it('should use simple fallback when both AI and Python fail', async () => {
      mockDb.where.mockResolvedValueOnce([mockInvoice]);
      mockDb.where.mockResolvedValueOnce([]);
      mockDb.where.mockResolvedValueOnce([mockTransaction]);

      mockAiExplanation.explainViaAi.mockResolvedValue(null);
      mockPythonReconciliation.explainViaPython.mockResolvedValue(null);

      const result = await service.explainWithAiFallback(1, 1, 10);

      expect(result.source).toBe('fallback');
      expect(result.score).toBeDefined();
      expect(result.factors).toBeDefined();
    });

    it('should throw NotFoundException when invoice not found', async () => {
      mockDb.where.mockResolvedValueOnce([]);
      mockDb.where.mockResolvedValueOnce([]);
      mockDb.where.mockResolvedValueOnce([mockTransaction]);

      await expect(service.explainWithAiFallback(1, 999, 10)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when transaction not found', async () => {
      mockDb.where.mockResolvedValueOnce([mockInvoice]);
      mockDb.where.mockResolvedValueOnce([]);
      mockDb.where.mockResolvedValueOnce([]);

      await expect(service.explainWithAiFallback(1, 1, 999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should filter to allowed attributes only', async () => {
      mockDb.where.mockResolvedValueOnce([mockInvoice]);
      mockDb.where.mockResolvedValueOnce([]);
      mockDb.where.mockResolvedValueOnce([mockTransaction]);

      mockAiExplanation.explainViaAi.mockResolvedValue('AI explanation');

      await service.explainWithAiFallback(1, 1, 10);

      const aiCall = mockAiExplanation.explainViaAi.mock.calls[0][0];
      expect(aiCall.invoice).toHaveProperty('amount');
      expect(aiCall.invoice).toHaveProperty('currency');
      expect(aiCall.invoice).not.toHaveProperty('tenantId');
    });
  });

  describe('ensureDb', () => {
    it('should throw error when database is not configured', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          MatchesService,
          {
            provide: DRIZZLE,
            useValue: null,
          },
          {
            provide: AiExplanationService,
            useValue: mockAiExplanation,
          },
          {
            provide: PythonReconciliationService,
            useValue: mockPythonReconciliation,
          },
        ],
      }).compile();

      const serviceWithoutDb = module.get<MatchesService>(MatchesService);

      await expect(serviceWithoutDb.findCandidates(1, {})).rejects.toThrow(
        'Database not configured',
      );
    });
  });
});
