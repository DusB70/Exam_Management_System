import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

describe('PrismaService (PostgreSQL Database Client)', () => {
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    prismaService = module.get<PrismaService>(PrismaService);
  });

  it('should be defined and instantiate PrismaClient', () => {
    expect(prismaService).toBeDefined();
    expect(typeof prismaService.$connect).toBe('function');
    expect(typeof prismaService.$disconnect).toBe('function');
    expect(typeof prismaService.$transaction).toBe('function');
  });

  describe('Lifecycle Hooks', () => {
    it('should connect to PostgreSQL database on module init', async () => {
      const connectSpy = jest.spyOn(prismaService, '$connect').mockImplementation(async () => {});

      await prismaService.onModuleInit();
      expect(connectSpy).toHaveBeenCalledTimes(1);
    });

    it('should disconnect from PostgreSQL database on module destroy', async () => {
      const disconnectSpy = jest
        .spyOn(prismaService, '$disconnect')
        .mockImplementation(async () => {});

      await prismaService.onModuleDestroy();
      expect(disconnectSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('PostgreSQL Transactions ($transaction)', () => {
    it('should execute interactive transaction callback successfully', async () => {
      const mockUser = { user_id: 1, email: 'student@ems.com' };

      jest.spyOn(prismaService, '$transaction').mockImplementation(async (callback: any) => {
        return callback(prismaService);
      });

      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockUser as any);

      const result = await prismaService.$transaction(async (tx) => {
        return tx.user.findUnique({ where: { email: 'student@ems.com' } });
      });

      expect(result).toEqual(mockUser);
    });

    it('should reject and rollback if any operation in transaction fails', async () => {
      jest.spyOn(prismaService, '$transaction').mockImplementation(async (callback: any) => {
        return callback(prismaService);
      });

      jest
        .spyOn(prismaService.user, 'create')
        .mockRejectedValue(new Error('Transaction aborted due to unique constraint violation'));

      await expect(
        prismaService.$transaction(async (tx) => {
          return tx.user.create({ data: {} as any });
        }),
      ).rejects.toThrow('Transaction aborted due to unique constraint violation');
    });
  });

  describe('Raw PostgreSQL Queries ($queryRaw)', () => {
    it('should execute raw SQL query (e.g. database health ping)', async () => {
      const rawQueryResult = [{ health: 1 }];
      const queryRawSpy = jest
        .spyOn(prismaService, '$queryRaw')
        .mockResolvedValue(rawQueryResult as any);

      // Simulate SELECT 1 health check query
      const result = await prismaService.$queryRaw`SELECT 1 AS health`;

      expect(queryRawSpy).toHaveBeenCalled();
      expect(result).toEqual(rawQueryResult);
    });
  });

  describe('PostgreSQL Constraint & Error Handling', () => {
    it('should catch unique constraint violation (P2002 error code)', async () => {
      const uniqueConstraintError = {
        name: 'PrismaClientKnownRequestError',
        code: 'P2002',
        message: 'Unique constraint failed on the fields: (`email`)',
        meta: { target: ['email'] },
      };

      jest.spyOn(prismaService.user, 'create').mockRejectedValue(uniqueConstraintError as any);

      await expect(
        prismaService.user.create({
          data: {
            email: 'duplicate@ems.com',
            full_name: 'Test Student',
            name_with_initials: 'T. Student',
            password_hash: 'hash',
            role_id: 1,
            nic_no: '200012345678',
            date_of_birth: new Date(),
            phone_number: '0771234567',
            address: 'Colombo',
          },
        }),
      ).rejects.toMatchObject({
        code: 'P2002',
        meta: { target: ['email'] },
      });
    });
  });
});
