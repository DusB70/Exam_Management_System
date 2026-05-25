import { Test, TestingModule } from '@nestjs/testing';
import { CoursesService } from './courses.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PeriodStatus } from './dtos/registration-periods.dto';
import { NotificationsQueueService } from '../notifications/notifications.queue.service';

describe('CoursesService', () => {
  let service: CoursesService;
  let prisma: PrismaService;
  let audit: AuditService;

  const mockNotificationsQueueService = {
    addResultsPublishedJob: jest.fn().mockResolvedValue(true),
    addRegistrationOpenedJob: jest.fn().mockResolvedValue(true),
  };

  const mockPrismaService = {
    course: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    lecturer: {
      findUnique: jest.fn(),
    },
    courseLecturer: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    registrationPeriod: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockAuditService = {
    logAction: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoursesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: NotificationsQueueService, useValue: mockNotificationsQueueService },
      ],
    }).compile();

    service = module.get<CoursesService>(CoursesService);
    prisma = module.get<PrismaService>(PrismaService);
    audit = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createCourse', () => {
    it('should throw BadRequestException if course code is already in use', async () => {
      mockPrismaService.course.findUnique.mockResolvedValue({
        course_id: 1,
        course_code: 'CS-101',
      });

      const dto = {
        courseCode: 'CS-101',
        courseName: 'Intro to CS',
        creditValue: 3,
        departmentId: 1,
        semester: 1,
        academicYear: 2026,
      };

      await expect(service.create(dto, 99)).rejects.toThrow(BadRequestException);
      expect(prisma.course.findUnique).toHaveBeenCalledWith({ where: { course_code: 'CS-101' } });
    });

    it('should create course and log audit action', async () => {
      mockPrismaService.course.findUnique.mockResolvedValue(null);
      mockPrismaService.course.create.mockResolvedValue({
        course_id: 10,
        course_code: 'CS-101',
        course_name: 'Intro to CS',
        credit_value: 3,
      });

      const dto = {
        courseCode: 'CS-101',
        courseName: 'Intro to CS',
        creditValue: 3,
        departmentId: 1,
        semester: 1,
        academicYear: 2026,
      };

      const result = await service.create(dto, 99);
      expect(result.course_id).toBe(10);
      expect(prisma.course.create).toHaveBeenCalled();
      expect(audit.logAction).toHaveBeenCalledWith(
        99,
        'COURSE_CREATE',
        'courses',
        '10',
        null,
        expect.any(Object),
      );
    });
  });

  describe('assignLecturer', () => {
    it('should throw NotFoundException if lecturer does not exist', async () => {
      mockPrismaService.course.findUnique.mockResolvedValue({ course_id: 1 });
      mockPrismaService.lecturer.findUnique.mockResolvedValue(null);

      await expect(service.assignLecturer(1, 2, 99)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if lecturer is already assigned', async () => {
      mockPrismaService.course.findUnique.mockResolvedValue({ course_id: 1 });
      mockPrismaService.lecturer.findUnique.mockResolvedValue({ lecturer_id: 2 });
      mockPrismaService.courseLecturer.findUnique.mockResolvedValue({
        course_id: 1,
        lecturer_id: 2,
      });

      await expect(service.assignLecturer(1, 2, 99)).rejects.toThrow(BadRequestException);
    });

    it('should assign lecturer and log audit action', async () => {
      mockPrismaService.course.findUnique.mockResolvedValue({ course_id: 1 });
      mockPrismaService.lecturer.findUnique.mockResolvedValue({ lecturer_id: 2 });
      mockPrismaService.courseLecturer.findUnique.mockResolvedValue(null);
      mockPrismaService.courseLecturer.create.mockResolvedValue({ course_id: 1, lecturer_id: 2 });

      const result = await service.assignLecturer(1, 2, 99);
      expect(result).toEqual({ course_id: 1, lecturer_id: 2 });
      expect(prisma.courseLecturer.create).toHaveBeenCalled();
      expect(audit.logAction).toHaveBeenCalledWith(
        99,
        'COURSE_ASSIGN_LECTURER',
        'course_lecturers',
        '1_2',
        null,
        expect.any(Object),
      );
    });
  });

  describe('createPeriod', () => {
    it('should throw BadRequestException if start date is after or equal to end date', async () => {
      const dto = {
        academicYear: 2026,
        semester: 1,
        startDate: '2026-06-01T00:00:00.000Z',
        endDate: '2026-05-01T00:00:00.000Z',
        status: PeriodStatus.OPEN,
      };

      await expect(service.createPeriod(dto, 99)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if a registration window is already OPEN for the same semester/year', async () => {
      const dto = {
        academicYear: 2026,
        semester: 1,
        startDate: '2026-05-01T00:00:00.000Z',
        endDate: '2026-06-01T00:00:00.000Z',
        status: PeriodStatus.OPEN,
      };

      mockPrismaService.registrationPeriod.findFirst.mockResolvedValue({
        period_id: 1,
        status: PeriodStatus.OPEN,
      });

      await expect(service.createPeriod(dto, 99)).rejects.toThrow(BadRequestException);
    });
  });
});
