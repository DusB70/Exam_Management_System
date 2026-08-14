import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { XlsxParserService } from './xlsx-parser.service';
import * as bcrypt from 'bcrypt';
import * as XLSX from 'xlsx';

interface StudentImportRow {
  nameWithInitials: string;
  fullName: string;
  email: string;
  nicNo: string;
  dateOfBirth: string; // YYYY-MM-DD
  phoneNumber: string;
  address: string;
  indexNumber: string;
  registrationNumber: string;
  academicYear: number;
  degreeCode: string;
  specializationCode?: string;
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

    return this.prisma.$transaction(async (tx) => {
      const importedStudents = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2; // Row number in sheet (1-based, plus header)

        const {
          nameWithInitials,
          fullName,
          email,
          nicNo,
          dateOfBirth,
          phoneNumber,
          address,
          indexNumber,
          registrationNumber,
          academicYear,
          degreeCode,
          specializationCode,
        } = row;

        if (
          !nameWithInitials ||
          !fullName ||
          !email ||
          !nicNo ||
          !dateOfBirth ||
          !phoneNumber ||
          !address ||
          !indexNumber ||
          !registrationNumber ||
          !academicYear ||
          !degreeCode
        ) {
          throw new BadRequestException(
            `Row ${rowNum}: All columns except specializationCode are required (nameWithInitials, fullName, email, nicNo, dateOfBirth, phoneNumber, address, indexNumber, registrationNumber, academicYear, degreeCode).`,
          );
        }

        // 1. Verify degree
        const degree = await tx.degree.findUnique({
          where: { degree_code: degreeCode.trim().toUpperCase() },
        });
        if (!degree) {
          throw new BadRequestException(`Row ${rowNum}: Degree code "${degreeCode}" not found.`);
        }

        // 2. Verify specialization (optional)
        let specializationId: number | null = null;
        if (specializationCode && specializationCode.trim()) {
          const spec = await tx.specialization.findFirst({
            where: {
              degree_id: degree.degree_id,
              specialization_code: specializationCode.trim().toUpperCase(),
            },
          });
          if (!spec) {
            throw new BadRequestException(
              `Row ${rowNum}: Specialization "${specializationCode}" not found for degree "${degreeCode}".`,
            );
          }
          specializationId = spec.specialization_id;
        }

        // 3. Verify unique email
        const emailExists = await tx.user.findUnique({
          where: { email: email.trim().toLowerCase() },
        });
        if (emailExists) {
          throw new BadRequestException(`Row ${rowNum}: Email "${email}" is already in use.`);
        }

        // 4. Verify unique NIC
        const nicExists = await tx.user.findUnique({
          where: { nic_no: nicNo.trim() },
        });
        if (nicExists) {
          throw new BadRequestException(`Row ${rowNum}: NIC "${nicNo}" is already in use.`);
        }

        // 5. Verify unique registration number
        const regExists = await tx.student.findUnique({
          where: { registration_number: registrationNumber.trim() },
        });
        if (regExists) {
          throw new BadRequestException(
            `Row ${rowNum}: Registration number "${registrationNumber}" is already in use.`,
          );
        }

        // 6. Verify unique index number
        const indexExists = await tx.student.findUnique({
          where: { index_number: indexNumber.trim() },
        });
        if (indexExists) {
          throw new BadRequestException(
            `Row ${rowNum}: Index number "${indexNumber}" is already in use.`,
          );
        }

        // Default password is NIC number
        const defaultPasswordHash = await bcrypt.hash(nicNo.trim(), 10);

        // 7. Create User
        const user = await tx.user.create({
          data: {
            full_name: fullName.trim(),
            name_with_initials: nameWithInitials.trim(),
            email: email.trim().toLowerCase(),
            password_hash: defaultPasswordHash,
            role_id: 4, // Student Role ID
            is_active: true,
            nic_no: nicNo.trim(),
            date_of_birth: new Date(dateOfBirth),
            phone_number: phoneNumber.toString().trim(),
            address: address.trim(),
          },
        });

        // 8. Create Student
        const student = await tx.student.create({
          data: {
            user_id: user.user_id,
            registration_number: registrationNumber.trim(),
            index_number: indexNumber.trim(),
            degree_id: degree.degree_id,
            specialization_id: specializationId,
            academic_year: Number(academicYear),
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
    const course = await this.prisma.course.findUnique({
      where: { course_id: exam.course_id },
    });
    const isLocked =
      course?.result_submission_status &&
      !['DRAFT', 'REJECTED_BY_HEAD', 'REJECTED_BY_STAFF', 'PUBLISHED_PROVISIONAL'].includes(
        course.result_submission_status,
      );

    if (isLocked) {
      throw new BadRequestException(
        'Marksheet has already been submitted or approved and is locked.',
      );
    }

    // Parse Excel dynamically
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    if (workbook.SheetNames.length === 0) {
      throw new BadRequestException('The uploaded spreadsheet contains no worksheets.');
    }
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const sheetData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    // Find the header row
    let headerRowIndex = -1;
    for (let i = 0; i < sheetData.length; i++) {
      const row = sheetData[i];
      if (
        row.some(
          (cell) =>
            typeof cell === 'string' &&
            (cell.toLowerCase().includes('registrationnumber') ||
              cell.toLowerCase().includes('registration number')),
        )
      ) {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      throw new BadRequestException(
        'Could not find header row with "Registration Number" or "registrationNumber" column.',
      );
    }

    const headers = sheetData[headerRowIndex].map((h) => String(h).trim());
    const regNoIndex = headers.findIndex(
      (h) =>
        h.toLowerCase().includes('registrationnumber') ||
        h.toLowerCase().includes('registration number'),
    );
    const marksIndex = headers.findIndex(
      (h) =>
        h.toLowerCase() === 'marks' ||
        h.toLowerCase().includes('marksobtained') ||
        h.toLowerCase().includes('marks obtained'),
    );

    if (regNoIndex === -1) {
      throw new BadRequestException('Missing registration number column.');
    }
    if (marksIndex === -1) {
      throw new BadRequestException(
        'Missing "marks" column. Please add a column named "marks" with the student marks.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const importedMarks = [];

      for (let i = headerRowIndex + 1; i < sheetData.length; i++) {
        const row = sheetData[i];
        if (row.length === 0 || !row[regNoIndex]) continue;

        const registrationNumber = String(row[regNoIndex]).trim();
        const scoreStr = String(row[marksIndex]).trim();

        if (!registrationNumber || scoreStr === '') continue;

        const score = parseFloat(scoreStr);
        if (isNaN(score) || score < 0) {
          throw new BadRequestException(`Row ${i + 1}: Marks obtained must be a positive number.`);
        }

        if (score > exam.total_marks) {
          throw new BadRequestException(
            `Row ${i + 1}: Score ${score} exceeds exam maximum marks (${exam.total_marks}).`,
          );
        }

        // 1. Find Student
        const student = await tx.student.findUnique({
          where: { registration_number: registrationNumber },
        });
        if (!student) {
          throw new BadRequestException(
            `Row ${i + 1}: Student with registration number "${registrationNumber}" not found.`,
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
            `Row ${i + 1}: Student "${registrationNumber}" is not registered for this exam's course.`,
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
