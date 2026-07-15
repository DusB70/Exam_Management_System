import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    student: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendResultsPublishedNotifications', () => {
    it('should find students and log simulated emails', async () => {
      const mockStudents = [
        {
          student_id: 1,
          academic_year: 2026,
          semester: '1.1',
          user: {
            email: 'test@example.com',
            full_name: 'Test Student',
          },
        },
      ];
      mockPrismaService.student.findMany.mockResolvedValue(mockStudents);

      const loggerSpy = jest.spyOn(service['logger'], 'log');

      await service.sendResultsPublishedNotifications(2026, '1.1');

      expect(prisma.student.findMany).toHaveBeenCalledWith({
        where: { academic_year: 2026, semester: '1.1' },
        include: { user: true },
      });

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Sending results publication email notifications'),
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[SIMULATED EMAIL SENT] To: test@example.com'),
      );
    });
  });

  describe('sendRegistrationOpenedNotifications', () => {
    it('should find students and log simulated emails with formatted date', async () => {
      const mockStudents = [
        {
          student_id: 2,
          academic_year: 2026,
          semester: '1.2',
          user: {
            email: 'student2@example.com',
            full_name: 'Student Two',
          },
        },
      ];
      mockPrismaService.student.findMany.mockResolvedValue(mockStudents);

      const loggerSpy = jest.spyOn(service['logger'], 'log');
      const endDate = new Date('2026-12-31');

      await service.sendRegistrationOpenedNotifications(2026, '1.2', endDate);

      expect(prisma.student.findMany).toHaveBeenCalledWith({
        where: { academic_year: 2026, semester: '1.2' },
        include: { user: true },
      });

      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('Sending course registration window email notifications'),
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('[SIMULATED EMAIL SENT] To: student2@example.com'),
      );
    });
  });
});
