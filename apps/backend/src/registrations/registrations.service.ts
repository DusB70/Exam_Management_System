import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CourseRegistration } from '@prisma/client';
import { RegisterCoursesDto } from './dtos/registrations.dto';

@Injectable()
export class RegistrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getStudentByUserId(userId: number) {
    const student = await this.prisma.student.findUnique({
      where: { user_id: userId },
      include: { degree: true },
    });
    if (!student) {
      throw new NotFoundException(`Student profile not found for user ID ${userId}`);
    }
    return student;
  }

  async getActivePeriodForStudent(userId: number): Promise<any> {
    const student = await this.getStudentByUserId(userId);
    const now = new Date();

    const period = await this.prisma.registrationPeriod.findFirst({
      where: {
        academic_year: student.academic_year,
        status: 'OPEN',
        start_date: { lte: now },
        end_date: { gte: now },
      },
    });

    if (!period) return null;

    const limitObj = await this.prisma.degreeSemesterLimit.findFirst({
      where: {
        degree_id: student.degree_id,
        academic_year: period.academic_year,
        semester: period.semester,
      },
    });

    return {
      ...period,
      max_credits: limitObj ? limitObj.max_credits : 22.0,
    };
  }

  async getEligibleCourses(userId: number) {
    const student = await this.getStudentByUserId(userId);

    const activePeriod = await this.getActivePeriodForStudent(userId);
    if (!activePeriod) {
      return [];
    }

    // Get all courses offered for the student's degree, specialization, and semester
    const courses = await this.prisma.course.findMany({
      where: {
        degrees: {
          some: {
            degree_id: student.degree_id,
          },
        },
        semester: activePeriod.semester,
        OR: [{ specialization_id: null }, { specialization_id: student.specialization_id }],
      },
      include: {
        department: true,
        degrees: true,
        lecturers: {
          include: {
            lecturer: {
              include: {
                user: {
                  select: {
                    full_name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Get the student's already registered course IDs
    const registrations = await this.prisma.courseRegistration.findMany({
      where: { student_id: student.student_id },
      select: { course_id: true },
    });
    const registeredCourseIds = new Set(registrations.map((r) => r.course_id));

    // Filter courses that are not yet registered
    const filteredCourses = courses.filter((course) => !registeredCourseIds.has(course.course_id));

    return filteredCourses.map((course) => {
      const courseDegree = course.degrees.find((d) => d.degree_id === student.degree_id);
      return {
        ...course,
        is_compulsory: courseDegree ? courseDegree.status === 'COMPULSORY' : false,
      };
    });
  }

  async getMyRegistrations(userId: number) {
    const student = await this.getStudentByUserId(userId);

    return this.prisma.courseRegistration.findMany({
      where: { student_id: student.student_id },
      include: {
        course: {
          include: {
            department: true,
            degrees: {
              include: {
                degree: true,
              },
            },
            specialization: true,
            lecturers: {
              include: {
                lecturer: {
                  include: {
                    user: {
                      select: {
                        full_name: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  async registerCourses(userId: number, dto: RegisterCoursesDto): Promise<CourseRegistration[]> {
    const student = await this.getStudentByUserId(userId);
    const { courseIds } = dto;

    if (courseIds.length === 0) {
      throw new BadRequestException('No courses selected for registration.');
    }

    // 1. Verify Active Registration Period
    const period = await this.getActivePeriodForStudent(userId);
    if (!period) {
      throw new BadRequestException(
        `Registration window is closed or suspended for Year ${student.academic_year}`,
      );
    }

    // 2. Fetch Selected Courses & Validate details
    const selectedCourses = await this.prisma.course.findMany({
      where: {
        course_id: { in: courseIds },
      },
    });

    if (selectedCourses.length !== courseIds.length) {
      throw new BadRequestException('One or more of the selected courses do not exist.');
    }

    // Verify all selected courses match student's degree, specialization, and semester
    for (const course of selectedCourses) {
      const courseDegree = await this.prisma.courseDegree.findUnique({
        where: {
          course_id_degree_id: {
            course_id: course.course_id,
            degree_id: student.degree_id,
          },
        },
      });

      if (
        !courseDegree ||
        (course.specialization_id !== null &&
          course.specialization_id !== student.specialization_id) ||
        course.semester !== period.semester
      ) {
        throw new BadRequestException(
          `Course ${course.course_code} is not offered for your semester, degree, or specialization.`,
        );
      }
    }

    // 3. Verify Credit Hours Limits
    const currentRegistrations = await this.prisma.courseRegistration.findMany({
      where: { student_id: student.student_id },
      include: { course: true },
    });

    const existingCredits = currentRegistrations.reduce(
      (sum, reg) => sum + parseFloat(reg.course.credit_value.toString()),
      0,
    );
    const newCredits = selectedCourses.reduce(
      (sum, course) => sum + parseFloat(course.credit_value.toString()),
      0,
    );

    const totalCredits = existingCredits + newCredits;
    const maxCreditsAllowed = period.max_credits ?? 22.0;
    if (totalCredits > maxCreditsAllowed) {
      throw new BadRequestException(
        `Registration limits exceeded. Maximum credit load per semester is ${maxCreditsAllowed.toFixed(1)}. Selected: ${totalCredits.toFixed(1)}`,
      );
    }

    // 4. Register within a transaction
    return this.prisma.$transaction(async (tx) => {
      const results: CourseRegistration[] = [];

      for (const course of selectedCourses) {
        // Double check unique registration in transaction to prevent concurrent race conditions
        const exists = await tx.courseRegistration.findFirst({
          where: {
            student_id: student.student_id,
            course_id: course.course_id,
            attempt_number: 1,
          },
        });

        if (exists) {
          continue; // Skip if already registered
        }

        const registration = await tx.courseRegistration.create({
          data: {
            student_id: student.student_id,
            course_id: course.course_id,
            attempt_type:
              period.window_type === 'MEDICAL_REPEAT_REGISTRATION' ? 'REPEAT' : 'PROPER',
          },
        });

        await this.auditService.logAction(
          userId,
          'REGISTRATION_ADD',
          'course_registrations',
          registration.registration_id.toString(),
          null,
          registration,
        );

        results.push(registration);
      }

      return results;
    });
  }

  async dropCourse(userId: number, registrationId: number): Promise<CourseRegistration> {
    const student = await this.getStudentByUserId(userId);

    const registration = await this.prisma.courseRegistration.findUnique({
      where: { registration_id: registrationId },
      include: { course: true },
    });

    if (!registration) {
      throw new NotFoundException(`Registration record with ID ${registrationId} not found`);
    }

    if (registration.student_id !== student.student_id) {
      throw new BadRequestException('You do not own this course registration.');
    }

    // Verify window is active
    const period = await this.getActivePeriodForStudent(userId);
    if (!period) {
      throw new BadRequestException(
        'Cannot drop courses when the registration period is closed or suspended.',
      );
    }

    const result = await this.prisma.courseRegistration.delete({
      where: { registration_id: registrationId },
    });

    await this.auditService.logAction(
      userId,
      'REGISTRATION_DROP',
      'course_registrations',
      registrationId.toString(),
      registration,
      null,
    );

    return result;
  }

  // ==========================================
  // ADMINISTRATOR MANUAL OVERRIDES
  // ==========================================

  async getStudentRegistrationsForAdmin(studentId: number) {
    const student = await this.prisma.student.findUnique({
      where: { student_id: studentId },
      include: { user: true, degree: { include: { department: true } } },
    });
    if (!student) {
      throw new NotFoundException(`Student with ID ${studentId} not found`);
    }

    const registrations = await this.prisma.courseRegistration.findMany({
      where: { student_id: studentId },
      include: {
        course: {
          include: {
            department: true,
          },
        },
      },
    });

    return {
      student,
      registrations,
    };
  }

  async adminRegisterCourse(
    studentId: number,
    courseId: number,
    executorId: number,
  ): Promise<CourseRegistration> {
    const student = await this.prisma.student.findUnique({
      where: { student_id: studentId },
    });
    if (!student) {
      throw new NotFoundException(`Student with ID ${studentId} not found`);
    }

    const course = await this.prisma.course.findUnique({
      where: { course_id: courseId },
    });
    if (!course) {
      throw new NotFoundException(`Course with ID ${courseId} not found`);
    }

    // Check if duplicate
    const exists = await this.prisma.courseRegistration.findFirst({
      where: {
        student_id: studentId,
        course_id: courseId,
        attempt_number: 1,
      },
    });
    if (exists) {
      throw new BadRequestException('Student is already registered for this course.');
    }

    // Note: Admin manual overrides bypass semester matching, credit hour limit, and date checks!
    const registration = await this.prisma.courseRegistration.create({
      data: {
        student_id: studentId,
        course_id: courseId,
      },
    });

    await this.auditService.logAction(
      executorId,
      'REGISTRATION_ADMIN_FORCE',
      'course_registrations',
      registration.registration_id.toString(),
      null,
      registration,
    );

    return registration;
  }

  async adminDropCourse(
    studentId: number,
    courseId: number,
    executorId: number,
  ): Promise<CourseRegistration> {
    const registration = await this.prisma.courseRegistration.findFirst({
      where: {
        student_id: studentId,
        course_id: courseId,
      },
    });

    if (!registration) {
      throw new NotFoundException(
        `Registration for Student ${studentId} and Course ${courseId} not found`,
      );
    }

    const result = await this.prisma.courseRegistration.delete({
      where: {
        registration_id: registration.registration_id,
      },
    });

    await this.auditService.logAction(
      executorId,
      'REGISTRATION_ADMIN_DROP',
      'course_registrations',
      registration.registration_id.toString(),
      registration,
      null,
    );

    return result;
  }

  async getRepeatEligibleCourses(userId: number) {
    const student = await this.getStudentByUserId(userId);

    const allGrades = await this.prisma.studentCourseGrade.findMany({
      where: { student_id: student.student_id },
      include: { course: true },
    });

    const courseGradesMap = new Map<number, typeof allGrades>();
    for (const g of allGrades) {
      if (!courseGradesMap.has(g.course_id)) {
        courseGradesMap.set(g.course_id, []);
      }
      courseGradesMap.get(g.course_id)!.push(g);
    }

    const eligibleCourses: any[] = [];

    for (const grades of courseGradesMap.values()) {
      grades.sort((a, b) => b.attempt_number - a.attempt_number);

      const latestGrade = grades[0];
      const maxAttempt = grades.reduce((max, g) => Math.max(max, g.attempt_number), 0);
      const hasPassed = grades.some(
        (g) => g.grade_point >= 2.0 && !g.is_violated && g.grade !== 'VIOLATED',
      );

      if (!hasPassed && maxAttempt < 3) {
        const targetCourse = latestGrade.course;
        eligibleCourses.push({
          course_id: targetCourse.course_id,
          course_code: targetCourse.course_code,
          course_name: targetCourse.course_name,
          credit_value: parseFloat(targetCourse.credit_value.toString()),
          semester: targetCourse.semester,
          previous_grade: latestGrade.grade,
          previous_grade_point: latestGrade.grade_point,
          attempt_count: maxAttempt,
          next_attempt_number: maxAttempt + 1,
          max_allowed_grade: 'C',
          attempt_label: maxAttempt + 1 === 2 ? 'Repeat 1' : 'Repeat 2',
        });
      }
    }

    const activePeriod = await this.getActivePeriodForStudent(userId);

    return {
      activePeriod,
      eligibleCourses,
    };
  }

  async registerRepeatCourse(userId: number, courseId: number) {
    const student = await this.getStudentByUserId(userId);

    const course = await this.prisma.course.findUnique({
      where: { course_id: courseId },
    });
    if (!course) {
      throw new NotFoundException(`Course with ID ${courseId} not found.`);
    }

    const existingRegs = await this.prisma.courseRegistration.findMany({
      where: { student_id: student.student_id, course_id: courseId },
      orderBy: { attempt_number: 'desc' },
    });

    const maxAttempt = existingRegs.length > 0 ? existingRegs[0].attempt_number : 1;
    if (maxAttempt >= 3) {
      throw new BadRequestException('Maximum repeat attempts (3) already reached for this course.');
    }

    const nextAttempt = maxAttempt + 1;
    const attemptType = nextAttempt === 2 ? 'REPEAT_1' : 'REPEAT_2';

    const registration = await this.prisma.courseRegistration.create({
      data: {
        student_id: student.student_id,
        course_id: courseId,
        attempt_number: nextAttempt,
        attempt_type: attemptType,
        is_held: false,
      },
    });

    await this.prisma.studentCourseGrade.create({
      data: {
        student_id: student.student_id,
        course_id: courseId,
        attempt_number: nextAttempt,
        attempt_type: attemptType,
        max_allowed_grade: 'C',
        grade: 'Pending',
        grade_point: 0.0,
      },
    });

    await this.auditService.logAction(
      userId,
      'REPEAT_EXAM_REGISTER',
      'course_registrations',
      registration.registration_id.toString(),
      null,
      { studentId: student.student_id, courseId, nextAttempt, attemptType },
    );

    return registration;
  }
}
