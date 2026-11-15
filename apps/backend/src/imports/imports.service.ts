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

    return this.prisma.$transaction(async (tx) => {
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
    });
  }

  async importCourses(buffer: Buffer, executorId: number) {
    const rows = this.xlsxParser.parseBuffer<Record<string, any>>(buffer);
    if (rows.length === 0) {
      throw new BadRequestException('Import file is empty.');
    }

    return this.prisma.$transaction(async (tx) => {
      const importedCourses = [];
      const seenCodes = new Set<string>();

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;

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

        if (!courseCode || !courseName || !creditValue || !semester) {
          throw new BadRequestException(
            `Row ${rowNum}: Required column missing or empty. Required columns: course code, course name, credit value, and semester.`,
          );
        }

        const cleanCode = courseCode.trim().toUpperCase();
        if (!/^[A-Z0-9-]+$/.test(cleanCode)) {
          throw new BadRequestException(
            `Row ${rowNum}: Course code "${cleanCode}" must contain only uppercase letters, numbers, and hyphens.`,
          );
        }

        if (seenCodes.has(cleanCode)) {
          throw new BadRequestException(
            `Row ${rowNum}: Duplicate course code "${cleanCode}" found in spreadsheet.`,
          );
        }
        seenCodes.add(cleanCode);

        // Check if course already exists in database
        const existingCourse = await tx.course.findUnique({
          where: { course_code: cleanCode },
        });
        if (existingCourse) {
          throw new BadRequestException(
            `Row ${rowNum}: Course code "${cleanCode}" is already in use.`,
          );
        }

        // Validate credit value
        const credits = parseFloat(creditValue);
        if (isNaN(credits) || credits < 0 || credits > 10) {
          throw new BadRequestException(
            `Row ${rowNum}: Credit value must be a valid number between 0 and 10. Received "${creditValue}".`,
          );
        }

        // Validate & normalize semester format: 1.1, 1.2, ..., 4.2
        let cleanSemester = semester.trim();
        const semMatch = cleanSemester.match(/^[Yy]?([1-4])[-_./]?[Ss]?([1-2])$/);
        if (semMatch) {
          cleanSemester = `${semMatch[1]}.${semMatch[2]}`;
        }
        if (!/^(1\.1|1\.2|2\.1|2\.2|3\.1|3\.2|4\.1|4\.2)$/.test(cleanSemester)) {
          throw new BadRequestException(
            `Row ${rowNum}: Semester "${semester}" is invalid. Must be in format X.Y (1.1 to 4.2).`,
          );
        }

        // Resolve Degrees
        const degreeList: { degreeId: number; status: string }[] = [];
        const defaultStatus: 'COMPULSORY' | 'OPTIONAL' =
          (statusVal ? this.normalizeCourseStatus(statusVal) : null) || 'COMPULSORY';

        if (degreeCodesRaw) {
          const tokens = degreeCodesRaw
            .split(/[,;]/)
            .map((t) => t.trim())
            .filter(Boolean);
          for (const token of tokens) {
            const { code: dCode, status: dStatus } = this.parseCodeAndStatus(token, defaultStatus);

            const degreeObj = await tx.degree.findFirst({
              where: {
                OR: [
                  { degree_code: { equals: dCode, mode: 'insensitive' } },
                  { degree_name: { equals: dCode, mode: 'insensitive' } },
                ],
              },
            });

            if (!degreeObj) {
              throw new BadRequestException(`Row ${rowNum}: Degree program "${dCode}" not found.`);
            }

            if (!degreeList.some((d) => d.degreeId === degreeObj.degree_id)) {
              degreeList.push({ degreeId: degreeObj.degree_id, status: dStatus });
            }
          }
        }

        // Resolve Department
        let departmentId: number | null = null;
        if (departmentCode) {
          const deptObj = await tx.department.findFirst({
            where: {
              OR: [
                { department_code: { equals: departmentCode.trim(), mode: 'insensitive' } },
                { department_name: { equals: departmentCode.trim(), mode: 'insensitive' } },
              ],
            },
          });
          if (!deptObj) {
            throw new BadRequestException(
              `Row ${rowNum}: Department "${departmentCode}" not found.`,
            );
          }
          departmentId = deptObj.department_id;
        } else if (degreeList.length > 0) {
          // Infer department from the first degree's department
          const firstDeg = await tx.degree.findUnique({
            where: { degree_id: degreeList[0].degreeId },
          });
          if (firstDeg?.department_id) {
            departmentId = firstDeg.department_id;
          }
        }

        if (!departmentId) {
          const anyDept = await tx.department.findFirst();
          if (anyDept) {
            departmentId = anyDept.department_id;
          } else {
            throw new BadRequestException(
              `Row ${rowNum}: Offering department could not be determined.`,
            );
          }
        }

        // If no degree was specified, auto-associate with degrees belonging to the department or first available degree
        if (degreeList.length === 0) {
          const deptDegrees = await tx.degree.findMany({
            where: { department_id: departmentId },
          });
          if (deptDegrees.length > 0) {
            for (const deg of deptDegrees) {
              degreeList.push({ degreeId: deg.degree_id, status: defaultStatus });
            }
          } else {
            const anyDegree = await tx.degree.findFirst();
            if (anyDegree) {
              degreeList.push({ degreeId: anyDegree.degree_id, status: defaultStatus });
            } else {
              throw new BadRequestException(
                `Row ${rowNum}: At least one degree program must be specified.`,
              );
            }
          }
        }

        // Resolve Specialization (Optional - only applicable for semester 2.1 or above)
        let specializationId: number | null = null;
        const specList: { specializationId: number; status: string }[] = [];
        const isEligibleForSpecialization = cleanSemester !== '1.1' && cleanSemester !== '1.2';
        if (specializationVal && isEligibleForSpecialization) {
          const specTokens = specializationVal
            .split(/[,;]/)
            .map((t) => t.trim())
            .filter(Boolean);
          for (const sToken of specTokens) {
            const { code: sCode, status: sStatus } = this.parseCodeAndStatus(sToken, defaultStatus);

            const specObj = await tx.specialization.findFirst({
              where: {
                OR: [
                  { specialization_code: { equals: sCode, mode: 'insensitive' } },
                  { specialization_name: { equals: sCode, mode: 'insensitive' } },
                ],
              },
            });

            if (
              specObj &&
              !specList.some((s) => s.specializationId === specObj.specialization_id)
            ) {
              specList.push({ specializationId: specObj.specialization_id, status: sStatus });
            }
          }

          if (specList.length > 0) {
            specializationId = specList[0].specializationId;
          }
        }

        // Create Course
        const course = await tx.course.create({
          data: {
            course_code: cleanCode,
            course_name: courseName.trim(),
            credit_value: new Prisma.Decimal(credits),
            department_id: departmentId,
            specialization_id: specializationId,
            semester: cleanSemester,
            degrees: {
              create: degreeList.map((d) => ({
                degree_id: d.degreeId,
                status: d.status,
              })),
            },
            ...(isEligibleForSpecialization && specList.length > 0
              ? {
                  course_specializations: {
                    create: specList.map((s) => ({
                      specialization_id: s.specializationId,
                      status: s.status,
                    })),
                  },
                }
              : {}),
          },
        });

        // Resolve Lecturer (Optional)
        if (lecturerVal) {
          const lecturerObj = await tx.lecturer.findFirst({
            where: {
              OR: [
                { employee_number: { equals: lecturerVal.trim(), mode: 'insensitive' } },
                {
                  user: {
                    email: { equals: lecturerVal.trim().toLowerCase(), mode: 'insensitive' },
                  },
                },
              ],
            },
          });
          if (lecturerObj) {
            await tx.courseLecturer.create({
              data: {
                course_id: course.course_id,
                lecturer_id: lecturerObj.lecturer_id,
              },
            });
          }
        }

        await this.auditService.logAction(
          executorId,
          'COURSE_CREATE',
          'courses',
          course.course_id.toString(),
          null,
          course,
        );

        importedCourses.push(course);
      }

      return {
        success: true,
        count: importedCourses.length,
      };
    });
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

    if (rows.length === 0) {
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
        select: { specialization_id: true, specialization_code: true, specialization_name: true },
      }),
    ]);

    const existingCourseCodes = new Set(existingCourses.map((c) => c.course_code.toUpperCase()));
    const seenCodes = new Set<string>();
    const parsedRows: any[] = [];

    rows.forEach((row, index) => {
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
      }

      if (!creditValue) {
        rowErrors.push('Credit Value is missing or empty.');
      } else {
        const credits = parseFloat(creditValue);
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

      const resolvedDegrees: { degree_id: number; department_id: number | null }[] = [];
      if (degreeCodesRaw) {
        const tokens = degreeCodesRaw
          .split(/[,;]/)
          .map((t) => t.trim())
          .filter(Boolean);
        for (const token of tokens) {
          const { code: dCode, invalidStatus } = this.parseCodeAndStatus(token, 'COMPULSORY');
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
            resolvedDegrees.push(matchedDeg);
          }
        }
      }

      if (departmentCode) {
        const matchedDept = allDepartments.find(
          (d) =>
            d.department_code.toLowerCase() === departmentCode.trim().toLowerCase() ||
            d.department_name.toLowerCase() === departmentCode.trim().toLowerCase(),
        );
        if (!matchedDept) {
          rowErrors.push(`Department "${departmentCode}" not found in system.`);
        }
      } else if (
        !(resolvedDegrees.length > 0 && resolvedDegrees[0].department_id) &&
        allDepartments.length === 0
      ) {
        rowErrors.push('Offering department could not be determined.');
      }

      if (!degreeCodesRaw && allDegrees.length === 0) {
        rowErrors.push('At least one degree program must be specified.');
      }

      const normalizedRowStatus = statusVal ? this.normalizeCourseStatus(statusVal) : 'COMPULSORY';
      if (statusVal && !normalizedRowStatus) {
        rowErrors.push(`Status "${statusVal}" must be C (Compulsory) or O (Optional).`);
      }

      if (specializationVal) {
        const isEligibleForSpec = cleanSemester !== '1.1' && cleanSemester !== '1.2';
        if (isEligibleForSpec) {
          const specTokens = specializationVal
            .split(/[,;]/)
            .map((t) => t.trim())
            .filter(Boolean);
          for (const sToken of specTokens) {
            const { code: sCode, invalidStatus } = this.parseCodeAndStatus(
              sToken,
              normalizedRowStatus || 'COMPULSORY',
            );
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
            }
          }
        }
      }

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
