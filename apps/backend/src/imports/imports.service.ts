import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { XlsxParserService } from './xlsx-parser.service';
import * as bcrypt from 'bcrypt';

interface StudentImportRow {
  fullName: string;
  email: string;
  registrationNumber: string;
  departmentCode: string;
  academicYear: number;
  semester: string;
}

interface MarkImportRow {
  registrationNumber: string;
  marksObtained: number;
}

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly xlsxParser: XlsxParserService,
  ) {}

  async importStudents(buffer: Buffer, executorId: number) {
    const rows = this.xlsxParser.parseBuffer<StudentImportRow>(buffer);
    if (rows.length === 0) {
      throw new BadRequestException('Import file is empty.');
    }

    // Default password hash
    const defaultPasswordHash = await bcrypt.hash('StudentPassword123', 10);

    return this.prisma.$transaction(async (tx) => {
      const importedStudents = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2; // Row number in sheet (1-based, plus header)

        const { fullName, email, registrationNumber, departmentCode, academicYear, semester } = row;

        if (
          !fullName ||
          !email ||
          !registrationNumber ||
          !departmentCode ||
          !academicYear ||
          !semester
        ) {
          throw new BadRequestException(
            `Row ${rowNum}: All columns (fullName, email, registrationNumber, departmentCode, academicYear, semester) are required.`,
          );
        }

        // 1. Verify department
        const dept = await tx.department.findUnique({
          where: { department_code: departmentCode.trim() },
        });
        if (!dept) {
          throw new BadRequestException(
            `Row ${rowNum}: Department code "${departmentCode}" not found.`,
          );
        }

        // 2. Verify unique email
        const emailExists = await tx.user.findUnique({
          where: { email: email.trim().toLowerCase() },
        });
        if (emailExists) {
          throw new BadRequestException(`Row ${rowNum}: Email "${email}" is already in use.`);
        }

        // 3. Verify unique registration number
        const regExists = await tx.student.findUnique({
          where: { registration_number: registrationNumber.trim() },
        });
        if (regExists) {
          throw new BadRequestException(
            `Row ${rowNum}: Registration number "${registrationNumber}" is already in use.`,
          );
        }

        // 4. Create User
        const user = await tx.user.create({
          data: {
            full_name: fullName.trim(),
            email: email.trim().toLowerCase(),
            password_hash: defaultPasswordHash,
            role_id: 4, // Student Role ID
            is_active: true,
          },
        });

        // 5. Create Student
        const student = await tx.student.create({
          data: {
            user_id: user.user_id,
            registration_number: registrationNumber.trim(),
            department_id: dept.department_id,
            academic_year: Number(academicYear),
            semester: String(semester),
          },
        });

        await this.auditService.logAction(
          executorId,
          'USER_CREATE',
          'users',
          user.user_id.toString(),
          null,
          { user, student },
        );

        importedStudents.push(student);
      }

      return {
        success: true,
        count: importedStudents.length,
      };
    });
  }

  private async getLecturerByUserId(userId: number) {
    const lecturer = await this.prisma.lecturer.findUnique({
      where: { user_id: userId },
    });
    if (!lecturer) {
      throw new NotFoundException(`Lecturer profile not found for user ID ${userId}`);
    }
    return lecturer;
  }

  async importMarks(examId: number, buffer: Buffer, executorId: number, isLecturer: boolean) {
    const exam = await this.prisma.exam.findUnique({
      where: { exam_id: examId },
    });
    if (!exam) {
      throw new NotFoundException(`Exam with ID ${examId} not found.`);
    }

    // 1. Verify lecturer course assignment
    if (isLecturer) {
      const lecturer = await this.getLecturerByUserId(executorId);
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

    // Verify marksheet is not locked
    const lockedCount = await this.prisma.examMark.count({
      where: {
        exam_id: examId,
        grading_status: { in: ['SUBMITTED', 'APPROVED'] },
      },
    });
    if (lockedCount > 0) {
      throw new BadRequestException(
        'Marksheet has already been submitted or approved and is locked.',
      );
    }

    const rows = this.xlsxParser.parseBuffer<MarkImportRow>(buffer);
    if (rows.length === 0) {
      throw new BadRequestException('Import file is empty.');
    }

    return this.prisma.$transaction(async (tx) => {
      const importedMarks = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;

        const { registrationNumber, marksObtained } = row;

        if (!registrationNumber || marksObtained === undefined || marksObtained === null) {
          throw new BadRequestException(
            `Row ${rowNum}: Both columns (registrationNumber, marksObtained) are required.`,
          );
        }

        const score = Number(marksObtained);
        if (isNaN(score) || score < 0) {
          throw new BadRequestException(`Row ${rowNum}: Marks obtained must be a positive number.`);
        }

        if (score > exam.total_marks) {
          throw new BadRequestException(
            `Row ${rowNum}: Score ${score} exceeds exam maximum marks (${exam.total_marks}).`,
          );
        }

        // 1. Find Student
        const student = await tx.student.findUnique({
          where: { registration_number: registrationNumber.trim() },
        });
        if (!student) {
          throw new BadRequestException(
            `Row ${rowNum}: Student with registration number "${registrationNumber}" not found.`,
          );
        }

        // 2. Verify Student is registered for this course
        const isRegistered = await tx.courseRegistration.findUnique({
          where: {
            unique_student_course: {
              student_id: student.student_id,
              course_id: exam.course_id,
            },
          },
        });
        if (!isRegistered) {
          throw new BadRequestException(
            `Row ${rowNum}: Student "${registrationNumber}" is not registered for this exam's course.`,
          );
        }

        // 3. Upsert mark
        const mark = await tx.examMark.upsert({
          where: {
            student_id_exam_id: {
              student_id: student.student_id,
              exam_id: examId,
            },
          },
          update: {
            marks_obtained: score,
            recorded_by_id: executorId,
            grading_status: 'PENDING',
          },
          create: {
            student_id: student.student_id,
            exam_id: examId,
            marks_obtained: score,
            recorded_by_id: executorId,
            grading_status: 'PENDING',
          },
        });

        await this.auditService.logAction(
          executorId,
          'MARK_RECORD',
          'exam_marks',
          mark.mark_id.toString(),
          null,
          mark,
        );

        importedMarks.push(mark);
      }

      return {
        success: true,
        count: importedMarks.length,
      };
    });
  }
}
