import { Test, TestingModule } from '@nestjs/testing';
import { ResultsService } from './results.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BadRequestException } from '@nestjs/common';

describe('ResultsService', () => {
  let service: ResultsService;
  let prisma: PrismaService;

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

      await expect(service.publishResults(2026, 1, 99)).rejects.toThrow(BadRequestException);
    });

    it('should calculate GPAs and CGPAs and lock course grades', async () => {
      // 1 registered student
      mockPrismaService.student.findMany.mockResolvedValue([
        { student_id: 5, user_id: 10, academic_year: 2026, semester: 1 },
      ]);

      // Student course grades: CS-101 (3 credits, GP 4.0 - A), CS-102 (4 credits, GP 3.0 - B)
      const mockGrades = [
        {
          grade_id: 1,
          student_id: 5,
          grade_point: 4.0,
          course: { credit_value: 3, academic_year: 2026, semester: 1 },
        },
        {
          grade_id: 2,
          student_id: 5,
          grade_point: 3.0,
          course: { credit_value: 4, academic_year: 2026, semester: 1 },
        },
      ];
      mockPrismaService.studentCourseGrade.findMany.mockResolvedValue(mockGrades);
      mockPrismaService.studentSemesterGpa.upsert.mockResolvedValue({
        gpa_id: 12,
      });

      const result = await service.publishResults(2026, 1, 99);

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
            semester: 1,
          },
        },
        data: {
          is_published: true,
          is_locked: true,
        },
      });
    });
  });
});
