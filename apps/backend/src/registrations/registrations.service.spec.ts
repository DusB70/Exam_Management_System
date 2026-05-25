import { Test, TestingModule } from '@nestjs/testing';
import { RegistrationsService } from './registrations.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('RegistrationsService', () => {
  let service: RegistrationsService;
  let prisma: PrismaService;
  let audit: AuditService;

  const mockPrismaService = {
    student: {
      findUnique: jest.fn(),
    },
    course: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    courseRegistration: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    registrationPeriod: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
  };

  const mockAuditService = {
    logAction: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegistrationsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<RegistrationsService>(RegistrationsService);
    prisma = module.get<PrismaService>(PrismaService);
    audit = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('registerCourses', () => {
    it('should throw NotFoundException if student profile does not exist', async () => {
      mockPrismaService.student.findUnique.mockResolvedValue(null);

      await expect(service.registerCourses(1, { courseIds: [10] })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if no courses selected', async () => {
      mockPrismaService.student.findUnique.mockResolvedValue({ student_id: 1 });

      await expect(service.registerCourses(1, { courseIds: [] })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if registration window is closed or suspended', async () => {
      mockPrismaService.student.findUnique.mockResolvedValue({
        student_id: 1,
        academic_year: 2026,
        semester: 1,
      });
      mockPrismaService.registrationPeriod.findFirst.mockResolvedValue(null);

      await expect(service.registerCourses(1, { courseIds: [10] })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if any selected course does not exist', async () => {
      mockPrismaService.student.findUnique.mockResolvedValue({
        student_id: 1,
        academic_year: 2026,
        semester: 1,
      });
      mockPrismaService.registrationPeriod.findFirst.mockResolvedValue({
        period_id: 5,
        status: 'OPEN',
      });
      mockPrismaService.course.findMany.mockResolvedValue([{ course_id: 10, credit_value: 3 }]); // Only returns 1 course instead of 2

      await expect(service.registerCourses(1, { courseIds: [10, 11] })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if course does not match student semester or department', async () => {
      mockPrismaService.student.findUnique.mockResolvedValue({
        student_id: 1,
        department_id: 2, // Dept 2
        academic_year: 2026,
        semester: 1,
      });
      mockPrismaService.registrationPeriod.findFirst.mockResolvedValue({
        period_id: 5,
        status: 'OPEN',
      });
      mockPrismaService.course.findMany.mockResolvedValue([
        {
          course_id: 10,
          course_code: 'CS-101',
          department_id: 3, // Different Department
          semester: 1,
          academic_year: 2026,
          credit_value: 3,
        },
      ]);

      await expect(service.registerCourses(1, { courseIds: [10] })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if credits limit of 22.0 is exceeded', async () => {
      mockPrismaService.student.findUnique.mockResolvedValue({
        student_id: 1,
        department_id: 2,
        academic_year: 2026,
        semester: 1,
      });
      mockPrismaService.registrationPeriod.findFirst.mockResolvedValue({
        period_id: 5,
        status: 'OPEN',
      });

      // Student already registered for 20 credits
      mockPrismaService.courseRegistration.findMany.mockResolvedValue([
        { course: { credit_value: 20 } },
      ]);

      // Student tries to register for another 3 credit course
      mockPrismaService.course.findMany.mockResolvedValue([
        {
          course_id: 10,
          department_id: 2,
          semester: 1,
          academic_year: 2026,
          credit_value: 3,
        },
      ]);

      await expect(service.registerCourses(1, { courseIds: [10] })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should register for course successfully and log audit', async () => {
      mockPrismaService.student.findUnique.mockResolvedValue({
        student_id: 1,
        department_id: 2,
        academic_year: 2026,
        semester: 1,
      });
      mockPrismaService.registrationPeriod.findFirst.mockResolvedValue({
        period_id: 5,
        status: 'OPEN',
      });
      mockPrismaService.courseRegistration.findMany.mockResolvedValue([]);
      mockPrismaService.course.findMany.mockResolvedValue([
        {
          course_id: 10,
          course_code: 'CS-101',
          department_id: 2,
          semester: 1,
          academic_year: 2026,
          credit_value: 3,
        },
      ]);
      mockPrismaService.courseRegistration.findUnique.mockResolvedValue(null);
      mockPrismaService.courseRegistration.create.mockResolvedValue({
        registration_id: 99,
        student_id: 1,
        course_id: 10,
      });

      const result = await service.registerCourses(1, { courseIds: [10] });

      expect(result).toHaveLength(1);
      expect(result[0].registration_id).toBe(99);
      expect(prisma.courseRegistration.create).toHaveBeenCalled();
      expect(audit.logAction).toHaveBeenCalledWith(
        1,
        'REGISTRATION_ADD',
        'course_registrations',
        '99',
        null,
        expect.any(Object),
      );
    });
  });

  describe('dropCourse', () => {
    it('should throw NotFoundException if registration record does not exist', async () => {
      mockPrismaService.student.findUnique.mockResolvedValue({ student_id: 1 });
      mockPrismaService.courseRegistration.findUnique.mockResolvedValue(null);

      await expect(service.dropCourse(1, 99)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if student does not own registration', async () => {
      mockPrismaService.student.findUnique.mockResolvedValue({ student_id: 1 });
      mockPrismaService.courseRegistration.findUnique.mockResolvedValue({
        registration_id: 99,
        student_id: 2, // Different student
      });

      await expect(service.dropCourse(1, 99)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if window is closed', async () => {
      mockPrismaService.student.findUnique.mockResolvedValue({
        student_id: 1,
        academic_year: 2026,
        semester: 1,
      });
      mockPrismaService.courseRegistration.findUnique.mockResolvedValue({
        registration_id: 99,
        student_id: 1,
      });
      mockPrismaService.registrationPeriod.findFirst.mockResolvedValue(null); // Closed

      await expect(service.dropCourse(1, 99)).rejects.toThrow(BadRequestException);
    });

    it('should drop course successfully and log audit', async () => {
      mockPrismaService.student.findUnique.mockResolvedValue({
        student_id: 1,
        academic_year: 2026,
        semester: 1,
      });
      const mockReg = {
        registration_id: 99,
        student_id: 1,
        course_id: 10,
      };
      mockPrismaService.courseRegistration.findUnique.mockResolvedValue(mockReg);
      mockPrismaService.registrationPeriod.findFirst.mockResolvedValue({
        period_id: 5,
        status: 'OPEN',
      });
      mockPrismaService.courseRegistration.delete.mockResolvedValue(mockReg);

      const result = await service.dropCourse(1, 99);

      expect(result.registration_id).toBe(99);
      expect(prisma.courseRegistration.delete).toHaveBeenCalledWith({
        where: { registration_id: 99 },
      });
      expect(audit.logAction).toHaveBeenCalledWith(
        1,
        'REGISTRATION_DROP',
        'course_registrations',
        '99',
        expect.any(Object),
        null,
      );
    });
  });
});
