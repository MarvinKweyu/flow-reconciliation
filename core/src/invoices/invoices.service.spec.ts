import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { DRIZZLE } from '../db/tokens';
import { CreateInvoiceDto, InvoiceStatus } from './dto/create-invoice.dto';
import { ListInvoicesDto } from './dto/list-invoices.dto';

describe('InvoicesService', () => {
  let service: InvoicesService;
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
      returning: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoicesService,
        {
          provide: DRIZZLE,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<InvoicesService>(InvoicesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create invoice with explicit vendorId', async () => {
      const dto: CreateInvoiceDto = {
        vendorId: 5,
        amount: '100.00',
        currency: 'USD',
        invoiceNumber: 'INV-001',
        description: 'Test invoice',
      };

      const mockInvoice = {
        id: 1,
        tenantId: 1,
        vendorId: 5,
        amount: '100.00',
        currency: 'USD',
        status: 'open',
      };

      mockDb.returning.mockResolvedValue([mockInvoice]);

      const result = await service.create(1, dto);

      expect(result).toEqual(mockInvoice);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb.values).toHaveBeenCalled();
    });

    it('should create vendor implicitly when vendorName provided and vendor does not exist', async () => {
      const dto: CreateInvoiceDto = {
        vendorName: 'Acme Corp',
        amount: '200.00',
        currency: 'EUR',
      };

      const mockCreatedVendor = { id: 10, tenantId: 1, name: 'Acme Corp' };
      const mockInvoice = {
        id: 2,
        tenantId: 1,
        vendorId: 10,
        amount: '200.00',
        currency: 'EUR',
        status: 'open',
      };

      // First limit call: vendor lookup returns empty
      mockDb.limit.mockResolvedValueOnce([]);
      // Vendor insert returning
      mockDb.returning.mockResolvedValueOnce([mockCreatedVendor]);
      // Invoice insert returning
      mockDb.returning.mockResolvedValueOnce([mockInvoice]);

      const result = await service.create(1, dto);

      expect(result.vendorId).toBe(10);
      expect(mockDb.insert).toHaveBeenCalledTimes(2); // vendor + invoice
    });

    it('should reuse existing vendor when vendorName matches', async () => {
      const dto: CreateInvoiceDto = {
        vendorName: 'Beta Inc',
        amount: '300.00',
      };

      const mockExistingVendor = { id: 20, tenantId: 1, name: 'Beta Inc' };
      const mockInvoice = {
        id: 3,
        tenantId: 1,
        vendorId: 20,
        amount: '300.00',
        status: 'open',
      };

      // Vendor lookup returns existing
      mockDb.limit.mockResolvedValueOnce([mockExistingVendor]);
      // Invoice insert
      mockDb.returning.mockResolvedValueOnce([mockInvoice]);

      const result = await service.create(1, dto);

      expect(result.vendorId).toBe(20);
      expect(mockDb.insert).toHaveBeenCalledTimes(1); // only invoice, no vendor insert
    });

    it('should default to USD currency and open status', async () => {
      const dto: CreateInvoiceDto = {
        amount: '50.00',
      };

      const mockInvoice = {
        id: 4,
        tenantId: 2,
        amount: '50.00',
        currency: 'USD',
        status: 'open',
      };

      mockDb.returning.mockResolvedValue([mockInvoice]);

      const result = await service.create(2, dto);

      expect(result.currency).toBe('USD');
      expect(result.status).toBe('open');
    });
  });

  describe('findAll', () => {
    beforeEach(() => {
      mockDb.select.mockReturnValue(mockDb);
      mockDb.from.mockReturnValue(mockDb);
      mockDb.where.mockReturnValue(mockDb);
      mockDb.orderBy.mockReturnValue(mockDb);
    });

    it('should return all invoices for a tenant', async () => {
      const mockInvoices = [
        { id: 1, tenantId: 1, amount: '100.00', status: 'open' },
        { id: 2, tenantId: 1, amount: '200.00', status: 'paid' },
      ];

      mockDb.orderBy.mockResolvedValue(mockInvoices);

      const result = await service.findAll(1, {});

      expect(result).toEqual(mockInvoices);
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should apply status filter', async () => {
      mockDb.orderBy.mockResolvedValue([]);

      await service.findAll(1, { status: InvoiceStatus.OPEN });

      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should apply vendorId filter', async () => {
      mockDb.orderBy.mockResolvedValue([]);

      await service.findAll(1, { vendorId: 5 });

      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should apply date range filters', async () => {
      mockDb.orderBy.mockResolvedValue([]);

      await service.findAll(1, {
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
      });

      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should apply amount range filters', async () => {
      mockDb.orderBy.mockResolvedValue([]);

      await service.findAll(1, {
        amountMin: '50.00',
        amountMax: '500.00',
      });

      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe('findAllPaginated', () => {
    beforeEach(() => {
      mockDb.select.mockReturnValue(mockDb);
      mockDb.from.mockReturnValue(mockDb);
      mockDb.where.mockReturnValue(mockDb);
      mockDb.orderBy.mockReturnValue(mockDb);
      mockDb.limit.mockReturnValue(mockDb);
      mockDb.offset.mockReturnValue(mockDb);
    });

    it('should return paginated results with total count', async () => {
      const mockInvoices = [
        { id: 1, tenantId: 1, amount: '100.00' },
        { id: 2, tenantId: 1, amount: '200.00' },
      ];

      // First query: items
      mockDb.offset.mockResolvedValueOnce(mockInvoices);

      // Second query: count
      const mockCountDb = {
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValue([{ value: 10 }]),
      };
      mockDb.select
        .mockReturnValueOnce(mockDb)
        .mockReturnValueOnce(mockCountDb);

      const result = await service.findAllPaginated(1, {}, 1, 20);

      expect(result.items).toEqual(mockInvoices);
      expect(result.total).toBe(10);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('should calculate correct offset for page 3', async () => {
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

      // Page 3, pageSize 10 => offset = 20
      expect(mockDb.limit).toHaveBeenCalledWith(10);
      expect(mockDb.offset).toHaveBeenCalledWith(20);
    });

    it('should apply filters to both queries', async () => {
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
        { status: InvoiceStatus.OPEN, amountMin: '100.00' },
        1,
        20,
      );

      expect(mockDb.where).toHaveBeenCalled();
      expect(mockCountDb.where).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    beforeEach(() => {
      mockDb.delete.mockReturnValue(mockDb);
      mockDb.where.mockReturnValue(mockDb);
      mockDb.returning.mockReturnValue(mockDb);
    });

    it('should delete an invoice and return it', async () => {
      const mockDeleted = {
        id: 1,
        tenantId: 1,
        amount: '100.00',
        status: 'open',
      };

      mockDb.returning.mockResolvedValue([mockDeleted]);

      const result = await service.delete(1, 1);

      expect(result).toEqual(mockDeleted);
      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.where).toHaveBeenCalled();
    });

    it('should throw NotFoundException if invoice not found', async () => {
      mockDb.returning.mockResolvedValue([]);

      await expect(service.delete(1, 999)).rejects.toThrow(NotFoundException);
      await expect(service.delete(1, 999)).rejects.toThrow(
        'Invoice 999 not found for tenant 1',
      );
    });

    it('should enforce tenant isolation on delete', async () => {
      mockDb.returning.mockResolvedValue([]);

      // Try to delete invoice from different tenant
      await expect(service.delete(2, 1)).rejects.toThrow(NotFoundException);

      expect(mockDb.where).toHaveBeenCalled();
    });
  });

  describe('ensureDb', () => {
    it('should throw error when database is not configured', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          InvoicesService,
          {
            provide: DRIZZLE,
            useValue: null,
          },
        ],
      }).compile();

      const serviceWithoutDb = module.get<InvoicesService>(InvoicesService);

      await expect(serviceWithoutDb.findAll(1, {})).rejects.toThrow(
        'Database not configured',
      );
    });
  });
});
