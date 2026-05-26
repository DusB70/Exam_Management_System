import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateExamDto,
  UpdateExamDto,
  CreateHallDto,
  UpdateHallDto,
  ScheduleExamDto,
} from './dtos/exams.dto';
import { Exam, ExamHall, ExamSchedule } from '@prisma/client';

@Injectable()
export class ExamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private parseTime(timeInput: string | Date): Date {
    if (timeInput instanceof Date) return timeInput;
    if (timeInput.includes('T')) return new Date(timeInput);

    const parts = timeInput.split(':');
    const date = new Date(1970, 0, 1, 0, 0, 0, 0);
    date.setUTCHours(
      parseInt(parts[0] || '0', 10),
      parseInt(parts[1] || '0', 10),
      parseInt(parts[2] || '0', 10),
    );
    return date;
  }

  // ==========================================
  // EXAM CRUD
  // ==========================================

  async findAllExams(): Promise<Exam[]> {
    return this.prisma.exam.findMany({
      include: {
        course: true,
        schedules: {
          include: {
            hall: true,
          },
        },
      },
      orderBy: { exam_date: 'asc' },
    });
  }

  async createExam(dto: CreateExamDto, executorId: number): Promise<Exam> {
    const course = await this.prisma.course.findUnique({
      where: { course_id: dto.courseId },
    });
    if (!course) {
      throw new NotFoundException(`Course with ID ${dto.courseId} not found`);
    }

    const exam = await this.prisma.exam.create({
      data: {
        course_id: dto.courseId,
        exam_type: dto.examType,
        exam_title: dto.examTitle,
        total_marks: dto.totalMarks,
        exam_date: new Date(dto.examDate),
        start_time: this.parseTime(dto.startTime),
        end_time: this.parseTime(dto.endTime),
      },
    });

    await this.auditService.logAction(
      executorId,
      'EXAM_CREATE',
      'exams',
      exam.exam_id.toString(),
      null,
      exam,
    );
    return exam;
  }

  async updateExam(id: number, dto: UpdateExamDto, executorId: number): Promise<Exam> {
    const existing = await this.prisma.exam.findUnique({
      where: { exam_id: id },
    });
    if (!existing) {
      throw new NotFoundException(`Exam with ID ${id} not found`);
    }

    const updateData: any = {};
    if (dto.examType) updateData.exam_type = dto.examType;
    if (dto.examTitle) updateData.exam_title = dto.examTitle;
    if (dto.totalMarks) updateData.total_marks = dto.totalMarks;
    if (dto.examDate) updateData.exam_date = new Date(dto.examDate);
    if (dto.startTime) updateData.start_time = this.parseTime(dto.startTime);
    if (dto.endTime) updateData.end_time = this.parseTime(dto.endTime);

    const exam = await this.prisma.exam.update({
      where: { exam_id: id },
      data: updateData,
    });

    await this.auditService.logAction(
      executorId,
      'EXAM_UPDATE',
      'exams',
      id.toString(),
      existing,
      exam,
    );
    return exam;
  }

  async deleteExam(id: number, executorId: number): Promise<Exam> {
    const existing = await this.prisma.exam.findUnique({
      where: { exam_id: id },
    });
    if (!existing) {
      throw new NotFoundException(`Exam with ID ${id} not found`);
    }

    const exam = await this.prisma.exam.delete({
      where: { exam_id: id },
    });

    await this.auditService.logAction(
      executorId,
      'EXAM_DELETE',
      'exams',
      id.toString(),
      existing,
      null,
    );
    return exam;
  }

  // ==========================================
  // HALL CRUD
  // ==========================================

  async findAllHalls(): Promise<ExamHall[]> {
    return this.prisma.examHall.findMany({
      orderBy: { hall_name: 'asc' },
    });
  }

  async createHall(dto: CreateHallDto, executorId: number): Promise<ExamHall> {
    const exists = await this.prisma.examHall.findUnique({
      where: { hall_name: dto.hallName },
    });
    if (exists) {
      throw new BadRequestException(`Exam Hall with name "${dto.hallName}" already exists`);
    }

    const hall = await this.prisma.examHall.create({
      data: {
        hall_name: dto.hallName,
        capacity: dto.capacity,
      },
    });

    await this.auditService.logAction(
      executorId,
      'EXAM_HALL_CREATE',
      'exam_halls',
      hall.hall_id.toString(),
      null,
      hall,
    );
    return hall;
  }

  async updateHall(id: number, dto: UpdateHallDto, executorId: number): Promise<ExamHall> {
    const existing = await this.prisma.examHall.findUnique({
      where: { hall_id: id },
    });
    if (!existing) {
      throw new NotFoundException(`Exam Hall with ID ${id} not found`);
    }

    if (dto.hallName && dto.hallName !== existing.hall_name) {
      const exists = await this.prisma.examHall.findUnique({
        where: { hall_name: dto.hallName },
      });
      if (exists) {
        throw new BadRequestException(`Exam Hall with name "${dto.hallName}" already exists`);
      }
    }

    const hall = await this.prisma.examHall.update({
      where: { hall_id: id },
      data: {
        hall_name: dto.hallName || undefined,
        capacity: dto.capacity || undefined,
      },
    });

    await this.auditService.logAction(
      executorId,
      'EXAM_HALL_UPDATE',
      'exam_halls',
      id.toString(),
      existing,
      hall,
    );
    return hall;
  }

  async deleteHall(id: number, executorId: number): Promise<ExamHall> {
    const existing = await this.prisma.examHall.findUnique({
      where: { hall_id: id },
    });
    if (!existing) {
      throw new NotFoundException(`Exam Hall with ID ${id} not found`);
    }

    const hall = await this.prisma.examHall.delete({
      where: { hall_id: id },
    });

    await this.auditService.logAction(
      executorId,
      'EXAM_HALL_DELETE',
      'exam_halls',
      id.toString(),
      existing,
      null,
    );
    return hall;
  }

  // ==========================================
  // SCHEDULING & ALLOCATION
  // ==========================================

  async findAllSchedules(): Promise<ExamSchedule[]> {
    return this.prisma.examSchedule.findMany({
      include: {
        exam: {
          include: {
            course: true,
          },
        },
        hall: true,
      },
      orderBy: {
        exam: {
          exam_date: 'asc',
        },
      },
    });
  }

  async createSchedule(dto: ScheduleExamDto, executorId: number): Promise<ExamSchedule> {
    const exam = await this.prisma.exam.findUnique({
      where: { exam_id: dto.examId },
    });
    if (!exam) {
      throw new NotFoundException(`Exam with ID ${dto.examId} not found`);
    }

    const hall = await this.prisma.examHall.findUnique({
      where: { hall_id: dto.hallId },
    });
    if (!hall) {
      throw new NotFoundException(`Exam Hall with ID ${dto.hallId} not found`);
    }

    // 1. Check if this exam is already scheduled
    const alreadyScheduled = await this.prisma.examSchedule.findFirst({
      where: { exam_id: dto.examId },
    });
    if (alreadyScheduled) {
      throw new BadRequestException('This exam has already been scheduled in another hall');
    }

    // 2. Validate Capacity: Number of registered students vs Hall Capacity
    const studentCount = await this.prisma.courseRegistration.count({
      where: { course_id: exam.course_id },
    });
    if (studentCount > hall.capacity) {
      throw new BadRequestException(
        `Insufficient hall capacity. Hall capacity is ${hall.capacity}, but course has ${studentCount} registered students.`,
      );
    }

    // 3. Validate Double-Booking: Hall is free during this exam time range
    // Overlaps if: S1 < E2 AND E1 > S2
    const overlapping = await this.prisma.examSchedule.findFirst({
      where: {
        hall_id: dto.hallId,
        exam: {
          exam_date: exam.exam_date,
          start_time: { lt: exam.end_time },
          end_time: { gt: exam.start_time },
        },
      },
      include: { exam: true },
    });

    if (overlapping) {
      throw new BadRequestException(
        `Double-booking conflict. Hall "${hall.hall_name}" is already booked for exam "${overlapping.exam.exam_title}" at this time.`,
      );
    }

    const schedule = await this.prisma.examSchedule.create({
      data: {
        exam_id: dto.examId,
        hall_id: dto.hallId,
      },
      include: {
        exam: true,
        hall: true,
      },
    });

    await this.auditService.logAction(
      executorId,
      'EXAM_SCHEDULE_CREATE',
      'exam_schedules',
      schedule.schedule_id.toString(),
      null,
      schedule,
    );

    return schedule;
  }

  async deleteSchedule(id: number, executorId: number): Promise<ExamSchedule> {
    const existing = await this.prisma.examSchedule.findUnique({
      where: { schedule_id: id },
    });
    if (!existing) {
      throw new NotFoundException(`Exam Schedule with ID ${id} not found`);
    }

    const schedule = await this.prisma.examSchedule.delete({
      where: { schedule_id: id },
    });

    await this.auditService.logAction(
      executorId,
      'EXAM_SCHEDULE_DELETE',
      'exam_schedules',
      id.toString(),
      existing,
      null,
    );
    return schedule;
  }
}
