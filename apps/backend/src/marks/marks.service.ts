import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
  HttpException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ExamMark, Prisma } from '@prisma/client';
import { BulkRecordMarksDto } from './dtos/marks.dto';
import * as XLSX from 'xlsx';

@Injectable()
export class MarksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
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

  private isLecturerAuthorizedForCourseObj(course: any, lecturerId: number): boolean {
    const cfg =
      course.marks_config && typeof course.marks_config === 'object'
        ? (course.marks_config as Record<string, any>)
        : {};

    const isSameAsInCharge =
      cfg.isFirstMarkerSameAsInCharge !== undefined
        ? Boolean(cfg.isFirstMarkerSameAsInCharge)
        : true;

    const inChargeId =
      cfg.inChargeLecturerId !== undefined
        ? cfg.inChargeLecturerId
          ? Number(cfg.inChargeLecturerId)
          : null
        : isSameAsInCharge && course.first_marker_type !== 'EXTERNAL'
          ? course.first_marker_lecturer_id || null
          : null;

    // 1. Course In-Charge is always authorized to enter marks
    if (inChargeId && inChargeId === lecturerId) {
      return true;
    }

    // 2. Primary 1st Marker is authorized ONLY when 1st Marker and In-Charge are the same
    if (
      isSameAsInCharge &&
      course.first_marker_type !== 'EXTERNAL' &&
      course.first_marker_lecturer_id === lecturerId
    ) {
      return true;
    }

    // 3. Any newly added 1st Marker from the faculty (INTERNAL) is authorized to enter marks
    if (Array.isArray(cfg.additionalFirstMarkers)) {
      const isAdditionalInternal = cfg.additionalFirstMarkers.some(
        (m: any) => m?.type === 'INTERNAL' && Number(m?.lecturerId) === lecturerId,
      );
      if (isAdditionalInternal) {
        return true;
      }
    }

    // 4. If 1st Marker is explicitly different from In-Charge, the 1st Marker does not enter marks in the system
    if (
      !isSameAsInCharge &&
      course.first_marker_type !== 'EXTERNAL' &&
      course.first_marker_lecturer_id === lecturerId &&
      inChargeId !== lecturerId
    ) {
      return false;
    }

    // 5.Assigned course lecturer
    if (Array.isArray(course.lecturers)) {
      const isCourseLecturer = course.lecturers.some(
        (cl: any) => Number(cl.lecturer_id) === lecturerId,
      );
      if (isCourseLecturer) {
        return true;
      }
    }

    return false;
  }

  private async canLecturerAccessCourseMarks(
    courseId: number,
    lecturerId: number,
  ): Promise<boolean> {
    const course = await this.prisma.course.findUnique({
      where: { course_id: courseId },
      include: { lecturers: true },
    });
    if (!course) return false;
    return this.isLecturerAuthorizedForCourseObj(course, lecturerId);
  }

  async findMyCourses(lecturerUserId: number) {
    const lecturer = await this.getLecturerByUserId(lecturerUserId);

    const allCourses = await this.prisma.course.findMany({
      include: {
        department: true,
        lecturers: true,
        _count: {
          select: { registrations: true },
        },
      },
      orderBy: { course_code: 'asc' },
    });

    return allCourses.filter((c) => this.isLecturerAuthorizedForCourseObj(c, lecturer.lecturer_id));
  }

  async getStudentsRegisteredForCourse(courseId: number) {
    const course = await this.prisma.course.findUnique({
      where: { course_id: courseId },
    });
    if (!course) {
      throw new NotFoundException(`Course with ID ${courseId} not found`);
    }

    const isFinalPrepared = [
      'SUBMITTED_FINAL',
      'SUBMITTED_PROVISIONAL',
      'SUBMITTED',
      'SUBMITTED_TO_STAFF',
      'RECEIVED_BY_STAFF',
      'APPROVED',
      'PUBLISHED',
      'PUBLISHED_PROVISIONAL',
    ].includes(course.result_submission_status);

    let cfg: any = course.marks_config || {};
    if (typeof cfg === 'string') {
      try {
        cfg = JSON.parse(cfg);
      } catch {
        cfg = {};
      }
    }
    const caMarksConfig = cfg.caMarks || {};

    const caExams = await this.prisma.exam.findMany({
      where: { course_id: courseId, exam_type: 'CA' },
      select: { exam_id: true, total_marks: true },
    });
    const caExamIds = caExams.map((e) => e.exam_id);
    const caExamMarks =
      caExamIds.length > 0
        ? await this.prisma.examMark.findMany({
            where: { exam_id: { in: caExamIds } },
          })
        : [];

    const resolvedWeights = cfg.weights || {};
    const resolvedContributes = cfg.contributes || {};

    const contributingCaExams = caExams.filter((e) =>
      resolvedContributes[e.exam_id] !== undefined ? !!resolvedContributes[e.exam_id] : true,
    );

    const totalCaWeightAllocated =
      contributingCaExams.reduce((sum, e) => {
        const w = resolvedWeights[e.exam_id] !== undefined ? Number(resolvedWeights[e.exam_id]) : 0;
        return sum + (isNaN(w) ? 0 : w);
      }, 0) || Number((course as any).ca_weight || 40);

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
        course_grades: {
          where: { course_id: courseId },
          select: {
            continuous_assessment_marks: true,
            final_exam_marks: true,
            total_marks: true,
            grade: true,
          },
        },
      },
      orderBy: { registration_number: 'asc' },
    });

    return students.map((student) => {
      let caMarksVal: number | null = null;
      const studentCaMarks = caExamMarks.filter((m) => m.student_id === student.student_id);

      if (studentCaMarks.length > 0 && contributingCaExams.length > 0) {
        let weightedScore = 0;
        let hasMark = false;

        for (const caExam of contributingCaExams) {
          const markObj = studentCaMarks.find((m) => m.exam_id === caExam.exam_id);
          const weight =
            resolvedWeights[caExam.exam_id] !== undefined
              ? Number(resolvedWeights[caExam.exam_id])
              : contributingCaExams.length > 0
                ? totalCaWeightAllocated / contributingCaExams.length
                : 0;
          const maxMarks = caExam.total_marks || 100;

          if (markObj && markObj.marks_obtained !== null && markObj.marks_obtained !== undefined) {
            hasMark = true;
            const score = Number(markObj.marks_obtained);
            if (maxMarks > 0 && weight > 0) {
              weightedScore += (score / maxMarks) * weight;
            }
          }
        }

        if (hasMark) {
          caMarksVal = Math.round(weightedScore * 10) / 10;
        }
      } else if (caMarksConfig[student.student_id] !== undefined) {
        const rawCa = Number(caMarksConfig[student.student_id]);
        if (!isNaN(rawCa)) {
          caMarksVal = Math.round(((rawCa * totalCaWeightAllocated) / 100) * 10) / 10;
        }
      } else if (
        student.course_grades &&
        student.course_grades.length > 0 &&
        student.course_grades[0].continuous_assessment_marks !== null
      ) {
        const gradeCa = Number(student.course_grades[0].continuous_assessment_marks);
        if (!isNaN(gradeCa)) {
          caMarksVal =
            gradeCa > totalCaWeightAllocated
              ? Math.round(((gradeCa * totalCaWeightAllocated) / 100) * 10) / 10
              : Math.round(gradeCa * 10) / 10;
        }
      }

      const finalGradeVal =
        isFinalPrepared &&
        student.course_grades &&
        student.course_grades.length > 0 &&
        student.course_grades[0].grade
          ? student.course_grades[0].grade
          : null;

      return {
        ...student,
        ca_marks: caMarksVal !== null && !isNaN(caMarksVal) ? caMarksVal.toFixed(1) : null,
        final_grade: finalGradeVal,
        is_final_prepared: isFinalPrepared,
      };
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
      const isAssigned = await this.canLecturerAccessCourseMarks(
        exam.course_id,
        lecturer.lecturer_id,
      );

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
      const isAssigned = await this.canLecturerAccessCourseMarks(
        exam.course_id,
        lecturer.lecturer_id,
      );

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
                batch: true,
              },
            },
          },
        },
      },
    });

    const courseDistribution = courses.map((c) => {
      const batchStr = c.registrations[0]?.student?.batch || '21/22';

      return {
        courseId: c.course_id,
        courseCode: c.course_code,
        courseName: c.course_name,
        studentCount: c.registrations.length,
        latestSemesterCount: c.registrations.length,
        batch: batchStr,
        semester: c.semester,
      };
    });

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
      const isAssigned = await this.canLecturerAccessCourseMarks(courseId, lecturer.lecturer_id);
      if (!isAssigned) {
        throw new BadRequestException('You are not authorized to access this course.');
      }
    }

    // 2. Get registrations for this course with student details
    const registrations = await this.prisma.courseRegistration.findMany({
      where: { course_id: courseId },
      include: {
        student: {
          include: {
            user: {
              select: {
                full_name: true,
                name_with_initials: true,
                email: true,
              },
            },
          },
        },
      },
    });

    // Sort students: regular/proper attempt students at the top, repeat/violation/held at the bottom
    registrations.sort((a, b) => {
      const aIsRepeat = a.attempt_type !== 'PROPER' || a.attempt_number > 1 || a.is_held;
      const bIsRepeat = b.attempt_type !== 'PROPER' || b.attempt_number > 1 || b.is_held;

      if (aIsRepeat !== bIsRepeat) {
        return aIsRepeat ? 1 : -1;
      }
      return (a.student.registration_number || '').localeCompare(
        b.student.registration_number || '',
      );
    });

    // Get the batch (enrollment year of the first student, or default to 21/22)
    const batch = registrations[0]?.student?.batch || '21/22';

    const rows: any[][] = [
      ['Student List'],
      ['Course Code:', course.course_code],
      ['Course Name:', course.course_name],
      ['Batch:', `${batch}`],
      [],
      ['Registration Number', 'Index Number', 'Full Name', 'Email', 'Attempt Type'],
    ];

    registrations.forEach((reg) => {
      const s = reg.student;
      let typeLabel = reg.attempt_type || 'PROPER';
      if (reg.is_held) typeLabel += ' (HELD)';
      rows.push([
        s.registration_number,
        s.index_number,
        s.user?.full_name || '',
        s.user?.email || '',
        typeLabel,
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(rows);

    // Apply column widths
    worksheet['!cols'] = [
      { wch: 25 }, // Registration Number
      { wch: 25 }, // Index Number
      { wch: 40 }, // Full Name
      { wch: 35 }, // Email
      { wch: 20 }, // Attempt Type
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
      include: {
        publishing_progress: true,
      },
    });
    if (!course) {
      throw new NotFoundException(`Course with ID ${courseId} not found`);
    }

    if (isLecturer) {
      const lecturer = await this.getLecturerByUserId(lecturerUserId);
      if (!lecturer.is_head && !lecturer.is_dean) {
        const isAssigned = await this.canLecturerAccessCourseMarks(courseId, lecturer.lecturer_id);
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
        registrations: {
          where: { course_id: courseId },
          select: {
            attempt_type: true,
            attempt_number: true,
          },
        },
      },
      orderBy: { index_number: 'asc' },
    });

    let exams = await this.prisma.exam.findMany({
      where: { course_id: courseId },
      orderBy: { exam_id: 'asc' },
    });

    // Default End Semester Examination: Every course has a default FINAL exam with 100% weight
    if (exams.length === 0) {
      const defaultExam = await this.prisma.exam.create({
        data: {
          course_id: courseId,
          exam_type: 'FINAL',
          exam_title: 'End Semester Examination',
          total_marks: 100,
          exam_date: new Date(),
          start_time: new Date(1970, 0, 1, 9, 0, 0),
          end_time: new Date(1970, 0, 1, 12, 0, 0),
        },
      });
      exams = [defaultExam];

      let currentConfig: any = course.marks_config || {};
      if (typeof currentConfig === 'string') {
        try {
          currentConfig = JSON.parse(currentConfig);
        } catch {
          currentConfig = {};
        }
      }
      currentConfig.weights = { ...(currentConfig.weights || {}), [defaultExam.exam_id]: 100 };
      currentConfig.contributes = {
        ...(currentConfig.contributes || {}),
        [defaultExam.exam_id]: true,
      };

      await this.prisma.course.update({
        where: { course_id: courseId },
        data: { marks_config: currentConfig },
      });
      (course as any).marks_config = currentConfig;
    }

    const examIds = exams.map((e) => e.exam_id);
    const marks = await this.prisma.examMark.findMany({
      where: {
        exam_id: { in: examIds },
      },
    });

    const courseGrades = await this.prisma.studentCourseGrade.findMany({
      where: { course_id: courseId },
      include: {
        student: {
          include: {
            user: true,
          },
        },
      },
    });

    // Academic Integrity Safeguard: Never disclose 2nd marker draft evaluations to 1st marker before official submission
    if (isLecturer && course) {
      let cfg: any = course.marks_config || {};
      if (typeof cfg === 'string') {
        try {
          cfg = JSON.parse(cfg);
        } catch {
          cfg = {};
        }
      }
      if (cfg.secondMarkerSheet && !cfg.secondMarkerSheet.submitted) {
        (course as any).marks_config = {
          ...cfg,
          secondMarkerSheet: {
            submitted: false,
            submittedAt: null,
            marks: {},
          },
        };
      }
    }

    return {
      course,
      students,
      exams,
      marks,
      grades: courseGrades,
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
      const isAssigned = await this.canLecturerAccessCourseMarks(courseId, lecturer.lecturer_id);
      if (!isAssigned) {
        throw new BadRequestException('You are not authorized to configure this course.');
      }
    }

    const existingCourse = await this.prisma.course.findUnique({
      where: { course_id: courseId },
      select: { marks_config: true },
    });
    const existingConfig =
      existingCourse?.marks_config && typeof existingCourse.marks_config === 'object'
        ? (existingCourse.marks_config as Record<string, any>)
        : {};

    const newConfig = {
      ...existingConfig,
      ...(config || {}),
    };

    if (
      config?.firstMarkerSheet === null ||
      (config?.firstMarkerSheet === undefined && 'firstMarkerSheet' in config)
    ) {
      delete newConfig.firstMarkerSheet;
    }

    if (config?.questions === null || (config?.questions === undefined && 'questions' in config)) {
      delete newConfig.questions;
    }

    return this.prisma.course.update({
      where: { course_id: courseId },
      data: {
        marks_config: newConfig,
      },
    });
  }

  // 3. Create Course Exam (Add assessment)
  async createCourseExam(
    courseId: number,
    data: {
      exam_type: string;
      exam_title: string;
      total_marks: number;
      weight?: number;
      contributes?: boolean;
    },
    lecturerUserId: number,
    isLecturer: boolean,
  ) {
    if (isLecturer) {
      const lecturer = await this.getLecturerByUserId(lecturerUserId);
      const isAssigned = await this.canLecturerAccessCourseMarks(courseId, lecturer.lecturer_id);
      if (!isAssigned) {
        throw new BadRequestException('You are not authorized to manage exams for this course.');
      }
    }

    const exam = await this.prisma.exam.create({
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

    if (data.weight !== undefined || data.contributes !== undefined) {
      const course = await this.prisma.course.findUnique({ where: { course_id: courseId } });
      let currentConfig: any = course?.marks_config || {};
      if (typeof currentConfig === 'string') {
        try {
          currentConfig = JSON.parse(currentConfig);
        } catch {
          currentConfig = {};
        }
      }
      const weights = currentConfig.weights || {};
      const contributes = currentConfig.contributes || {};

      if (data.weight !== undefined) weights[exam.exam_id] = data.weight;
      if (data.contributes !== undefined) contributes[exam.exam_id] = data.contributes;

      // Automatically reduce End Semester Examination weight according to added CA weights!
      const allCourseExams = await this.prisma.exam.findMany({ where: { course_id: courseId } });
      const caExams = allCourseExams.filter((e) => e.exam_type?.toUpperCase() === 'CA');
      const finalExams = allCourseExams.filter((e) => e.exam_type?.toUpperCase() === 'FINAL');

      let totalCaWeight = 0;
      caExams.forEach((ce) => {
        const isContrib = contributes[ce.exam_id] !== undefined ? !!contributes[ce.exam_id] : true;
        if (isContrib) {
          totalCaWeight += Number(weights[ce.exam_id] || 0);
        }
      });

      const remainingFinalWeight = Math.max(0, parseFloat((100 - totalCaWeight).toFixed(1)));
      if (finalExams.length > 0) {
        weights[finalExams[0].exam_id] = remainingFinalWeight;
        contributes[finalExams[0].exam_id] = true;
      }

      await this.prisma.course.update({
        where: { course_id: courseId },
        data: {
          marks_config: {
            ...currentConfig,
            weights,
            contributes,
          },
        },
      });
    }

    return exam;
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
      const isAssigned = await this.canLecturerAccessCourseMarks(courseId, lecturer.lecturer_id);
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
      const isAssigned = await this.canLecturerAccessCourseMarks(courseId, lecturer.lecturer_id);
      if (!isAssigned) {
        throw new BadRequestException('You are not authorized to manage exams for this course.');
      }
    }

    const deleted = await this.prisma.exam.delete({
      where: { exam_id: examId },
    });

    // Rebalance End Semester Examination weight after deleting an assessment
    const course = await this.prisma.course.findUnique({ where: { course_id: courseId } });
    let currentConfig: any = course?.marks_config || {};
    if (typeof currentConfig === 'string') {
      try {
        currentConfig = JSON.parse(currentConfig);
      } catch {
        currentConfig = {};
      }
    }
    const weights = currentConfig.weights || {};
    const contributes = currentConfig.contributes || {};
    delete weights[examId];
    delete contributes[examId];

    const allRemainingExams = await this.prisma.exam.findMany({ where: { course_id: courseId } });
    const caExams = allRemainingExams.filter((e) => e.exam_type?.toUpperCase() === 'CA');
    const finalExams = allRemainingExams.filter((e) => e.exam_type?.toUpperCase() === 'FINAL');

    let totalCaWeight = 0;
    caExams.forEach((ce) => {
      const isContrib = contributes[ce.exam_id] !== undefined ? !!contributes[ce.exam_id] : true;
      if (isContrib) {
        totalCaWeight += Number(weights[ce.exam_id] || 0);
      }
    });

    const remainingFinalWeight = Math.max(0, parseFloat((100 - totalCaWeight).toFixed(1)));
    if (finalExams.length > 0) {
      weights[finalExams[0].exam_id] = remainingFinalWeight;
    }

    await this.prisma.course.update({
      where: { course_id: courseId },
      data: {
        marks_config: {
          ...currentConfig,
          weights,
          contributes,
        },
      },
    });

    return deleted;
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
      const isAssigned = await this.canLecturerAccessCourseMarks(courseId, lecturer.lecturer_id);
      if (!isAssigned) {
        throw new BadRequestException('You are not authorized to grade this course.');
      }

      const lockedStatuses = [
        'SUBMITTED_FINAL',
        'SUBMITTED_PROVISIONAL',
        'SUBMITTED',
        'SUBMITTED_TO_STAFF',
        'RECEIVED_BY_STAFF',
        'APPROVED',
        'PUBLISHED',
        'PUBLISHED_PROVISIONAL',
      ];
      if (
        lockedStatuses.includes(course.result_submission_status) &&
        course.result_submission_status !== 'REJECTED_BY_HEAD' &&
        course.result_submission_status !== 'REJECTED_BY_STAFF'
      ) {
        throw new BadRequestException(
          'Marksheet is currently submitted and locked. Modifications are not allowed unless rejected by the Department Head.',
        );
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

    if ((data as any).caMarks) {
      const course = await this.prisma.course.findUnique({ where: { course_id: courseId } });
      let currentConfig: any = course?.marks_config || {};
      if (typeof currentConfig === 'string') {
        try {
          currentConfig = JSON.parse(currentConfig);
        } catch {
          currentConfig = {};
        }
      }
      currentConfig.caMarks = { ...(currentConfig.caMarks || {}), ...(data as any).caMarks };
      await this.prisma.course.update({
        where: { course_id: courseId },
        data: { marks_config: currentConfig },
      });
    }

    if (data.submissionType) {
      let dbStatus = '';
      if (data.submissionType === 'PROVISIONAL') {
        dbStatus = 'SUBMITTED_PROVISIONAL';
      } else if (data.submissionType === 'FINAL') {
        dbStatus = 'SUBMITTED_FINAL';
      } else {
        dbStatus = 'DRAFT';
      }

      const courseForCfg = await this.prisma.course.findUnique({ where: { course_id: courseId } });
      let currentConfig: any = courseForCfg?.marks_config || {};
      if (typeof currentConfig === 'string') {
        try {
          currentConfig = JSON.parse(currentConfig);
        } catch {
          currentConfig = {};
        }
      }
      if (data.submissionType === 'FINAL') {
        currentConfig.finalSubmission = {
          submitted: true,
          submittedAt: new Date().toISOString(),
        };
      }

      await this.prisma.course.update({
        where: { course_id: courseId },
        data: {
          result_submission_status: dbStatus,
          rejection_reason: null,
          marks_config: currentConfig,
        },
      });

      await this.prisma.coursePublishingProgress.upsert({
        where: { course_id: courseId },
        update: { first_marking_submitted: true, final_submitted: true },
        create: { course_id: courseId, first_marking_submitted: true, final_submitted: true },
      });

      await this.compileCourseGradesForSubmission(courseId, data.submissionType);
    }

    return { success: true };
  }

  // Revoke Course Grid (before Head approval)
  async revokeCourseGrid(courseId: number, executorUserId: number, isLecturer: boolean) {
    const course = await this.prisma.course.findUnique({
      where: { course_id: courseId },
    });
    if (!course) {
      throw new NotFoundException(`Course with ID ${courseId} not found`);
    }

    if (isLecturer) {
      const lecturer = await this.getLecturerByUserId(executorUserId);
      const isAssigned = await this.canLecturerAccessCourseMarks(courseId, lecturer.lecturer_id);
      if (!isAssigned) {
        throw new BadRequestException('You are not authorized to revoke marks for this course.');
      }
    }

    const currentStatus = course.result_submission_status;
    if (
      currentStatus === 'APPROVED' ||
      currentStatus === 'PUBLISHED_PROVISIONAL' ||
      currentStatus === 'SUBMITTED_TO_STAFF' ||
      currentStatus === 'RECEIVED_BY_STAFF'
    ) {
      throw new BadRequestException(
        'Cannot revoke result sheet after Department Head or Exam Staff approval.',
      );
    }

    if (!currentStatus || currentStatus === 'DRAFT') {
      throw new BadRequestException('Result sheet is not submitted yet.');
    }

    const courseForCfg = await this.prisma.course.findUnique({ where: { course_id: courseId } });
    let currentConfig: any = courseForCfg?.marks_config || {};
    if (typeof currentConfig === 'string') {
      try {
        currentConfig = JSON.parse(currentConfig);
      } catch {
        currentConfig = {};
      }
    }
    if (currentConfig.finalSubmission) {
      currentConfig.finalSubmission = {
        submitted: false,
        submittedAt: null,
      };
    }

    await this.prisma.$transaction([
      this.prisma.course.update({
        where: { course_id: courseId },
        data: {
          result_submission_status: 'DRAFT',
          rejection_reason: null,
          marks_config: currentConfig,
        },
      }),
      this.prisma.studentCourseGrade.updateMany({
        where: { course_id: courseId },
        data: {
          result_status: 'DRAFT',
          is_locked: false,
          is_published: false,
        },
      }),
      this.prisma.examMark.updateMany({
        where: {
          exam: { course_id: courseId },
        },
        data: {
          grading_status: 'PENDING',
        },
      }),
    ]);

    await this.prisma.coursePublishingProgress.upsert({
      where: { course_id: courseId },
      update: { final_submitted: false },
      create: { course_id: courseId, final_submitted: false },
    });

    return {
      success: true,
      message: 'Submitted result sheet revoked successfully. You can now edit marks.',
    };
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
    const contributes = config.contributes || {};
    const cutoffs = config.cutoffs || { ca: 40, final: 35 };
    const gradeRanges = config.grade_ranges || null;

    const caExams = exams.filter((e) => e.exam_type.toUpperCase() === 'CA');
    const finalExams = exams.filter((e) => e.exam_type.toUpperCase() === 'FINAL');

    const resolvedWeights: { [examId: number]: number } = {};
    const resolvedContributes: { [examId: number]: boolean } = {};

    const hasCustomWeights = Object.keys(weights).length > 0;

    exams.forEach((e) => {
      const isContributing = contributes[e.exam_id] !== undefined ? !!contributes[e.exam_id] : true;
      resolvedContributes[e.exam_id] = isContributing;

      if (hasCustomWeights) {
        resolvedWeights[e.exam_id] =
          isContributing && weights[e.exam_id] !== undefined ? parseFloat(weights[e.exam_id]) : 0;
      }
    });

    if (!hasCustomWeights) {
      const activeCaExams = caExams.filter((e) => resolvedContributes[e.exam_id]);
      if (activeCaExams.length > 0 && finalExams.length > 0) {
        activeCaExams.forEach((e) => {
          resolvedWeights[e.exam_id] = 40 / activeCaExams.length;
        });
        finalExams.forEach((e) => {
          resolvedWeights[e.exam_id] = 60 / finalExams.length;
        });
      } else if (activeCaExams.length > 0) {
        activeCaExams.forEach((e) => {
          resolvedWeights[e.exam_id] = 100 / activeCaExams.length;
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
      let totalCAWeightedScore = 0;
      let totalCAWeight = 0;

      let totalFinalObtained = 0;
      let totalFinalMax = 0;
      let totalFinalWeightedScore = 0;
      let totalFinalWeight = 0;

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
        const isContributing = resolvedContributes[exam.exam_id];
        const weight = resolvedWeights[exam.exam_id] || 0;

        if (exam.exam_type.toUpperCase() === 'CA') {
          if (isContributing) {
            totalCAObtained += score;
            totalCAMax += exam.total_marks;
            totalCAWeight += weight;
            if (exam.total_marks > 0 && weight > 0) {
              totalCAWeightedScore += (score / exam.total_marks) * weight;
            }
          }
        } else {
          totalFinalObtained += score;
          totalFinalMax += exam.total_marks;
          totalFinalWeight += weight;
          if (exam.total_marks > 0 && weight > 0) {
            totalFinalWeightedScore += (score / exam.total_marks) * weight;
          }
        }
      }

      const totalWeightedPercentage = totalCAWeightedScore + totalFinalWeightedScore;

      const caPercentage =
        totalCAWeight > 0
          ? (totalCAWeightedScore / totalCAWeight) * 100
          : totalCAMax > 0
            ? (totalCAObtained / totalCAMax) * 100
            : 100;
      const finalPercentage =
        totalFinalWeight > 0
          ? (totalFinalWeightedScore / totalFinalWeight) * 100
          : totalFinalMax > 0
            ? (totalFinalObtained / totalFinalMax) * 100
            : 100;

      const failedCA = totalCAWeight > 0 && caPercentage < (cutoffs.ca ?? 40);
      const failedFinal = totalFinalWeight > 0 && finalPercentage < (cutoffs.final ?? 35);

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

      const attemptNumber = reg.attempt_number || 1;
      const attemptType = reg.attempt_type || 'PROPER';
      let maxAllowedGrade: string | null = null;

      if (
        ['REPEAT_1', 'REPEAT_2', 'REPEAT_VIOLATION', 'REPEAT'].includes(attemptType) ||
        attemptNumber > 1
      ) {
        maxAllowedGrade = 'C';
      }

      if (maxAllowedGrade === 'C' && gradePoint > 2.0) {
        grade = 'C';
        gradePoint = 2.0;
      }

      await this.prisma.studentCourseGrade.upsert({
        where: {
          unique_student_course_grade_attempt: {
            student_id: reg.student_id,
            course_id: courseId,
            attempt_number: attemptNumber,
          },
        },
        update: {
          continuous_assessment_marks: Math.round(totalCAWeightedScore * 10) / 10,
          final_exam_marks: totalFinalObtained,
          total_marks: totalWeightedPercentage,
          grade,
          grade_point: gradePoint,
          attempt_type: attemptType,
          max_allowed_grade: maxAllowedGrade,
          result_status: submissionType,
        },
        create: {
          student_id: reg.student_id,
          course_id: courseId,
          attempt_number: attemptNumber,
          attempt_type: attemptType,
          max_allowed_grade: maxAllowedGrade,
          continuous_assessment_marks: Math.round(totalCAWeightedScore * 10) / 10,
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

    const nowIso = new Date().toISOString();
    let currentConfig: any = course.marks_config || {};
    if (typeof currentConfig === 'string') {
      try {
        currentConfig = JSON.parse(currentConfig);
      } catch {
        currentConfig = {};
      }
    }
    currentConfig.headApproval = {
      approved: true,
      approvedAt: nowIso,
      approvedBy: lecturerUserId,
    };

    if (course.result_submission_status === 'SUBMITTED_PROVISIONAL') {
      await this.prisma.$transaction([
        this.prisma.course.update({
          where: { course_id: courseId },
          data: {
            result_submission_status: 'PUBLISHED_PROVISIONAL',
            rejection_reason: null,
            marks_config: currentConfig,
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
          marks_config: currentConfig,
        },
      });
    } else {
      throw new BadRequestException('Course is not in a submittable state for approval.');
    }

    await this.prisma.coursePublishingProgress.upsert({
      where: { course_id: courseId },
      update: { head_approved: true },
      create: { course_id: courseId, head_approved: true },
    });

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

    let currentConfig: any = course.marks_config || {};
    if (typeof currentConfig === 'string') {
      try {
        currentConfig = JSON.parse(currentConfig);
      } catch {
        currentConfig = {};
      }
    }
    if (currentConfig.headApproval) {
      currentConfig.headApproval = {
        approved: false,
        approvedAt: null,
      };
    }
    if (currentConfig.finalSubmission) {
      currentConfig.finalSubmission = {
        submitted: false,
        submittedAt: null,
      };
    }

    await this.prisma.course.update({
      where: { course_id: courseId },
      data: {
        result_submission_status: 'REJECTED_BY_HEAD',
        rejection_reason: reason.trim(),
        marks_config: currentConfig,
      },
    });

    await this.prisma.coursePublishingProgress.upsert({
      where: { course_id: courseId },
      update: { head_approved: false, final_submitted: false },
      create: { course_id: courseId, head_approved: false, final_submitted: false },
    });

    return { success: true };
  }

  async publishCourseCA(courseId: number, lecturerUserId: number) {
    const lecturer = await this.getLecturerByUserId(lecturerUserId);
    const isAssigned = await this.canLecturerAccessCourseMarks(courseId, lecturer.lecturer_id);
    if (!isAssigned) {
      throw new ForbiddenException('You are not assigned to teach or manage this course.');
    }

    const course = await this.prisma.course.findUnique({
      where: { course_id: courseId },
      include: {
        exams: true,
        registrations: {
          include: {
            student: true,
          },
        },
      },
    });

    if (!course) {
      throw new NotFoundException(`Course ${courseId} not found`);
    }

    await this.prisma.course.update({
      where: { course_id: courseId },
      data: {
        ca_published: true,
      },
    });

    // Calculate & persist CA marks for each registered student
    const cfg: any =
      typeof course.marks_config === 'string'
        ? (() => {
            try {
              return JSON.parse(course.marks_config as string);
            } catch {
              return {};
            }
          })()
        : course.marks_config || {};

    const weights = cfg.weights || {};
    const contributes = cfg.contributes || {};
    const caMarksConfig = cfg.caMarks || {};

    const caExams = course.exams.filter((e) => e.exam_type?.toUpperCase() === 'CA');
    const caExamIds = caExams.map((e) => e.exam_id);
    const caExamMarks =
      caExamIds.length > 0
        ? await this.prisma.examMark.findMany({
            where: { exam_id: { in: caExamIds } },
          })
        : [];

    const contributingCaExams = caExams.filter((e) =>
      contributes[e.exam_id] !== undefined ? !!contributes[e.exam_id] : true,
    );

    const totalCaWeightAllocated =
      contributingCaExams.reduce((sum, e) => {
        const w = weights[e.exam_id] !== undefined ? Number(weights[e.exam_id]) : 0;
        return sum + (isNaN(w) ? 0 : w);
      }, 0) ||
      Number(cfg.caWeight) ||
      Number((course as any).ca_weight) ||
      40;

    for (const reg of course.registrations) {
      let caMarksVal: number | null = null;
      const studentCaMarks = caExamMarks.filter((m) => m.student_id === reg.student_id);

      if (studentCaMarks.length > 0 && contributingCaExams.length > 0) {
        let weightedScore = 0;
        let hasMark = false;

        for (const caExam of contributingCaExams) {
          const markObj = studentCaMarks.find((m) => m.exam_id === caExam.exam_id);
          const weight =
            weights[caExam.exam_id] !== undefined
              ? Number(weights[caExam.exam_id])
              : contributingCaExams.length > 0
                ? totalCaWeightAllocated / contributingCaExams.length
                : 0;
          const maxMarks = caExam.total_marks || 100;

          if (markObj && markObj.marks_obtained !== null && markObj.marks_obtained !== undefined) {
            hasMark = true;
            const score = Number(markObj.marks_obtained);
            if (maxMarks > 0 && weight > 0) {
              weightedScore += (score / maxMarks) * weight;
            }
          }
        }

        if (hasMark) {
          caMarksVal = Math.round(weightedScore * 10) / 10;
        }
      } else if (caMarksConfig[reg.student_id] !== undefined) {
        const rawCa = Number(caMarksConfig[reg.student_id]);
        if (!isNaN(rawCa)) {
          caMarksVal = Math.round(((rawCa * totalCaWeightAllocated) / 100) * 10) / 10;
        }
      }

      if (caMarksVal !== null) {
        const attemptNum = reg.attempt_number || 1;
        const attemptTyp = reg.attempt_type || 'PROPER';

        await this.prisma.studentCourseGrade.upsert({
          where: {
            unique_student_course_grade_attempt: {
              student_id: reg.student_id,
              course_id: courseId,
              attempt_number: attemptNum,
            },
          },
          update: {
            continuous_assessment_marks: caMarksVal,
          },
          create: {
            student_id: reg.student_id,
            course_id: courseId,
            attempt_number: attemptNum,
            attempt_type: attemptTyp,
            continuous_assessment_marks: caMarksVal,
            final_exam_marks: 0,
            total_marks: caMarksVal,
            grade: 'Pending',
            grade_point: 0,
            is_published: false,
          },
        });
      }
    }

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

    let currentConfig: any = course.marks_config || {};
    if (typeof currentConfig === 'string') {
      try {
        currentConfig = JSON.parse(currentConfig);
      } catch {
        currentConfig = {};
      }
    }
    if (currentConfig.resultsPublished) {
      currentConfig.resultsPublished = {
        published: false,
        publishedAt: null,
      };
    }

    await this.prisma.course.update({
      where: { course_id: courseId },
      data: {
        result_submission_status: 'REJECTED_BY_STAFF',
        rejection_reason: reason.trim(),
        marks_config: currentConfig,
      },
    });

    await this.prisma.coursePublishingProgress.upsert({
      where: { course_id: courseId },
      update: { results_published: false },
      create: { course_id: courseId, results_published: false },
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

    const nowIso = new Date().toISOString();
    let currentConfig: any = course.marks_config || {};
    if (typeof currentConfig === 'string') {
      try {
        currentConfig = JSON.parse(currentConfig);
      } catch {
        currentConfig = {};
      }
    }
    currentConfig.resultsPublished = {
      published: true,
      publishedAt: nowIso,
    };

    await this.prisma.$transaction([
      this.prisma.course.update({
        where: { course_id: courseId },
        data: {
          result_submission_status: 'APPROVED',
          rejection_reason: null,
          marks_config: currentConfig,
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

    await this.prisma.coursePublishingProgress.upsert({
      where: { course_id: courseId },
      update: { results_published: true },
      create: { course_id: courseId, results_published: true },
    });

    return { success: true };
  }

  // =========================================================================
  // SECOND MARKING MAGIC LINK & EVALUATION
  // =========================================================================

  async verifySecondMarkingToken(token: string) {
    if (!token) {
      throw new BadRequestException('Magic token is required.');
    }

    try {
      const jsonStr = Buffer.from(token, 'base64url').toString('utf-8');
      const payload = JSON.parse(jsonStr);

      if (!payload.courseId || !payload.exp) {
        throw new BadRequestException('Invalid magic token payload.');
      }

      if (Date.now() > payload.exp) {
        throw new BadRequestException('Magic token has expired.');
      }

      const course = await this.prisma.course.findUnique({
        where: { course_id: payload.courseId },
        include: {
          department: true,
          first_marker_lecturer: { include: { user: true } },
          second_marker_lecturer: { include: { user: true } },
          publishing_progress: true,
        },
      });

      if (!course) {
        throw new NotFoundException('Course referenced in token not found.');
      }

      const staffSubmittedStatuses = [
        'SUBMITTED_FINAL',
        'SUBMITTED_TO_STAFF',
        'RECEIVED_BY_STAFF',
        'APPROVED',
        'PUBLISHED',
      ];
      const isFinalSubmittedToStaff =
        staffSubmittedStatuses.includes(course.result_submission_status) ||
        Boolean(course.publishing_progress?.final_submitted);

      if (isFinalSubmittedToStaff) {
        throw new BadRequestException(
          'Evaluation concluded: The detailed marksheet has already been submitted to the Examination Division. This link has expired.',
        );
      }

      const registeredEmail =
        (course.second_marker_type === 'EXTERNAL'
          ? course.second_marker_email
          : course.second_marker_lecturer?.user?.email) ||
        course.second_marker_email ||
        course.second_marker_lecturer?.user?.email;

      if (
        !registeredEmail ||
        registeredEmail.trim().toLowerCase() !== payload.email?.trim().toLowerCase()
      ) {
        throw new UnauthorizedException(
          'Magic link authentication failed: Token email does not match the registered 2nd marker for this course.',
        );
      }

      const students = await this.getStudentsRegisteredForCourse(course.course_id);
      const grid = await this.getCourseGridData(course.course_id, 0, false);
      const exam = await this.prisma.exam.findFirst({
        where: { course_id: course.course_id },
        select: { exam_id: true, exam_title: true, exam_type: true },
      });

      return {
        course,
        students,
        grid,
        examTitle: exam?.exam_title || `${course.course_name} Final Examination`,
        tokenEmail: payload.email,
        isSubmitted: Boolean(
          (course.marks_config as any)?.secondMarkerSheet?.submitted ||
          course.publishing_progress?.second_marking_submitted,
        ),
      };
    } catch (err: any) {
      if (err instanceof HttpException) {
        throw err;
      }
      throw new BadRequestException('Invalid or corrupted magic token.');
    }
  }

  // Submit 1st Marking to 2nd Marker
  async submitFirstMarking(
    courseId: number,
    dto: { marks?: any; config?: any },
    _executorUserId: number,
    _isLecturer: boolean,
  ) {
    const course = await this.prisma.course.findUnique({
      where: { course_id: courseId },
      include: {
        first_marker_lecturer: { include: { user: true } },
        second_marker_lecturer: { include: { user: true } },
      },
    });

    if (!course) {
      throw new NotFoundException(`Course with ID ${courseId} not found`);
    }

    let existingConfig: any = course.marks_config || {};
    if (typeof existingConfig === 'string') {
      try {
        existingConfig = JSON.parse(existingConfig);
      } catch {
        existingConfig = {};
      }
    }

    if (dto.config) {
      existingConfig = { ...existingConfig, ...dto.config };
    }
    if (dto.marks) {
      existingConfig.firstMarkerSheet = {
        submitted: true,
        submittedAt: new Date().toISOString(),
        marks: dto.marks,
      };
    } else if (existingConfig.firstMarkerSheet) {
      existingConfig.firstMarkerSheet.submitted = true;
      existingConfig.firstMarkerSheet.submittedAt = new Date().toISOString();
    } else {
      existingConfig.firstMarkerSheet = {
        submitted: true,
        submittedAt: new Date().toISOString(),
        marks: {},
      };
    }

    await this.prisma.course.update({
      where: { course_id: courseId },
      data: {
        marks_config: existingConfig,
      },
    });

    // Update publishing progress
    await this.prisma.coursePublishingProgress.upsert({
      where: { course_id: courseId },
      update: { first_marking_submitted: true },
      create: { course_id: courseId, first_marking_submitted: true },
    });

    // Send email to Second Marker
    const secondMarkerEmail =
      course.second_marker_type === 'EXTERNAL'
        ? course.second_marker_email
        : course.second_marker_lecturer?.user?.email;

    const secondMarkerName =
      course.second_marker_type === 'EXTERNAL'
        ? course.second_marker_name || 'Second Marker'
        : course.second_marker_lecturer?.user?.full_name || 'Second Marker';

    if (secondMarkerEmail) {
      const payload = {
        courseId,
        email: secondMarkerEmail,
        exp: Date.now() + 30 * 24 * 60 * 60 * 1000,
      };
      const token = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const magicLinkUrl = `${frontendUrl}/second-marking-portal?token=${token}`;

      await this.notificationsService.sendSecondMarkerMagicLinkNotification(
        secondMarkerEmail,
        secondMarkerName,
        course.course_code,
        course.course_name,
        magicLinkUrl,
        course.second_marker_type || 'INTERNAL',
      );
    }

    return {
      success: true,
      message: '1st marking submitted to 2nd marker successfully.',
      magicTokenCreated: Boolean(secondMarkerEmail),
    };
  }

  async saveSecondMarkingDraft(courseId: number, dto: { marks: any; config?: any }) {
    const course = await this.prisma.course.findUnique({
      where: { course_id: courseId },
      include: { publishing_progress: true },
    });
    if (!course) {
      throw new NotFoundException(`Course with ID ${courseId} not found`);
    }

    const staffSubmittedStatuses = [
      'SUBMITTED_FINAL',
      'SUBMITTED_TO_STAFF',
      'RECEIVED_BY_STAFF',
      'APPROVED',
      'PUBLISHED',
    ];
    if (
      staffSubmittedStatuses.includes(course.result_submission_status) ||
      Boolean(course.publishing_progress?.final_submitted)
    ) {
      throw new BadRequestException(
        'Evaluation period has ended. The marksheet has been submitted to Examination Division.',
      );
    }

    let existingConfig: any = course.marks_config || {};
    if (typeof existingConfig === 'string') {
      try {
        existingConfig = JSON.parse(existingConfig);
      } catch {
        existingConfig = {};
      }
    }

    if (existingConfig.secondMarkerSheet?.submitted) {
      throw new BadRequestException('2nd marking has already been submitted and is locked.');
    }

    existingConfig.secondMarkerSheet = {
      submitted: false,
      submittedAt: existingConfig.secondMarkerSheet?.submittedAt || null,
      marks: dto.marks || existingConfig.secondMarkerSheet?.marks || {},
    };

    if (dto.config) {
      existingConfig = { ...existingConfig, ...dto.config };
    }

    await this.prisma.course.update({
      where: { course_id: courseId },
      data: {
        marks_config: existingConfig,
      },
    });

    return { success: true };
  }

  async submitSecondMarking(courseId: number, dto: { marks: any; config?: any; decisions?: any }) {
    const course = await this.prisma.course.findUnique({
      where: { course_id: courseId },
      include: {
        first_marker_lecturer: { include: { user: true } },
        second_marker_lecturer: { include: { user: true } },
        publishing_progress: true,
      },
    });

    if (!course) {
      throw new NotFoundException(`Course with ID ${courseId} not found`);
    }

    const staffSubmittedStatuses = [
      'SUBMITTED_FINAL',
      'SUBMITTED_TO_STAFF',
      'RECEIVED_BY_STAFF',
      'APPROVED',
      'PUBLISHED',
    ];
    if (
      staffSubmittedStatuses.includes(course.result_submission_status) ||
      Boolean(course.publishing_progress?.final_submitted)
    ) {
      throw new BadRequestException('Evaluation period has ended. Results cannot be submitted.');
    }

    let existingConfig: any = course.marks_config || {};
    if (typeof existingConfig === 'string') {
      try {
        existingConfig = JSON.parse(existingConfig);
      } catch {
        existingConfig = {};
      }
    }

    existingConfig.secondMarkerSheet = {
      submitted: true,
      submittedAt: new Date().toISOString(),
      marks: dto.marks || existingConfig.secondMarkerSheet?.marks || {},
    };

    if (dto.config) {
      existingConfig = { ...existingConfig, ...dto.config };
    }

    if (dto.decisions) {
      existingConfig.reconciliation = dto.decisions;
    }

    await this.prisma.course.update({
      where: { course_id: courseId },
      data: {
        marks_config: existingConfig,
      },
    });

    // Mark 2nd marking as submitted in publishing progress
    await this.prisma.coursePublishingProgress.upsert({
      where: { course_id: courseId },
      update: { second_marking_submitted: true },
      create: { course_id: courseId, second_marking_submitted: true },
    });

    // Trigger notification email to Course In-Charge (and First Marker if same)
    let recipientEmail: string | undefined;
    let recipientName: string = 'Course In-Charge';

    const inChargeId = existingConfig.inChargeLecturerId
      ? Number(existingConfig.inChargeLecturerId)
      : null;

    if (inChargeId) {
      const inChargeLec = await this.prisma.lecturer.findUnique({
        where: { lecturer_id: inChargeId },
        include: { user: true },
      });
      if (inChargeLec?.user?.email) {
        recipientEmail = inChargeLec.user.email;
        recipientName = inChargeLec.user.full_name || 'Course In-Charge';
      }
    }

    if (!recipientEmail) {
      recipientEmail =
        course.first_marker_type === 'EXTERNAL'
          ? course.first_marker_email || undefined
          : course.first_marker_lecturer?.user?.email;
      recipientName =
        course.first_marker_type === 'EXTERNAL'
          ? course.first_marker_name || 'Course In-Charge'
          : course.first_marker_lecturer?.user?.full_name || 'Course In-Charge';
    }

    if (recipientEmail) {
      await this.notificationsService.sendFirstMarkerSecondMarkingDoneNotification(
        recipientEmail,
        recipientName,
        course.course_code,
        course.course_name,
      );
    }

    return {
      success: true,
      message:
        'Second marking submitted successfully. Notification sent to Course In-Charge for final reconciliation.',
    };
  }
}
