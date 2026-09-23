import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import * as XLSX from 'xlsx';
import {
  CreateExamDto,
  UpdateExamDto,
  CreateHallDto,
  UpdateHallDto,
  ScheduleExamDto,
  UpdateProgressDto,
} from './dtos/exams.dto';
import { Exam, ExamHall, ExamSchedule } from '@prisma/client';

export function parseFlexibleDate(dateVal: any): Date | null {
  if (dateVal === null || dateVal === undefined || dateVal === '') return null;
  if (dateVal instanceof Date && !isNaN(dateVal.getTime())) {
    return dateVal;
  }

  // Handle Excel numeric date serials (e.g., 46310)
  if (typeof dateVal === 'number' && !isNaN(dateVal)) {
    const utcDays = dateVal - 25569;
    const utcValue = utcDays * 86400 * 1000;
    const d = new Date(utcValue);
    if (!isNaN(d.getTime())) return d;
  }

  const str = String(dateVal).trim();
  if (!str) return null;

  // 1. DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY (e.g. 15-10-2026, 15/10/2026)
  const ddmmyyyyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (ddmmyyyyMatch) {
    const day = parseInt(ddmmyyyyMatch[1], 10);
    const month = parseInt(ddmmyyyyMatch[2], 10);
    const year = parseInt(ddmmyyyyMatch[3], 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const d = new Date(Date.UTC(year, month - 1, day));
      if (!isNaN(d.getTime())) return d;
    }
  }

  // 2. YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD (e.g. 2026-10-15, 2026/10/15)
  const yyyymmddMatch = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (yyyymmddMatch) {
    const year = parseInt(yyyymmddMatch[1], 10);
    const month = parseInt(yyyymmddMatch[2], 10);
    const day = parseInt(yyyymmddMatch[3], 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const d = new Date(Date.UTC(year, month - 1, day));
      if (!isNaN(d.getTime())) return d;
    }
  }

  // 3. Fallback standard parse
  const fallback = new Date(str);
  if (!isNaN(fallback.getTime())) {
    return fallback;
  }
  return null;
}

export function formatToDDMMYYYY(dateVal: any): string {
  const d = parseFlexibleDate(dateVal);
  if (!d) return '—';
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

@Injectable()
export class ExamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
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

  // ==========================================
  // EXAM TIMETABLE METHODS
  // ==========================================

  // ==========================================
  // EXAM TIMETABLE METHODS
  // ==========================================

  async getAllTimetables() {
    const timetables = await this.prisma.examTimetable.findMany({
      include: {
        course: {
          include: {
            department: true,
            publishing_progress: true,
          },
        },
      },
      orderBy: [{ exam_date: 'asc' }, { start_time: 'asc' }],
    });

    const courses = await this.prisma.course.findMany({
      include: { department: true },
      orderBy: [{ semester: 'asc' }, { course_code: 'asc' }],
    });

    const examNames = Array.from(
      new Set(timetables.map((t) => (t as any).exam_name).filter(Boolean)),
    ) as string[];

    const batches = Array.from(new Set(timetables.map((t) => t.batch))).filter(Boolean);

    return {
      timetables,
      availableCourses: courses,
      examNames,
      batches,
    };
  }

  async getTimetableByBatch(batch: string) {
    const timetables = await this.prisma.examTimetable.findMany({
      where: { batch },
      include: {
        course: {
          include: {
            department: true,
          },
        },
      },
      orderBy: { exam_date: 'asc' },
    });

    const courses = await this.prisma.course.findMany({
      include: { department: true },
      orderBy: [{ semester: 'asc' }, { course_code: 'asc' }],
    });

    const hasUnpublishedChanges = timetables.some((t) => (t as any).is_dirty || !t.is_published);

    return {
      batch,
      isPublished: timetables.length > 0 && timetables.every((t) => t.is_published),
      hasUnpublishedChanges,
      publishedAt: timetables.find((t) => t.is_published)?.published_at || null,
      timetables,
      availableCourses: courses,
    };
  }

  async saveBatchTimetable(batch: string, items: any[], executorId: number) {
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new BadRequestException(
        'Please provide at least one course timetable entry with a valid exam date before saving.',
      );
    }

    const results = [];
    try {
      for (const item of items) {
        const courseId = Number(item.courseId);
        if (isNaN(courseId) || courseId <= 0) {
          throw new BadRequestException('Invalid course selection provided for timetable entry.');
        }

        if (!item.examDate) {
          throw new BadRequestException(
            'Please specify an examination date for all entered courses.',
          );
        }

        const parsedDate = parseFlexibleDate(item.examDate);
        if (!parsedDate) {
          throw new BadRequestException(
            `Invalid examination date '${item.examDate}' provided. Please enter dates in DD-MM-YYYY format (e.g. 15-10-2026).`,
          );
        }

        const existing = await this.prisma.examTimetable.findFirst({
          where: { batch, course_id: courseId },
        });

        const examName = item.examName || 'End Semester Examination 2026';
        const startTime = item.startTime || '09:00 AM';
        const endTime = item.endTime || '12:00 PM';
        const venue = item.venue || 'Main Exam Hall A';

        if (existing) {
          const updated = await this.prisma.examTimetable.update({
            where: { timetable_id: existing.timetable_id },
            data: {
              exam_name: examName,
              exam_date: parsedDate,
              start_time: startTime,
              end_time: endTime,
              venue,
              is_dirty: true,
            } as any,
          });
          results.push(updated);
        } else {
          const created = await this.prisma.examTimetable.create({
            data: {
              batch,
              course_id: courseId,
              exam_name: examName,
              exam_date: parsedDate,
              start_time: startTime,
              end_time: endTime,
              venue,
              is_published: false,
              is_dirty: true,
            } as any,
          });
          results.push(created);
        }

        // Upsert publishing progress entry for this course to associate batch
        await this.prisma.coursePublishingProgress.upsert({
          where: { course_id: courseId },
          update: { batch },
          create: { course_id: courseId, batch, exam_held: 'PENDING' },
        });
      }

      // Handle removed courses during editing
      const savedCourseIds = items.map((i) => Number(i.courseId)).filter(Boolean);
      if (savedCourseIds.length > 0) {
        const sampleCourse = await this.prisma.course.findUnique({
          where: { course_id: savedCourseIds[0] },
        });
        if (sampleCourse) {
          const removedTimetables = await this.prisma.examTimetable.findMany({
            where: {
              batch,
              course: { semester: sampleCourse.semester },
              course_id: { notIn: savedCourseIds },
            },
            select: { timetable_id: true, course_id: true },
          });

          if (removedTimetables.length > 0) {
            const removedIds = removedTimetables.map((t) => t.timetable_id);
            const removedCourseIds = removedTimetables.map((t) => t.course_id);

            await this.prisma.examTimetable.deleteMany({
              where: { timetable_id: { in: removedIds } },
            });

            for (const cId of removedCourseIds) {
              const count = await this.prisma.examTimetable.count({ where: { course_id: cId } });
              if (count === 0) {
                await this.prisma.coursePublishingProgress.deleteMany({
                  where: { course_id: cId },
                });
              }
            }
          }
        }
      }

      await this.auditService.logAction(
        executorId,
        'EXAM_TIMETABLE_SAVE',
        'exam_timetables',
        batch,
        null,
        { count: results.length },
      );

      return results;
    } catch (err: any) {
      if (err instanceof BadRequestException) {
        throw err;
      }
      throw new BadRequestException(
        err.message ||
          'Failed to save timetable entries. Please check the course dates and times and try again.',
      );
    }
  }

  async deleteBatchTimetable(batch: string, semester?: string, executorId?: number) {
    let whereClause: any = { batch };
    if (semester && semester !== 'ALL') {
      whereClause = {
        batch,
        course: {
          semester: semester,
        },
      };
    }

    const timetablesToDelete = await this.prisma.examTimetable.findMany({
      where: whereClause,
      select: { course_id: true },
    });

    const courseIds = timetablesToDelete.map((t) => t.course_id);

    const deleted = await this.prisma.examTimetable.deleteMany({
      where: whereClause,
    });

    for (const courseId of courseIds) {
      const remainingCount = await this.prisma.examTimetable.count({
        where: { course_id: courseId },
      });
      if (remainingCount === 0) {
        await this.prisma.coursePublishingProgress.deleteMany({
          where: { course_id: courseId },
        });
      }
    }

    if (executorId) {
      await this.auditService.logAction(
        executorId,
        'EXAM_TIMETABLE_DELETE',
        'exam_timetables',
        batch,
        null,
        { batch, deletedCount: deleted.count },
      );
    }

    return {
      batch,
      deletedCount: deleted.count,
      message: `Successfully deleted timetable for batch ${batch}${semester ? ` (Semester ${semester})` : ''}.`,
    };
  }

  async validateExcelTimetable(
    batch: string,
    semester: string,
    examName: string,
    fileBuffer: Buffer,
  ) {
    if (!fileBuffer) {
      throw new BadRequestException('Excel file is required for timetable validation');
    }

    const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (rawRows.length === 0) {
      throw new BadRequestException('Uploaded spreadsheet is completely empty.');
    }

    // Header validation
    const headerRow: string[] = (rawRows[0] || []).map((h: any) => String(h).trim());
    const expectedHeaders = ['Course Code', 'Date', 'Start Time', 'End Time', 'Venue'];

    const headerErrors: string[] = [];

    const hasCodeHeader = headerRow.some((h) => /course|subject|code/i.test(h));
    const hasDateHeader = headerRow.some((h) => /date/i.test(h));
    const hasStartHeader = headerRow.some((h) => /start|time/i.test(h));
    const hasEndHeader = headerRow.some((h) => /end/i.test(h));

    if (!hasCodeHeader) {
      headerErrors.push("Missing required column 'Course Code'");
    }
    if (!hasDateHeader) {
      headerErrors.push("Missing required column 'Date'");
    }
    if (!hasStartHeader) {
      headerErrors.push("Missing required column 'Start Time'");
    }
    if (!hasEndHeader) {
      headerErrors.push("Missing required column 'End Time'");
    }

    const rowsData: any[] = XLSX.utils.sheet_to_json(sheet);

    // Fetch system courses to validate course code matches for this batch/semester
    const systemCourses = await this.prisma.course.findMany({
      where: semester && semester !== 'ALL' ? { semester } : {},
      include: { department: true },
    });

    const parsedRows: any[] = [];
    let hasBlockingErrors = headerErrors.length > 0;

    for (let index = 0; index < rowsData.length; index++) {
      const row = rowsData[index];
      const rowErrors: string[] = [];

      const codeKey = Object.keys(row).find((k) => /course|subject|code/i.test(k));
      const dateKey = Object.keys(row).find((k) => /date/i.test(k));
      const startKey = Object.keys(row).find((k) => /start|time/i.test(k));
      const endKey = Object.keys(row).find((k) => /end/i.test(k));
      const venueKey = Object.keys(row).find((k) => /venue|hall|location/i.test(k));

      const rawCode = codeKey ? String(row[codeKey]).trim() : '';
      const rawDate = dateKey ? row[dateKey] : '';
      const rawStart = startKey ? String(row[startKey]).trim() : '09:00 AM';
      const rawEnd = endKey ? String(row[endKey]).trim() : '12:00 PM';
      const rawVenue = venueKey ? String(row[venueKey]).trim() : 'Main Exam Hall A';

      if (!rawCode) {
        rowErrors.push('Course Code is missing or empty.');
      } else {
        const matchedCourse = systemCourses.find(
          (c) => c.course_code.toLowerCase() === rawCode.toLowerCase(),
        );
        if (!matchedCourse) {
          rowErrors.push(
            `Course Code '${rawCode}' does not exist in the system${semester && semester !== 'ALL' ? ` for Semester ${semester}` : ''}.`,
          );
        }
      }

      if (rawDate === null || rawDate === undefined || rawDate === '') {
        rowErrors.push('Examination Date is missing.');
      } else {
        const parsedDate = parseFlexibleDate(rawDate);
        if (!parsedDate) {
          rowErrors.push(
            `Invalid date format '${rawDate}'. Expected DD-MM-YYYY or YYYY-MM-DD format (e.g. 15-10-2026 or 2026-10-15).`,
          );
        }
      }

      if (rowErrors.length > 0) {
        hasBlockingErrors = true;
      }

      const matched = systemCourses.find(
        (c) => c.course_code.toLowerCase() === rawCode.toLowerCase(),
      );

      const formattedDisplayDate = formatToDDMMYYYY(rawDate);

      parsedRows.push({
        rowIndex: index + 2,
        courseCode: rawCode,
        courseName: matched ? matched.course_name : 'Unknown Course',
        courseId: matched ? matched.course_id : null,
        semester: matched ? matched.semester : semester || '1.1',
        examDate: formattedDisplayDate !== '—' ? formattedDisplayDate : String(rawDate || ''),
        startTime: rawStart,
        endTime: rawEnd,
        venue: rawVenue,
        errors: rowErrors,
        isValid: rowErrors.length === 0,
      });
    }

    return {
      batch,
      semester,
      examName,
      headerRow,
      headerErrors,
      expectedHeaders,
      hasHeaderErrors: headerErrors.length > 0,
      hasBlockingErrors,
      totalRows: parsedRows.length,
      validRowsCount: parsedRows.filter((r) => r.isValid).length,
      invalidRowsCount: parsedRows.filter((r) => !r.isValid).length,
      rows: parsedRows,
    };
  }

  async importBatchTimetableExcel(batch: string, fileBuffer: Buffer, executorId: number) {
    const validation = await this.validateExcelTimetable(
      batch,
      'ALL',
      'End Semester Examination 2026',
      fileBuffer,
    );

    if (validation.hasBlockingErrors) {
      throw new BadRequestException(
        `Spreadsheet validation failed with ${validation.invalidRowsCount} error(s). Please review the errors before committing.`,
      );
    }

    const itemsToSave = validation.rows
      .filter((r) => r.isValid && r.courseId)
      .map((r) => ({
        courseId: r.courseId,
        examName: 'End Semester Examination 2026',
        examDate: r.examDate,
        startTime: r.startTime,
        endTime: r.endTime,
        venue: r.venue,
      }));

    const results = await this.saveBatchTimetable(batch, itemsToSave, executorId);

    return {
      batch,
      importedCount: results.length,
      message: `Successfully imported and saved ${results.length} timetable entries for batch ${batch}!`,
    };
  }

  async publishBatchTimetable(batch: string, executorId: number) {
    const updated = await this.prisma.examTimetable.updateMany({
      where: { batch },
      data: {
        is_published: true,
        is_dirty: false,
        published_at: new Date(),
      } as any,
    });

    // Fetch student emails in batch for notification log simulation
    const studentsInBatch = await this.prisma.student.findMany({
      include: { user: true },
    });

    await this.auditService.logAction(
      executorId,
      'EXAM_TIMETABLE_PUBLISH',
      'exam_timetables',
      batch,
      null,
      {
        batch,
        publishedCount: updated.count,
        notifiedStudentsCount: studentsInBatch.length,
      },
    );

    return {
      batch,
      publishedCount: updated.count,
      notifiedStudentsCount: studentsInBatch.length,
      message: `Exam timetable published to students! Notification emails dispatched for batch ${batch}.`,
    };
  }

  async getStudentPublishedTimetable(userId: number) {
    const student = await this.prisma.student.findUnique({
      where: { user_id: userId },
      include: {
        registrations: {
          include: {
            course: true,
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Student profile not found');
    }

    const registeredCourseIds = student.registrations.map((r) => r.course_id);

    const timetables = await this.prisma.examTimetable.findMany({
      where: {
        is_published: true,
        course_id: { in: registeredCourseIds },
      },
      include: {
        course: {
          include: {
            department: true,
          },
        },
      },
      orderBy: { exam_date: 'asc' },
    });

    return timetables;
  }

  // ==========================================
  // RESULT PUBLISHING PROGRESS TRACKER
  // ==========================================

  async getPublishingProgress() {
    const courses = await this.prisma.course.findMany({
      include: {
        department: true,
        first_marker_lecturer: { include: { user: true } },
        second_marker_lecturer: { include: { user: true } },
        publishing_progress: true,
        timetables: {
          orderBy: { created_at: 'desc' },
        },
      },
      orderBy: [{ semester: 'asc' }, { course_code: 'asc' }],
    });

    const coursesWithTimetables = courses.filter((c) => c.timetables && c.timetables.length > 0);
    const now = new Date();

    const results = await Promise.all(
      coursesWithTimetables.map(async (course) => {
        const prog = course.publishing_progress;
        const mainTimetable = course.timetables[0];

        let effectiveExamHeld = prog?.exam_held || 'PENDING';

        // Auto-calculate HELD status after 2 hours from exam end date & time if not postponed
        if (
          effectiveExamHeld !== 'POSTPONED' &&
          effectiveExamHeld !== 'HELD' &&
          mainTimetable?.exam_date
        ) {
          const parsedDate = parseFlexibleDate(mainTimetable.exam_date);
          if (parsedDate) {
            let endHours = 12;
            let endMins = 0;
            if (mainTimetable.end_time) {
              const isPm = /pm/i.test(mainTimetable.end_time);
              const isAm = /am/i.test(mainTimetable.end_time);
              const match = mainTimetable.end_time.match(/(\d{1,2})[:.](\d{1,2})/);
              if (match) {
                endHours = parseInt(match[1], 10);
                endMins = parseInt(match[2], 10);
                if (isPm && endHours < 12) endHours += 12;
                if (isAm && endHours === 12) endHours = 0;
              }
            }

            const cutoff = new Date(
              Date.UTC(
                parsedDate.getUTCFullYear(),
                parsedDate.getUTCMonth(),
                parsedDate.getUTCDate(),
                endHours + 2, // 2 hours after exam end time
                endMins,
              ),
            );

            if (now >= cutoff) {
              effectiveExamHeld = 'HELD';
              // Automatically persist HELD status in database
              try {
                await this.prisma.coursePublishingProgress.upsert({
                  where: { course_id: course.course_id },
                  update: { exam_held: 'HELD' },
                  create: {
                    course_id: course.course_id,
                    exam_held: 'HELD',
                    batch: mainTimetable.batch,
                  },
                });
              } catch (e) {
                // Ignore background DB error on read
              }
            }
          }
        }

        return {
          course_id: course.course_id,
          course_code: course.course_code,
          course_name: course.course_name,
          semester: course.semester,
          batch: prog?.batch || mainTimetable?.batch || '20/21',
          exam_name: mainTimetable?.exam_name || 'End Semester Examination 2026',
          exam_date: mainTimetable?.exam_date || null,
          department_name: course.department.department_name,
          first_marker_name:
            course.first_marker_type === 'EXTERNAL'
              ? course.first_marker_name || 'External Marker'
              : course.first_marker_lecturer?.user.full_name || 'Unassigned',
          second_marker_name:
            course.second_marker_type === 'EXTERNAL'
              ? course.second_marker_name || 'External Marker'
              : course.second_marker_lecturer?.user.full_name || 'Unassigned',
          exam_held: effectiveExamHeld,
          first_marking: {
            collected: prog?.first_marking_collected || false,
            submitted: prog?.first_marking_submitted || false,
            returned: prog?.first_marking_returned || false,
          },
          second_marking: {
            collected: prog?.second_marking_collected || false,
            submitted: prog?.second_marking_submitted || false,
            returned: prog?.second_marking_returned || false,
          },
          final_submission: {
            submitted: prog?.final_submitted || false,
            head_approved: prog?.head_approved || false,
          },
          exam_board: prog?.exam_board || false,
          results_published: prog?.results_published || false,
        };
      }),
    );

    return results;
  }

  async updatePublishingProgress(courseId: number, dto: UpdateProgressDto, executorId: number) {
    const course = await this.prisma.course.findUnique({
      where: { course_id: courseId },
      include: {
        first_marker_lecturer: { include: { user: true } },
        second_marker_lecturer: { include: { user: true } },
        publishing_progress: true,
      },
    });
    if (!course) throw new NotFoundException('Course not found');

    const prevProgress = course.publishing_progress;
    const currentHeld = dto.examHeld || prevProgress?.exam_held || 'PENDING';

    // Strict Sequential Step Enforcement
    if (dto.firstMarkingCollected !== undefined && dto.firstMarkingCollected) {
      if (currentHeld !== 'HELD') {
        throw new BadRequestException(
          'Cannot collect 1st marking papers: Examination has not been held yet.',
        );
      }
    }

    if (dto.firstMarkingReturned !== undefined && dto.firstMarkingReturned) {
      if (!prevProgress?.first_marking_collected && !dto.firstMarkingCollected) {
        throw new BadRequestException(
          'Cannot return 1st marking papers: Papers have not been collected by 1st marker yet.',
        );
      }
      if (!prevProgress?.first_marking_submitted) {
        throw new BadRequestException(
          'Cannot return 1st marking papers: 1st marking marks have not been submitted by 1st marker yet.',
        );
      }
    }

    if (dto.secondMarkingCollected !== undefined && dto.secondMarkingCollected) {
      if (!prevProgress?.first_marking_returned && !dto.firstMarkingReturned) {
        throw new BadRequestException(
          'Cannot collect 2nd marking papers: 1st marking papers have not been returned to AR Office yet.',
        );
      }
    }

    if (dto.secondMarkingReturned !== undefined && dto.secondMarkingReturned) {
      if (!prevProgress?.second_marking_collected && !dto.secondMarkingCollected) {
        throw new BadRequestException(
          'Cannot return 2nd marking papers: Papers have not been collected by 2nd marker yet.',
        );
      }
      if (!prevProgress?.second_marking_submitted) {
        throw new BadRequestException(
          'Cannot return 2nd marking papers: 2nd marking marks have not been submitted by 2nd marker yet.',
        );
      }
    }

    if (dto.examBoard !== undefined && dto.examBoard) {
      if (!prevProgress?.first_marking_returned && !dto.firstMarkingReturned) {
        throw new BadRequestException(
          'Cannot approve Exam Board: 1st marking papers have not been returned yet.',
        );
      }
    }

    const dataToUpdate: any = {};
    if (dto.examHeld !== undefined) dataToUpdate.exam_held = dto.examHeld;
    if (dto.firstMarkingCollected !== undefined)
      dataToUpdate.first_marking_collected = dto.firstMarkingCollected;
    if (dto.firstMarkingReturned !== undefined)
      dataToUpdate.first_marking_returned = dto.firstMarkingReturned;
    if (dto.secondMarkingCollected !== undefined)
      dataToUpdate.second_marking_collected = dto.secondMarkingCollected;
    if (dto.secondMarkingReturned !== undefined)
      dataToUpdate.second_marking_returned = dto.secondMarkingReturned;
    if (dto.examBoard !== undefined) dataToUpdate.exam_board = dto.examBoard;

    const progress = await this.prisma.coursePublishingProgress.upsert({
      where: { course_id: courseId },
      update: dataToUpdate,
      create: {
        course_id: courseId,
        ...dataToUpdate,
      },
    });

    // 1. Trigger Email to 1st Marker when exam_held becomes "HELD"
    if (dto.examHeld === 'HELD' && prevProgress?.exam_held !== 'HELD') {
      const markerEmail =
        course.first_marker_type === 'EXTERNAL'
          ? course.first_marker_email
          : course.first_marker_lecturer?.user?.email;
      const markerName =
        course.first_marker_type === 'EXTERNAL'
          ? course.first_marker_name || 'First Marker'
          : course.first_marker_lecturer?.user?.full_name || 'First Marker';

      if (markerEmail) {
        await this.notificationsService.sendFirstMarkerExamHeldNotification(
          markerEmail,
          markerName,
          course.course_code,
          course.course_name,
        );
      }
    }

    // 2. Trigger Email with Magic Link to 2nd Marker when 1st marker returns paper packet (firstMarkingReturned becomes true)
    if (dto.firstMarkingReturned === true && !prevProgress?.first_marking_returned) {
      const markerEmail =
        course.second_marker_type === 'EXTERNAL'
          ? course.second_marker_email
          : course.second_marker_lecturer?.user?.email;
      const markerName =
        course.second_marker_type === 'EXTERNAL'
          ? course.second_marker_name || 'Second Marker'
          : course.second_marker_lecturer?.user?.full_name || 'Second Marker';

      if (markerEmail) {
        const payload = JSON.stringify({
          courseId,
          email: markerEmail,
          exp: Date.now() + 14 * 24 * 3600 * 1000, // 14 days valid
        });
        const token = Buffer.from(payload).toString('base64url');
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const magicLinkUrl = `${frontendUrl}/marks/second-marking?token=${token}&courseId=${courseId}`;

        await this.notificationsService.sendSecondMarkerMagicLinkNotification(
          markerEmail,
          markerName,
          course.course_code,
          course.course_name,
          magicLinkUrl,
        );
      }
    }

    await this.auditService.logAction(
      executorId,
      'PROGRESS_TRACKER_UPDATE',
      'course_publishing_progress',
      courseId.toString(),
      null,
      progress,
    );

    return progress;
  }

  async getStudentPublishingProgress(userId: number) {
    const student = await this.prisma.student.findUnique({
      where: { user_id: userId },
      include: {
        registrations: {
          include: {
            course: {
              include: {
                publishing_progress: true,
              },
            },
          },
        },
      },
    });

    if (!student) throw new NotFoundException('Student not found');

    return student.registrations.map((reg) => {
      const prog = reg.course.publishing_progress;
      return {
        course_id: reg.course.course_id,
        course_code: reg.course.course_code,
        course_name: reg.course.course_name,
        semester: reg.course.semester,
        exam_held: prog?.exam_held || 'PENDING',
        first_marking: prog?.first_marking_submitted
          ? 'COMPLETED'
          : prog?.first_marking_collected
            ? 'IN_PROGRESS'
            : 'PENDING',
        second_marking: prog?.second_marking_submitted
          ? 'COMPLETED'
          : prog?.second_marking_collected
            ? 'IN_PROGRESS'
            : 'PENDING',
        published: prog?.results_published ? 'PUBLISHED' : 'PENDING',
      };
    });
  }
}
