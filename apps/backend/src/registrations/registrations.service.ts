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

  async getActivePeriodForStudent(
    userId: number,
    windowType: string = 'SEMESTER_REGISTRATION',
  ): Promise<any> {
    const student = await this.getStudentByUserId(userId);
    const now = new Date();

    const period = await this.prisma.registrationPeriod.findFirst({
      where: {
        status: 'OPEN',
        start_date: { lte: now },
        end_date: { gte: now },
        window_type: windowType,
        OR: student.batch ? [{ batch: student.batch }, { batch: null }] : undefined,
      },
    });

    if (!period) return null;

    // Check if student has progression hold
    if (
      student.progression_status === 'HOLD_REMEDIATION' ||
      student.progression_status === 'HOLD_BATCH_DEMOTION'
    ) {
      return null;
    }

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
        OR: [
          {
            AND: [{ specialization_id: null }, { course_specializations: { none: {} } }],
          },
          ...(student.specialization_id
            ? [
                {
                  course_specializations: {
                    some: {
                      specialization_id: student.specialization_id,
                    },
                  },
                },
                { specialization_id: student.specialization_id },
              ]
            : []),
        ],
      },
      include: {
        department: true,
        degrees: true,
        course_specializations: true,
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
      let isCompulsory = false;
      const specMatch = student.specialization_id
        ? course.course_specializations?.find(
            (cs: any) => cs.specialization_id === student.specialization_id,
          )
        : null;

      if (specMatch) {
        isCompulsory = specMatch.status === 'COMPULSORY';
      } else {
        const courseDegree = course.degrees.find((d) => d.degree_id === student.degree_id);
        isCompulsory = courseDegree ? courseDegree.status === 'COMPULSORY' : false;
      }

      return {
        ...course,
        is_compulsory: isCompulsory,
      };
    });
  }

  async getMyRegistrations(userId: number) {
    const student = await this.getStudentByUserId(userId);

    const registrations = await this.prisma.courseRegistration.findMany({
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
            course_specializations: true,
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

    return registrations
      .map((reg) => {
        let isCompulsory = false;
        const specMatch = student.specialization_id
          ? reg.course.course_specializations?.find(
              (cs: any) => cs.specialization_id === student.specialization_id,
            )
          : null;

        if (specMatch) {
          isCompulsory = specMatch.status === 'COMPULSORY';
        } else {
          const courseDegree = reg.course.degrees?.find(
            (d: any) => d.degree_id === student.degree_id,
          );
          isCompulsory = courseDegree ? courseDegree.status === 'COMPULSORY' : false;
        }

        return {
          ...reg,
          is_compulsory: isCompulsory,
        };
      })
      .sort((a, b) => {
        if (a.is_compulsory && !b.is_compulsory) return -1;
        if (!a.is_compulsory && b.is_compulsory) return 1;
        return 0;
      });
  }

  async registerCourses(userId: number, dto: RegisterCoursesDto): Promise<CourseRegistration[]> {
    const student = await this.getStudentByUserId(userId);
    const rawCourseIds = dto.courseIds || [];
    const courseIds = Array.from(new Set(rawCourseIds.map(Number)));

    if (courseIds.length === 0) {
      throw new BadRequestException('No courses selected for registration.');
    }

    if (
      student.progression_status === 'HOLD_REMEDIATION' ||
      student.progression_status === 'HOLD_BATCH_DEMOTION'
    ) {
      throw new BadRequestException(
        'Registration is suspended: Your academic progression is currently on hold.',
      );
    }

    // 1. Verify Active Registration Period
    const period = await this.getActivePeriodForStudent(userId, 'SEMESTER_REGISTRATION');
    if (!period) {
      throw new BadRequestException(
        `Registration window is closed or suspended for Enrollment Year ${student.batch || '21/22'}`,
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

      const courseSpecializations = await this.prisma.courseSpecialization.findMany({
        where: { course_id: course.course_id },
      });

      let matchesSpecialization = true;
      if (courseSpecializations.length > 0) {
        matchesSpecialization = student.specialization_id
          ? courseSpecializations.some((cs) => cs.specialization_id === student.specialization_id)
          : false;
      } else if (course.specialization_id !== null) {
        matchesSpecialization = course.specialization_id === student.specialization_id;
      }

      if (!courseDegree || !matchesSpecialization || course.semester !== period.semester) {
        throw new BadRequestException(
          `Course ${course.course_code} is not offered for your semester, degree, or specialization.`,
        );
      }
    }

    // 3. Verify Compulsory Courses Are Included
    // Students cannot remove or omit compulsory subjects offered for the semester
    const eligibleCourses = await this.getEligibleCourses(userId);
    const eligibleCompulsoryCourseIds = eligibleCourses
      .filter((c) => c.is_compulsory)
      .map((c) => c.course_id);

    const missingCompulsory = eligibleCompulsoryCourseIds.filter(
      (compulsoryId) => !courseIds.includes(compulsoryId),
    );

    if (missingCompulsory.length > 0) {
      throw new BadRequestException(
        'Compulsory courses cannot be removed and must be included in your registration.',
      );
    }

    // 4. Register within a transaction (increased timeout for multiple courses)
    const results = await this.prisma.$transaction(
      async (tx) => {
        const created: CourseRegistration[] = [];

        for (const course of selectedCourses) {
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

          created.push(registration);
        }

        return created;
      },
      { timeout: 30000, maxWait: 10000 },
    );

    // 5. Audit logs safely recorded outside the database transaction
    for (const reg of results) {
      try {
        await this.auditService.logAction(
          userId,
          'REGISTRATION_ADD',
          'course_registrations',
          reg.registration_id.toString(),
          null,
          reg,
        );
      } catch {
        // Logging error should not interrupt client registration
      }
    }

    return results;
  }

  async dropCourse(userId: number, registrationId: number): Promise<CourseRegistration> {
    const student = await this.getStudentByUserId(userId);

    const registration = await this.prisma.courseRegistration.findUnique({
      where: { registration_id: registrationId },
      include: {
        course: {
          include: {
            degrees: true,
            course_specializations: true,
          },
        },
      },
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

    // Compulsory courses cannot be dropped by students
    let isCompulsory = false;
    const specMatch = student.specialization_id
      ? registration.course.course_specializations?.find(
          (cs) => cs.specialization_id === student.specialization_id,
        )
      : null;

    if (specMatch) {
      isCompulsory = specMatch.status === 'COMPULSORY';
    } else {
      const courseDegree = registration.course.degrees?.find(
        (d) => d.degree_id === student.degree_id,
      );
      isCompulsory = courseDegree ? courseDegree.status === 'COMPULSORY' : false;
    }

    if (isCompulsory) {
      throw new BadRequestException('Compulsory courses cannot be dropped.');
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

    const activePeriod = await this.getActivePeriodForStudent(
      userId,
      'MEDICAL_REPEAT_REGISTRATION',
    );

    return {
      activePeriod,
      eligibleCourses,
    };
  }

  async registerRepeatCourse(userId: number, courseId: number) {
    const student = await this.getStudentByUserId(userId);

    const activePeriod = await this.getActivePeriodForStudent(
      userId,
      'MEDICAL_REPEAT_REGISTRATION',
    );
    if (!activePeriod) {
      throw new BadRequestException(
        'Repeat / Medical exam registration window is currently closed.',
      );
    }

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

  // ==========================================
  // BATCH ENROLLMENT MONITOR FOR STAFF / ADMIN
  // ==========================================

  async getEnrollmentMonitor(filter: {
    batch?: string;
    semester?: string;
    degreeId?: number;
    departmentId?: number;
  }) {
    const { batch, semester, degreeId, departmentId } = filter;

    const whereStudent: any = {};
    if (batch && batch !== 'ALL' && batch !== '') {
      whereStudent.batch = batch;
    }
    if (degreeId && !isNaN(degreeId) && degreeId > 0) {
      whereStudent.degree_id = degreeId;
    }
    if (departmentId && !isNaN(departmentId) && departmentId > 0) {
      whereStudent.degree = { department_id: departmentId };
    }

    // Determine active semester
    let activeSemester = semester && semester !== 'ALL' && semester !== '' ? semester : '';
    if (!activeSemester) {
      if (batch && batch !== 'ALL' && batch !== '') {
        const latestPeriod = await this.prisma.registrationPeriod.findFirst({
          where: { batch },
          orderBy: { end_date: 'desc' },
        });
        activeSemester = latestPeriod ? latestPeriod.semester : '1.1';
      } else {
        const anyPeriod = await this.prisma.registrationPeriod.findFirst({
          where: { status: 'OPEN' },
          orderBy: { end_date: 'desc' },
        });
        activeSemester = anyPeriod ? anyPeriod.semester : '1.1';
      }
    }

    // Courses offered in this active semester matching degree/department
    const whereCourse: any = { semester: activeSemester };
    if (departmentId && !isNaN(departmentId) && departmentId > 0) {
      whereCourse.department_id = departmentId;
    }
    if (degreeId && !isNaN(degreeId) && degreeId > 0) {
      whereCourse.degrees = {
        some: { degree_id: degreeId },
      };
    }
    const offeredCoursesCount = await this.prisma.course.count({
      where: whereCourse,
    });

    // Students matching filter
    const students = await this.prisma.student.findMany({
      where: whereStudent,
      include: {
        user: {
          select: {
            user_id: true,
            full_name: true,
            email: true,
            phone_number: true,
            nic_no: true,
          },
        },
        degree: {
          include: {
            department: true,
          },
        },
        registrations: {
          where: {
            course: {
              semester: activeSemester,
            },
          },
          include: {
            course: {
              select: {
                course_id: true,
                course_code: true,
                course_name: true,
              },
            },
          },
        },
      },
      orderBy: [{ registration_number: 'asc' }],
    });

    const registeredCount = students.filter((s) => s.registrations.length > 0).length;
    const totalStudentsCount = students.length;
    const nonRegisteredCount = totalStudentsCount - registeredCount;

    // Distinct available batches for filter dropdown
    const distinctBatches = await this.prisma.student.groupBy({
      by: ['batch'],
    });
    const batches = distinctBatches
      .map((b) => b.batch)
      .filter((b): b is string => Boolean(b))
      .sort((a, b) => b.localeCompare(a));

    return {
      activeSemester,
      offeredCoursesCount,
      registeredCount,
      totalStudentsCount,
      nonRegisteredCount,
      batches,
      students: students.map((s) => ({
        studentId: s.student_id,
        registrationNumber: s.registration_number,
        indexNumber: s.index_number,
        fullName: s.user?.full_name,
        nicNo: s.user?.nic_no,
        email: s.user?.email,
        phoneNumber: s.user?.phone_number || '—',
        batch: s.batch,
        degreeCode: s.degree?.degree_code,
        degreeName: s.degree?.degree_name,
        departmentCode: s.degree?.department?.department_code,
        departmentName: s.degree?.department?.department_name,
        registeredCoursesCount: s.registrations.length,
        isRegistered: s.registrations.length > 0,
        registeredCourses: s.registrations.map((r) => r.course),
      })),
    };
  }

  // ==========================================
  // PROGRESSION & PROMOTION ENGINE
  // ==========================================

  async evaluateProgression(
    batch: string,
    targetSemester: string,
    consideredSemesters: string[] = [],
    minGpa: number = 2.0,
  ) {
    // 1. Fetch all active students in the selected batch
    const cohortStudents = await this.prisma.student.findMany({
      where: {
        batch,
        status: 'ACTIVE',
      },
      include: {
        user: true,
        degree: true,
        semester_gpas: true,
      },
      orderBy: { registration_number: 'asc' },
    });

    // 2. Fetch remediation students from earlier/other batches whose target re-evaluation semester matches targetSemester
    const resurfacedStudents = await this.prisma.student.findMany({
      where: {
        status: 'ACTIVE',
        target_re_evaluation_sem: targetSemester,
        NOT: { batch }, // Don't duplicate if already in cohortStudents
      },
      include: {
        user: true,
        degree: true,
        semester_gpas: true,
      },
      orderBy: { registration_number: 'asc' },
    });

    const allStudentsToEvaluate = [
      ...cohortStudents.map((s) => ({ ...s, isResurfacedCandidate: false })),
      ...resurfacedStudents.map((s) => ({ ...s, isResurfacedCandidate: true })),
    ];

    const results = allStudentsToEvaluate.map((student) => {
      // Find GPA records for selected discrete semesters
      const semesterGpaMap: Record<string, { gpa: number; credits: number }> = {};
      let totalWeightedGpa = 0;
      let totalConsideredCredits = 0;

      for (const semGpa of student.semester_gpas) {
        semesterGpaMap[semGpa.semester] = {
          gpa: semGpa.semester_gpa,
          credits: semGpa.total_credits || 0,
        };
      }

      const consideredDetails: {
        semester: string;
        gpa: number | null;
        credits: number;
        isReleased: boolean;
      }[] = [];

      if (consideredSemesters.length > 0) {
        for (const sem of consideredSemesters) {
          const rec = semesterGpaMap[sem];
          if (rec && rec.credits > 0) {
            consideredDetails.push({
              semester: sem,
              gpa: rec.gpa,
              credits: rec.credits,
              isReleased: true,
            });
            totalWeightedGpa += rec.gpa * rec.credits;
            totalConsideredCredits += rec.credits;
          } else {
            // Either marks are not released or 0 credits recorded
            consideredDetails.push({
              semester: sem,
              gpa: rec ? rec.gpa : null,
              credits: 0,
              isReleased: false,
            });
          }
        }
      }

      // Compute weighted CGPA based on RELEASED marks only
      let calculatedCgpa: number | null = null;
      if (consideredSemesters.length === 0) {
        calculatedCgpa = null; // No GPA consideration required
      } else if (totalConsideredCredits > 0) {
        calculatedCgpa = Number((totalWeightedGpa / totalConsideredCredits).toFixed(2));
      } else {
        calculatedCgpa = 0.0;
      }

      // Determine Eligibility
      let isEligible = true;
      if (consideredSemesters.length > 0) {
        if (calculatedCgpa !== null) {
          isEligible = calculatedCgpa >= minGpa;
        }
      }

      // Default recommendation
      const recommendedAction = isEligible ? 'PROMOTE' : 'HOLD_REMEDIATION';

      return {
        studentId: student.student_id,
        registrationNumber: student.registration_number,
        indexNumber: student.index_number,
        fullName: student.user?.full_name,
        batch: student.batch,
        degreeCode: student.degree?.degree_code,
        currentSemester: student.current_semester || '1.1',
        progressionStatus: student.progression_status || 'REGULAR',
        isResurfacedCandidate: student.isResurfacedCandidate,
        consideredDetails,
        totalConsideredCredits,
        calculatedCgpa,
        isEligible,
        recommendedAction,
      };
    });

    const eligibleCount = results.filter((r) => r.isEligible).length;
    const ineligibleCount = results.filter((r) => !r.isEligible).length;

    return {
      batch,
      targetSemester,
      minGpa,
      consideredSemesters,
      totalCount: results.length,
      eligibleCount,
      ineligibleCount,
      students: results,
    };
  }

  async executePromotion(
    batch: string,
    targetSemester: string,
    decisions: { studentId: number; action: string; remarks?: string }[],
    executorId: number,
  ) {
    if (!decisions || decisions.length === 0) {
      throw new BadRequestException('No student promotion decisions provided.');
    }

    const updatedStudents: any[] = [];

    // Helper: calculate next sequential semester after targetSemester for Option 1
    // e.g., if targetSemester is "3.1", next semester is "3.2"
    const calculateNextSemester = (sem: string): string => {
      const parts = sem.split('.');
      if (parts.length === 2) {
        const year = parseInt(parts[0], 10);
        const term = parseInt(parts[1], 10);
        if (term === 1) return `${year}.2`;
        return `${year + 1}.1`;
      }
      return sem;
    };

    const nextSemesterForRemediation = calculateNextSemester(targetSemester);

    await this.prisma.$transaction(async (tx) => {
      for (const item of decisions) {
        let updateData: any = {};

        if (item.action === 'PROMOTE') {
          updateData = {
            current_semester: targetSemester,
            progression_status: 'REGULAR',
            target_re_evaluation_sem: null,
          };
        } else if (item.action === 'HOLD_REMEDIATION') {
          // Option 1: Remediation. Keep in current semester, re-evaluate when batch promotes to next term (e.g. 3.2)
          updateData = {
            progression_status: 'HOLD_REMEDIATION',
            target_re_evaluation_sem: nextSemesterForRemediation,
          };
        } else if (item.action === 'HOLD_BATCH_DEMOTION') {
          // Option 2: Fall back to junior batch. Re-evaluate when junior batch promotes to targetSemester (e.g. 3.1)
          updateData = {
            progression_status: 'HOLD_BATCH_DEMOTION',
            target_re_evaluation_sem: targetSemester,
          };
        }

        const student = await tx.student.update({
          where: { student_id: item.studentId },
          data: updateData,
          include: { user: true },
        });

        updatedStudents.push({
          studentId: student.student_id,
          registrationNumber: student.registration_number,
          action: item.action,
          newSemester: student.current_semester,
          progressionStatus: student.progression_status,
        });
      }

      await this.auditService.log({
        action: 'EXECUTE_SEMESTER_PROMOTION',
        entityType: 'PROMOTION',
        entityId: 0,
        executorId,
        details: {
          batch,
          targetSemester,
          totalProcessed: decisions.length,
          promotedCount: decisions.filter((d) => d.action === 'PROMOTE').length,
          remediationCount: decisions.filter((d) => d.action === 'HOLD_REMEDIATION').length,
          demotionCount: decisions.filter((d) => d.action === 'HOLD_BATCH_DEMOTION').length,
        },
      });
    });

    return {
      batch,
      targetSemester,
      processedCount: updatedStudents.length,
      students: updatedStudents,
    };
  }
}
