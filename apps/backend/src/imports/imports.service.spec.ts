import { Test, TestingModule } from '@nestjs/testing';
import { ImportsService } from './imports.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { XlsxParserService } from './xlsx-parser.service';
import { BadRequestException } from '@nestjs/common';

describe('ImportsService', () => {
  let service: ImportsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    department: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    student: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    exam: {
      findUnique: jest.fn(),
    },
    examMark: {
      count: jest.fn(),
      upsert: jest.fn(),
    },
    courseLecturer: {
      findUnique: jest.fn(),
    },
    courseRegistration: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
  };

  const mockAuditService = {
    logAction: jest.fn().mockResolvedValue(true),
  };

  const mockXlsxParserService = {
    parseBuffer: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
        { provide: XlsxParserService, useValue: mockXlsxParserService },
      ],
    }).compile();

    service = module.get<ImportsService>(ImportsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('importStudents', () => {
    it('should throw BadRequestException if parsed rows are empty', async () => {
      mockXlsxParserService.parseBuffer.mockReturnValue([]);

      await expect(service.importStudents(Buffer.from(''), 99)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if department code is not found', async () => {
      mockXlsxParserService.parseBuffer.mockReturnValue([
        {
          fullName: 'Alice',
          email: 'alice@example.com',
          registrationNumber: 'REG001',
          departmentCode: 'INVALID_DEPT',
          academicYear: 2026,
          semester: 1,
        },
      ]);
      mockPrismaService.department.findUnique.mockResolvedValue(null); // Not found

      await expect(service.importStudents(Buffer.from(''), 99)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should import students successfully and write transactional audit logs', async () => {
      mockXlsxParserService.parseBuffer.mockReturnValue([
        {
          fullName: 'Alice',
          email: 'alice@example.com',
          registrationNumber: 'REG001',
          departmentCode: 'CS',
          academicYear: 2026,
          semester: 1,
        },
      ]);
      mockPrismaService.department.findUnique.mockResolvedValue({ department_id: 2 });
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.student.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue({ user_id: 10 });
      mockPrismaService.student.create.mockResolvedValue({ student_id: 5 });

      const result = await service.importStudents(Buffer.from(''), 99);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
      expect(prisma.user.create).toHaveBeenCalled();
      expect(prisma.student.create).toHaveBeenCalled();
    });
  });

  describe('importMarks', () => {
    it('should throw BadRequestException if marks sheet has score exceeding max total marks', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue({
        exam_id: 1,
        course_id: 10,
        total_marks: 30,
      });
      mockPrismaService.examMark.count.mockResolvedValue(0);
      mockXlsxParserService.parseBuffer.mockReturnValue([
        {
          registrationNumber: 'REG001',
          marksObtained: 35, // 35 exceeds 30
        },
      ]);

      await expect(service.importMarks(1, Buffer.from(''), 99, false)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if student is not registered for the course', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue({
        exam_id: 1,
        course_id: 10,
        total_marks: 30,
      });
      mockPrismaService.examMark.count.mockResolvedValue(0);
      mockXlsxParserService.parseBuffer.mockReturnValue([
        {
          registrationNumber: 'REG001',
          marksObtained: 25,
        },
      ]);
      mockPrismaService.student.findUnique.mockResolvedValue({ student_id: 5 });
      mockPrismaService.courseRegistration.findUnique.mockResolvedValue(null); // Not registered

      await expect(service.importMarks(1, Buffer.from(''), 99, false)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
