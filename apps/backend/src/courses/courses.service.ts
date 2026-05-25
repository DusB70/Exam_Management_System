import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateCourseDto, UpdateCourseDto } from './dtos/courses.dto';
import { CreatePeriodDto, PeriodStatus } from './dtos/registration-periods.dto';
import { Prisma, Course, RegistrationPeriod } from '@prisma/client';

@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(
    page: number,
    limit: number,
    search?: string,
    departmentId?: number,
    semester?: number,
    academicYear?: number,
  ) {
    const where: Prisma.CourseWhereInput = {};

    if (search) {
      where.OR = [
        { course_code: { contains: search, mode: 'insensitive' } },
        { course_name: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (departmentId) {
      where.department_id = departmentId;
    }

    if (semester) {
      where.semester = semester;
    }

    if (academicYear) {
      where.academic_year = academicYear;
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.course.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          department: true,
        },
        orderBy: { course_code: 'asc' },
      }),
      this.prisma.course.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number) {
    const course = await this.prisma.course.findUnique({
      where: { course_id: id },
      include: {
        department: true,
        lecturers: {
          include: {
            lecturer: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }

    return course;
  }

  async create(createCourseDto: CreateCourseDto, executorId: number): Promise<Course> {
    const { courseCode, courseName, creditValue, departmentId, semester, academicYear } =
      createCourseDto;

    // Verify course code unique
    const codeExists = await this.prisma.course.findUnique({
      where: { course_code: courseCode },
    });
    if (codeExists) {
      throw new BadRequestException(`Course code ${courseCode} is already in use`);
    }

    const course = await this.prisma.course.create({
      data: {
        course_code: courseCode,
        course_name: courseName,
        credit_value: new Prisma.Decimal(creditValue),
        department_id: departmentId,
        semester,
        academic_year: academicYear,
      },
    });

    await this.auditService.logAction(
      executorId,
      'COURSE_CREATE',
      'courses',
      course.course_id.toString(),
      null,
      course,
    );

    return course;
  }

  async update(id: number, updateCourseDto: UpdateCourseDto, executorId: number): Promise<Course> {
    const existingCourse = await this.findOne(id);
    const { courseCode, courseName, creditValue, departmentId, semester, academicYear } =
      updateCourseDto;

    if (courseCode && courseCode !== existingCourse.course_code) {
      const codeExists = await this.prisma.course.findUnique({
        where: { course_code: courseCode },
      });
      if (codeExists) {
        throw new BadRequestException(`Course code ${courseCode} is already in use`);
      }
    }

    const updateData: Prisma.CourseUpdateInput = {};
    if (courseCode) updateData.course_code = courseCode;
    if (courseName) updateData.course_name = courseName;
    if (creditValue !== undefined) updateData.credit_value = new Prisma.Decimal(creditValue);
    if (departmentId) updateData.department = { connect: { department_id: departmentId } };
    if (semester) updateData.semester = semester;
    if (academicYear) updateData.academic_year = academicYear;

    const course = await this.prisma.course.update({
      where: { course_id: id },
      data: updateData,
    });

    await this.auditService.logAction(
      executorId,
      'COURSE_UPDATE',
      'courses',
      id.toString(),
      existingCourse,
      course,
    );

    return course;
  }

  async delete(id: number, executorId: number): Promise<Course> {
    const existingCourse = await this.findOne(id);

    const course = await this.prisma.course.delete({
      where: { course_id: id },
    });

    await this.auditService.logAction(
      executorId,
      'COURSE_DELETE',
      'courses',
      id.toString(),
      existingCourse,
      null,
    );

    return course;
  }

  async assignLecturer(courseId: number, lecturerId: number, executorId: number) {
    await this.findOne(courseId); // Throws 404 if course not found

    const lecturer = await this.prisma.lecturer.findUnique({
      where: { lecturer_id: lecturerId },
      include: { user: true },
    });
    if (!lecturer) {
      throw new NotFoundException(`Lecturer with ID ${lecturerId} not found`);
    }

    const assignmentExists = await this.prisma.courseLecturer.findUnique({
      where: {
        course_id_lecturer_id: {
          course_id: courseId,
          lecturer_id: lecturerId,
        },
      },
    });

    if (assignmentExists) {
      throw new BadRequestException('Lecturer is already assigned to this course');
    }

    const assignment = await this.prisma.courseLecturer.create({
      data: {
        course_id: courseId,
        lecturer_id: lecturerId,
      },
    });

    await this.auditService.logAction(
      executorId,
      'COURSE_ASSIGN_LECTURER',
      'course_lecturers',
      `${courseId}_${lecturerId}`,
      null,
      assignment,
    );

    return assignment;
  }

  async removeLecturer(courseId: number, lecturerId: number, executorId: number) {
    await this.findOne(courseId);

    const assignment = await this.prisma.courseLecturer.delete({
      where: {
        course_id_lecturer_id: {
          course_id: courseId,
          lecturer_id: lecturerId,
        },
      },
    });

    await this.auditService.logAction(
      executorId,
      'COURSE_REMOVE_LECTURER',
      'course_lecturers',
      `${courseId}_${lecturerId}`,
      assignment,
      null,
    );

    return assignment;
  }

  // ==========================================
  // REGISTRATION PERIOD WINDOW MANAGEMENT
  // ==========================================

  async findAllPeriods(): Promise<RegistrationPeriod[]> {
    return this.prisma.registrationPeriod.findMany({
      orderBy: { start_date: 'desc' },
    });
  }

  async createPeriod(
    createPeriodDto: CreatePeriodDto,
    executorId: number,
  ): Promise<RegistrationPeriod> {
    const { academicYear, semester, startDate, endDate, status } = createPeriodDto;

    // Verify start date is before end date
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start >= end) {
      throw new BadRequestException('Start date must be strictly before the end date');
    }

    // Connect to database to check for existing open registration windows for same semester
    const periodActive = await this.prisma.registrationPeriod.findFirst({
      where: {
        academic_year: academicYear,
        semester,
        status: PeriodStatus.OPEN,
      },
    });

    if (periodActive && status === PeriodStatus.OPEN) {
      throw new BadRequestException(
        `A registration window is already OPEN for Semester ${semester} in Academic Year ${academicYear}`,
      );
    }

    const period = await this.prisma.registrationPeriod.create({
      data: {
        academic_year: academicYear,
        semester,
        start_date: start,
        end_date: end,
        status: status || PeriodStatus.CLOSED,
      },
    });

    await this.auditService.logAction(
      executorId,
      'REGISTRATION_PERIOD_OPEN',
      'registration_periods',
      period.period_id.toString(),
      null,
      period,
    );

    return period;
  }

  async updatePeriodStatus(
    periodId: number,
    status: PeriodStatus,
    executorId: number,
  ): Promise<RegistrationPeriod> {
    const existingPeriod = await this.prisma.registrationPeriod.findUnique({
      where: { period_id: periodId },
    });

    if (!existingPeriod) {
      throw new NotFoundException(`Registration period with ID ${periodId} not found`);
    }

    // Check if opening, ensure no other window is open for the same year/semester
    if (status === PeriodStatus.OPEN) {
      const activeWindow = await this.prisma.registrationPeriod.findFirst({
        where: {
          academic_year: existingPeriod.academic_year,
          semester: existingPeriod.semester,
          status: PeriodStatus.OPEN,
          NOT: { period_id: periodId },
        },
      });
      if (activeWindow) {
        throw new BadRequestException(
          `Another window is already open for Semester ${existingPeriod.semester} in ${existingPeriod.academic_year}`,
        );
      }
    }

    const period = await this.prisma.registrationPeriod.update({
      where: { period_id: periodId },
      data: { status },
    });

    await this.auditService.logAction(
      executorId,
      status === PeriodStatus.OPEN
        ? 'REGISTRATION_PERIOD_OPEN'
        : status === PeriodStatus.SUSPENDED
          ? 'REGISTRATION_PERIOD_SUSPEND'
          : 'REGISTRATION_PERIOD_CLOSE',
      'registration_periods',
      periodId.toString(),
      existingPeriod,
      period,
    );

    return period;
  }
}
