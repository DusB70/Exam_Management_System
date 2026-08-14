import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
          student: {
            academic_year: latestCompletedPeriod.academic_year,
          },
          course: {
            semester: latestCompletedPeriod.semester,
          },
        },
      });
      studentsCurrentlyLearning = uniqueRegistered.length;
    } else {
      // Fallback
      studentsCurrentlyLearning = await this.prisma.student.count();
    }

    const totalStudents = await this.prisma.student.count();
    const totalCourses = await this.prisma.course.count();

    // Distinct batches (academic_year)
    const distinctBatches = await this.prisma.student.groupBy({
      by: ['academic_year'],
      orderBy: { academic_year: 'desc' },
    });
    const batchesList = distinctBatches.map((b) => b.academic_year);

    let batchDetails = null;

    if (batch) {
      // Find the latest registration period for this batch to get their active semester
      const latestPeriod = await this.prisma.registrationPeriod.findFirst({
        where: { academic_year: batch },
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
                      academic_year: batch,
                    },
                  },
                },
              },
            },
          },
        });

        // Get all students of this batch
        const studentsInBatch = await this.prisma.student.findMany({
          where: { academic_year: batch },
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
}
