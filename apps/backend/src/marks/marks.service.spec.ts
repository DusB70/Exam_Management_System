import { Test, TestingModule } from '@nestjs/testing';
import { MarksService } from './marks.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('MarksService', () => {
  let service: MarksService;
  let prisma: PrismaService;
  let audit: AuditService;

  const mockPrismaService = {
    lecturer: {
      findUnique: jest.fn(),
    },
    course: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    student: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    exam: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    examMark: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
      upsert: jest.fn(),
    },
    courseLecturer: {
      findUnique: jest.fn(),
    },
    courseRegistration: {
      findMany: jest.fn(),
    },
    studentCourseGrade: {
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
        MarksService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<MarksService>(MarksService);
    prisma = module.get<PrismaService>(PrismaService);
    audit = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('recordMarksBulk', () => {
    it('should throw NotFoundException if exam does not exist', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue(null);

      await expect(service.recordMarksBulk(1, { marks: [] }, 99, false)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if lecturer is not assigned to the course', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue({ exam_id: 1, course_id: 10 });
      mockPrismaService.lecturer.findUnique.mockResolvedValue({ lecturer_id: 2 });
      mockPrismaService.courseLecturer.findUnique.mockResolvedValue(null); // Not assigned

      await expect(
        service.recordMarksBulk(1, { marks: [{ studentId: 5, marksObtained: 20 }] }, 99, true),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if marks exceed exam max points', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue({
        exam_id: 1,
        course_id: 10,
        total_marks: 30, // Max marks is 30
      });
      mockPrismaService.lecturer.findUnique.mockResolvedValue({ lecturer_id: 2 });
      mockPrismaService.courseLecturer.findUnique.mockResolvedValue({
        lecturer_id: 2,
        course_id: 10,
      });
      mockPrismaService.examMark.findFirst.mockResolvedValue(null);

      // Student scored 35 out of 30
      await expect(
        service.recordMarksBulk(1, { marks: [{ studentId: 5, marksObtained: 35 }] }, 99, true),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if marksheet is locked', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue({
        exam_id: 1,
        course_id: 10,
        total_marks: 30,
      });
      mockPrismaService.lecturer.findUnique.mockResolvedValue({ lecturer_id: 2 });
      mockPrismaService.courseLecturer.findUnique.mockResolvedValue({
        lecturer_id: 2,
        course_id: 10,
      });

      // Marksheet already submitted
      mockPrismaService.examMark.findFirst.mockResolvedValue({ grading_status: 'SUBMITTED' });

      await expect(
        service.recordMarksBulk(1, { marks: [{ studentId: 5, marksObtained: 20 }] }, 99, true),
      ).rejects.toThrow(BadRequestException);
    });

    it('should record marks successfully and audit changes', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue({
        exam_id: 1,
        course_id: 10,
        total_marks: 30,
      });
      mockPrismaService.lecturer.findUnique.mockResolvedValue({ lecturer_id: 2 });
      mockPrismaService.courseLecturer.findUnique.mockResolvedValue({
        lecturer_id: 2,
        course_id: 10,
      });
      mockPrismaService.examMark.findFirst.mockResolvedValue(null);
      mockPrismaService.examMark.upsert.mockResolvedValue({
        mark_id: 15,
        student_id: 5,
        exam_id: 1,
        marks_obtained: 25,
      });

      const result = await service.recordMarksBulk(
        1,
        { marks: [{ studentId: 5, marksObtained: 25 }] },
        99,
        true,
      );

      expect(result).toHaveLength(1);
      expect(result[0].mark_id).toBe(15);
      expect(prisma.examMark.upsert).toHaveBeenCalled();
      expect(audit.logAction).toHaveBeenCalledWith(
        99,
        'MARK_RECORD',
        'exam_marks',
        '15',
        null,
        expect.any(Object),
      );
    });
  });

  describe('submitMarks', () => {
    it('should throw BadRequestException if no marks have been recorded', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue({ exam_id: 1, course_id: 10 });
      mockPrismaService.lecturer.findUnique.mockResolvedValue({ lecturer_id: 2 });
      mockPrismaService.courseLecturer.findUnique.mockResolvedValue({
        lecturer_id: 2,
        course_id: 10,
      });
      mockPrismaService.examMark.count.mockResolvedValue(0);

      await expect(service.submitMarks(1, 99, true)).rejects.toThrow(BadRequestException);
    });

    it('should successfully update status to SUBMITTED', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue({ exam_id: 1, course_id: 10 });
      mockPrismaService.lecturer.findUnique.mockResolvedValue({ lecturer_id: 2 });
      mockPrismaService.courseLecturer.findUnique.mockResolvedValue({
        lecturer_id: 2,
        course_id: 10,
      });
      mockPrismaService.examMark.count.mockResolvedValue(5);

      const result = await service.submitMarks(1, 99, true);

      expect(result).toBe(5);
      expect(prisma.examMark.updateMany).toHaveBeenCalledWith({
        where: { exam_id: 1 },
        data: { grading_status: 'SUBMITTED' },
      });
      expect(audit.logAction).toHaveBeenCalledWith(
        99,
        'MARKS_SUBMIT',
        'exam_marks',
        '1',
        null,
        expect.any(Object),
      );
    });
  });

  describe('approveMarks & Grading Compilation', () => {
    it('should throw BadRequestException if marksheet is not in SUBMITTED state', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue({ exam_id: 1, course_id: 10 });
      mockPrismaService.examMark.count.mockResolvedValue(0); // No submitted marks

      await expect(service.approveMarks(1, 99)).rejects.toThrow(BadRequestException);
    });

    it('should approve marksheet and compile grades if all exams approved', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue({ exam_id: 1, course_id: 10 });
      mockPrismaService.examMark.count.mockImplementation((params) => {
        if (params.where?.grading_status === 'SUBMITTED') {
          return 5; // Submitted count for approval check
        }
        if (params.where?.NOT?.grading_status === 'APPROVED') {
          return 0; // Compile check: all are approved
        }
        return 5; // General count
      });

      // Course offers two exams: 1 CA (max 40) and 1 FINAL (max 60)
      const mockCAExam = { exam_id: 1, course_id: 10, exam_type: 'CA', total_marks: 40 };
      const mockFinalExam = { exam_id: 2, course_id: 10, exam_type: 'FINAL', total_marks: 60 };
      mockPrismaService.exam.findMany.mockResolvedValue([mockCAExam, mockFinalExam]);

      // 1 registered student
      mockPrismaService.courseRegistration.findMany.mockResolvedValue([
        { student_id: 5, course_id: 10 },
      ]);

      // Mock student scored: 32/40 on CA, 48/60 on Final Exam
      mockPrismaService.examMark.findUnique.mockImplementation((params) => {
        if (params.where?.student_id_exam_id?.exam_id === 1) {
          return { student_id: 5, exam_id: 1, marks_obtained: 32 };
        }
        if (params.where?.student_id_exam_id?.exam_id === 2) {
          return { student_id: 5, exam_id: 2, marks_obtained: 48 };
        }
        return null;
      });

      const result = await service.approveMarks(1, 99);

      expect(result.success).toBe(true);
      expect(prisma.examMark.updateMany).toHaveBeenCalledWith({
        where: { exam_id: 1 },
        data: { grading_status: 'APPROVED' },
      });
      // Grade computation check: 32/40 = 80%, 48/60 = 80%. Total Weighted = 80% (B+ or A- depending on mapping)
      // 80% maps to A- (GP 3.7) in our mapPercentageToGrade
      expect(prisma.studentCourseGrade.upsert).toHaveBeenCalledWith({
        where: {
          student_id_course_id: {
            student_id: 5,
            course_id: 10,
          },
        },
        update: {
          continuous_assessment_marks: 32,
          final_exam_marks: 48,
          total_marks: 80,
          grade: 'A-',
          grade_point: 3.7,
        },
        create: {
          student_id: 5,
          course_id: 10,
          continuous_assessment_marks: 32,
          final_exam_marks: 48,
          total_marks: 80,
          grade: 'A-',
          grade_point: 3.7,
        },
      });
    });
  });
});
