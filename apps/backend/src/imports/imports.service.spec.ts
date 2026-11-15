import { Test, TestingModule } from '@nestjs/testing';
import { ImportsService } from './imports.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { XlsxParserService } from './xlsx-parser.service';
import { BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';

describe('ImportsService', () => {
  let service: ImportsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    department: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
    },
    student: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
    },
    exam: {
      findUnique: jest.fn(),
    },
    examMark: {
      count: jest.fn(),
      upsert: jest.fn(),
    },
    course: {
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
    },
    degree: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
    specialization: {
      findFirst: jest.fn(),
    },
    lecturer: {
      findFirst: jest.fn(),
    },
    courseLecturer: {
      findUnique: jest.fn(),
      create: jest.fn(),
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

  describe('importCourses', () => {
    it('should throw BadRequestException if parsed rows are empty', async () => {
      mockXlsxParserService.parseBuffer.mockReturnValue([]);

      await expect(service.importCourses(Buffer.from(''), 99)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if required field is missing', async () => {
      mockXlsxParserService.parseBuffer.mockReturnValue([
        {
          courseCode: 'CS101',
          courseName: '', // Missing name
          creditValue: 3,
          semester: '1.1',
        },
      ]);

      await expect(service.importCourses(Buffer.from(''), 99)).rejects.toThrow(BadRequestException);
    });

    it('should import courses successfully', async () => {
      mockXlsxParserService.parseBuffer.mockReturnValue([
        {
          courseCode: 'CS101',
          courseName: 'Intro to CS',
          creditValue: 3,
          semester: '1.1',
          department: 'ICT',
          degree: 'BICT',
          status: 'COMPULSORY',
        },
      ]);
      mockPrismaService.course.findUnique.mockResolvedValue(null);
      mockPrismaService.degree.findFirst.mockResolvedValue({ degree_id: 1, department_id: 1 });
      (mockPrismaService.department as any).findFirst = jest
        .fn()
        .mockResolvedValue({ department_id: 1 });
      mockPrismaService.course.create.mockResolvedValue({
        course_id: 101,
        course_code: 'CS101',
        course_name: 'Intro to CS',
      });

      const result = await service.importCourses(Buffer.from(''), 99);

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
      expect(mockPrismaService.course.create).toHaveBeenCalled();
    });
  });

  describe('validateCoursesImport', () => {
    const makeXlsxBuffer = (rows: any[]) => {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    };

    it('should detect missing headers, invalid credits/semester, and existing course codes', async () => {
      mockPrismaService.course.findMany.mockResolvedValue([{ course_code: 'ICT1101' }]);
      mockPrismaService.degree.findMany.mockResolvedValue([
        { degree_id: 1, degree_code: 'BICT', degree_name: 'BICT', department_id: 1 },
      ]);
      mockPrismaService.department.findMany.mockResolvedValue([
        { department_id: 1, department_code: 'ICT', department_name: 'ICT' },
      ]);

      const buf = makeXlsxBuffer([
        {
          courseCode: 'ICT1101',
          courseName: 'Intro',
          creditValue: 3,
          semester: '1.1',
          department: 'ICT',
          degree: 'BICT',
        },
        {
          courseCode: 'ICT1102',
          courseName: '',
          creditValue: 15,
          semester: '9.9',
          department: 'UNKNOWN_DEPT',
          degree: 'UNKNOWN_DEG',
        },
      ]);

      const res = await service.validateCoursesImport(buf);

      expect(res.hasHeaderErrors).toBe(false);
      expect(res.hasBlockingErrors).toBe(true);
      expect(res.totalRows).toBe(2);
      expect(res.validRowsCount).toBe(0);
      expect(res.invalidRowsCount).toBe(2);
      expect(res.rows[0].errors).toContain(
        'Course code "ICT1101" is already in use in the system.',
      );
      expect(res.rows[1].errors.length).toBeGreaterThanOrEqual(4);
    });

    it('should pass validation for clean course rows', async () => {
      mockPrismaService.course.findMany.mockResolvedValue([]);
      mockPrismaService.degree.findMany.mockResolvedValue([
        { degree_id: 1, degree_code: 'BICT', degree_name: 'BICT', department_id: 1 },
      ]);
      mockPrismaService.department.findMany.mockResolvedValue([
        { department_id: 1, department_code: 'ICT', department_name: 'ICT' },
      ]);

      const buf = makeXlsxBuffer([
        {
          courseCode: 'ICT2101',
          courseName: 'Algorithms',
          creditValue: 3,
          semester: '2.1',
          department: 'ICT',
          degree: 'BICT',
          status: 'COMPULSORY',
        },
      ]);

      const res = await service.validateCoursesImport(buf);

      expect(res.hasHeaderErrors).toBe(false);
      expect(res.hasBlockingErrors).toBe(false);
      expect(res.validRowsCount).toBe(1);
      expect(res.invalidRowsCount).toBe(0);
    });
  });

  describe('validateStudentsImport', () => {
    const makeXlsxBuffer = (rows: any[]) => {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    };

    it('should detect duplicate email/NIC/regNo/indexNo and missing degree', async () => {
      mockPrismaService.degree.findMany.mockResolvedValue([
        { degree_id: 1, degree_code: 'BICT', degree_name: 'BICT' },
      ]);
      mockPrismaService.user.findMany.mockResolvedValue([
        { email: 'dup@std.ems.edu', nic_no: '200115603421' },
      ]);
      mockPrismaService.student.findMany.mockResolvedValue([
        { registration_number: 'UWU/BICT/21/101', index_number: 'TG/2021/101' },
      ]);

      const buf = makeXlsxBuffer([
        {
          fullName: 'Alice',
          nameWithInitials: 'A. Perera',
          email: 'dup@std.ems.edu',
          nicNo: '200115603421',
          dateOfBirth: '2001-05-18',
          phoneNumber: '+94712345678',
          address: 'Kandy',
          indexNumber: 'TG/2021/101',
          registrationNumber: 'UWU/BICT/21/101',
          'enrolled degree': 'UNKNOWN',
        },
      ]);

      const res = await service.validateStudentsImport(buf);

      expect(res.hasHeaderErrors).toBe(false);
      expect(res.hasBlockingErrors).toBe(true);
      expect(res.invalidRowsCount).toBe(1);
      expect(res.rows[0].errors).toContain('Email "dup@std.ems.edu" is already in use.');
      expect(res.rows[0].errors).toContain('NIC "200115603421" is already in use.');
      expect(res.rows[0].errors).toContain(
        'Registration number "UWU/BICT/21/101" is already in use.',
      );
      expect(res.rows[0].errors).toContain('Index number "TG/2021/101" is already in use.');
      expect(res.rows[0].errors).toContain('Enrolled degree "UNKNOWN" not found in system.');
    });

    it('should pass validation for clean student rows', async () => {
      mockPrismaService.degree.findMany.mockResolvedValue([
        { degree_id: 1, degree_code: 'BICT', degree_name: 'BICT' },
      ]);
      mockPrismaService.user.findMany.mockResolvedValue([]);
      mockPrismaService.student.findMany.mockResolvedValue([]);

      const buf = makeXlsxBuffer([
        {
          fullName: 'Kavindu Perera',
          nameWithInitials: 'K. Perera',
          email: 'kavindu@std.ems.edu',
          nicNo: '200115603499',
          dateOfBirth: '2001-05-18',
          phoneNumber: '+94712345678',
          address: 'Kandy',
          indexNumber: 'TG/2021/199',
          registrationNumber: 'UWU/BICT/21/199',
          'enrollment year (e.g. 21/22)': '21/22',
          'enrolled degree': 'BICT',
        },
      ]);

      const res = await service.validateStudentsImport(buf);

      expect(res.hasHeaderErrors).toBe(false);
      expect(res.hasBlockingErrors).toBe(false);
      expect(res.validRowsCount).toBe(1);
      expect(res.invalidRowsCount).toBe(0);
    });
  });
});
