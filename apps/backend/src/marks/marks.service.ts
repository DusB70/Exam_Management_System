import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ExamMark, Prisma } from '@prisma/client';
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
            name_with_initials: true,
            email: true,
            nic_no: true,
            date_of_birth: true,
            phone_number: true,
            address: true,
          },
        },
        degree: {
          select: {
            degree_name: true,
            degree_code: true,
          },
        },
        specialization: {
          select: {
            specialization_name: true,
            specialization_code: true,
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
    // Check if all exams have APPROVED status before finalizing compilation
    const exams = await this.prisma.exam.findMany({
      where: { course_id: courseId },
    });
    if (exams.length === 0) return;

    for (const exam of exams) {
      const nonApprovedCount = await this.prisma.examMark.count({
        where: {
          exam_id: exam.exam_id,
          NOT: { grading_status: 'APPROVED' },
        },
      });
      const hasMarks = await this.prisma.examMark.count({ where: { exam_id: exam.exam_id } });
      if (nonApprovedCount > 0 || hasMarks === 0) {
        return; // Grade compilation remains incomplete
      }
    }

    await this.compileCourseGradesForSubmission(courseId, 'FINAL');
  }

  // GPA mapping logic
  private mapPercentageToGrade(pct: number): { grade: string; gradePoint: number } {
    return this.mapPercentageToCustomGrade(pct, null);
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

  // 1. Get Course Grid Data
  async getCourseGridData(courseId: number, lecturerUserId: number, isLecturer: boolean) {
    const course = await this.prisma.course.findUnique({
      where: { course_id: courseId },
    });
    if (!course) {
      throw new NotFoundException(`Course with ID ${courseId} not found`);
    }

    if (isLecturer) {
      const lecturer = await this.getLecturerByUserId(lecturerUserId);
      if (!lecturer.is_head && !lecturer.is_dean) {
        const isAssigned = await this.prisma.courseLecturer.findUnique({
          where: {
            course_id_lecturer_id: {
              course_id: courseId,
              lecturer_id: lecturer.lecturer_id,
            },
          },
        });
        if (!isAssigned) {
          throw new BadRequestException('You are not authorized to grade this course.');
        }
      }
    }

    const students = await this.prisma.student.findMany({
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
      orderBy: { index_number: 'asc' },
    });

    const exams = await this.prisma.exam.findMany({
      where: { course_id: courseId },
      orderBy: { exam_id: 'asc' },
    });

    const examIds = exams.map((e) => e.exam_id);
    const marks = await this.prisma.examMark.findMany({
      where: {
        exam_id: { in: examIds },
      },
    });

    const courseGrades = await this.prisma.studentCourseGrade.findMany({
      where: { course_id: courseId },
    });

    return {
      course,
      students,
      exams,
      marks,
      courseGrades,
    };
  }

  // 2. Update Course Configuration
  async updateCourseConfig(
    courseId: number,
    config: any,
    lecturerUserId: number,
    isLecturer: boolean,
  ) {
    if (isLecturer) {
      const lecturer = await this.getLecturerByUserId(lecturerUserId);
      const isAssigned = await this.prisma.courseLecturer.findUnique({
        where: {
          course_id_lecturer_id: {
            course_id: courseId,
            lecturer_id: lecturer.lecturer_id,
          },
        },
      });
      if (!isAssigned) {
        throw new BadRequestException('You are not authorized to configure this course.');
      }
    }

    return this.prisma.course.update({
      where: { course_id: courseId },
      data: {
        marks_config: config,
      },
    });
  }

  // 3. Create Course Exam (Add assessment)
  async createCourseExam(
    courseId: number,
    data: { exam_type: string; exam_title: string; total_marks: number },
    lecturerUserId: number,
    isLecturer: boolean,
  ) {
    if (isLecturer) {
      const lecturer = await this.getLecturerByUserId(lecturerUserId);
      const isAssigned = await this.prisma.courseLecturer.findUnique({
        where: {
          course_id_lecturer_id: {
            course_id: courseId,
            lecturer_id: lecturer.lecturer_id,
          },
        },
      });
      if (!isAssigned) {
        throw new BadRequestException('You are not authorized to manage exams for this course.');
      }
    }

    return this.prisma.exam.create({
      data: {
        course_id: courseId,
        exam_type: data.exam_type,
        exam_title: data.exam_title,
        total_marks: data.total_marks,
        exam_date: new Date(),
        start_time: new Date(1970, 0, 1, 9, 0, 0),
        end_time: new Date(1970, 0, 1, 12, 0, 0),
      },
    });
  }

  // 4. Update Course Exam (Rename, edit total marks)
  async updateCourseExam(
    courseId: number,
    examId: number,
    data: { exam_title?: string; total_marks?: number },
    lecturerUserId: number,
    isLecturer: boolean,
  ) {
    if (isLecturer) {
      const lecturer = await this.getLecturerByUserId(lecturerUserId);
      const isAssigned = await this.prisma.courseLecturer.findUnique({
        where: {
          course_id_lecturer_id: {
            course_id: courseId,
            lecturer_id: lecturer.lecturer_id,
          },
        },
      });
      if (!isAssigned) {
        throw new BadRequestException('You are not authorized to manage exams for this course.');
      }
    }

    return this.prisma.exam.update({
      where: { exam_id: examId },
      data: {
        exam_title: data.exam_title,
        total_marks: data.total_marks,
      },
    });
  }

  // 5. Delete Course Exam
  async deleteCourseExam(
    courseId: number,
    examId: number,
    lecturerUserId: number,
    isLecturer: boolean,
  ) {
    if (isLecturer) {
      const lecturer = await this.getLecturerByUserId(lecturerUserId);
      const isAssigned = await this.prisma.courseLecturer.findUnique({
        where: {
          course_id_lecturer_id: {
            course_id: courseId,
            lecturer_id: lecturer.lecturer_id,
          },
        },
      });
      if (!isAssigned) {
        throw new BadRequestException('You are not authorized to manage exams for this course.');
      }
    }

    return this.prisma.exam.delete({
      where: { exam_id: examId },
    });
  }

  // 6. Submit Grid of Marks
  async submitCourseGrid(
    courseId: number,
    data: {
      marks: { studentId: number; examMarks: { [examId: string]: number } }[];
      submissionType?: 'PROVISIONAL' | 'FINAL' | 'UPDATED' | null;
    },
    executorUserId: number,
    isLecturer: boolean,
  ) {
    const course = await this.prisma.course.findUnique({
      where: { course_id: courseId },
    });
    if (!course) {
      throw new NotFoundException(`Course with ID ${courseId} not found`);
    }

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
        throw new BadRequestException('You are not authorized to grade this course.');
      }
    }

    // Save/upsert marks for each student & exam
    await this.prisma.$transaction(async (tx) => {
      for (const entry of data.marks) {
        for (const [examIdStr, score] of Object.entries(entry.examMarks)) {
          const examId = parseInt(examIdStr);
          if (isNaN(examId)) continue;

          await tx.examMark.upsert({
            where: {
              student_id_exam_id: {
                student_id: entry.studentId,
                exam_id: examId,
              },
            },
            update: {
              marks_obtained: score,
              recorded_by_id: executorUserId,
              grading_status: data.submissionType
                ? isLecturer
                  ? 'SUBMITTED'
                  : 'APPROVED'
                : 'PENDING',
            },
            create: {
              student_id: entry.studentId,
              exam_id: examId,
              marks_obtained: score,
              recorded_by_id: executorUserId,
              grading_status: data.submissionType
                ? isLecturer
                  ? 'SUBMITTED'
                  : 'APPROVED'
                : 'PENDING',
            },
          });
        }
      }
    });

    if (data.submissionType) {
      let dbStatus = '';
      if (data.submissionType === 'PROVISIONAL') {
        dbStatus = 'SUBMITTED_PROVISIONAL';
      } else if (data.submissionType === 'FINAL') {
        dbStatus = 'SUBMITTED_FINAL';
      } else {
        dbStatus = 'DRAFT';
      }

      await this.prisma.course.update({
        where: { course_id: courseId },
        data: {
          result_submission_status: dbStatus,
          rejection_reason: null,
        },
      });

      await this.compileCourseGradesForSubmission(courseId, data.submissionType);
    }

    return { success: true };
  }

  // Compile Course Grades for Submission
  async compileCourseGradesForSubmission(courseId: number, submissionType: string) {
    const course = await this.prisma.course.findUnique({
      where: { course_id: courseId },
    });
    if (!course) return;

    const exams = await this.prisma.exam.findMany({
      where: { course_id: courseId },
    });
    if (exams.length === 0) return;

    const registrations = await this.prisma.courseRegistration.findMany({
      where: { course_id: courseId },
    });

    const config: any = course.marks_config || {};
    const weights = config.weights || {};
    const cutoffs = config.cutoffs || { ca: 40, final: 35 };
    const gradeRanges = config.grade_ranges || null;

    const caExams = exams.filter((e) => e.exam_type.toUpperCase() === 'CA');
    const finalExams = exams.filter((e) => e.exam_type.toUpperCase() === 'FINAL');

    const resolvedWeights: { [examId: number]: number } = {};

    let hasCustomWeights = false;
    if (weights && Object.keys(weights).length > 0) {
      hasCustomWeights = true;
      for (const [examIdStr, w] of Object.entries(weights)) {
        resolvedWeights[parseInt(examIdStr)] = parseFloat(w as string);
      }
    }

    if (!hasCustomWeights) {
      if (caExams.length > 0 && finalExams.length > 0) {
        caExams.forEach((e) => {
          resolvedWeights[e.exam_id] = 40 / caExams.length;
        });
        finalExams.forEach((e) => {
          resolvedWeights[e.exam_id] = 60 / finalExams.length;
        });
      } else if (caExams.length > 0) {
        caExams.forEach((e) => {
          resolvedWeights[e.exam_id] = 100 / caExams.length;
        });
      } else if (finalExams.length > 0) {
        finalExams.forEach((e) => {
          resolvedWeights[e.exam_id] = 100 / finalExams.length;
        });
      }
    }

    for (const reg of registrations) {
      let totalCAObtained = 0;
      let totalCAMax = 0;
      let totalFinalObtained = 0;
      let totalFinalMax = 0;

      let totalWeightedPercentage = 0;

      for (const exam of exams) {
        const mark = await this.prisma.examMark.findUnique({
          where: {
            student_id_exam_id: {
              student_id: reg.student_id,
              exam_id: exam.exam_id,
            },
          },
        });

        const score = mark ? mark.marks_obtained : 0;

        if (exam.exam_type.toUpperCase() === 'CA') {
          totalCAObtained += score;
          totalCAMax += exam.total_marks;
        } else {
          totalFinalObtained += score;
          totalFinalMax += exam.total_marks;
        }

        const weight = resolvedWeights[exam.exam_id] || 0;
        if (exam.total_marks > 0 && weight > 0) {
          totalWeightedPercentage += (score / exam.total_marks) * weight;
        }
      }

      const caPercentage = totalCAMax > 0 ? (totalCAObtained / totalCAMax) * 100 : 100;
      const finalPercentage = totalFinalMax > 0 ? (totalFinalObtained / totalFinalMax) * 100 : 100;

      const failedCA = totalCAMax > 0 && caPercentage < (cutoffs.ca ?? 40);
      const failedFinal = totalFinalMax > 0 && finalPercentage < (cutoffs.final ?? 35);

      let grade = '';
      let gradePoint = 0;

      if (failedCA && failedFinal) {
        grade = 'E(CA)/E(SA)';
        gradePoint = 0.0;
      } else if (failedCA) {
        grade = 'E(CA)';
        gradePoint = 0.0;
      } else if (failedFinal) {
        grade = 'E(SA)';
        gradePoint = 0.0;
      } else {
        const mapped = this.mapPercentageToCustomGrade(totalWeightedPercentage, gradeRanges);
        grade = mapped.grade;
        gradePoint = mapped.gradePoint;
      }

      await this.prisma.studentCourseGrade.upsert({
        where: {
          student_id_course_id: {
            student_id: reg.student_id,
            course_id: courseId,
          },
        },
        update: {
          continuous_assessment_marks: totalCAObtained,
          final_exam_marks: totalFinalObtained,
          total_marks: totalWeightedPercentage,
          grade,
          grade_point: gradePoint,
          result_status: submissionType,
        },
        create: {
          student_id: reg.student_id,
          course_id: courseId,
          continuous_assessment_marks: totalCAObtained,
          final_exam_marks: totalFinalObtained,
          total_marks: totalWeightedPercentage,
          grade,
          grade_point: gradePoint,
          result_status: submissionType,
        },
      });
    }
  }

  // Map percentage using custom boundaries
  private mapPercentageToCustomGrade(
    pct: number,
    ranges: any[] | null,
  ): { grade: string; gradePoint: number } {
    const defaultRanges = [
      { grade: 'A', min: 85.0, gp: 4.0 },
      { grade: 'A-', min: 80.0, gp: 3.7 },
      { grade: 'B+', min: 75.0, gp: 3.3 },
      { grade: 'B', min: 70.0, gp: 3.0 },
      { grade: 'B-', min: 65.0, gp: 2.7 },
      { grade: 'C+', min: 60.0, gp: 2.3 },
      { grade: 'C', min: 55.0, gp: 2.0 },
      { grade: 'C-', min: 50.0, gp: 1.7 },
      { grade: 'D', min: 40.0, gp: 1.0 },
      { grade: 'F', min: 0.0, gp: 0.0 },
    ];

    const activeRanges = ranges && ranges.length > 0 ? ranges : defaultRanges;
    const sorted = [...activeRanges].sort((a: any, b: any) => b.min - a.min);

    for (const r of sorted) {
      if (pct >= r.min) {
        return { grade: r.grade, gradePoint: r.gp ?? r.gradePoint ?? 0.0 };
      }
    }

    return { grade: 'F', gradePoint: 0.0 };
  }

  // =========================================================================
  // DEPARTMENT HEAD / DEAN RESULTS APPROVALS
  // =========================================================================

  async getHeadPendingApprovals(lecturerUserId: number) {
    const lecturer = await this.prisma.lecturer.findUnique({
      where: { user_id: lecturerUserId },
    });
    if (!lecturer || (!lecturer.is_head && !lecturer.is_dean)) {
      throw new ForbiddenException('Only department heads or deans can access this.');
    }

    const whereClause: Prisma.CourseWhereInput = {
      result_submission_status: {
        in: ['SUBMITTED_PROVISIONAL', 'SUBMITTED_FINAL'],
      },
    };

    if (lecturer.is_head && !lecturer.is_dean) {
      whereClause.department_id = lecturer.department_id;
    }

    return this.prisma.course.findMany({
      where: whereClause,
      include: {
        department: true,
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
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async headApproveCourse(courseId: number, lecturerUserId: number) {
    const lecturer = await this.prisma.lecturer.findUnique({
      where: { user_id: lecturerUserId },
    });
    if (!lecturer || (!lecturer.is_head && !lecturer.is_dean)) {
      throw new ForbiddenException('Only department heads or deans can approve.');
    }

    const course = await this.prisma.course.findUnique({
      where: { course_id: courseId },
    });
    if (!course) {
      throw new NotFoundException(`Course with ID ${courseId} not found`);
    }

    if (lecturer.is_head && !lecturer.is_dean && course.department_id !== lecturer.department_id) {
      throw new ForbiddenException('You can only approve courses from your department.');
    }

    if (course.result_submission_status === 'SUBMITTED_PROVISIONAL') {
      await this.prisma.$transaction([
        this.prisma.course.update({
          where: { course_id: courseId },
          data: {
            result_submission_status: 'PUBLISHED_PROVISIONAL',
            rejection_reason: null,
          },
        }),
        this.prisma.studentCourseGrade.updateMany({
          where: { course_id: courseId },
          data: {
            is_published: true,
            result_status: 'PROVISIONAL',
            is_locked: false,
          },
        }),
      ]);
    } else if (course.result_submission_status === 'SUBMITTED_FINAL') {
      await this.prisma.course.update({
        where: { course_id: courseId },
        data: {
          result_submission_status: 'SUBMITTED_TO_STAFF',
          rejection_reason: null,
        },
      });
    } else {
      throw new BadRequestException('Course is not in a submittable state for approval.');
    }

    return { success: true };
  }

  async headRejectCourse(courseId: number, reason: string, lecturerUserId: number) {
    const lecturer = await this.prisma.lecturer.findUnique({
      where: { user_id: lecturerUserId },
    });
    if (!lecturer || (!lecturer.is_head && !lecturer.is_dean)) {
      throw new ForbiddenException('Only department heads or deans can reject.');
    }

    const course = await this.prisma.course.findUnique({
      where: { course_id: courseId },
    });
    if (!course) {
      throw new NotFoundException(`Course with ID ${courseId} not found`);
    }

    if (lecturer.is_head && !lecturer.is_dean && course.department_id !== lecturer.department_id) {
      throw new ForbiddenException('You can only reject courses from your department.');
    }

    if (!reason || reason.trim() === '') {
      throw new BadRequestException('A reason for rejection must be provided.');
    }

    await this.prisma.course.update({
      where: { course_id: courseId },
      data: {
        result_submission_status: 'REJECTED_BY_HEAD',
        rejection_reason: reason.trim(),
      },
    });

    return { success: true };
  }

  async publishCourseCA(courseId: number, lecturerUserId: number) {
    const lecturer = await this.getLecturerByUserId(lecturerUserId);
    const isAssigned = await this.prisma.courseLecturer.findUnique({
      where: {
        course_id_lecturer_id: {
          course_id: courseId,
          lecturer_id: lecturer.lecturer_id,
        },
      },
    });
    if (!isAssigned) {
      throw new ForbiddenException('You are not assigned to teach this course.');
    }

    await this.prisma.course.update({
      where: { course_id: courseId },
      data: {
        ca_published: true,
      },
    });

    return { success: true };
  }

  // =========================================================================
  // EXAM DIVISION STAFF QUEUES
  // =========================================================================

  async getStaffReviewQueue() {
    return this.prisma.course.findMany({
      where: {
        result_submission_status: 'SUBMITTED_TO_STAFF',
      },
      include: {
        department: true,
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
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async getStaffReceivedQueue() {
    return this.prisma.course.findMany({
      where: {
        result_submission_status: 'RECEIVED_BY_STAFF',
      },
      include: {
        department: true,
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
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async getStaffApprovedDirectory() {
    return this.prisma.course.findMany({
      where: {
        result_submission_status: 'APPROVED',
      },
      include: {
        department: true,
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
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async staffReceiveCourse(courseId: number) {
    const course = await this.prisma.course.findUnique({
      where: { course_id: courseId },
    });
    if (!course) {
      throw new NotFoundException(`Course with ID ${courseId} not found`);
    }
    if (course.result_submission_status !== 'SUBMITTED_TO_STAFF') {
      throw new BadRequestException('Course final marks are not submitted to staff yet.');
    }

    await this.prisma.course.update({
      where: { course_id: courseId },
      data: {
        result_submission_status: 'RECEIVED_BY_STAFF',
        rejection_reason: null,
      },
    });

    return { success: true };
  }

  async staffRejectCourse(courseId: number, reason: string) {
    const course = await this.prisma.course.findUnique({
      where: { course_id: courseId },
    });
    if (!course) {
      throw new NotFoundException(`Course with ID ${courseId} not found`);
    }
    if (
      course.result_submission_status !== 'SUBMITTED_TO_STAFF' &&
      course.result_submission_status !== 'RECEIVED_BY_STAFF'
    ) {
      throw new BadRequestException('Course is not in a rejectable state for staff.');
    }
    if (!reason || reason.trim() === '') {
      throw new BadRequestException('A reason for rejection must be provided.');
    }

    await this.prisma.course.update({
      where: { course_id: courseId },
      data: {
        result_submission_status: 'REJECTED_BY_STAFF',
        rejection_reason: reason.trim(),
      },
    });

    return { success: true };
  }

  async staffApproveCourse(courseId: number) {
    const course = await this.prisma.course.findUnique({
      where: { course_id: courseId },
    });
    if (!course) {
      throw new NotFoundException(`Course with ID ${courseId} not found`);
    }
    if (course.result_submission_status !== 'RECEIVED_BY_STAFF') {
      throw new BadRequestException('Course must be marked as received before final approval.');
    }

    await this.prisma.$transaction([
      this.prisma.course.update({
        where: { course_id: courseId },
        data: {
          result_submission_status: 'APPROVED',
          rejection_reason: null,
        },
      }),
      this.prisma.studentCourseGrade.updateMany({
        where: { course_id: courseId },
        data: {
          is_published: true,
          result_status: 'FINAL',
          is_locked: true,
        },
      }),
    ]);

    return { success: true };
  }
}
