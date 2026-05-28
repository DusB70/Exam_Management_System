import { Test, TestingModule } from '@nestjs/testing';
import { SystemService } from './system.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SystemService', () => {
  let service: SystemService;
  let prisma: PrismaService;

  const mockPrismaService = {
    role: { findMany: jest.fn().mockResolvedValue([]) },
    user: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(5) },
    department: { findMany: jest.fn().mockResolvedValue([]) },
    student: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(3) },
    lecturer: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(2) },
    course: { findMany: jest.fn().mockResolvedValue([]) },
    courseRegistration: { findMany: jest.fn().mockResolvedValue([]) },
    exam: { findMany: jest.fn().mockResolvedValue([]) },
    examHall: { findMany: jest.fn().mockResolvedValue([]) },
    examSchedule: { findMany: jest.fn().mockResolvedValue([]) },
    refreshToken: { findMany: jest.fn().mockResolvedValue([]) },
    courseLecturer: { findMany: jest.fn().mockResolvedValue([]) },
    registrationPeriod: { findMany: jest.fn().mockResolvedValue([]) },
    examMark: { findMany: jest.fn().mockResolvedValue([]) },
    studentCourseGrade: { findMany: jest.fn().mockResolvedValue([]) },
    studentSemesterGpa: { findMany: jest.fn().mockResolvedValue([]) },
    auditLog: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(10) },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SystemService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get<SystemService>(SystemService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createBackup', () => {
    it('should query all 17 tables and return a backup object', async () => {
      const backup = await service.createBackup();
      expect(backup.backupVersion).toBe('1.0');
      expect(backup.tablesCount).toBe(17);
      expect(backup.data).toBeDefined();
      expect(backup.data.users).toBeInstanceOf(Array);
      expect(prisma.user.findMany).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return system counts', async () => {
      const stats = await service.getStats();
      expect(stats.totalUsers).toBe(5);
      expect(stats.totalStudents).toBe(3);
      expect(stats.totalLecturers).toBe(2);
      expect(stats.totalLogs).toBe(10);
      expect(stats.databaseStatus).toBe('ONLINE');
    });
  });
});
