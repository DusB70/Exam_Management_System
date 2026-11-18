import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateCourseDto, UpdateCourseDto, AssignMarkersDto } from './dtos/courses.dto';
import { CreatePeriodDto, PeriodStatus } from './dtos/registration-periods.dto';
import { Prisma, Course, RegistrationPeriod } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private isEligibleForSpecialization(sem?: string): boolean {
    return Boolean(sem && sem !== '1.1' && sem !== '1.2');
  }

  private async enrichCoursesWithAllocationDetails(courses: any[]) {
    if (!courses || courses.length === 0) return courses;

    const lecturerIdsToFetch = new Set<number>();
    for (const c of courses) {
      const cfg = (c.marks_config as any) || {};
      if (cfg.inChargeLecturerId) {
        lecturerIdsToFetch.add(Number(cfg.inChargeLecturerId));
      }
      if (Array.isArray(cfg.additionalFirstMarkers)) {
        for (const m of cfg.additionalFirstMarkers) {
          if (m?.type === 'INTERNAL' && m?.lecturerId) {
            lecturerIdsToFetch.add(Number(m.lecturerId));
          }
        }
      }
    }

    const lecturerMap = new Map<number, any>();
    if (lecturerIdsToFetch.size > 0) {
      const lecturers = await this.prisma.lecturer.findMany({
        where: { lecturer_id: { in: Array.from(lecturerIdsToFetch) } },
        include: {
          user: { select: { full_name: true, email: true } },
          department: {
            select: {
              department_id: true,
              department_code: true,
              department_name: true,
            },
          },
        },
      });
      for (const l of lecturers) {
        lecturerMap.set(l.lecturer_id, l);
      }
    }

    return courses.map((c) => {
      const cfg = (c.marks_config as any) || {};
      const isSameAsInCharge =
        cfg.isFirstMarkerSameAsInCharge !== undefined
          ? Boolean(cfg.isFirstMarkerSameAsInCharge)
          : true;

      const inChargeLecturerId =
        cfg.inChargeLecturerId !== undefined
          ? cfg.inChargeLecturerId
            ? Number(cfg.inChargeLecturerId)
            : null
          : isSameAsInCharge && c.first_marker_type !== 'EXTERNAL'
            ? c.first_marker_lecturer_id || null
            : null;

      const inChargeLecturer = inChargeLecturerId
        ? lecturerMap.get(inChargeLecturerId) ||
          (c.first_marker_lecturer_id === inChargeLecturerId ? c.first_marker_lecturer : null) ||
          c.lecturers?.find((cl: any) => cl.lecturer_id === inChargeLecturerId)?.lecturer ||
          null
        : null;

      const rawAdditional = Array.isArray(cfg.additionalFirstMarkers)
        ? cfg.additionalFirstMarkers
        : [];
      const additionalFirstMarkers = rawAdditional.map((m: any, idx: number) => {
        const lecId = m?.lecturerId ? Number(m.lecturerId) : null;
        const lecObj = m?.type === 'INTERNAL' && lecId ? lecturerMap.get(lecId) || null : null;
        return {
          id: m?.id || `add-fm-${idx}`,
          type: m?.type || 'INTERNAL',
          lecturerId: lecId,
          name:
            m?.type === 'INTERNAL' ? lecObj?.user?.full_name || m?.name || null : m?.name || null,
          email:
            m?.type === 'INTERNAL' ? lecObj?.user?.email || m?.email || null : m?.email || null,
          lecturer: lecObj,
        };
      });

      return {
        ...c,
        is_first_marker_same_as_in_charge: isSameAsInCharge,
        in_charge_lecturer_id: inChargeLecturerId,
        in_charge_lecturer: inChargeLecturer,
        additional_first_markers: additionalFirstMarkers,
      };
    });
  }

  async findAll(
    page: number,
    limit: number,
    search?: string,
    departmentId?: number,
    semester?: string,
    academicYear?: number,
    degreeId?: number,
    specializationId?: number,
    status?: string,
  ) {
    const conditions: Prisma.CourseWhereInput[] = [];

    if (search) {
      conditions.push({
        OR: [
          { course_code: { contains: search, mode: 'insensitive' } },
          { course_name: { contains: search, mode: 'insensitive' } },
          { department: { department_name: { contains: search, mode: 'insensitive' } } },
          { department: { department_code: { contains: search, mode: 'insensitive' } } },
        ],
      });
    }

    if (departmentId) {
      conditions.push({ department_id: departmentId });
    }

    if (degreeId && !status) {
      conditions.push({
        OR: [
          { degrees: { some: { degree_id: degreeId } } },
          { course_specializations: { some: { specialization: { degree_id: degreeId } } } },
          { specialization: { degree_id: degreeId } },
        ],
      });
    }

    if (specializationId) {
      conditions.push({
        OR: [
          { specialization_id: specializationId },
          { course_specializations: { some: { specialization_id: specializationId } } },
        ],
      });
    }

    if (semester) {
      conditions.push({ semester });
    }

    if (status) {
      const normStatus = status.trim().toUpperCase();
      const isOpt = normStatus.startsWith('OPT') || normStatus === 'O';
      const statusValues = isOpt
        ? ['OPTIONAL', 'Optional', 'optional', 'O', 'o', 'Opt', 'opt']
        : ['COMPULSORY', 'Compulsory', 'compulsory', 'C', 'c', 'Comp', 'comp'];

      const statusFilterCondition = {
        in: statusValues,
        mode: 'insensitive' as const,
      };

      if (degreeId) {
        conditions.push({
          OR: [
            {
              degrees: {
                some: {
                  degree_id: degreeId,
                  status: statusFilterCondition,
                },
              },
            },
            {
              course_specializations: {
                some: {
                  specialization: { degree_id: degreeId },
                  status: statusFilterCondition,
                },
              },
            },
            {
              specialization: {
                degree_id: degreeId,
              },
              course_specializations: {
                some: {
                  status: statusFilterCondition,
                },
              },
            },
          ],
        });
      } else {
        conditions.push({
          OR: [
            {
              degrees: {
                some: {
                  status: statusFilterCondition,
                },
              },
            },
            {
              course_specializations: {
                some: {
                  status: statusFilterCondition,
                },
              },
            },
          ],
        });
      }
    }

    const where: Prisma.CourseWhereInput = conditions.length > 0 ? { AND: conditions } : {};

    const [items, total] = await this.prisma.$transaction([
      this.prisma.course.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          department: true,
          degrees: {
            include: {
              degree: true,
            },
          },
          specialization: {
            include: {
              degree: true,
            },
          },
          course_specializations: {
            include: {
              specialization: {
                include: {
                  degree: true,
                },
              },
            },
          },
          lecturers: {
            include: {
              lecturer: {
                include: {
                  user: {
                    select: {
                      full_name: true,
                      email: true,
                    },
                  },
                },
              },
            },
          },
          first_marker_lecturer: {
            include: {
              user: {
                select: {
                  full_name: true,
                  email: true,
                },
              },
            },
          },
          second_marker_lecturer: {
            include: {
              user: {
                select: {
                  full_name: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: [{ semester: 'asc' }, { course_code: 'asc' }],
      }),
      this.prisma.course.count({ where }),
    ]);

    const enrichedItems = await this.enrichCoursesWithAllocationDetails(items);

    return {
      items: enrichedItems,
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
        degrees: {
          include: {
            degree: true,
          },
        },
        specialization: {
          include: {
            degree: true,
          },
        },
        course_specializations: {
          include: {
            specialization: {
              include: {
                degree: true,
              },
            },
          },
        },
        lecturers: {
          include: {
            lecturer: {
              include: {
                user: true,
              },
            },
          },
        },
        first_marker_lecturer: {
          include: {
            user: {
              select: {
                full_name: true,
                email: true,
              },
            },
          },
        },
        second_marker_lecturer: {
          include: {
            user: {
              select: {
                full_name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }

    const [enriched] = await this.enrichCoursesWithAllocationDetails([course]);
    return enriched;
  }

  async create(createCourseDto: CreateCourseDto, executorId: number): Promise<Course> {
    const {
      courseCode,
      courseName,
      creditValue,
      departmentId,
      degrees,
      specializationId,
      specializations,
      semester,
      lecturerId,
    } = createCourseDto;

    // Verify course code unique
    const codeExists = await this.prisma.course.findUnique({
      where: { course_code: courseCode },
    });
    if (codeExists) {
      throw new BadRequestException(`Course code ${courseCode} is already in use`);
    }

    // Verify department exists
    const deptObj = await this.prisma.department.findUnique({
      where: { department_id: departmentId },
    });
    if (!deptObj) {
      throw new NotFoundException(`Department with ID ${departmentId} not found`);
    }

    const isEligible = this.isEligibleForSpecialization(semester);
    const primarySpecId = isEligible
      ? specializations && specializations.length > 0
        ? specializations[0].specializationId
        : specializationId || null
      : null;

    const course = await this.prisma.$transaction(async (tx) => {
      const newCourse = await tx.course.create({
        data: {
          course_code: courseCode,
          course_name: courseName,
          credit_value: new Prisma.Decimal(creditValue),
          department_id: departmentId,
          specialization_id: primarySpecId,
          semester,
          degrees: {
            create: degrees.map((d: any) => ({
              degree_id: d.degreeId,
              status: d.status,
            })),
          },
          ...(isEligible && specializations && specializations.length > 0
            ? {
                course_specializations: {
                  create: specializations.map((s: any) => ({
                    specialization_id: s.specializationId,
                    status: s.status,
                  })),
                },
              }
            : {}),
        },
      });

      if (lecturerId) {
        const lecturer = await tx.lecturer.findUnique({
          where: { lecturer_id: lecturerId },
        });
        if (!lecturer) {
          throw new NotFoundException(`Lecturer with ID ${lecturerId} not found`);
        }

        await tx.courseLecturer.create({
          data: {
            course_id: newCourse.course_id,
            lecturer_id: lecturerId,
          },
        });
      }

      // Create default End Semester Examination assessment with 100% weight
      const defaultExam = await tx.exam.create({
        data: {
          course_id: newCourse.course_id,
          exam_type: 'FINAL',
          exam_title: 'End Semester Examination',
          total_marks: 100,
          exam_date: new Date(),
          start_time: new Date(1970, 0, 1, 9, 0, 0),
          end_time: new Date(1970, 0, 1, 12, 0, 0),
        },
      });

      await tx.course.update({
        where: { course_id: newCourse.course_id },
        data: {
          marks_config: {
            weights: { [defaultExam.exam_id]: 100 },
            contributes: { [defaultExam.exam_id]: true },
          },
        },
      });

      return newCourse;
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
    const {
      courseCode,
      courseName,
      creditValue,
      departmentId,
      degrees,
      specializationId,
      specializations,
      semester,
      lecturerId,
    } = updateCourseDto;

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
    if (semester) updateData.semester = semester;

    if (departmentId) {
      updateData.department = { connect: { department_id: departmentId } };
    }

    const targetSemester = semester || existingCourse.semester;
    const canHaveSpecialization = this.isEligibleForSpecialization(targetSemester);

    if (!canHaveSpecialization) {
      if (existingCourse.specialization_id) {
        updateData.specialization = { disconnect: true };
      }
    } else if (specializations !== undefined) {
      if (specializations.length > 0) {
        updateData.specialization = {
          connect: { specialization_id: specializations[0].specializationId },
        };
      } else if (existingCourse.specialization_id) {
        updateData.specialization = { disconnect: true };
      }
    } else if (specializationId !== undefined) {
      if (specializationId === null || specializationId === 0) {
        if (existingCourse.specialization_id) {
          updateData.specialization = { disconnect: true };
        }
      } else {
        updateData.specialization = { connect: { specialization_id: specializationId } };
      }
    }

    const course = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.course.update({
        where: { course_id: id },
        data: updateData,
      });

      if (!canHaveSpecialization) {
        await tx.courseSpecialization.deleteMany({
          where: { course_id: id },
        });
      } else if (specializations !== undefined) {
        await tx.courseSpecialization.deleteMany({
          where: { course_id: id },
        });

        if (specializations.length > 0) {
          await tx.courseSpecialization.createMany({
            data: specializations.map((s: any) => ({
              course_id: id,
              specialization_id: s.specializationId,
              status: s.status,
            })),
          });
        }
      }

      if (degrees !== undefined) {
        // Clear previous degree assignments for this course
        await tx.courseDegree.deleteMany({
          where: { course_id: id },
        });

        if (degrees.length > 0) {
          await tx.courseDegree.createMany({
            data: degrees.map((d: any) => ({
              course_id: id,
              degree_id: d.degreeId,
              status: d.status,
            })),
          });
        }
      }

      if (lecturerId !== undefined) {
        // Clear previous lecturer assignments for this course
        await tx.courseLecturer.deleteMany({
          where: { course_id: id },
        });

        if (lecturerId) {
          const lecturer = await tx.lecturer.findUnique({
            where: { lecturer_id: lecturerId },
          });
          if (!lecturer) {
            throw new NotFoundException(`Lecturer with ID ${lecturerId} not found`);
          }
          await tx.courseLecturer.create({
            data: {
              course_id: id,
              lecturer_id: lecturerId,
            },
          });
        }
      }

      return updated;
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
        batch: createPeriodDto.batch || undefined,
        semester,
        window_type: createPeriodDto.windowType || 'SEMESTER_REGISTRATION',
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

    if (period.status === PeriodStatus.OPEN) {
      this.notificationsService.sendRegistrationOpenedNotifications(
        period.academic_year,
        period.semester,
        period.end_date,
      );
    }

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

    if (status === PeriodStatus.OPEN) {
      this.notificationsService.sendRegistrationOpenedNotifications(
        period.academic_year,
        period.semester,
        period.end_date,
      );
    }

    return period;
  }

  async updatePeriodEndDate(
    periodId: number,
    endDate: string,
    executorId: number,
  ): Promise<RegistrationPeriod> {
    const existingPeriod = await this.prisma.registrationPeriod.findUnique({
      where: { period_id: periodId },
    });

    if (!existingPeriod) {
      throw new NotFoundException(`Registration period with ID ${periodId} not found`);
    }

    const newEnd = new Date(endDate);
    if (newEnd <= existingPeriod.start_date) {
      throw new BadRequestException('End date must be strictly after the start date');
    }

    const updated = await this.prisma.registrationPeriod.update({
      where: { period_id: periodId },
      data: { end_date: newEnd },
    });

    await this.auditService.logAction(
      executorId,
      'REGISTRATION_PERIOD_UPDATE_ENDDATE',
      'registration_periods',
      periodId.toString(),
      existingPeriod,
      updated,
    );

    return updated;
  }

  async deletePeriod(periodId: number, executorId: number): Promise<RegistrationPeriod> {
    const existingPeriod = await this.prisma.registrationPeriod.findUnique({
      where: { period_id: periodId },
    });

    if (!existingPeriod) {
      throw new NotFoundException(`Registration period with ID ${periodId} not found`);
    }

    const deleted = await this.prisma.registrationPeriod.delete({
      where: { period_id: periodId },
    });

    await this.auditService.logAction(
      executorId,
      'REGISTRATION_PERIOD_DELETE',
      'registration_periods',
      periodId.toString(),
      existingPeriod,
      null,
    );

    return deleted;
  }

  async setCourseLecturer(
    courseId: number,
    lecturerId: number | null | undefined,
    executorId: number,
  ) {
    const existingCourse = await this.findOne(courseId);

    if (lecturerId) {
      const lecturer = await this.prisma.lecturer.findUnique({
        where: { lecturer_id: lecturerId },
      });
      if (!lecturer) {
        throw new NotFoundException(`Lecturer with ID ${lecturerId} not found`);
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.courseLecturer.deleteMany({
        where: { course_id: courseId },
      });

      if (lecturerId) {
        await tx.courseLecturer.create({
          data: {
            course_id: courseId,
            lecturer_id: lecturerId,
          },
        });
      }
    });

    const updated = await this.findOne(courseId);

    await this.auditService.logAction(
      executorId,
      'COURSE_SET_LECTURER',
      'course_lecturers',
      courseId.toString(),
      existingCourse,
      updated,
    );

    return updated;
  }

  async setCourseInCharge(
    courseId: number,
    inChargeLecturerId: number | null | undefined,
    executorId: number,
  ) {
    const course = await this.prisma.course.findUnique({
      where: { course_id: courseId },
    });

    if (!course) {
      throw new NotFoundException(`Course with ID ${courseId} not found`);
    }

    if (inChargeLecturerId) {
      const lecturer = await this.prisma.lecturer.findUnique({
        where: { lecturer_id: inChargeLecturerId },
      });
      if (!lecturer) {
        throw new NotFoundException(`Lecturer with ID ${inChargeLecturerId} not found`);
      }
    }

    const existingConfig =
      course.marks_config && typeof course.marks_config === 'object'
        ? { ...(course.marks_config as Record<string, any>) }
        : {};

    const normalizedInChargeId = inChargeLecturerId ? Number(inChargeLecturerId) : null;

    // Determine whether 1st marker and in-charge are the same based on current 1st marker
    let isSameAsInCharge =
      existingConfig.isFirstMarkerSameAsInCharge !== undefined
        ? Boolean(existingConfig.isFirstMarkerSameAsInCharge)
        : true;

    const hasPrimaryFirstMarker = Boolean(
      course.first_marker_lecturer_id || course.first_marker_name,
    );

    if (hasPrimaryFirstMarker) {
      if (
        course.first_marker_type !== 'EXTERNAL' &&
        course.first_marker_lecturer_id &&
        normalizedInChargeId &&
        course.first_marker_lecturer_id === normalizedInChargeId
      ) {
        isSameAsInCharge = true;
      } else {
        isSameAsInCharge = false;
      }
    }

    const updatedConfig = {
      ...existingConfig,
      inChargeLecturerId: normalizedInChargeId,
      isFirstMarkerSameAsInCharge: isSameAsInCharge,
    };

    await this.prisma.course.update({
      where: { course_id: courseId },
      data: {
        marks_config: updatedConfig as any,
      },
    });

    const updated = await this.findOne(courseId);

    await this.auditService.logAction(
      executorId,
      'COURSE_SET_IN_CHARGE',
      'courses',
      courseId.toString(),
      course,
      updated,
    );

    return updated;
  }

  async assignCourseMarkers(courseId: number, dto: AssignMarkersDto, executorId: number) {
    const course = await this.prisma.course.findUnique({
      where: { course_id: courseId },
    });

    if (!course) {
      throw new NotFoundException(`Course with ID ${courseId} not found`);
    }

    const existingConfig =
      course.marks_config && typeof course.marks_config === 'object'
        ? { ...(course.marks_config as Record<string, any>) }
        : {};

    const isSameAsInCharge =
      dto.isFirstMarkerSameAsInCharge !== undefined
        ? Boolean(dto.isFirstMarkerSameAsInCharge)
        : existingConfig.isFirstMarkerSameAsInCharge !== undefined
          ? Boolean(existingConfig.isFirstMarkerSameAsInCharge)
          : true;

    // Primary 1st marker fields — explicitly allow clearing to null without shifting 2nd marker or additional 1st markers
    const hasFirstMarkerInternal =
      dto.firstMarkerType === 'INTERNAL' && Boolean(dto.firstMarkerLecturerId);
    const hasFirstMarkerExternal =
      dto.firstMarkerType === 'EXTERNAL' && Boolean(dto.firstMarkerName?.trim());

    const firstMarkerType = hasFirstMarkerInternal
      ? 'INTERNAL'
      : hasFirstMarkerExternal
        ? 'EXTERNAL'
        : null;
    const firstMarkerLecturerId = hasFirstMarkerInternal ? Number(dto.firstMarkerLecturerId) : null;
    const firstMarkerName = hasFirstMarkerExternal ? dto.firstMarkerName!.trim() : null;
    const firstMarkerEmail = hasFirstMarkerExternal ? dto.firstMarkerEmail?.trim() || null : null;

    // 2nd marker fields — completely independent from 1st marker
    const hasSecondMarkerInternal =
      dto.secondMarkerType === 'INTERNAL' && Boolean(dto.secondMarkerLecturerId);
    const hasSecondMarkerExternal =
      dto.secondMarkerType === 'EXTERNAL' && Boolean(dto.secondMarkerName?.trim());

    const secondMarkerType = hasSecondMarkerInternal
      ? 'INTERNAL'
      : hasSecondMarkerExternal
        ? 'EXTERNAL'
        : null;
    const secondMarkerLecturerId = hasSecondMarkerInternal
      ? Number(dto.secondMarkerLecturerId)
      : null;
    const secondMarkerName = hasSecondMarkerExternal ? dto.secondMarkerName!.trim() : null;
    const secondMarkerEmail = hasSecondMarkerExternal
      ? dto.secondMarkerEmail?.trim() || null
      : null;

    // Resolve In-Charge Lecturer ID
    let inChargeLecturerId: number | null =
      existingConfig.inChargeLecturerId !== undefined
        ? existingConfig.inChargeLecturerId
          ? Number(existingConfig.inChargeLecturerId)
          : null
        : course.first_marker_type !== 'EXTERNAL' && course.first_marker_lecturer_id
          ? course.first_marker_lecturer_id
          : null;

    if (dto.inChargeLecturerId !== undefined) {
      inChargeLecturerId = dto.inChargeLecturerId ? Number(dto.inChargeLecturerId) : null;
    } else if (isSameAsInCharge && firstMarkerLecturerId) {
      inChargeLecturerId = firstMarkerLecturerId;
    }

    // Resolve Additional 1st Markers
    let additionalFirstMarkers = Array.isArray(existingConfig.additionalFirstMarkers)
      ? existingConfig.additionalFirstMarkers
      : [];

    if (dto.additionalFirstMarkers !== undefined) {
      additionalFirstMarkers = (dto.additionalFirstMarkers || [])
        .filter((m) => {
          if (m.type === 'INTERNAL') return Boolean(m.lecturerId);
          if (m.type === 'EXTERNAL') return Boolean(m.name && m.name.trim());
          return false;
        })
        .map((m, idx) => ({
          id: m.id || `add-fm-${Date.now()}-${idx}`,
          type: m.type === 'EXTERNAL' ? 'EXTERNAL' : 'INTERNAL',
          lecturerId: m.type === 'INTERNAL' && m.lecturerId ? Number(m.lecturerId) : null,
          name: m.type === 'EXTERNAL' && m.name ? m.name.trim() : null,
          email: m.type === 'EXTERNAL' && m.email ? m.email.trim() : null,
        }));
    }

    const updatedConfig = {
      ...existingConfig,
      isFirstMarkerSameAsInCharge: isSameAsInCharge,
      inChargeLecturerId,
      additionalFirstMarkers,
    };

    await this.prisma.course.update({
      where: { course_id: courseId },
      data: {
        first_marker_type: firstMarkerType,
        first_marker_lecturer_id: firstMarkerLecturerId,
        first_marker_name: firstMarkerName,
        first_marker_email: firstMarkerEmail,
        second_marker_type: secondMarkerType,
        second_marker_lecturer_id: secondMarkerLecturerId,
        second_marker_name: secondMarkerName,
        second_marker_email: secondMarkerEmail,
        marks_config: updatedConfig as any,
      },
    });

    const updated = await this.findOne(courseId);

    await this.auditService.logAction(
      executorId,
      'COURSE_ASSIGN_MARKERS',
      'courses',
      courseId.toString(),
      course,
      updated,
    );

    return updated;
  }
}
