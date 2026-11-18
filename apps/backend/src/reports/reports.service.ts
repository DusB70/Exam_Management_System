import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@ems/shared';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary() {
    const totalStudents = await this.prisma.student.count();
    const totalCourses = await this.prisma.course.count();
    const totalLecturers = await this.prisma.lecturer.count();

    const aggregate = await this.prisma.studentSemesterGpa.aggregate({
      where: { is_published: true },
      _avg: { cumulative_gpa: true },
    });

    return {
      totalStudents,
      totalCourses,
      totalLecturers,
      averageCgpa: aggregate._avg.cumulative_gpa || 0.0,
    };
  }

  async getDepartmentPerformance() {
    const departments = await this.prisma.department.findMany();
    const performance = [];

    for (const dept of departments) {
      const agg = await this.prisma.studentSemesterGpa.aggregate({
        where: {
          is_published: true,
          student: {
            degree: {
              department_id: dept.department_id,
            },
          },
        },
        _avg: {
          cumulative_gpa: true,
        },
      });

      performance.push({
        departmentCode: dept.department_code,
        departmentName: dept.department_name,
        averageCgpa: agg._avg.cumulative_gpa || 0.0,
      });
    }

    return performance;
  }

  async getCourseGradesDistribution(courseId: number) {
    const gradesGroup = await this.prisma.studentCourseGrade.groupBy({
      by: ['grade'],
      where: {
        course_id: courseId,
        is_published: true,
      },
      _count: {
        grade_id: true,
      },
    });

    const orderMap = {
      A: 1,
      'A-': 2,
      'B+': 3,
      B: 4,
      'B-': 5,
      'C+': 6,
      C: 7,
      'C-': 8,
      D: 9,
      F: 10,
    };

    return gradesGroup
      .map((g) => ({
        grade: g.grade,
        count: g._count.grade_id,
      }))
      .sort((a, b) => {
        const orderA = orderMap[a.grade as keyof typeof orderMap] || 99;
        const orderB = orderMap[b.grade as keyof typeof orderMap] || 99;
        return orderA - orderB;
      });
  }

  async getGpaTrends() {
    const trends = await this.prisma.studentSemesterGpa.groupBy({
      by: ['academic_year', 'semester'],
      where: { is_published: true },
      _avg: {
        semester_gpa: true,
      },
      orderBy: [{ academic_year: 'asc' }, { semester: 'asc' }],
    });

    return trends.map((t) => ({
      semesterLabel: `AY ${t.academic_year} Sem ${t.semester}`,
      averageGpa: t._avg.semester_gpa || 0.0,
    }));
  }

  async getCoursesList() {
    return this.prisma.course.findMany({
      select: {
        course_id: true,
        course_code: true,
        course_name: true,
      },
      orderBy: { course_code: 'asc' },
    });
  }

  async getStaffOverview(batch?: number) {
    // 1. Total students currently learning: derived from the latest completed registration window
    const latestCompletedPeriod = await this.prisma.registrationPeriod.findFirst({
      where: { status: 'CLOSED' },
      orderBy: { end_date: 'desc' },
    });

    let studentsCurrentlyLearning = 0;
    if (latestCompletedPeriod) {
      const uniqueRegistered = await this.prisma.courseRegistration.groupBy({
        by: ['student_id'],
        where: {
          course: {
            semester: latestCompletedPeriod.semester,
          },
          ...(latestCompletedPeriod.batch
            ? { student: { batch: latestCompletedPeriod.batch } }
            : {}),
        },
      });
      studentsCurrentlyLearning = uniqueRegistered.length;
    } else {
      // Fallback
      studentsCurrentlyLearning = await this.prisma.student.count();
    }

    const totalStudents = await this.prisma.student.count();
    const totalCourses = await this.prisma.course.count();

    // Distinct batches
    const distinctBatches = await this.prisma.student.groupBy({
      by: ['batch'],
    });
    const batchesList = distinctBatches.map((b) => b.batch).filter((b): b is string => !!b);

    let batchDetails = null;

    if (batch) {
      const batchStr = String(batch);
      // Find the latest registration period for this batch to get their active semester
      const latestPeriod = await this.prisma.registrationPeriod.findFirst({
        where: { batch: batchStr },
        orderBy: { end_date: 'desc' },
      });

      const batchSemester = latestPeriod ? latestPeriod.semester : '1';

      if (batchSemester) {
        // Available courses for this batch & semester
        const availableCoursesCount = await this.prisma.course.count({
          where: {
            semester: batchSemester,
            degrees: {
              some: {
                degree: {
                  students: {
                    some: {
                      batch: batchStr,
                    },
                  },
                },
              },
            },
          },
        });

        // Get all students of this batch
        const studentsInBatch = await this.prisma.student.findMany({
          where: { batch: batchStr },
          include: {
            user: {
              select: {
                full_name: true,
                email: true,
                phone_number: true,
              },
            },
            registrations: {
              where: {
                course: {
                  semester: batchSemester,
                },
              },
            },
          },
        });

        const registeredCount = studentsInBatch.filter((s) => s.registrations.length > 0).length;
        const nonFilledStudents = studentsInBatch
          .filter((s) => s.registrations.length === 0)
          .map((s) => ({
            studentId: s.student_id,
            registrationNumber: s.registration_number,
            fullName: s.user.full_name,
            email: s.user.email,
            phoneNumber: s.user.phone_number || '-',
          }));

        batchDetails = {
          batch,
          semester: batchSemester,
          availableCoursesCount,
          registeredCount,
          totalStudentsCount: studentsInBatch.length,
          nonFilledStudents,
        };
      }
    }

    return {
      studentsCurrentlyLearning,
      totalStudents,
      totalCourses,
      batches: batchesList,
      batchDetails,
    };
  }

  private async resolveActiveSemesters(): Promise<string[]> {
    const activeSemestersSet = new Set<string>();

    // 1. Any currently OPEN or ACTIVE registration periods
    const openPeriods = await this.prisma.registrationPeriod.findMany({
      where: { status: { in: ['OPEN', 'ACTIVE'] } },
    });
    for (const p of openPeriods) {
      if (p.semester?.trim()) {
        activeSemestersSet.add(p.semester.trim());
      }
    }

    // 2. Determine the latest semester registered by each active batch
    const activeBatches = await this.prisma.student.findMany({
      where: {
        status: { not: 'GRADUATED' },
        batch: { not: null },
      },
      select: { batch: true },
      distinct: ['batch'],
    });

    for (const { batch } of activeBatches) {
      if (!batch) continue;

      // Look for latest PROPER course registration for this batch
      const latestProper = await this.prisma.courseRegistration.findFirst({
        where: {
          student: { batch, status: { not: 'GRADUATED' } },
          attempt_type: 'PROPER',
        },
        orderBy: [{ registration_date: 'desc' }, { registration_id: 'desc' }],
        include: {
          course: {
            select: { semester: true },
          },
        },
      });

      if (latestProper?.course?.semester?.trim()) {
        activeSemestersSet.add(latestProper.course.semester.trim());
        continue;
      }

      // If no PROPER registration found for this batch, check any course registration
      const latestAny = await this.prisma.courseRegistration.findFirst({
        where: {
          student: { batch, status: { not: 'GRADUATED' } },
        },
        orderBy: [{ registration_date: 'desc' }, { registration_id: 'desc' }],
        include: {
          course: {
            select: { semester: true },
          },
        },
      });

      if (latestAny?.course?.semester?.trim()) {
        activeSemestersSet.add(latestAny.course.semester.trim());
        continue;
      }

      // Fallback: check latest registration period created for this batch
      const latestBatchPeriod = await this.prisma.registrationPeriod.findFirst({
        where: { batch },
        orderBy: [{ start_date: 'desc' }, { period_id: 'desc' }],
      });

      if (latestBatchPeriod?.semester?.trim()) {
        activeSemestersSet.add(latestBatchPeriod.semester.trim());
      }
    }

    // 3. Fallback: if no active batch registrations exist yet, inspect latest registration periods
    if (activeSemestersSet.size === 0) {
      const latestPeriods = await this.prisma.registrationPeriod.findMany({
        orderBy: [{ end_date: 'desc' }, { period_id: 'desc' }],
        take: 5,
      });
      for (const p of latestPeriods) {
        if (p.semester?.trim()) {
          activeSemestersSet.add(p.semester.trim());
        }
      }
    }

    // 4. Default fallback to odd-semester cycle
    if (activeSemestersSet.size === 0) {
      return ['1.1', '2.1', '3.1', '4.1'];
    }

    return Array.from(activeSemestersSet).sort();
  }

  async getLecturerAnalytics(
    userId: number,
    role: string,
    filters?: {
      semester?: string;
      batch?: string;
      courseId?: number;
      search?: string;
    },
  ) {
    let whereCourse: any = {};
    if (role === UserRole.LECTURER) {
      const lecturer = await this.prisma.lecturer.findUnique({
        where: { user_id: userId },
      });
      if (!lecturer) {
        throw new NotFoundException(`Lecturer profile not found for user ID ${userId}`);
      }
      whereCourse = {
        lecturers: {
          some: { lecturer_id: lecturer.lecturer_id },
        },
      };
    }

    // 1. Fetch all taught courses for this lecturer
    const allCourses = await this.prisma.course.findMany({
      where: whereCourse,
      include: {
        department: true,
        registrations: {
          include: {
            student: {
              select: {
                student_id: true,
                registration_number: true,
                index_number: true,
                batch: true,
                status: true,
                enrollment_date: true,
                user: { select: { full_name: true } },
              },
            },
          },
        },
        exams: {
          include: {
            exam_marks: true,
          },
        },
        course_grades: {
          include: {
            student: {
              select: {
                student_id: true,
                index_number: true,
                batch: true,
              },
            },
          },
        },
      },
      orderBy: [{ semester: 'asc' }, { course_code: 'asc' }],
    });

    // 2. Identify active semesters based on latest registered semester per batch + open periods
    const activeSemesters = await this.resolveActiveSemesters();

    const openPeriod = await this.prisma.registrationPeriod.findFirst({
      where: { status: { in: ['OPEN', 'ACTIVE'] } },
      orderBy: { start_date: 'desc' },
    });
    const latestPeriod =
      openPeriod ||
      (await this.prisma.registrationPeriod.findFirst({
        orderBy: [{ end_date: 'desc' }, { period_id: 'desc' }],
      }));
    const activeAcademicYear = latestPeriod?.academic_year || new Date().getFullYear();

    // 3. Collect distinct filter options across all courses
    const availableSemestersSet = new Set<string>();
    const availableBatchesSet = new Set<string>();
    const availableCourses = allCourses.map((c) => {
      if (c.semester) availableSemestersSet.add(c.semester.trim());
      c.registrations.forEach((r) => {
        if (r.student?.batch) availableBatchesSet.add(r.student.batch.trim());
      });
      return {
        courseId: c.course_id,
        courseCode: c.course_code,
        courseName: c.course_name,
        semester: c.semester,
      };
    });

    const availableSemesters = Array.from(availableSemestersSet).sort();
    const availableBatches = Array.from(availableBatchesSet).sort();

    // 4. Calculate total enrolled students over the years (All-Time) & Active Year
    const allEnrolledStudentIds = new Set<number>();
    const activeYearStudentIds = new Set<number>();
    const yearlyMap: { [yearKey: string]: Set<number> } = {};

    allCourses.forEach((c) => {
      const isCourseActiveSemester = activeSemesters.includes(c.semester?.trim());
      c.registrations.forEach((r) => {
        allEnrolledStudentIds.add(r.student_id);

        if (isCourseActiveSemester) {
          activeYearStudentIds.add(r.student_id);
        }

        let yearKey = r.student?.batch || '';
        if (!yearKey && r.registration_date) {
          yearKey = String(new Date(r.registration_date).getFullYear());
        }
        if (!yearKey) {
          yearKey = String(c.created_at ? new Date(c.created_at).getFullYear() : '2024');
        }
        if (!yearlyMap[yearKey]) {
          yearlyMap[yearKey] = new Set();
        }
        yearlyMap[yearKey].add(r.student_id);
      });
    });

    const totalStudentsEnrolledOverYears = allEnrolledStudentIds.size;
    const totalStudentsEnrolledActiveYear = activeYearStudentIds.size;
    const totalStudentsEnrolledPerYear = Object.entries(yearlyMap)
      .map(([year, students]) => ({
        year,
        count: students.size,
      }))
      .sort((a, b) => a.year.localeCompare(b.year));

    // 5. Filter courses based on query parameters
    let filteredCourses = allCourses;

    if (filters?.semester && filters.semester !== 'ALL') {
      filteredCourses = filteredCourses.filter(
        (c) => c.semester?.trim() === filters.semester?.trim(),
      );
    }

    if (filters?.courseId) {
      filteredCourses = filteredCourses.filter((c) => c.course_id === filters.courseId);
    }

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      filteredCourses = filteredCourses.filter(
        (c) =>
          c.course_code.toLowerCase().includes(q) ||
          c.course_name.toLowerCase().includes(q) ||
          (c.semester && c.semester.toLowerCase().includes(q)),
      );
    }

    // 6. Process course performance analytics
    const GRADE_ORDER = [
      'A+',
      'A',
      'A-',
      'B+',
      'B',
      'B-',
      'C+',
      'C',
      'C-',
      'D',
      'F',
      'E(CA)',
      'E(SA)',
    ];
    const overallGradeCounts: { [grade: string]: number } = {};
    GRADE_ORDER.forEach((g) => (overallGradeCounts[g] = 0));

    let accumulatedCaSum = 0;
    let accumulatedCaCount = 0;
    let accumulatedFinalSum = 0;
    let accumulatedFinalCount = 0;
    let accumulatedTotalSum = 0;
    let accumulatedTotalCount = 0;
    let accumulatedPassCount = 0;
    let accumulatedGradedCount = 0;

    const courseAnalytics = filteredCourses.map((c) => {
      let registrations = c.registrations;
      if (filters?.batch && filters.batch !== 'ALL') {
        registrations = registrations.filter(
          (r) => r.student?.batch?.trim() === filters.batch?.trim(),
        );
      }
      const enrolledCount = registrations.length;

      const courseBatches = Array.from(
        new Set(c.registrations.map((r) => r.student?.batch?.trim()).filter(Boolean)),
      ).sort();

      let courseGrades = c.course_grades;
      if (filters?.batch && filters.batch !== 'ALL') {
        courseGrades = courseGrades.filter(
          (g) => g.student?.batch?.trim() === filters.batch?.trim(),
        );
      }

      const gradeCounts: { [grade: string]: number } = {};
      GRADE_ORDER.forEach((g) => (gradeCounts[g] = 0));

      let courseCaSum = 0;
      let courseCaCount = 0;
      let courseFinalSum = 0;
      let courseFinalCount = 0;
      let courseTotalSum = 0;
      let courseTotalCount = 0;
      let passCount = 0;
      let eCaCount = 0;
      let eSaCount = 0;

      courseGrades.forEach((g) => {
        const gradeStr = g.grade?.trim().toUpperCase();
        if (gradeCounts[gradeStr] !== undefined) {
          gradeCounts[gradeStr]++;
        } else if (gradeStr === 'E') {
          gradeCounts['F'] = (gradeCounts['F'] || 0) + 1;
        } else {
          gradeCounts[gradeStr] = 1;
        }

        if (overallGradeCounts[gradeStr] !== undefined) {
          overallGradeCounts[gradeStr]++;
        } else {
          overallGradeCounts[gradeStr] = (overallGradeCounts[gradeStr] || 0) + 1;
        }

        if (gradeStr === 'E(CA)') eCaCount++;
        if (gradeStr === 'E(SA)') eSaCount++;

        const isPassing = !['F', 'E', 'E(CA)', 'E(SA)'].includes(gradeStr);
        if (isPassing) passCount++;

        if (g.continuous_assessment_marks !== null && g.continuous_assessment_marks !== undefined) {
          courseCaSum += Number(g.continuous_assessment_marks);
          courseCaCount++;
        }
        if (g.final_exam_marks !== null && g.final_exam_marks !== undefined) {
          courseFinalSum += Number(g.final_exam_marks);
          courseFinalCount++;
        }
        if (g.total_marks !== null && g.total_marks !== undefined) {
          courseTotalSum += Number(g.total_marks);
          courseTotalCount++;
        }
      });

      // Fallback to exams & marks if no course_grades yet
      if (courseCaCount === 0) {
        const caExams = c.exams.filter((e) => e.exam_type?.toUpperCase() === 'CA');
        caExams.forEach((e) => {
          e.exam_marks.forEach((m) => {
            const score = (m.marks_obtained / (e.total_marks || 100)) * 100;
            courseCaSum += score;
            courseCaCount++;
          });
        });
      }

      if (courseFinalCount === 0) {
        const finalExams = c.exams.filter((e) => e.exam_type?.toUpperCase() === 'FINAL');
        finalExams.forEach((e) => {
          e.exam_marks.forEach((m) => {
            const score = (m.marks_obtained / (e.total_marks || 100)) * 100;
            courseFinalSum += score;
            courseFinalCount++;
          });
        });
      }

      const avgCaMarks =
        courseCaCount > 0 ? Math.round((courseCaSum / courseCaCount) * 10) / 10 : 0;
      const avgFinalExamMarks =
        courseFinalCount > 0 ? Math.round((courseFinalSum / courseFinalCount) * 10) / 10 : 0;
      const avgCombinedMarks =
        courseTotalCount > 0
          ? Math.round((courseTotalSum / courseTotalCount) * 10) / 10
          : Math.round((avgCaMarks * 0.4 + avgFinalExamMarks * 0.6) * 10) / 10;

      const gradedCount = courseGrades.length;
      const passRate = gradedCount > 0 ? Math.round((passCount / gradedCount) * 1000) / 10 : 0;

      accumulatedCaSum += courseCaSum;
      accumulatedCaCount += courseCaCount;
      accumulatedFinalSum += courseFinalSum;
      accumulatedFinalCount += courseFinalCount;
      accumulatedTotalSum += courseTotalSum;
      accumulatedTotalCount += courseTotalCount;
      accumulatedPassCount += passCount;
      accumulatedGradedCount += gradedCount;

      const gradeDistribution = GRADE_ORDER.map((grade) => ({
        grade,
        count: gradeCounts[grade] || 0,
        percentage:
          gradedCount > 0 ? Math.round(((gradeCounts[grade] || 0) / gradedCount) * 1000) / 10 : 0,
      }));

      return {
        courseId: c.course_id,
        courseCode: c.course_code,
        courseName: c.course_name,
        semester: c.semester,
        creditValue: Number(c.credit_value),
        isActiveSemester: activeSemesters.includes(c.semester?.trim()),
        batches: courseBatches,
        enrolledCount,
        gradedCount,
        avgCaMarks,
        avgFinalExamMarks,
        avgCombinedMarks,
        passCount,
        failCount: gradedCount - passCount,
        passRate,
        eCaCount,
        eSaCount,
        gradeDistribution,
      };
    });

    const overallCaAvg =
      accumulatedCaCount > 0 ? Math.round((accumulatedCaSum / accumulatedCaCount) * 10) / 10 : 0;
    const overallFinalAvg =
      accumulatedFinalCount > 0
        ? Math.round((accumulatedFinalSum / accumulatedFinalCount) * 10) / 10
        : 0;
    const overallCombinedAvg =
      accumulatedTotalCount > 0
        ? Math.round((accumulatedTotalSum / accumulatedTotalCount) * 10) / 10
        : 0;
    const overallPassRate =
      accumulatedGradedCount > 0
        ? Math.round((accumulatedPassCount / accumulatedGradedCount) * 1000) / 10
        : 0;

    const overallGradeDistribution = GRADE_ORDER.map((grade) => ({
      grade,
      count: overallGradeCounts[grade] || 0,
      percentage:
        accumulatedGradedCount > 0
          ? Math.round(((overallGradeCounts[grade] || 0) / accumulatedGradedCount) * 1000) / 10
          : 0,
    }));

    const activeCoursesCount = allCourses.filter((c) =>
      activeSemesters.includes(c.semester?.trim()),
    ).length;
    const pastCoursesCount = allCourses.length - activeCoursesCount;

    return {
      activeSemesters,
      activeAcademicYear,
      totalStudentsEnrolledOverYears,
      totalStudentsEnrolledActiveYear,
      totalStudentsEnrolledPerYear,
      totalCoursesTaught: allCourses.length,
      activeCoursesCount,
      pastCoursesCount,
      overallCaAvg,
      overallFinalAvg,
      overallCombinedAvg,
      overallPassRate,
      overallGradeDistribution,
      availableSemesters,
      availableBatches,
      availableCourses,
      courses: courseAnalytics,
    };
  }
}
