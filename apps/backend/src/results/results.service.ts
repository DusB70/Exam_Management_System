import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StudentSemesterGpa } from '@prisma/client';

@Injectable()
export class ResultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private async getStudentByUserId(userId: number) {
    const student = await this.prisma.student.findUnique({
      where: { user_id: userId },
    });
    if (!student) {
      throw new NotFoundException(`Student profile not found for user ID ${userId}`);
    }
    return student;
  }

  // Publish results for all students in a semester
  async publishResults(academicYear: number, semester: number, executorUserId: number) {
    // 1. Find all students registered in this semester
    const students = await this.prisma.student.findMany({
      where: {
        academic_year: academicYear,
        semester,
      },
    });

    if (students.length === 0) {
      throw new BadRequestException(
        `No students found for Academic Year ${academicYear} Semester ${semester}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const gpas: StudentSemesterGpa[] = [];

      for (const student of students) {
        // Calculate SGPAs & CGPAs
        const calculation = await this.calculateGpaInternal(
          tx,
          student.student_id,
          academicYear,
          semester,
        );

        if (!calculation) continue; // If they have no graded courses, skip

        // Upsert Semester GPA
        const gpaRecord = await tx.studentSemesterGpa.upsert({
          where: {
            student_id_academic_year_semester: {
              student_id: student.student_id,
              academic_year: academicYear,
              semester,
            },
          },
          update: {
            semester_gpa: calculation.sgpa,
            cumulative_gpa: calculation.cgpa,
            total_credits: calculation.semesterCredits,
            is_published: true,
            is_locked: true,
          },
          create: {
            student_id: student.student_id,
            academic_year: academicYear,
            semester,
            semester_gpa: calculation.sgpa,
            cumulative_gpa: calculation.cgpa,
            total_credits: calculation.semesterCredits,
            is_published: true,
            is_locked: true,
          },
        });

        // Publish and Lock all student course grades for this semester
        await tx.studentCourseGrade.updateMany({
          where: {
            student_id: student.student_id,
            course: {
              academic_year: academicYear,
              semester,
            },
          },
          data: {
            is_published: true,
            is_locked: true,
          },
        });

        gpas.push(gpaRecord);
      }

      await this.auditService.logAction(
        executorUserId,
        'RESULTS_PUBLISH',
        'student_semester_gpas',
        `${academicYear}_${semester}`,
        null,
        { year: academicYear, semester, processedCount: gpas.length },
      );

      return {
        success: true,
        count: gpas.length,
      };
    });
  }

  // Retrieve published grades and GPAs for student portal
  async getStudentReportCard(studentUserId: number) {
    const student = await this.getStudentByUserId(studentUserId);

    // Fetch published GPAs
    const gpas = await this.prisma.studentSemesterGpa.findMany({
      where: {
        student_id: student.student_id,
        is_published: true,
      },
      orderBy: { semester: 'asc' },
    });

    // Fetch published Course Grades
    const grades = await this.prisma.studentCourseGrade.findMany({
      where: {
        student_id: student.student_id,
        is_published: true,
      },
      include: {
        course: {
          select: {
            course_code: true,
            course_name: true,
            credit_value: true,
            academic_year: true,
            semester: true,
          },
        },
      },
      orderBy: {
        course: {
          semester: 'asc',
        },
      },
    });

    return {
      student,
      gpas,
      grades,
    };
  }

  // GPA calculation helper
  private async calculateGpaInternal(
    tx: any,
    studentId: number,
    academicYear: number,
    semester: number,
  ) {
    // 1. Fetch current semester grades
    const currentSemesterGrades = await tx.studentCourseGrade.findMany({
      where: {
        student_id: studentId,
        course: {
          academic_year: academicYear,
          semester,
        },
      },
      include: { course: true },
    });

    if (currentSemesterGrades.length === 0) {
      return null;
    }

    let semesterGpProduct = 0;
    let semesterCredits = 0;

    for (const g of currentSemesterGrades) {
      const cred = parseFloat(g.course.credit_value.toString());
      semesterGpProduct += g.grade_point * cred;
      semesterCredits += cred;
    }

    const sgpa = semesterCredits > 0 ? semesterGpProduct / semesterCredits : 0;

    // 2. Fetch all historical grades up to this year/semester to calculate CGPA
    const allHistoricalGrades = await tx.studentCourseGrade.findMany({
      where: {
        student_id: studentId,
        course: {
          OR: [
            { academic_year: { lt: academicYear } },
            { academic_year: academicYear, semester: { lte: semester } },
          ],
        },
      },
      include: { course: true },
    });

    let cumulativeGpProduct = 0;
    let cumulativeCredits = 0;

    for (const g of allHistoricalGrades) {
      const cred = parseFloat(g.course.credit_value.toString());
      cumulativeGpProduct += g.grade_point * cred;
      cumulativeCredits += cred;
    }

    const cgpa = cumulativeCredits > 0 ? cumulativeGpProduct / cumulativeCredits : 0;

    return {
      sgpa,
      cgpa,
      semesterCredits,
    };
  }
}
