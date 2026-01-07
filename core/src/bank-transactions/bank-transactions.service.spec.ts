import { Test, TestingModule } from '@nestjs/testing';
import { BankTransactionsService } from './bank-transactions.service';
import { DRIZZLE } from '../db/tokens';
import { BankTransactionItemDto } from './dto/bank-transaction-item.dto';

describe('BankTransactionsService', () => {
  let service: BankTransactionsService;
  let mockDb: any;

  beforeEach(async () => {
    // Mock Drizzle database
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BankTransactionsService,
        {
          provide: DRIZZLE,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<BankTransactionsService>(BankTransactionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('bulkImport', () => {
    it('should import new transactions without externalId', async () => {
      const transactions: BankTransactionItemDto[] = [
        {
          postedAt: '2024-01-01T00:00:00Z',
          amount: '100.00',
          currency: 'USD',
          description: 'Payment 1',
        },
        {
          postedAt: '2024-01-02T00:00:00Z',
          amount: '200.00',
          currency: 'EUR',
          description: 'Payment 2',
        },
      ];

      // Mock insert to succeed
      mockDb.insert.mockReturnValue({
        values: jest.fn().mockResolvedValue(undefined),
      });

      const result = await service.bulkImport(1, transactions);

      expect(result.imported).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
    });

    it('should skip duplicate transactions with same externalId', async () => {
      const transactions: BankTransactionItemDto[] = [
        {
          externalId: 'ext-123',
          postedAt: '2024-01-01T00:00:00Z',
          amount: '100.00',
          currency: 'USD',
        },
        {
          externalId: 'ext-123', // duplicate
          postedAt: '2024-01-02T00:00:00Z',
          amount: '150.00',
          currency: 'USD',
        },
      ];

      // First check: no existing, second check: existing
      let callCount = 0;
      mockDb.limit.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve([]); // not found
        }
        return Promise.resolve([{ id: 1, externalId: 'ext-123' }]); // found
      });

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockResolvedValue(undefined),
      });

      const result = await service.bulkImport(1, transactions);

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle import errors gracefully', async () => {
      const transactions: BankTransactionItemDto[] = [
        {
          postedAt: '2024-01-01T00:00:00Z',
          amount: '100.00',
        },
      ];

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockRejectedValue(new Error('DB connection failed')),
      });

      const result = await service.bulkImport(1, transactions);

      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('DB connection failed');
    });

    it('should enforce tenant isolation during idempotency check', async () => {
      const transactions: BankTransactionItemDto[] = [
        {
          externalId: 'ext-456',
          postedAt: '2024-01-01T00:00:00Z',
          amount: '100.00',
        },
      ];

      // Simulate existing record for different tenant
      mockDb.limit.mockResolvedValue([]);

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockResolvedValue(undefined),
      });

      const result = await service.bulkImport(2, transactions);

      expect(result.imported).toBe(1);
      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return all transactions for a tenant', async () => {
      const mockTransactions = [
        {
          id: 1,
          tenantId: 1,
          amount: '100.00',
          postedAt: new Date('2024-01-01'),
        },
        {
          id: 2,
          tenantId: 1,
          amount: '200.00',
          postedAt: new Date('2024-01-02'),
        },
      ];

      mockDb.orderBy.mockResolvedValue(mockTransactions);

      const result = await service.findAll(1);

      expect(result).toEqual(mockTransactions);
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.orderBy).toHaveBeenCalled();
    });

    it('should only return transactions for specified tenant', async () => {
      mockDb.orderBy.mockResolvedValue([]);

      await service.findAll(42);

      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe('findAllPaginated', () => {
    beforeEach(() => {
      // Reset mocks and ensure orderBy is part of the chain
      mockDb.select.mockReturnValue(mockDb);
      mockDb.from.mockReturnValue(mockDb);
      mockDb.where.mockReturnValue(mockDb);
      mockDb.orderBy.mockReturnValue(mockDb);
      mockDb.limit.mockReturnValue(mockDb);
      mockDb.offset.mockReturnValue(mockDb);
    });

    it('should return paginated results with total count', async () => {
      const mockItems = [
        {
          id: 1,
          tenantId: 1,
          amount: '100.00',
          postedAt: new Date('2024-01-01'),
        },
      ];

      // Mock the query chain
      mockDb.offset.mockResolvedValueOnce(mockItems);

      // Mock count query
      const mockCountDb = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([{ value: 5 }]),
      };
      mockDb.select
        .mockReturnValueOnce(mockDb)
        .mockReturnValueOnce(mockCountDb);

      const result = await service.findAllPaginated(1, {}, 1, 20);

      expect(result.items).toEqual(mockItems);
      expect(result.total).toBe(5);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('should apply date filters correctly', async () => {
      mockDb.offset.mockResolvedValueOnce([]);

      const mockCountDb = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([{ value: 0 }]),
      };
      mockDb.select
        .mockReturnValueOnce(mockDb)
        .mockReturnValueOnce(mockCountDb);

      await service.findAllPaginated(
        1,
        {
          dateFrom: '2024-01-01',
          dateTo: '2024-01-31',
        },
        1,
        20,
      );

      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.orderBy).toHaveBeenCalled();
    });

    it('should apply amount filters correctly', async () => {
      mockDb.offset.mockResolvedValueOnce([]);

      const mockCountDb = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([{ value: 0 }]),
      };
      mockDb.select
        .mockReturnValueOnce(mockDb)
        .mockReturnValueOnce(mockCountDb);

      await service.findAllPaginated(
        1,
        {
          amountMin: '50.00',
          amountMax: '150.00',
        },
        1,
        20,
      );

      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.orderBy).toHaveBeenCalled();
    });

    it('should apply description filter with LIKE', async () => {
      mockDb.offset.mockResolvedValueOnce([]);

      const mockCountDb = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([{ value: 0 }]),
      };
      mockDb.select
        .mockReturnValueOnce(mockDb)
        .mockReturnValueOnce(mockCountDb);

      await service.findAllPaginated(
        1,
        {
          description: 'Payment',
        },
        1,
        20,
      );

      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.orderBy).toHaveBeenCalled();
    });

    it('should calculate correct offset for pagination', async () => {
      mockDb.offset.mockResolvedValueOnce([]);

      const mockCountDb = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([{ value: 0 }]),
      };
      mockDb.select
        .mockReturnValueOnce(mockDb)
        .mockReturnValueOnce(mockCountDb);

      await service.findAllPaginated(1, {}, 3, 10);

      // Page 3, pageSize 10 => offset should be 20
      expect(mockDb.limit).toHaveBeenCalledWith(10);
      expect(mockDb.offset).toHaveBeenCalledWith(20);
    });
  });

  describe('ensureDb', () => {
    it('should throw error when database is not configured', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          BankTransactionsService,
          {
            provide: DRIZZLE,
            useValue: null,
          },
        ],
      }).compile();

      const serviceWithoutDb = module.get<BankTransactionsService>(
        BankTransactionsService,
      );

      await expect(serviceWithoutDb.findAll(1)).rejects.toThrow(
        'Database not configured',
      );
    });
  });
});
