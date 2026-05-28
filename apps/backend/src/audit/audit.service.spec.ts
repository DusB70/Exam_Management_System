import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuditService', () => {
  let service: AuditService;
  let prisma: PrismaService;

  const mockPrismaService = {
    auditLog: {
      create: jest.fn().mockResolvedValue({ log_id: 1 }),
      findMany: jest.fn().mockResolvedValue([{ log_id: 1, action: 'USER_CREATE' }]),
      count: jest.fn().mockResolvedValue(1),
    },
    $transaction: jest.fn((arg) => {
      if (Array.isArray(arg)) {
        return Promise.all(arg);
      }
      return arg(mockPrismaService);
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuditService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get<AuditService>(AuditService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('logAction', () => {
    it('should create an audit log record', async () => {
      const res = await service.logAction(1, 'USER_CREATE', 'users', '10');
      expect(res).toBeDefined();
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated audit logs', async () => {
      const res = await service.findAll(1, 10, 'USER');
      expect(res.items).toHaveLength(1);
      expect(res.total).toBe(1);
      expect(res.totalPages).toBe(1);
    });
  });
});
