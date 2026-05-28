import { Test, TestingModule } from '@nestjs/testing';
import { ResultsService } from './results.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BadRequestException } from '@nestjs/common';
import { NotificationsQueueService } from '../notifications/notifications.queue.service';

describe('ResultsService', () => {
  let service: ResultsService;
  let prisma: PrismaService;

  const mockNotificationsQueueService = {
    addResultsPublishedJob: jest.fn().mockResolvedValue(true),
    addRegistrationOpenedJob: jest.fn().mockResolvedValue(true),
  };

  const mockPrismaService = {
    student: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    studentCourseGrade: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
      upsert: jest.fn(),
    },
    studentSemesterGpa: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    department: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
  };

  const mockAuditService = {
    logAction: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResultsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: NotificationsQueueService, useValue: mockNotificationsQueueService },
      ],
    }).compile();

    service = module.get<ResultsService>(ResultsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('publishResults', () => {
    it('should throw BadRequestException if no students are registered in the semester', async () => {
      mockPrismaService.student.findMany.mockResolvedValue([]);

      await expect(service.publishResults(2026, '1.1', 99)).rejects.toThrow(BadRequestException);
    });

    it('should calculate GPAs and CGPAs and lock course grades', async () => {
      // 1 registered student
      mockPrismaService.student.findMany.mockResolvedValue([
        { student_id: 5, user_id: 10, academic_year: 2026, semester: '1.1' },
      ]);

      // Student course grades: CS-101 (3 credits, GP 4.0 - A), CS-102 (4 credits, GP 3.0 - B)
      const mockGrades = [
        {
          grade_id: 1,
          student_id: 5,
          grade_point: 4.0,
          course: { credit_value: 3, academic_year: 2026, semester: '1.1' },
        },
        {
          grade_id: 2,
          student_id: 5,
          grade_point: 3.0,
          course: { credit_value: 4, academic_year: 2026, semester: '1.1' },
        },
      ];
      mockPrismaService.studentCourseGrade.findMany.mockResolvedValue(mockGrades);
      mockPrismaService.studentSemesterGpa.upsert.mockResolvedValue({
        gpa_id: 12,
      });

      const result = await service.publishResults(2026, '1.1', 99);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);

      // SGPA check: (4.0 * 3 + 3.0 * 4) / 7 = (12 + 12) / 7 = 24 / 7 = 3.428...
      expect(prisma.studentSemesterGpa.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            semester_gpa: expect.closeTo(3.43, 2),
            cumulative_gpa: expect.closeTo(3.43, 2),
            total_credits: 7,
            is_published: true,
            is_locked: true,
          }),
        }),
      );

      // Verify course grades are updated to published and locked
      expect(prisma.studentCourseGrade.updateMany).toHaveBeenCalledWith({
        where: {
          student_id: 5,
          course: {
            academic_year: 2026,
            semester: '1.1',
          },
        },
        data: {
          is_published: true,
          is_locked: true,
        },
      });
    });
  });

  describe('generateReportCardExcelBuffer', () => {
    it('should generate an Excel sheet buffer with student grades and summaries', async () => {
      // Mock student report card query
      mockPrismaService.student.findUnique.mockResolvedValue({
        student_id: 5,
        user_id: 10,
        registration_number: 'REG001',
        department_id: 1,
        academic_year: 2026,
        semester: '1.1',
      });

      mockPrismaService.studentSemesterGpa.findMany.mockResolvedValue([
        {
          gpa_id: 1,
          student_id: 5,
          academic_year: 2026,
          semester: '1.1',
          semester_gpa: 3.5,
          cumulative_gpa: 3.5,
          total_credits: 6,
          is_published: true,
        },
      ]);

      mockPrismaService.studentCourseGrade.findMany.mockResolvedValue([
        {
          grade_id: 1,
          student_id: 5,
          course_id: 1,
          total_marks: 80,
          grade: 'A',
          grade_point: 4.0,
          is_published: true,
          course: {
            course_code: 'CS101',
            course_name: 'Intro to Programming',
            credit_value: 3,
            academic_year: 2026,
            semester: '1.1',
          },
        },
      ]);

      // Mock user and department lookup
      const mockDepartment = { department_id: 1, department_name: 'Computer Science' };
      const mockUser = { user_id: 10, full_name: 'Jane Doe', email: 'jane@example.com' };

      mockPrismaService.department.findUnique.mockResolvedValue(mockDepartment);
      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const buffer = await service.generateReportCardExcelBuffer(10);
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer.length).toBeGreaterThan(0);
    });
  });
});
