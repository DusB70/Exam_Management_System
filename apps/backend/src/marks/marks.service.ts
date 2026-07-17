import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ExamMark } from '@prisma/client';
import { BulkRecordMarksDto } from './dtos/marks.dto';
import * as XLSX from 'xlsx';

@Injectable()
export class MarksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // Resolve Lecturer from user ID
  private async getLecturerByUserId(userId: number) {
    const lecturer = await this.prisma.lecturer.findUnique({
      where: { user_id: userId },
    });
    if (!lecturer) {
      throw new NotFoundException(`Lecturer profile not found for user ID ${userId}`);
    }
    return lecturer;
  }

  async findMyCourses(lecturerUserId: number) {
    const lecturer = await this.getLecturerByUserId(lecturerUserId);

    return this.prisma.course.findMany({
      where: {
        lecturers: {
          some: { lecturer_id: lecturer.lecturer_id },
        },
      },
      include: {
        department: true,
      },
      orderBy: { course_code: 'asc' },
    });
  }

  async getStudentsRegisteredForCourse(courseId: number) {
    const course = await this.prisma.course.findUnique({
      where: { course_id: courseId },
    });
    if (!course) {
      throw new NotFoundException(`Course with ID ${courseId} not found`);
    }

    return this.prisma.student.findMany({
      where: {
        registrations: {
          some: { course_id: courseId },
        },
      },
      include: {
        user: {
          select: {
            full_name: true,
            email: true,
          },
        },
      },
      orderBy: { registration_number: 'asc' },
    });
  }

  async getExamsForCourse(courseId: number) {
    const course = await this.prisma.course.findUnique({
      where: { course_id: courseId },
    });
    if (!course) {
      throw new NotFoundException(`Course with ID ${courseId} not found`);
    }

    // Ensure default CA exam exists
    const caExam = await this.prisma.exam.findFirst({
      where: { course_id: courseId, exam_type: 'CA' },
    });
    if (!caExam) {
      await this.prisma.exam.create({
        data: {
          course_id: courseId,
          exam_type: 'CA',
          exam_title: 'Continuous Assessment (CA)',
          total_marks: 100,
          exam_date: new Date(),
          start_time: new Date(1970, 0, 1, 9, 0, 0),
          end_time: new Date(1970, 0, 1, 12, 0, 0),
        },
      });
    }

    // Ensure default FINAL exam exists
    const finalExam = await this.prisma.exam.findFirst({
      where: { course_id: courseId, exam_type: 'FINAL' },
    });
    if (!finalExam) {
      await this.prisma.exam.create({
        data: {
          course_id: courseId,
          exam_type: 'FINAL',
          exam_title: 'Final Examination',
          total_marks: 100,
          exam_date: new Date(),
          start_time: new Date(1970, 0, 1, 9, 0, 0),
          end_time: new Date(1970, 0, 1, 12, 0, 0),
        },
      });
    }

    return this.prisma.exam.findMany({
      where: { course_id: courseId },
      orderBy: { exam_date: 'asc' },
    });
  }

  async getExamMarks(examId: number) {
    const exam = await this.prisma.exam.findUnique({
      where: { exam_id: examId },
      include: { course: true },
    });
    if (!exam) {
      throw new NotFoundException(`Exam with ID ${examId} not found`);
    }

    return this.prisma.examMark.findMany({
      where: { exam_id: examId },
      include: {
        student: {
          include: {
            user: {
              select: { full_name: true },
            },
          },
        },
      },
      orderBy: {
        student: {
          registration_number: 'asc',
        },
      },
    });
  }

  // Record marks in bulk
  async recordMarksBulk(
    examId: number,
    dto: BulkRecordMarksDto,
    executorUserId: number,
    isLecturer: boolean,
  ): Promise<ExamMark[]> {
    const exam = await this.prisma.exam.findUnique({
      where: { exam_id: examId },
    });
    if (!exam) {
      throw new NotFoundException(`Exam with ID ${examId} not found`);
    }

    // 1. Verify permissions if Lecturer
    if (isLecturer) {
      const lecturer = await this.getLecturerByUserId(executorUserId);
      const isAssigned = await this.prisma.courseLecturer.findUnique({
        where: {
          course_id_lecturer_id: {
            course_id: exam.course_id,
            lecturer_id: lecturer.lecturer_id,
          },
        },
      });

      if (!isAssigned) {
        throw new BadRequestException('You are not authorized to grade this course.');
      }
    }

    // 2. Check if marksheet is locked (submitted or approved) for Lecturers
    if (isLecturer) {
      const existingSubmitted = await this.prisma.examMark.findFirst({
        where: {
          exam_id: examId,
          grading_status: { in: ['SUBMITTED', 'APPROVED'] },
        },
      });
      if (existingSubmitted) {
        throw new BadRequestException(
          'Marksheet has already been submitted or approved and is locked.',
        );
      }
    }

    // 3. Validate entries against exam max marks
    for (const entry of dto.marks) {
      if (entry.marksObtained > exam.total_marks) {
        throw new BadRequestException(
          `Marks obtained (${entry.marksObtained}) cannot exceed exam total marks (${exam.total_marks})`,
        );
      }
    }

    // 4. Save bulk marks in database transaction
    const results = await this.prisma.$transaction(async (tx) => {
      const savedMarks: ExamMark[] = [];

      for (const entry of dto.marks) {
        const mark = await tx.examMark.upsert({
          where: {
            student_id_exam_id: {
              student_id: entry.studentId,
              exam_id: examId,
            },
          },
          update: {
            marks_obtained: entry.marksObtained,
            recorded_by_id: executorUserId,
            grading_status: isLecturer ? 'PENDING' : 'APPROVED',
          },
          create: {
            student_id: entry.studentId,
            exam_id: examId,
            marks_obtained: entry.marksObtained,
            recorded_by_id: executorUserId,
            grading_status: isLecturer ? 'PENDING' : 'APPROVED',
          },
        });

        await this.auditService.logAction(
          executorUserId,
          'MARK_RECORD',
          'exam_marks',
          mark.mark_id.toString(),
          null,
          mark,
        );

        savedMarks.push(mark);
      }

      return savedMarks;
    });

    if (!isLecturer) {
      await this.compileCourseGrades(exam.course_id);
    }

    return results;
  }

  // Submit marksheet for approval
  async submitMarks(examId: number, executorUserId: number, isLecturer: boolean): Promise<number> {
    const exam = await this.prisma.exam.findUnique({
      where: { exam_id: examId },
    });
    if (!exam) {
      throw new NotFoundException(`Exam with ID ${examId} not found`);
    }

    // Verify Lecturer assigned
    if (isLecturer) {
      const lecturer = await this.getLecturerByUserId(executorUserId);
      const isAssigned = await this.prisma.courseLecturer.findUnique({
        where: {
          course_id_lecturer_id: {
            course_id: exam.course_id,
            lecturer_id: lecturer.lecturer_id,
          },
        },
      });

      if (!isAssigned) {
        throw new BadRequestException('You are not authorized to grade this course.');
      }
    }

    const marksCount = await this.prisma.examMark.count({
      where: { exam_id: examId },
    });
    if (marksCount === 0) {
      throw new BadRequestException('Cannot submit empty marksheet. Record marks first.');
    }

    // Lock and submit
    await this.prisma.examMark.updateMany({
      where: { exam_id: examId },
      data: { grading_status: 'SUBMITTED' },
    });

    await this.auditService.logAction(
      executorUserId,
      'MARKS_SUBMIT',
      'exam_marks',
      examId.toString(),
      null,
      { status: 'SUBMITTED', marksCount },
    );

    return marksCount;
  }

  // ==========================================
  // REVIEW & APPROVAL ENDPOINTS (STAFF/ADMIN)
  // ==========================================

  // Returns list of exams that have marks submitted for review
  async getSubmittedMarksheetsForReview() {
    return this.prisma.exam.findMany({
      where: {
        exam_marks: {
          some: {
            grading_status: 'SUBMITTED',
          },
        },
      },
      include: {
        course: {
          include: {
            department: true,
          },
        },
      },
      orderBy: { exam_date: 'desc' },
    });
  }

  // Approve a marksheet
  async approveMarks(examId: number, executorUserId: number) {
    const exam = await this.prisma.exam.findUnique({
      where: { exam_id: examId },
    });
    if (!exam) {
      throw new NotFoundException(`Exam with ID ${examId} not found`);
    }

    // Verify they are in SUBMITTED state
    const submittedCount = await this.prisma.examMark.count({
      where: { exam_id: examId, grading_status: 'SUBMITTED' },
    });
    if (submittedCount === 0) {
      throw new BadRequestException('Marksheet must be submitted before approval.');
    }

    // Update to APPROVED
    await this.prisma.examMark.updateMany({
      where: { exam_id: examId },
      data: { grading_status: 'APPROVED' },
    });

    await this.auditService.logAction(
      executorUserId,
      'MARKS_APPROVE',
      'exam_marks',
      examId.toString(),
      null,
      { status: 'APPROVED' },
    );

    // Run grading compilation for the course
    await this.compileCourseGrades(exam.course_id);

    return { success: true, message: 'Marks approved and course grades compiled.' };
  }

  // Reject a marksheet back to lecturer
  async rejectMarks(examId: number, executorUserId: number) {
    const exam = await this.prisma.exam.findUnique({
      where: { exam_id: examId },
    });
    if (!exam) {
      throw new NotFoundException(`Exam with ID ${examId} not found`);
    }

    const submittedCount = await this.prisma.examMark.count({
      where: { exam_id: examId, grading_status: 'SUBMITTED' },
    });
    if (submittedCount === 0) {
      throw new BadRequestException('Marksheet must be submitted to reject.');
    }

    await this.prisma.examMark.updateMany({
      where: { exam_id: examId },
      data: { grading_status: 'PENDING' },
    });

    await this.auditService.logAction(
      executorUserId,
      'MARKS_REJECT',
      'exam_marks',
      examId.toString(),
      null,
      { status: 'PENDING' },
    );

    return { success: true, message: 'Marksheet rejected and returned to PENDING.' };
  }

  // ==========================================
  // GRADING SYSTEM COMPILATION
  // ==========================================

  private async compileCourseGrades(courseId: number) {
    // 1. Fetch all exams offered for this course
    const exams = await this.prisma.exam.findMany({
      where: { course_id: courseId },
    });

    if (exams.length === 0) return;

    // Verify all exams have APPROVED status
    for (const exam of exams) {
      const nonApprovedCount = await this.prisma.examMark.count({
        where: {
          exam_id: exam.exam_id,
          NOT: { grading_status: 'APPROVED' },
        },
      });

      // If there are unapproved marks, or no marks recorded yet, do not compile final grades!
      const hasMarks = await this.prisma.examMark.count({ where: { exam_id: exam.exam_id } });
      if (nonApprovedCount > 0 || hasMarks === 0) {
        return; // Grade compilation remains incomplete
      }
    }

    // 2. Fetch all registered students
    const studentRegistrations = await this.prisma.courseRegistration.findMany({
      where: { course_id: courseId },
    });

    for (const reg of studentRegistrations) {
      let caMarks = 0;
      let caMax = 0;
      let finalMarks = 0;
      let finalMax = 0;

      // Fetch student marks for each exam
      for (const exam of exams) {
        const markRecord = await this.prisma.examMark.findUnique({
          where: {
            student_id_exam_id: {
              student_id: reg.student_id,
              exam_id: exam.exam_id,
            },
          },
        });

        if (!markRecord) continue;

        if (exam.exam_type.toUpperCase() === 'CA') {
          caMarks += markRecord.marks_obtained;
          caMax += exam.total_marks;
        } else {
          finalMarks += markRecord.marks_obtained;
          finalMax += exam.total_marks;
        }
      }

      // Compute total percentage (Standard weighting: 40% CA, 60% Final if both exist, otherwise direct percentage)
      const caPercentage = caMax > 0 ? (caMarks / caMax) * 100 : 0;
      const finalPercentage = finalMax > 0 ? (finalMarks / finalMax) * 100 : 0;

      let totalPercentage = 0;
      if (caMax > 0 && finalMax > 0) {
        totalPercentage = caPercentage * 0.4 + finalPercentage * 0.6;
      } else if (caMax > 0) {
        totalPercentage = caPercentage;
      } else if (finalMax > 0) {
        totalPercentage = finalPercentage;
      }

      const { grade, gradePoint } = this.mapPercentageToGrade(totalPercentage);

      // Upsert student course grade
      await this.prisma.studentCourseGrade.upsert({
        where: {
          student_id_course_id: {
            student_id: reg.student_id,
            course_id: courseId,
          },
        },
        update: {
          continuous_assessment_marks: caMarks,
          final_exam_marks: finalMarks,
          total_marks: totalPercentage,
          grade,
          grade_point: gradePoint,
        },
        create: {
          student_id: reg.student_id,
          course_id: courseId,
          continuous_assessment_marks: caMarks,
          final_exam_marks: finalMarks,
          total_marks: totalPercentage,
          grade,
          grade_point: gradePoint,
        },
      });
    }
  }

  // GPA mapping logic
  private mapPercentageToGrade(pct: number): { grade: string; gradePoint: number } {
    if (pct >= 85.0) return { grade: 'A', gradePoint: 4.0 };
    if (pct >= 80.0) return { grade: 'A-', gradePoint: 3.7 };
    if (pct >= 75.0) return { grade: 'B+', gradePoint: 3.3 };
    if (pct >= 70.0) return { grade: 'B', gradePoint: 3.0 };
    if (pct >= 65.0) return { grade: 'B-', gradePoint: 2.7 };
    if (pct >= 60.0) return { grade: 'C+', gradePoint: 2.3 };
    if (pct >= 55.0) return { grade: 'C', gradePoint: 2.0 };
    if (pct >= 50.0) return { grade: 'C-', gradePoint: 1.7 };
    if (pct >= 40.0) return { grade: 'D', gradePoint: 1.0 };
    return { grade: 'F', gradePoint: 0.0 };
  }

  async getApprovedMarksheets() {
    return this.prisma.exam.findMany({
      where: {
        exam_marks: {
          some: {
            grading_status: 'APPROVED',
          },
        },
      },
      include: {
        course: {
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
        },
      },
      orderBy: { exam_date: 'desc' },
    });
  }

  async getMyStudentsOverview(lecturerUserId: number) {
    const lecturer = await this.getLecturerByUserId(lecturerUserId);

    const courses = await this.prisma.course.findMany({
      where: {
        lecturers: {
          some: { lecturer_id: lecturer.lecturer_id },
        },
      },
      include: {
        registrations: {
          select: {
            student_id: true,
            student: {
              select: {
                academic_year: true,
              },
            },
          },
        },
      },
    });

    const courseDistribution = courses.map((c) => ({
      courseId: c.course_id,
      courseCode: c.course_code,
      courseName: c.course_name,
      studentCount: c.registrations.length,
      academicYear: c.registrations[0]?.student?.academic_year || new Date().getFullYear(),
      semester: c.semester,
    }));

    const allStudentIds = new Set<number>();
    courses.forEach((c) => {
      c.registrations.forEach((r) => {
        allStudentIds.add(r.student_id);
      });
    });

    return {
      totalUniqueStudents: allStudentIds.size,
      courseDistribution,
    };
  }

  async generateStudentListExcel(courseId: number, executorUserId: number, isLecturer: boolean) {
    const course = await this.prisma.course.findUnique({
      where: { course_id: courseId },
      include: {
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
      throw new NotFoundException(`Course with ID ${courseId} not found`);
    }

    // 1. Verify lecturer course assignment
    if (isLecturer) {
      const lecturer = await this.getLecturerByUserId(executorUserId);
      const isAssigned = await this.prisma.courseLecturer.findUnique({
        where: {
          course_id_lecturer_id: {
            course_id: courseId,
            lecturer_id: lecturer.lecturer_id,
          },
        },
      });
      if (!isAssigned) {
        throw new BadRequestException('You are not authorized to access this course.');
      }
    }

    // 2. Get students registered for this course
    const students = await this.getStudentsRegisteredForCourse(courseId);

    // Get the batch (academic year of the first student, or default to current year)
    const batch = students[0]?.academic_year || new Date().getFullYear();

    const rows: any[][] = [
      ['Student List'],
      ['Course Code:', course.course_code],
      ['Course Name:', course.course_name],
      ['Batch:', `Batch ${batch}`],
      [],
      ['Registration Number', 'Index Number', 'Full Name', 'Email'],
    ];

    students.forEach((s) => {
      rows.push([
        s.registration_number,
        s.index_number,
        s.user?.full_name || '',
        s.user?.email || '',
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(rows);

    // Apply column widths
    worksheet['!cols'] = [
      { wch: 25 }, // Registration Number
      { wch: 25 }, // Index Number
      { wch: 40 }, // Full Name
      { wch: 35 }, // Email
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Enrolled Students');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const fileName = `${course.course_name.replace(/[^a-zA-Z0-9-]/g, '_')}_${course.course_code.replace(/[^a-zA-Z0-9-]/g, '_')}_Batch_${batch}.xlsx`;

    return { buffer, fileName };
  }
}
