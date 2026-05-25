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
            department_id: dept.department_id,
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
}
