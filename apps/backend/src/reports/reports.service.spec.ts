import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ReportsService', () => {
  let service: ReportsService;

  const mockPrismaService = {
    student: {
      count: jest.fn(),
    },
    course: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    lecturer: {
      count: jest.fn(),
    },
    studentSemesterGpa: {
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    department: {
      findMany: jest.fn(),
    },
    studentCourseGrade: {
      groupBy: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrismaService)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getSummary', () => {
    it('should compile correct count metrics and average CGPA', async () => {
      mockPrismaService.student.count.mockResolvedValue(120);
      mockPrismaService.course.count.mockResolvedValue(15);
      mockPrismaService.lecturer.count.mockResolvedValue(8);
      mockPrismaService.studentSemesterGpa.aggregate.mockResolvedValue({
        _avg: { cumulative_gpa: 3.25 },
      });

      const res = await service.getSummary();

      expect(res.totalStudents).toBe(120);
      expect(res.totalCourses).toBe(15);
      expect(res.totalLecturers).toBe(8);
      expect(res.averageCgpa).toBe(3.25);
    });

    it('should return 0.0 for average CGPA if no published GPAs exist', async () => {
      mockPrismaService.student.count.mockResolvedValue(0);
      mockPrismaService.course.count.mockResolvedValue(0);
      mockPrismaService.lecturer.count.mockResolvedValue(0);
      mockPrismaService.studentSemesterGpa.aggregate.mockResolvedValue({
        _avg: { cumulative_gpa: null },
      });

      const res = await service.getSummary();
      expect(res.averageCgpa).toBe(0.0);
    });
  });

  describe('getDepartmentPerformance', () => {
    it('should return average CGPAs grouped by departments code', async () => {
      mockPrismaService.department.findMany.mockResolvedValue([
        { department_id: 1, department_code: 'CSE', department_name: 'Computer Science' },
        { department_id: 2, department_code: 'EEE', department_name: 'Electrical Eng' },
      ]);
      mockPrismaService.studentSemesterGpa.aggregate
        .mockResolvedValueOnce({ _avg: { cumulative_gpa: 3.4 } })
        .mockResolvedValueOnce({ _avg: { cumulative_gpa: 2.9 } });

      const res = await service.getDepartmentPerformance();

      expect(res).toHaveLength(2);
      expect(res[0]).toEqual({
        departmentCode: 'CSE',
        departmentName: 'Computer Science',
        averageCgpa: 3.4,
      });
      expect(res[1]).toEqual({
        departmentCode: 'EEE',
        departmentName: 'Electrical Eng',
        averageCgpa: 2.9,
      });
    });
  });

  describe('getCourseGradesDistribution', () => {
    it('should group counts and sort them in standard grading order', async () => {
      mockPrismaService.studentCourseGrade.groupBy.mockResolvedValue([
        { grade: 'B', _count: { grade_id: 3 } },
        { grade: 'A', _count: { grade_id: 5 } },
        { grade: 'F', _count: { grade_id: 1 } },
      ]);

      const res = await service.getCourseGradesDistribution(10);

      expect(res).toHaveLength(3);
      expect(res[0]).toEqual({ grade: 'A', count: 5 }); // A comes before B
      expect(res[1]).toEqual({ grade: 'B', count: 3 }); // B comes before F
      expect(res[2]).toEqual({ grade: 'F', count: 1 });
    });
  });

  describe('getGpaTrends', () => {
    it('should map historical semester averages correctly', async () => {
      mockPrismaService.studentSemesterGpa.groupBy.mockResolvedValue([
        { academic_year: 2025, semester: 1, _avg: { semester_gpa: 3.1 } },
        { academic_year: 2025, semester: 2, _avg: { semester_gpa: 3.3 } },
      ]);

      const res = await service.getGpaTrends();

      expect(res).toHaveLength(2);
      expect(res[0]).toEqual({
        semesterLabel: 'AY 2025 Sem 1',
        averageGpa: 3.1,
      });
      expect(res[1]).toEqual({
        semesterLabel: 'AY 2025 Sem 2',
        averageGpa: 3.3,
      });
    });
  });

  describe('getCoursesList', () => {
    it('should fetch course details', async () => {
      mockPrismaService.course.findMany.mockResolvedValue([
        { course_id: 1, course_code: 'CSE101', course_name: 'Intro to CS' },
      ]);

      const res = await service.getCoursesList();
      expect(res).toHaveLength(1);
      expect(res[0].course_code).toBe('CSE101');
    });
  });
});
