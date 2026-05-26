import { Test, TestingModule } from '@nestjs/testing';
import { ExamsService } from './exams.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('ExamsService', () => {
  let service: ExamsService;
  let prisma: PrismaService;
  let audit: AuditService;

  const mockPrismaService = {
    exam: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    examHall: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    examSchedule: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    course: {
      findUnique: jest.fn(),
    },
    courseRegistration: {
      count: jest.fn(),
    },
  };

  const mockAuditService = {
    logAction: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExamsService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<ExamsService>(ExamsService);
    prisma = module.get<PrismaService>(PrismaService);
    audit = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAllExams', () => {
    it('should return all exams', async () => {
      const mockExams = [{ exam_id: 1, exam_title: 'Exam 1' }];
      mockPrismaService.exam.findMany.mockResolvedValue(mockExams);

      const result = await service.findAllExams();
      expect(result).toEqual(mockExams);
      expect(prisma.exam.findMany).toHaveBeenCalled();
    });
  });

  describe('createExam', () => {
    const dto = {
      courseId: 10,
      examType: 'FINAL',
      examTitle: 'Final Exam',
      totalMarks: 100,
      examDate: '2026-06-01T00:00:00.000Z',
      startTime: '09:00:00',
      endTime: '12:00:00',
    };

    it('should throw NotFoundException if course does not exist', async () => {
      mockPrismaService.course.findUnique.mockResolvedValue(null);

      await expect(service.createExam(dto, 1)).rejects.toThrow(NotFoundException);
    });

    it('should create an exam and log action', async () => {
      mockPrismaService.course.findUnique.mockResolvedValue({ course_id: 10 });
      const mockExam = { exam_id: 1, ...dto };
      mockPrismaService.exam.create.mockResolvedValue(mockExam);

      const result = await service.createExam(dto, 1);
      expect(result).toEqual(mockExam);
      expect(prisma.exam.create).toHaveBeenCalled();
      expect(audit.logAction).toHaveBeenCalledWith(1, 'EXAM_CREATE', 'exams', '1', null, mockExam);
    });
  });

  describe('updateExam', () => {
    const dto = {
      examTitle: 'Updated Title',
    };

    it('should throw NotFoundException if exam does not exist', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue(null);

      await expect(service.updateExam(1, dto, 1)).rejects.toThrow(NotFoundException);
    });

    it('should update the exam and log action', async () => {
      const existing = { exam_id: 1, exam_title: 'Old Title' };
      const updated = { exam_id: 1, exam_title: 'Updated Title' };
      mockPrismaService.exam.findUnique.mockResolvedValue(existing);
      mockPrismaService.exam.update.mockResolvedValue(updated);

      const result = await service.updateExam(1, dto, 1);
      expect(result).toEqual(updated);
      expect(prisma.exam.update).toHaveBeenCalled();
      expect(audit.logAction).toHaveBeenCalledWith(
        1,
        'EXAM_UPDATE',
        'exams',
        '1',
        existing,
        updated,
      );
    });
  });

  describe('deleteExam', () => {
    it('should throw NotFoundException if exam does not exist', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue(null);

      await expect(service.deleteExam(1, 1)).rejects.toThrow(NotFoundException);
    });

    it('should delete the exam and log action', async () => {
      const existing = { exam_id: 1, exam_title: 'Test Exam' };
      mockPrismaService.exam.findUnique.mockResolvedValue(existing);
      mockPrismaService.exam.delete.mockResolvedValue(existing);

      const result = await service.deleteExam(1, 1);
      expect(result).toEqual(existing);
      expect(prisma.exam.delete).toHaveBeenCalled();
      expect(audit.logAction).toHaveBeenCalledWith(1, 'EXAM_DELETE', 'exams', '1', existing, null);
    });
  });

  describe('findAllHalls', () => {
    it('should return all halls', async () => {
      const mockHalls = [{ hall_id: 1, hall_name: 'LH 01', capacity: 100 }];
      mockPrismaService.examHall.findMany.mockResolvedValue(mockHalls);

      const result = await service.findAllHalls();
      expect(result).toEqual(mockHalls);
    });
  });

  describe('createHall', () => {
    const dto = { hallName: 'LH 01', capacity: 100 };

    it('should throw BadRequestException if hall name already exists', async () => {
      mockPrismaService.examHall.findUnique.mockResolvedValue({ hall_id: 1, ...dto });

      await expect(service.createHall(dto, 1)).rejects.toThrow(BadRequestException);
    });

    it('should create hall successfully and log action', async () => {
      mockPrismaService.examHall.findUnique.mockResolvedValue(null);
      const mockHall = { hall_id: 2, ...dto };
      mockPrismaService.examHall.create.mockResolvedValue(mockHall);

      const result = await service.createHall(dto, 1);
      expect(result).toEqual(mockHall);
      expect(audit.logAction).toHaveBeenCalledWith(
        1,
        'EXAM_HALL_CREATE',
        'exam_halls',
        '2',
        null,
        mockHall,
      );
    });
  });

  describe('updateHall', () => {
    const dto = { hallName: 'New LH Name', capacity: 120 };

    it('should throw NotFoundException if hall does not exist', async () => {
      mockPrismaService.examHall.findUnique.mockResolvedValue(null);

      await expect(service.updateHall(1, dto, 1)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if updating to an already existing hall name', async () => {
      const existing = { hall_id: 1, hall_name: 'Old Name', capacity: 100 };
      mockPrismaService.examHall.findUnique
        .mockResolvedValueOnce(existing) // For existing check
        .mockResolvedValueOnce({ hall_id: 2, hall_name: 'New LH Name' }); // For duplicate check

      await expect(service.updateHall(1, dto, 1)).rejects.toThrow(BadRequestException);
    });

    it('should update the hall successfully and log action', async () => {
      const existing = { hall_id: 1, hall_name: 'Old Name', capacity: 100 };
      const updated = { hall_id: 1, hall_name: 'New LH Name', capacity: 120 };
      mockPrismaService.examHall.findUnique
        .mockResolvedValueOnce(existing) // For existing check
        .mockResolvedValueOnce(null); // For duplicate check
      mockPrismaService.examHall.update.mockResolvedValue(updated);

      const result = await service.updateHall(1, dto, 1);
      expect(result).toEqual(updated);
      expect(audit.logAction).toHaveBeenCalledWith(
        1,
        'EXAM_HALL_UPDATE',
        'exam_halls',
        '1',
        existing,
        updated,
      );
    });
  });

  describe('deleteHall', () => {
    it('should throw NotFoundException if hall does not exist', async () => {
      mockPrismaService.examHall.findUnique.mockResolvedValue(null);

      await expect(service.deleteHall(1, 1)).rejects.toThrow(NotFoundException);
    });

    it('should delete the hall successfully and log action', async () => {
      const existing = { hall_id: 1, hall_name: 'LH 01', capacity: 100 };
      mockPrismaService.examHall.findUnique.mockResolvedValue(existing);
      mockPrismaService.examHall.delete.mockResolvedValue(existing);

      const result = await service.deleteHall(1, 1);
      expect(result).toEqual(existing);
      expect(audit.logAction).toHaveBeenCalledWith(
        1,
        'EXAM_HALL_DELETE',
        'exam_halls',
        '1',
        existing,
        null,
      );
    });
  });

  describe('findAllSchedules', () => {
    it('should return all schedules', async () => {
      const mockSchedules = [{ schedule_id: 1, exam_id: 1, hall_id: 1 }];
      mockPrismaService.examSchedule.findMany.mockResolvedValue(mockSchedules);

      const result = await service.findAllSchedules();
      expect(result).toEqual(mockSchedules);
    });
  });

  describe('createSchedule', () => {
    const dto = { examId: 10, hallId: 5 };
    const mockExam = {
      exam_id: 10,
      course_id: 100,
      exam_date: new Date('2026-06-01T00:00:00.000Z'),
      start_time: new Date('1970-01-01T09:00:00.000Z'),
      end_time: new Date('1970-01-01T12:00:00.000Z'),
    };
    const mockHall = {
      hall_id: 5,
      hall_name: 'LH 05',
      capacity: 50,
    };

    it('should throw NotFoundException if exam does not exist', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue(null);

      await expect(service.createSchedule(dto, 1)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if hall does not exist', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue(mockExam);
      mockPrismaService.examHall.findUnique.mockResolvedValue(null);

      await expect(service.createSchedule(dto, 1)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if exam is already scheduled', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue(mockExam);
      mockPrismaService.examHall.findUnique.mockResolvedValue(mockHall);
      mockPrismaService.examSchedule.findFirst.mockResolvedValueOnce({ schedule_id: 1 }); // Already scheduled

      await expect(service.createSchedule(dto, 1)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if student registrations count exceeds hall capacity', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue(mockExam);
      mockPrismaService.examHall.findUnique.mockResolvedValue(mockHall);
      mockPrismaService.examSchedule.findFirst.mockResolvedValueOnce(null); // Not already scheduled
      mockPrismaService.courseRegistration.count.mockResolvedValue(60); // 60 students > 50 capacity

      await expect(service.createSchedule(dto, 1)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if there is a double-booking conflict', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue(mockExam);
      mockPrismaService.examHall.findUnique.mockResolvedValue(mockHall);
      mockPrismaService.examSchedule.findFirst
        .mockResolvedValueOnce(null) // Not already scheduled
        .mockResolvedValueOnce({
          schedule_id: 2,
          exam: { exam_title: 'Conflict Exam' },
        }); // Overlapping schedule
      mockPrismaService.courseRegistration.count.mockResolvedValue(30); // 30 students <= 50 capacity

      await expect(service.createSchedule(dto, 1)).rejects.toThrow(BadRequestException);
    });

    it('should create schedule successfully and log action', async () => {
      mockPrismaService.exam.findUnique.mockResolvedValue(mockExam);
      mockPrismaService.examHall.findUnique.mockResolvedValue(mockHall);
      mockPrismaService.examSchedule.findFirst
        .mockResolvedValueOnce(null) // Not already scheduled
        .mockResolvedValueOnce(null); // No overlapping schedule
      mockPrismaService.courseRegistration.count.mockResolvedValue(30);

      const mockSchedule = {
        schedule_id: 99,
        exam_id: 10,
        hall_id: 5,
        exam: mockExam,
        hall: mockHall,
      };
      mockPrismaService.examSchedule.create.mockResolvedValue(mockSchedule);

      const result = await service.createSchedule(dto, 1);
      expect(result).toEqual(mockSchedule);
      expect(audit.logAction).toHaveBeenCalledWith(
        1,
        'EXAM_SCHEDULE_CREATE',
        'exam_schedules',
        '99',
        null,
        mockSchedule,
      );
    });
  });

  describe('deleteSchedule', () => {
    it('should throw NotFoundException if schedule does not exist', async () => {
      mockPrismaService.examSchedule.findUnique.mockResolvedValue(null);

      await expect(service.deleteSchedule(1, 1)).rejects.toThrow(NotFoundException);
    });

    it('should delete schedule successfully and log action', async () => {
      const existing = { schedule_id: 1, exam_id: 10, hall_id: 5 };
      mockPrismaService.examSchedule.findUnique.mockResolvedValue(existing);
      mockPrismaService.examSchedule.delete.mockResolvedValue(existing);

      const result = await service.deleteSchedule(1, 1);
      expect(result).toEqual(existing);
      expect(audit.logAction).toHaveBeenCalledWith(
        1,
        'EXAM_SCHEDULE_DELETE',
        'exam_schedules',
        '1',
        existing,
        null,
      );
    });
  });
});
