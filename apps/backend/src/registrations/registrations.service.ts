import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CourseRegistration, RegistrationPeriod } from '@prisma/client';
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
      include: { department: true },
    });
    if (!student) {
      throw new NotFoundException(`Student profile not found for user ID ${userId}`);
    }
    return student;
  }

  async getActivePeriodForStudent(userId: number): Promise<RegistrationPeriod | null> {
    const student = await this.getStudentByUserId(userId);
    const now = new Date();

    return this.prisma.registrationPeriod.findFirst({
      where: {
        academic_year: student.academic_year,
        semester: student.semester,
        status: 'OPEN',
        start_date: { lte: now },
        end_date: { gte: now },
      },
    });
  }

  async getEligibleCourses(userId: number) {
    const student = await this.getStudentByUserId(userId);

    // Get all courses offered for the student's department, semester, and year
    const courses = await this.prisma.course.findMany({
      where: {
        department_id: student.department_id,
        semester: student.semester,
        academic_year: student.academic_year,
      },
      include: {
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
    return courses.filter((course) => !registeredCourseIds.has(course.course_id));
  }

  async getMyRegistrations(userId: number) {
    const student = await this.getStudentByUserId(userId);

    return this.prisma.courseRegistration.findMany({
      where: { student_id: student.student_id },
      include: {
        course: {
          include: {
            department: true,
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
        `Registration window is closed or suspended for Year ${student.academic_year} Semester ${student.semester}`,
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

    // Verify all selected courses match student's current academic year, semester, and department
    for (const course of selectedCourses) {
      if (
        course.department_id !== student.department_id ||
        course.semester !== student.semester ||
        course.academic_year !== student.academic_year
      ) {
        throw new BadRequestException(
          `Course ${course.course_code} is not offered for your semester, academic year, or department.`,
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
    if (totalCredits > 22.0) {
      throw new BadRequestException(
        `Registration limits exceeded. Maximum credit load per semester is 22.0. Selected: ${totalCredits.toFixed(1)}`,
      );
    }

    // 4. Register within a transaction
    return this.prisma.$transaction(async (tx) => {
      const results: CourseRegistration[] = [];

      for (const course of selectedCourses) {
        // Double check unique registration in transaction to prevent concurrent race conditions
        const exists = await tx.courseRegistration.findUnique({
          where: {
            unique_student_course: {
              student_id: student.student_id,
              course_id: course.course_id,
            },
          },
        });

        if (exists) {
          continue; // Skip if already registered
        }

        const registration = await tx.courseRegistration.create({
          data: {
            student_id: student.student_id,
            course_id: course.course_id,
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
      include: { user: true, department: true },
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
    const exists = await this.prisma.courseRegistration.findUnique({
      where: {
        unique_student_course: {
          student_id: studentId,
          course_id: courseId,
        },
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
    const registration = await this.prisma.courseRegistration.findUnique({
      where: {
        unique_student_course: {
          student_id: studentId,
          course_id: courseId,
        },
      },
    });

    if (!registration) {
      throw new NotFoundException(
        `Registration for Student ${studentId} and Course ${courseId} not found`,
      );
    }

    const result = await this.prisma.courseRegistration.delete({
      where: {
        unique_student_course: {
          student_id: studentId,
          course_id: courseId,
        },
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
}
