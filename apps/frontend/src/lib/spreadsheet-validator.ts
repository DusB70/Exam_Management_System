import * as XLSX from 'xlsx';
import type { SpreadsheetValidationResult } from '../components/imports/spreadsheet-inspector-modal';

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[\s_-]/g, '');
}

function hasMatchingHeader(headerRow: string[], possibleKeys: string[]): boolean {
  const normalized = headerRow.map(normalizeKey);
  return possibleKeys.some((pk) => normalized.includes(normalizeKey(pk)));
}

function getVal(row: Record<string, any>, possibleKeys: string[]): string {
  const rowKeys = Object.keys(row);
  for (const pKey of possibleKeys) {
    const cleanPKey = normalizeKey(pKey);
    const foundKey = rowKeys.find((rk) => normalizeKey(rk) === cleanPKey);
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

async function readSpreadsheetFile(file: File): Promise<{
  headerRow: string[];
  rows: Record<string, any>[];
  parseError?: string;
}> {
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
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
      return { headerRow: [], rows: [], parseError: 'Spreadsheet contains no data rows.' };
    }
    const headerRow = (rawRows[0] || []).map((h: any) => String(h).trim()).filter(Boolean);
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });
    return { headerRow, rows };
  } catch (err: any) {
    return {
      headerRow: [],
      rows: [],
      parseError: `Failed to parse spreadsheet file: ${err?.message || 'Invalid format'}`,
    };
  }
}

export async function validateCoursesSpreadsheetLocally(
  file: File,
): Promise<SpreadsheetValidationResult> {
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

  const { headerRow, rows, parseError } = await readSpreadsheetFile(file);
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
  if (!hasMatchingHeader(headerRow, ['coursecode', 'course_code', 'course code', 'code'])) {
    headerErrors.push("Missing required column header 'courseCode'");
  }
  if (
    !hasMatchingHeader(headerRow, ['coursename', 'course_name', 'course name', 'name', 'title'])
  ) {
    headerErrors.push("Missing required column header 'courseName'");
  }
  if (
    !hasMatchingHeader(headerRow, [
      'creditvalue',
      'credit_value',
      'credit value',
      'credits',
      'credit',
    ])
  ) {
    headerErrors.push("Missing required column header 'creditValue'");
  }
  if (!hasMatchingHeader(headerRow, ['semester', 'sem', 'academicyearsemester'])) {
    headerErrors.push("Missing required column header 'semester'");
  }
  if (rows.length === 0) {
    headerErrors.push('Spreadsheet contains headers but no course rows.');
  }

  const seenCodes = new Set<string>();
  const parsedRows = rows.map((row, index) => {
    const rowErrors: string[] = [];
    const courseCode = getVal(row, ['coursecode', 'course_code', 'course code', 'code']);
    const courseName = getVal(row, ['coursename', 'course_name', 'course name', 'name', 'title']);
    const creditValue = getVal(row, [
      'creditvalue',
      'credit_value',
      'credit value',
      'credits',
      'credit',
    ]);
    const semester = getVal(row, ['semester', 'sem', 'academicyearsemester']);
    const department = getVal(row, [
      'department',
      'departmentcode',
      'department_code',
      'dept',
      'deptcode',
    ]);
    const degree = getVal(row, [
      'degree',
      'degrees',
      'degreecode',
      'degree_code',
      'degree codes',
      'program',
      'programme',
    ]);
    const status = getVal(row, [
      'status',
      'coursestatus',
      'course_status',
      'type',
      'coursetype',
      'course_type',
    ]);
    const specialization = getVal(row, [
      'specialization',
      'specializationcode',
      'specialization_code',
      'specialization code',
      'spec',
    ]);
    const lecturer = getVal(row, [
      'lecturer',
      'lectureremail',
      'lecturer_email',
      'lecturer email',
      'instructor',
    ]);

    const cleanCode = courseCode ? courseCode.toUpperCase() : '';
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
    }

    if (!courseName) rowErrors.push('Course Name is missing or empty.');

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

    let cleanSemester = semester;
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

    if (status && !['C', 'O', 'COMPULSORY', 'OPTIONAL'].includes(status.trim().toUpperCase())) {
      rowErrors.push(`Status "${status}" must be C (Compulsory) or O (Optional).`);
    }

    return {
      rowIndex: index + 2,
      courseCode: cleanCode || courseCode,
      courseName,
      creditValue,
      semester: cleanSemester || semester,
      department,
      degree,
      status: status ? status.toUpperCase() : 'COMPULSORY',
      specialization,
      lecturer,
      errors: rowErrors,
      isValid: rowErrors.length === 0,
    };
  });

  const validRowsCount = parsedRows.filter((r) => r.isValid).length;
  const invalidRowsCount = parsedRows.length - validRowsCount;

  return {
    headerRow,
    headerErrors,
    expectedHeaders,
    hasHeaderErrors: headerErrors.length > 0,
    hasBlockingErrors: headerErrors.length > 0 || parsedRows.length === 0 || invalidRowsCount > 0,
    totalRows: parsedRows.length,
    validRowsCount,
    invalidRowsCount,
    rows: parsedRows,
  };
}

export async function validateStudentsSpreadsheetLocally(
  file: File,
): Promise<SpreadsheetValidationResult> {
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

  const { headerRow, rows, parseError } = await readSpreadsheetFile(file);
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
  if (!hasMatchingHeader(headerRow, ['fullname', 'full_name', 'full name', 'name'])) {
    headerErrors.push("Missing required column header 'fullName'");
  }
  if (
    !hasMatchingHeader(headerRow, [
      'namewithinitials',
      'name_with_initials',
      'name with initials',
      'initials',
    ])
  ) {
    headerErrors.push("Missing required column header 'nameWithInitials'");
  }
  if (!hasMatchingHeader(headerRow, ['email', 'emailaddress', 'email_address'])) {
    headerErrors.push("Missing required column header 'email'");
  }
  if (!hasMatchingHeader(headerRow, ['nicno', 'nic_no', 'nic no', 'nic', 'nicnumber'])) {
    headerErrors.push("Missing required column header 'nicNo'");
  }
  if (!hasMatchingHeader(headerRow, ['dateofbirth', 'date_of_birth', 'date of birth', 'dob'])) {
    headerErrors.push("Missing required column header 'dateOfBirth'");
  }
  if (
    !hasMatchingHeader(headerRow, [
      'phonenumber',
      'phone_number',
      'phone number',
      'phone',
      'contactno',
    ])
  ) {
    headerErrors.push("Missing required column header 'phoneNumber'");
  }
  if (!hasMatchingHeader(headerRow, ['address', 'permanent_address'])) {
    headerErrors.push("Missing required column header 'address'");
  }
  if (
    !hasMatchingHeader(headerRow, [
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
    !hasMatchingHeader(headerRow, [
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
    !hasMatchingHeader(headerRow, [
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

  const seenEmails = new Set<string>();
  const seenNics = new Set<string>();
  const seenRegNos = new Set<string>();
  const seenIndexNos = new Set<string>();

  const parsedRows = rows.map((row, index) => {
    const rowErrors: string[] = [];

    const fullName = getVal(row, ['fullname', 'full_name', 'full name', 'name']);
    const nameWithInitials = getVal(row, [
      'namewithinitials',
      'name_with_initials',
      'name with initials',
      'initials',
    ]);
    const email = getVal(row, ['email', 'emailaddress', 'email_address']);
    const nicNo = getVal(row, ['nicno', 'nic_no', 'nic no', 'nic', 'nicnumber']);
    const dateOfBirth = getVal(row, ['dateofbirth', 'date_of_birth', 'date of birth', 'dob']);
    const phoneNumber = getVal(row, [
      'phonenumber',
      'phone_number',
      'phone number',
      'phone',
      'contactno',
    ]);
    const address = getVal(row, ['address', 'permanent_address']);
    const indexNumber = getVal(row, [
      'indexnumber',
      'index_number',
      'index number',
      'indexno',
      'index',
    ]);
    const registrationNumber = getVal(row, [
      'registrationnumber',
      'registration_number',
      'registration number',
      'regno',
      'reg_no',
    ]);
    const enrollmentYear = getVal(row, [
      'enrollmentyear',
      'enrollment_year',
      'enrollment year',
      'enrollment year (e.g. 21/22)',
      'academicyear',
      'academic_year',
      'academic year',
      'year',
    ]);
    const enrolledDegree = getVal(row, [
      'enrolleddegree',
      'enrolled_degree',
      'enrolled degree',
      'degreecode',
      'degree_code',
      'degree code',
      'degree',
    ]);

    if (!fullName) rowErrors.push('Full Name is missing or empty.');
    if (!nameWithInitials) rowErrors.push('Name with Initials is missing or empty.');

    if (!email) {
      rowErrors.push('Email is missing or empty.');
    } else {
      const cleanEmail = email.toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        rowErrors.push(`Invalid email format "${email}".`);
      }
      if (seenEmails.has(cleanEmail)) {
        rowErrors.push(`Duplicate email "${email}" found in spreadsheet.`);
      } else {
        seenEmails.add(cleanEmail);
      }
    }

    if (!nicNo) {
      rowErrors.push('NIC No is missing or empty.');
    } else if (seenNics.has(nicNo)) {
      rowErrors.push(`Duplicate NIC "${nicNo}" found in spreadsheet.`);
    } else {
      seenNics.add(nicNo);
    }

    if (!dateOfBirth) {
      rowErrors.push('Date of Birth is missing or empty.');
    } else if (isNaN(new Date(dateOfBirth).getTime())) {
      rowErrors.push(
        `Invalid Date of Birth "${dateOfBirth}". Expected YYYY-MM-DD format (e.g. 2001-05-18).`,
      );
    }

    if (!phoneNumber) rowErrors.push('Phone Number is missing or empty.');
    if (!address) rowErrors.push('Address is missing or empty.');

    if (!indexNumber) {
      rowErrors.push('Index Number is missing or empty.');
    } else if (seenIndexNos.has(indexNumber)) {
      rowErrors.push(`Duplicate index number "${indexNumber}" found in spreadsheet.`);
    } else {
      seenIndexNos.add(indexNumber);
    }

    if (!registrationNumber) {
      rowErrors.push('Registration Number is missing or empty.');
    } else if (seenRegNos.has(registrationNumber)) {
      rowErrors.push(`Duplicate registration number "${registrationNumber}" found in spreadsheet.`);
    } else {
      seenRegNos.add(registrationNumber);
    }

    if (!enrolledDegree) rowErrors.push('Enrolled Degree is missing or empty.');

    return {
      rowIndex: index + 2,
      fullName,
      nameWithInitials,
      email,
      nicNo,
      dateOfBirth,
      phoneNumber,
      address,
      indexNumber,
      registrationNumber,
      enrollmentYear: enrollmentYear || '21/22',
      enrolledDegree,
      errors: rowErrors,
      isValid: rowErrors.length === 0,
    };
  });

  const validRowsCount = parsedRows.filter((r) => r.isValid).length;
  const invalidRowsCount = parsedRows.length - validRowsCount;

  return {
    headerRow,
    headerErrors,
    expectedHeaders,
    hasHeaderErrors: headerErrors.length > 0,
    hasBlockingErrors: headerErrors.length > 0 || parsedRows.length === 0 || invalidRowsCount > 0,
    totalRows: parsedRows.length,
    validRowsCount,
    invalidRowsCount,
    rows: parsedRows,
  };
}
