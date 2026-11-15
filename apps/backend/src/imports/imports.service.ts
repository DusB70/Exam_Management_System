import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { XlsxParserService } from './xlsx-parser.service';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as XLSX from 'xlsx';

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly xlsxParser: XlsxParserService,
  ) {}

  private getCaseInsensitiveValue(row: Record<string, any>, possibleKeys: string[]): string {
    const rowKeys = Object.keys(row);
    for (const pKey of possibleKeys) {
      const cleanPKey = pKey.toLowerCase().replace(/[\s_-]/g, '');
      const foundKey = rowKeys.find((rk) => rk.toLowerCase().replace(/[\s_-]/g, '') === cleanPKey);
      if (
        foundKey &&
        row[foundKey] !== undefined &&
        row[foundKey] !== null &&
        String(row[foundKey]).trim() !== ''
      ) {
        return String(row[foundKey]).trim();
      }
    }
    return '';
  }

  private normalizeHeaderKey(key: string): string {
    return key.toLowerCase().replace(/[\s_-]/g, '');
  }

  private normalizeCourseStatus(raw: string): 'COMPULSORY' | 'OPTIONAL' | null {
    const cleaned = raw
      .trim()
      .replace(/^\(|\)$/g, '')
      .trim()
      .toUpperCase();
    if (cleaned === 'C' || cleaned === 'COMPULSORY') return 'COMPULSORY';
    if (cleaned === 'O' || cleaned === 'OPTIONAL') return 'OPTIONAL';
    return null;
  }

  private parseCodeAndStatus(
    token: string,
    defaultStatus: 'COMPULSORY' | 'OPTIONAL',
  ): { code: string; status: 'COMPULSORY' | 'OPTIONAL'; invalidStatus?: string } {
    const trimmed = token.trim();
    const parenMatch = trimmed.match(/^(.*?)\s*\(\s*([^)]+)\s*\)\s*$/);
    if (parenMatch) {
      const code = parenMatch[1].trim();
      const parsed = this.normalizeCourseStatus(parenMatch[2]);
      if (parsed) {
        return { code, status: parsed };
      }
      return { code, status: defaultStatus, invalidStatus: parenMatch[2].trim() };
    }

    if (trimmed.includes(':')) {
      const parts = trimmed.split(':');
      const code = parts[0].trim();
      const rawStatus = parts.slice(1).join(':').trim();
      const parsed = this.normalizeCourseStatus(rawStatus);
      if (parsed) {
        return { code, status: parsed };
      }
      return { code, status: defaultStatus, invalidStatus: rawStatus };
    }

    return { code: trimmed, status: defaultStatus };
  }

  private hasMatchingHeader(headerRow: string[], possibleKeys: string[]): boolean {
    const normalizedHeaders = headerRow.map((h) => this.normalizeHeaderKey(h));
    return possibleKeys.some((pKey) => normalizedHeaders.includes(this.normalizeHeaderKey(pKey)));
  }

  private extractSheetForValidation(buffer: Buffer): {
    headerRow: string[];
    rows: Record<string, any>[];
    parseError?: string;
  } {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      if (workbook.SheetNames.length === 0) {
        return {
          headerRow: [],
          rows: [],
          parseError: 'The uploaded spreadsheet contains no worksheets.',
        };
      }
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      if (rawRows.length === 0) {
        return {
          headerRow: [],
          rows: [],
          parseError: 'Spreadsheet contains no data rows.',
        };
      }
      const headerRow = (rawRows[0] || []).map((h: any) => String(h).trim()).filter(Boolean);
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
      return { headerRow, rows };
    } catch (err: any) {
      return {
        headerRow: [],
        rows: [],
        parseError: `Failed to parse spreadsheet file: ${err.message}`,
      };
    }
  }

  async importStudents(buffer: Buffer, executorId: number) {
    const rows = this.xlsxParser.parseBuffer<Record<string, any>>(buffer);
    if (rows.length === 0) {
      throw new BadRequestException('Import file is empty.');
    }

    return this.prisma.$transaction(
      async (tx) => {
        const importedStudents = [];

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const rowNum = i + 2; // Row number in sheet (1-based, plus header)

          const nameWithInitials = this.getCaseInsensitiveValue(row, [
            'namewithinitials',
            'name_with_initials',
            'name with initials',
            'initials',
          ]);
          const fullName = this.getCaseInsensitiveValue(row, [
            'fullname',
            'full_name',
            'full name',
            'name',
          ]);
          const email = this.getCaseInsensitiveValue(row, [
            'email',
            'emailaddress',
            'email_address',
          ]);
          const nicNo = this.getCaseInsensitiveValue(row, [
            'nicno',
            'nic_no',
            'nic no',
            'nic',
            'nicnumber',
          ]);
          const dateOfBirth = this.getCaseInsensitiveValue(row, [
            'dateofbirth',
            'date_of_birth',
            'date of birth',
            'dob',
          ]);
          const phoneNumber = this.getCaseInsensitiveValue(row, [
            'phonenumber',
            'phone_number',
            'phone number',
            'phone',
            'contactno',
          ]);
          const address = this.getCaseInsensitiveValue(row, ['address', 'permanent_address']);
          const indexNumber = this.getCaseInsensitiveValue(row, [
            'indexnumber',
            'index_number',
            'index number',
            'indexno',
            'index',
          ]);
          const registrationNumber = this.getCaseInsensitiveValue(row, [
            'registrationnumber',
            'registration_number',
            'registration number',
            'regno',
            'reg_no',
          ]);
          const academicYear = this.getCaseInsensitiveValue(row, [
            'enrollmentyear',
            'enrollment_year',
            'enrollment year',
            'academicyear',
            'academic_year',
            'academic year',
            'year',
          ]);
          const degreeCode = this.getCaseInsensitiveValue(row, [
            'enrolleddegree',
            'enrolled_degree',
            'enrolled degree',
            'degreecode',
            'degree_code',
            'degree code',
            'degree',
          ]);
          const batchVal = this.getCaseInsensitiveValue(row, [
            'batch',
            'specializationcode',
            'specialization_code',
            'specialization code',
            'specialization',
          ]);

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
            !degreeCode
          ) {
            throw new BadRequestException(
              `Row ${rowNum}: Required column missing or empty. Required columns: full name, name with initials, email, nic no, date of birth, phone number, address, index number, registration number, and enrolled degree.`,
            );
          }

          // 1. Verify degree
          const degree = await tx.degree.findFirst({
            where: {
              OR: [
                { degree_code: { equals: degreeCode.trim(), mode: 'insensitive' } },
                { degree_name: { equals: degreeCode.trim(), mode: 'insensitive' } },
              ],
            },
          });
          if (!degree) {
            throw new BadRequestException(
              `Row ${rowNum}: Enrolled degree "${degreeCode}" not found.`,
            );
          }

          // 2. Verify specialization / batch (optional)
          let specializationId: number | null = null;
          if (batchVal) {
            const spec = await tx.specialization.findFirst({
              where: {
                degree_id: degree.degree_id,
                OR: [
                  { specialization_code: { equals: batchVal.trim(), mode: 'insensitive' } },
                  { specialization_name: { equals: batchVal.trim(), mode: 'insensitive' } },
                ],
              },
            });
            if (spec) {
              specializationId = spec.specialization_id;
            }
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
              batch: (batchVal || academicYear || '21/22').trim(),
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
      },
      { maxWait: 15000, timeout: 120000 },
    );
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
      ![
        'DRAFT',
        'REJECTED_BY_HEAD',
        'REJECTED_BY_STAFF',
        'PUBLISHED_PROVISIONAL',
        'PROVISIONAL',
      ].includes(course.result_submission_status);

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

    return this.prisma.$transaction(
      async (tx) => {
        const importedMarks = [];

        for (let i = headerRowIndex + 1; i < sheetData.length; i++) {
          const row = sheetData[i];
          if (row.length === 0 || !row[regNoIndex]) continue;

          const registrationNumber = String(row[regNoIndex]).trim();
          const scoreStr = String(row[marksIndex]).trim();

          if (!registrationNumber || scoreStr === '') continue;

          const score = parseFloat(scoreStr);
          if (isNaN(score) || score < 0) {
            throw new BadRequestException(
              `Row ${i + 1}: Marks obtained must be a positive number.`,
            );
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
          const isRegistered = await tx.courseRegistration.findFirst({
            where: {
              student_id: student.student_id,
              course_id: exam.course_id,
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
      },
      { maxWait: 15000, timeout: 120000 },
    );
  }

  private isBlankRow(row: Record<string, any>): boolean {
    return Object.values(row).every(
      (val) => val === undefined || val === null || String(val).trim() === '',
    );
  }

  private async createManyInChunks<T>(
    items: T[],
    chunkSize: number,
    runner: (chunk: T[]) => Promise<unknown>,
  ): Promise<void> {
    for (let i = 0; i < items.length; i += chunkSize) {
      await runner(items.slice(i, i + chunkSize));
    }
  }

  private parseAndValidateCourseRows(
    rawRows: Record<string, any>[],
    lookups: {
      existingCourseCodes: Set<string>;
      allDegrees: {
        degree_id: number;
        degree_code: string;
        degree_name: string;
        department_id: number | null;
      }[];
      allDepartments: {
        department_id: number;
        department_code: string;
        department_name: string;
      }[];
      allSpecializations: {
        specialization_id: number;
        specialization_code: string;
        specialization_name: string;
        degree_id?: number;
      }[];
      allLecturers?: {
        lecturer_id: number;
        employee_number: string;
        user: { email: string } | null;
      }[];
    },
  ) {
    const { existingCourseCodes, allDegrees, allDepartments, allSpecializations, allLecturers } =
      lookups;
    const seenCodes = new Set<string>();
    const parsedRows: {
      rowIndex: number;
      courseCode: string;
      courseName: string;
      creditValue: string;
      semester: string;
      department: string;
      degree: string;
      status: string;
      specialization: string;
      lecturer: string;
      errors: string[];
      isValid: boolean;
      resolved?: {
        courseCode: string;
        courseName: string;
        credits: number;
        semester: string;
        departmentId: number;
        specializationId: number | null;
        degreeList: { degreeId: number; status: 'COMPULSORY' | 'OPTIONAL' }[];
        specList: { specializationId: number; status: 'COMPULSORY' | 'OPTIONAL' }[];
        lecturerId: number | null;
      };
    }[] = [];

    rawRows.forEach((row, index) => {
      if (this.isBlankRow(row)) {
        return;
      }

      const rowErrors: string[] = [];
      const rowIndex = index + 2;

      const courseCode = this.getCaseInsensitiveValue(row, [
        'coursecode',
        'course_code',
        'course code',
        'code',
      ]);
      const courseName = this.getCaseInsensitiveValue(row, [
        'coursename',
        'course_name',
        'course name',
        'name',
        'title',
      ]);
      const creditValue = this.getCaseInsensitiveValue(row, [
        'creditvalue',
        'credit_value',
        'credit value',
        'credits',
        'credit',
      ]);
      const semester = this.getCaseInsensitiveValue(row, [
        'semester',
        'sem',
        'academicyearsemester',
      ]);
      const departmentCode = this.getCaseInsensitiveValue(row, [
        'department',
        'departmentcode',
        'department_code',
        'dept',
        'deptcode',
      ]);
      const degreeCodesRaw = this.getCaseInsensitiveValue(row, [
        'degree',
        'degrees',
        'degreecode',
        'degree_code',
        'degree codes',
        'program',
        'programme',
      ]);
      const statusVal = this.getCaseInsensitiveValue(row, [
        'status',
        'coursestatus',
        'course_status',
        'type',
        'coursetype',
        'course_type',
      ]);
      const specializationVal = this.getCaseInsensitiveValue(row, [
        'specialization',
        'specializationcode',
        'specialization_code',
        'specialization code',
        'spec',
      ]);
      const lecturerVal = this.getCaseInsensitiveValue(row, [
        'lecturer',
        'lectureremail',
        'lecturer_email',
        'lecturer email',
        'instructor',
      ]);

      const cleanCode = courseCode ? courseCode.trim().toUpperCase() : '';
      if (!courseCode) {
        rowErrors.push('Course Code is missing or empty.');
      } else {
        if (!/^[A-Z0-9-]+$/.test(cleanCode)) {
          rowErrors.push(
            `Course code "${cleanCode}" must contain only uppercase letters, numbers, and hyphens.`,
          );
        }
        if (cleanCode.length > 20) {
          rowErrors.push(`Course code "${cleanCode}" must not exceed 20 characters.`);
        }
        if (seenCodes.has(cleanCode)) {
          rowErrors.push(`Duplicate course code "${cleanCode}" found in spreadsheet.`);
        } else {
          seenCodes.add(cleanCode);
        }
        if (existingCourseCodes.has(cleanCode)) {
          rowErrors.push(`Course code "${cleanCode}" is already in use in the system.`);
        }
      }

      if (!courseName) {
        rowErrors.push('Course Name is missing or empty.');
      } else if (courseName.trim().length > 150) {
        rowErrors.push('Course name must not exceed 150 characters.');
      }

      let credits = 0;
      if (!creditValue) {
        rowErrors.push('Credit Value is missing or empty.');
      } else {
        credits = parseFloat(creditValue);
        if (isNaN(credits) || credits < 0 || credits > 10) {
          rowErrors.push(
            `Credit value must be a valid number between 0 and 10 (received "${creditValue}").`,
          );
        }
      }

      let cleanSemester = semester ? semester.trim() : '';
      if (!semester) {
        rowErrors.push('Semester is missing or empty.');
      } else {
        const semMatch = cleanSemester.match(/^[Yy]?([1-4])[-_./]?[Ss]?([1-2])$/);
        if (semMatch) {
          cleanSemester = `${semMatch[1]}.${semMatch[2]}`;
        }
        if (!/^(1\.1|1\.2|2\.1|2\.2|3\.1|3\.2|4\.1|4\.2)$/.test(cleanSemester)) {
          rowErrors.push(`Semester "${semester}" is invalid. Must be in format X.Y (1.1 to 4.2).`);
        }
      }

      const normalizedRowStatus = statusVal ? this.normalizeCourseStatus(statusVal) : 'COMPULSORY';
      if (statusVal && !normalizedRowStatus) {
        rowErrors.push(`Status "${statusVal}" must be C (Compulsory) or O (Optional).`);
      }
      const defaultStatus: 'COMPULSORY' | 'OPTIONAL' = normalizedRowStatus || 'COMPULSORY';

      const resolvedDegrees: {
        degree_id: number;
        department_id: number | null;
        status: 'COMPULSORY' | 'OPTIONAL';
      }[] = [];
      const degreeList: { degreeId: number; status: 'COMPULSORY' | 'OPTIONAL' }[] = [];

      if (degreeCodesRaw) {
        const tokens = degreeCodesRaw
          .split(/[,;]/)
          .map((t) => t.trim())
          .filter(Boolean);
        for (const token of tokens) {
          const {
            code: dCode,
            status: dStatus,
            invalidStatus,
          } = this.parseCodeAndStatus(token, defaultStatus);
          if (invalidStatus) {
            rowErrors.push(
              `Invalid degree status "${invalidStatus}" for "${dCode}". Use (C) for Compulsory or (O) for Optional.`,
            );
          }

          const matchedDeg = allDegrees.find(
            (d) =>
              d.degree_code.toLowerCase() === dCode.toLowerCase() ||
              d.degree_name.toLowerCase() === dCode.toLowerCase(),
          );
          if (!matchedDeg) {
            rowErrors.push(`Degree program "${dCode}" not found in system.`);
          } else {
            resolvedDegrees.push({ ...matchedDeg, status: dStatus });
            if (!degreeList.some((d) => d.degreeId === matchedDeg.degree_id)) {
              degreeList.push({ degreeId: matchedDeg.degree_id, status: dStatus });
            }
          }
        }
      }

      const specList: {
        specializationId: number;
        status: 'COMPULSORY' | 'OPTIONAL';
        degreeId?: number;
      }[] = [];
      let specializationId: number | null = null;
      const isEligibleForSpec = cleanSemester !== '1.1' && cleanSemester !== '1.2';
      if (specializationVal && isEligibleForSpec) {
        const specTokens = specializationVal
          .split(/[,;]/)
          .map((t) => t.trim())
          .filter(Boolean);
        for (const sToken of specTokens) {
          const {
            code: sCode,
            status: sStatus,
            invalidStatus,
          } = this.parseCodeAndStatus(sToken, defaultStatus);
          if (invalidStatus) {
            rowErrors.push(
              `Invalid specialization status "${invalidStatus}" for "${sCode}". Use (C) for Compulsory or (O) for Optional.`,
            );
          }

          const matchedSpec = allSpecializations.find(
            (s) =>
              s.specialization_code.toLowerCase() === sCode.toLowerCase() ||
              s.specialization_name.toLowerCase() === sCode.toLowerCase(),
          );
          if (!matchedSpec) {
            rowErrors.push(`Specialization "${sCode}" not found in system.`);
          } else if (!specList.some((s) => s.specializationId === matchedSpec.specialization_id)) {
            specList.push({
              specializationId: matchedSpec.specialization_id,
              status: sStatus,
              degreeId: matchedSpec.degree_id,
            });
          }
        }

        if (specList.length > 0) {
          specializationId = specList[0].specializationId;
        }
      }

      let departmentId: number | null = null;
      if (departmentCode) {
        const matchedDept = allDepartments.find(
          (d) =>
            d.department_code.toLowerCase() === departmentCode.trim().toLowerCase() ||
            d.department_name.toLowerCase() === departmentCode.trim().toLowerCase(),
        );
        if (!matchedDept) {
          rowErrors.push(`Department "${departmentCode}" not found in system.`);
        } else {
          departmentId = matchedDept.department_id;
        }
      } else if (resolvedDegrees.length > 0 && resolvedDegrees[0].department_id) {
        departmentId = resolvedDegrees[0].department_id;
      } else if (allDepartments.length > 0) {
        departmentId = allDepartments[0].department_id;
      } else {
        rowErrors.push('Offering department could not be determined.');
      }

      if (degreeList.length === 0) {
        if (specList.some((s) => s.degreeId)) {
          for (const s of specList) {
            if (s.degreeId && !degreeList.some((d) => d.degreeId === s.degreeId)) {
              degreeList.push({ degreeId: s.degreeId, status: s.status });
            }
          }
        } else if (departmentId) {
          const deptDegrees = allDegrees.filter((d) => d.department_id === departmentId);
          if (deptDegrees.length > 0) {
            for (const deg of deptDegrees) {
              degreeList.push({ degreeId: deg.degree_id, status: defaultStatus });
            }
          } else if (allDegrees.length > 0) {
            degreeList.push({ degreeId: allDegrees[0].degree_id, status: defaultStatus });
          } else {
            rowErrors.push('At least one degree program must be specified.');
          }
        } else if (!degreeCodesRaw && allDegrees.length === 0) {
          rowErrors.push('At least one degree program must be specified.');
        }
      }

      let lecturerId: number | null = null;
      if (lecturerVal && allLecturers) {
        const needle = lecturerVal.trim().toLowerCase();
        const matchedLecturer = allLecturers.find(
          (l) =>
            l.employee_number.toLowerCase() === needle ||
            (l.user?.email && l.user.email.toLowerCase() === needle),
        );
        if (matchedLecturer) {
          lecturerId = matchedLecturer.lecturer_id;
        }
      }

      const isValid = rowErrors.length === 0;
      parsedRows.push({
        rowIndex,
        courseCode: cleanCode || courseCode,
        courseName,
        creditValue,
        semester: cleanSemester || semester,
        department: departmentCode,
        degree: degreeCodesRaw,
        status: normalizedRowStatus || statusVal.trim().toUpperCase() || 'COMPULSORY',
        specialization: specializationVal,
        lecturer: lecturerVal,
        errors: rowErrors,
        isValid,
        resolved:
          isValid && departmentId !== null
            ? {
                courseCode: cleanCode,
                courseName: courseName.trim(),
                credits,
                semester: cleanSemester,
                departmentId,
                specializationId,
                degreeList,
                specList: specList.map((s) => ({
                  specializationId: s.specializationId,
                  status: s.status,
                })),
                lecturerId,
              }
            : undefined,
      });
    });

    return parsedRows;
  }

  async importCourses(buffer: Buffer, executorId: number) {
    const rawRows = this.xlsxParser.parseBuffer<Record<string, any>>(buffer);
    if (rawRows.length === 0) {
      throw new BadRequestException('Import file is empty.');
    }

    const [existingCourses, allDegrees, allDepartments, allSpecializations, allLecturers] =
      await Promise.all([
        this.prisma.course.findMany({ select: { course_code: true } }),
        this.prisma.degree.findMany({
          select: { degree_id: true, degree_code: true, degree_name: true, department_id: true },
        }),
        this.prisma.department.findMany({
          select: { department_id: true, department_code: true, department_name: true },
        }),
        this.prisma.specialization.findMany({
          select: {
            specialization_id: true,
            specialization_code: true,
            specialization_name: true,
            degree_id: true,
          },
        }),
        this.prisma.lecturer.findMany({
          select: {
            lecturer_id: true,
            employee_number: true,
            user: { select: { email: true } },
          },
        }),
      ]);

    const existingCourseCodes = new Set(existingCourses.map((c) => c.course_code.toUpperCase()));
    const parsedRows = this.parseAndValidateCourseRows(rawRows, {
      existingCourseCodes,
      allDegrees,
      allDepartments,
      allSpecializations,
      allLecturers,
    });

    if (parsedRows.length === 0) {
      throw new BadRequestException('Import file is empty.');
    }

    const firstInvalid = parsedRows.find((r) => !r.isValid);
    if (firstInvalid) {
      throw new BadRequestException(`Row ${firstInvalid.rowIndex}: ${firstInvalid.errors[0]}`);
    }

    const prepared = parsedRows.map((r) => r.resolved!);

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await this.createManyInChunks(prepared, 500, (chunk) =>
            tx.course.createMany({
              data: chunk.map((c) => ({
                course_code: c.courseCode,
                course_name: c.courseName,
                credit_value: new Prisma.Decimal(c.credits),
                department_id: c.departmentId,
                specialization_id: c.specializationId,
                semester: c.semester,
              })),
            }),
          );

          const allCodes = prepared.map((c) => c.courseCode);
          const createdCourses: any[] = [];
          for (let i = 0; i < allCodes.length; i += 500) {
            const codeChunk = allCodes.slice(i, i + 500);
            const found = await tx.course.findMany({
              where: { course_code: { in: codeChunk } },
            });
            createdCourses.push(...found);
          }

          const courseByCode = new Map(createdCourses.map((c) => [c.course_code, c]));
          const courseDegreesData: { course_id: number; degree_id: number; status: string }[] = [];
          const courseSpecsData: {
            course_id: number;
            specialization_id: number;
            status: string;
          }[] = [];
          const courseLecturersData: { course_id: number; lecturer_id: number }[] = [];
          const auditLogsData: {
            user_id: number | null;
            action: string;
            entity_name: string;
            entity_id: string;
            new_values: Prisma.InputJsonValue;
          }[] = [];

          for (const item of prepared) {
            const created = courseByCode.get(item.courseCode);
            if (!created) continue;

            for (const d of item.degreeList) {
              courseDegreesData.push({
                course_id: created.course_id,
                degree_id: d.degreeId,
                status: d.status,
              });
            }

            for (const s of item.specList) {
              courseSpecsData.push({
                course_id: created.course_id,
                specialization_id: s.specializationId,
                status: s.status,
              });
            }

            if (item.lecturerId) {
              courseLecturersData.push({
                course_id: created.course_id,
                lecturer_id: item.lecturerId,
              });
            }

            auditLogsData.push({
              user_id: executorId ?? null,
              action: 'COURSE_CREATE',
              entity_name: 'courses',
              entity_id: created.course_id.toString(),
              new_values: JSON.parse(JSON.stringify(created)),
            });
          }

          if (courseDegreesData.length > 0) {
            await this.createManyInChunks(courseDegreesData, 500, (chunk) =>
              tx.courseDegree.createMany({ data: chunk }),
            );
          }

          if (courseSpecsData.length > 0) {
            await this.createManyInChunks(courseSpecsData, 500, (chunk) =>
              tx.courseSpecialization.createMany({ data: chunk }),
            );
          }

          if (courseLecturersData.length > 0) {
            await this.createManyInChunks(courseLecturersData, 500, (chunk) =>
              tx.courseLecturer.createMany({ data: chunk }),
            );
          }

          if (auditLogsData.length > 0) {
            await this.createManyInChunks(auditLogsData, 500, (chunk) =>
              tx.auditLog.createMany({ data: chunk }),
            );
          }

          return {
            success: true,
            count: createdCourses.length,
          };
        },
        { maxWait: 15000, timeout: 120000 },
      );
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2000') {
          throw new BadRequestException(
            'One or more course fields exceed the maximum allowed column length.',
          );
        }
        if (err.code === 'P2002') {
          throw new BadRequestException(
            'One or more course codes or assignments already exist in the database.',
          );
        }
        if (err.code === 'P2003') {
          throw new BadRequestException(
            'One or more referenced departments, degrees, specializations, or lecturers were not found.',
          );
        }
      }
      throw err;
    }
  }

  async validateCoursesImport(buffer: Buffer) {
    const expectedHeaders = [
      'courseCode',
      'courseName',
      'creditValue',
      'semester',
      'department',
      'degree',
      'status',
      'specialization',
      'lecturer',
    ];

    const { headerRow, rows, parseError } = this.extractSheetForValidation(buffer);
    if (parseError) {
      return {
        headerRow,
        headerErrors: [parseError],
        expectedHeaders,
        hasHeaderErrors: true,
        hasBlockingErrors: true,
        totalRows: 0,
        validRowsCount: 0,
        invalidRowsCount: 0,
        rows: [],
      };
    }

    const headerErrors: string[] = [];
    if (!this.hasMatchingHeader(headerRow, ['coursecode', 'course_code', 'course code', 'code'])) {
      headerErrors.push("Missing required column header 'courseCode'");
    }
    if (
      !this.hasMatchingHeader(headerRow, [
        'coursename',
        'course_name',
        'course name',
        'name',
        'title',
      ])
    ) {
      headerErrors.push("Missing required column header 'courseName'");
    }
    if (
      !this.hasMatchingHeader(headerRow, [
        'creditvalue',
        'credit_value',
        'credit value',
        'credits',
        'credit',
      ])
    ) {
      headerErrors.push("Missing required column header 'creditValue'");
    }
    if (!this.hasMatchingHeader(headerRow, ['semester', 'sem', 'academicyearsemester'])) {
      headerErrors.push("Missing required column header 'semester'");
    }

    const nonEmptyRows = rows.filter((row) => !this.isBlankRow(row));
    if (nonEmptyRows.length === 0) {
      headerErrors.push('Spreadsheet contains headers but no course rows.');
    }

    const [existingCourses, allDegrees, allDepartments, allSpecializations] = await Promise.all([
      this.prisma.course.findMany({ select: { course_code: true } }),
      this.prisma.degree.findMany({
        select: { degree_id: true, degree_code: true, degree_name: true, department_id: true },
      }),
      this.prisma.department.findMany({
        select: { department_id: true, department_code: true, department_name: true },
      }),
      this.prisma.specialization.findMany({
        select: {
          specialization_id: true,
          specialization_code: true,
          specialization_name: true,
          degree_id: true,
        },
      }),
    ]);

    const existingCourseCodes = new Set(existingCourses.map((c) => c.course_code.toUpperCase()));
    const parsedRows = this.parseAndValidateCourseRows(rows, {
      existingCourseCodes,
      allDegrees,
      allDepartments,
      allSpecializations,
    }).map(({ resolved: _resolved, ...rest }) => rest);

    const validRowsCount = parsedRows.filter((r) => r.isValid).length;
    const invalidRowsCount = parsedRows.length - validRowsCount;
    const hasHeaderErrors = headerErrors.length > 0;
    const hasBlockingErrors = hasHeaderErrors || parsedRows.length === 0 || invalidRowsCount > 0;

    return {
      headerRow,
      headerErrors,
      expectedHeaders,
      hasHeaderErrors,
      hasBlockingErrors,
      totalRows: parsedRows.length,
      validRowsCount,
      invalidRowsCount,
      rows: parsedRows,
    };
  }

  async validateStudentsImport(buffer: Buffer) {
    const expectedHeaders = [
      'fullName',
      'nameWithInitials',
      'email',
      'nicNo',
      'dateOfBirth',
      'phoneNumber',
      'address',
      'indexNumber',
      'registrationNumber',
      'enrollment year',
      'enrolled degree',
    ];

    const { headerRow, rows, parseError } = this.extractSheetForValidation(buffer);
    if (parseError) {
      return {
        headerRow,
        headerErrors: [parseError],
        expectedHeaders,
        hasHeaderErrors: true,
        hasBlockingErrors: true,
        totalRows: 0,
        validRowsCount: 0,
        invalidRowsCount: 0,
        rows: [],
      };
    }

    const headerErrors: string[] = [];
    if (!this.hasMatchingHeader(headerRow, ['fullname', 'full_name', 'full name', 'name'])) {
      headerErrors.push("Missing required column header 'fullName'");
    }
    if (
      !this.hasMatchingHeader(headerRow, [
        'namewithinitials',
        'name_with_initials',
        'name with initials',
        'initials',
      ])
    ) {
      headerErrors.push("Missing required column header 'nameWithInitials'");
    }
    if (!this.hasMatchingHeader(headerRow, ['email', 'emailaddress', 'email_address'])) {
      headerErrors.push("Missing required column header 'email'");
    }
    if (!this.hasMatchingHeader(headerRow, ['nicno', 'nic_no', 'nic no', 'nic', 'nicnumber'])) {
      headerErrors.push("Missing required column header 'nicNo'");
    }
    if (
      !this.hasMatchingHeader(headerRow, ['dateofbirth', 'date_of_birth', 'date of birth', 'dob'])
    ) {
      headerErrors.push("Missing required column header 'dateOfBirth'");
    }
    if (
      !this.hasMatchingHeader(headerRow, [
        'phonenumber',
        'phone_number',
        'phone number',
        'phone',
        'contactno',
      ])
    ) {
      headerErrors.push("Missing required column header 'phoneNumber'");
    }
    if (!this.hasMatchingHeader(headerRow, ['address', 'permanent_address'])) {
      headerErrors.push("Missing required column header 'address'");
    }
    if (
      !this.hasMatchingHeader(headerRow, [
        'indexnumber',
        'index_number',
        'index number',
        'indexno',
        'index',
      ])
    ) {
      headerErrors.push("Missing required column header 'indexNumber'");
    }
    if (
      !this.hasMatchingHeader(headerRow, [
        'registrationnumber',
        'registration_number',
        'registration number',
        'regno',
        'reg_no',
      ])
    ) {
      headerErrors.push("Missing required column header 'registrationNumber'");
    }
    if (
      !this.hasMatchingHeader(headerRow, [
        'enrolleddegree',
        'enrolled_degree',
        'enrolled degree',
        'degreecode',
        'degree_code',
        'degree code',
        'degree',
      ])
    ) {
      headerErrors.push("Missing required column header 'enrolled degree'");
    }

    if (rows.length === 0) {
      headerErrors.push('Spreadsheet contains headers but no student rows.');
    }

    const [allDegrees, existingUsers, existingStudents] = await Promise.all([
      this.prisma.degree.findMany({
        select: { degree_id: true, degree_code: true, degree_name: true },
      }),
      this.prisma.user.findMany({
        select: { email: true, nic_no: true },
      }),
      this.prisma.student.findMany({
        select: { registration_number: true, index_number: true },
      }),
    ]);

    const existingEmails = new Set(existingUsers.map((u) => u.email.toLowerCase()));
    const existingNics = new Set(existingUsers.map((u) => (u.nic_no || '').trim()).filter(Boolean));
    const existingRegNos = new Set(existingStudents.map((s) => s.registration_number.trim()));
    const existingIndexNos = new Set(existingStudents.map((s) => s.index_number.trim()));

    const seenEmails = new Set<string>();
    const seenNics = new Set<string>();
    const seenRegNos = new Set<string>();
    const seenIndexNos = new Set<string>();

    const parsedRows: any[] = [];

    rows.forEach((row, index) => {
      const rowErrors: string[] = [];
      const rowIndex = index + 2;

      const nameWithInitials = this.getCaseInsensitiveValue(row, [
        'namewithinitials',
        'name_with_initials',
        'name with initials',
        'initials',
      ]);
      const fullName = this.getCaseInsensitiveValue(row, [
        'fullname',
        'full_name',
        'full name',
        'name',
      ]);
      const email = this.getCaseInsensitiveValue(row, ['email', 'emailaddress', 'email_address']);
      const nicNo = this.getCaseInsensitiveValue(row, [
        'nicno',
        'nic_no',
        'nic no',
        'nic',
        'nicnumber',
      ]);
      const dateOfBirth = this.getCaseInsensitiveValue(row, [
        'dateofbirth',
        'date_of_birth',
        'date of birth',
        'dob',
      ]);
      const phoneNumber = this.getCaseInsensitiveValue(row, [
        'phonenumber',
        'phone_number',
        'phone number',
        'phone',
        'contactno',
      ]);
      const address = this.getCaseInsensitiveValue(row, ['address', 'permanent_address']);
      const indexNumber = this.getCaseInsensitiveValue(row, [
        'indexnumber',
        'index_number',
        'index number',
        'indexno',
        'index',
      ]);
      const registrationNumber = this.getCaseInsensitiveValue(row, [
        'registrationnumber',
        'registration_number',
        'registration number',
        'regno',
        'reg_no',
      ]);
      const academicYear = this.getCaseInsensitiveValue(row, [
        'enrollmentyear',
        'enrollment_year',
        'enrollment year',
        'enrollment year (e.g. 21/22)',
        'academicyear',
        'academic_year',
        'academic year',
        'year',
      ]);
      const degreeCode = this.getCaseInsensitiveValue(row, [
        'enrolleddegree',
        'enrolled_degree',
        'enrolled degree',
        'degreecode',
        'degree_code',
        'degree code',
        'degree',
      ]);
      const batchVal = this.getCaseInsensitiveValue(row, [
        'batch',
        'specializationcode',
        'specialization_code',
        'specialization code',
        'specialization',
      ]);

      if (!fullName) rowErrors.push('Full Name is missing or empty.');
      if (!nameWithInitials) rowErrors.push('Name with Initials is missing or empty.');

      if (!email) {
        rowErrors.push('Email is missing or empty.');
      } else {
        const cleanEmail = email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
          rowErrors.push(`Invalid email format "${email}".`);
        }
        if (seenEmails.has(cleanEmail)) {
          rowErrors.push(`Duplicate email "${email}" found in spreadsheet.`);
        } else {
          seenEmails.add(cleanEmail);
        }
        if (existingEmails.has(cleanEmail)) {
          rowErrors.push(`Email "${email}" is already in use.`);
        }
      }

      if (!nicNo) {
        rowErrors.push('NIC No is missing or empty.');
      } else {
        const cleanNic = nicNo.trim();
        if (seenNics.has(cleanNic)) {
          rowErrors.push(`Duplicate NIC "${cleanNic}" found in spreadsheet.`);
        } else {
          seenNics.add(cleanNic);
        }
        if (existingNics.has(cleanNic)) {
          rowErrors.push(`NIC "${cleanNic}" is already in use.`);
        }
      }

      if (!dateOfBirth) {
        rowErrors.push('Date of Birth is missing or empty.');
      } else {
        const parsedDob = new Date(dateOfBirth);
        if (isNaN(parsedDob.getTime())) {
          rowErrors.push(
            `Invalid Date of Birth "${dateOfBirth}". Expected YYYY-MM-DD format (e.g. 2001-05-18).`,
          );
        }
      }

      if (!phoneNumber) rowErrors.push('Phone Number is missing or empty.');
      if (!address) rowErrors.push('Address is missing or empty.');

      if (!indexNumber) {
        rowErrors.push('Index Number is missing or empty.');
      } else {
        const cleanIndex = indexNumber.trim();
        if (seenIndexNos.has(cleanIndex)) {
          rowErrors.push(`Duplicate index number "${cleanIndex}" found in spreadsheet.`);
        } else {
          seenIndexNos.add(cleanIndex);
        }
        if (existingIndexNos.has(cleanIndex)) {
          rowErrors.push(`Index number "${cleanIndex}" is already in use.`);
        }
      }

      if (!registrationNumber) {
        rowErrors.push('Registration Number is missing or empty.');
      } else {
        const cleanReg = registrationNumber.trim();
        if (seenRegNos.has(cleanReg)) {
          rowErrors.push(`Duplicate registration number "${cleanReg}" found in spreadsheet.`);
        } else {
          seenRegNos.add(cleanReg);
        }
        if (existingRegNos.has(cleanReg)) {
          rowErrors.push(`Registration number "${cleanReg}" is already in use.`);
        }
      }

      if (!degreeCode) {
        rowErrors.push('Enrolled Degree is missing or empty.');
      } else {
        const matchedDegree = allDegrees.find(
          (d) =>
            d.degree_code.toLowerCase() === degreeCode.trim().toLowerCase() ||
            d.degree_name.toLowerCase() === degreeCode.trim().toLowerCase(),
        );
        if (!matchedDegree) {
          rowErrors.push(`Enrolled degree "${degreeCode}" not found in system.`);
        }
      }

      parsedRows.push({
        rowIndex,
        fullName,
        nameWithInitials,
        email,
        nicNo,
        dateOfBirth,
        phoneNumber,
        address,
        indexNumber,
        registrationNumber,
        enrollmentYear: (batchVal || academicYear || '21/22').trim(),
        enrolledDegree: degreeCode,
        errors: rowErrors,
        isValid: rowErrors.length === 0,
      });
    });

    const validRowsCount = parsedRows.filter((r) => r.isValid).length;
    const invalidRowsCount = parsedRows.length - validRowsCount;
    const hasHeaderErrors = headerErrors.length > 0;
    const hasBlockingErrors = hasHeaderErrors || parsedRows.length === 0 || invalidRowsCount > 0;

    return {
      headerRow,
      headerErrors,
      expectedHeaders,
      hasHeaderErrors,
      hasBlockingErrors,
      totalRows: parsedRows.length,
      validRowsCount,
      invalidRowsCount,
      rows: parsedRows,
    };
  }
}
