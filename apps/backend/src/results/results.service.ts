import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StudentSemesterGpa } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { NotificationsQueueService } from '../notifications/notifications.queue.service';

@Injectable()
export class ResultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly notificationsQueueService: NotificationsQueueService,
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

    const result = await this.prisma.$transaction(async (tx) => {
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

    // Queue notifications to students asynchronously
    await this.notificationsQueueService.addResultsPublishedJob(academicYear, semester);

    return result;
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

  async generateReportCardPdfBuffer(studentUserId: number): Promise<Buffer> {
    const report = await this.getStudentReportCard(studentUserId);
    const { student, gpas, grades } = report;

    // Fetch department details
    const department = await this.prisma.department.findUnique({
      where: { department_id: student.department_id },
    });
    const deptName = department ? department.department_name : 'Unknown Department';

    // Fetch user details
    const user = await this.prisma.user.findUnique({
      where: { user_id: student.user_id },
    });
    const fullName = user ? user.full_name : 'Unknown Student';

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // Colors
      const primaryColor = '#1e293b'; // dark slate
      const accentColor = '#0f766e'; // teal
      const textColor = '#334155';
      const lightBg = '#f8fafc';
      const borderColor = '#e2e8f0';

      // Header
      doc
        .fillColor(primaryColor)
        .fontSize(20)
        .font('Helvetica-Bold')
        .text('METROPOLITAN UNIVERSITY OF TECHNOLOGY', { align: 'center' });

      doc
        .fontSize(10)
        .fillColor(textColor)
        .text('Office of the Registrar (Examinations Division)', { align: 'center' })
        .moveDown(1.5);

      // Title
      doc
        .fillColor(accentColor)
        .fontSize(13)
        .font('Helvetica-Bold')
        .text('OFFICIAL ACADEMIC TRANSCRIPT / RESULTS SHEET', { align: 'center' })
        .moveDown(1.5);

      // Student Info Block - 2 Columns
      const startY = doc.y;
      doc
        .fillColor(primaryColor)
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('Student Name:', 50, startY)
        .font('Helvetica')
        .text(fullName, 150, startY)
        .font('Helvetica-Bold')
        .text('Registration No:', 50, startY + 18)
        .font('Helvetica')
        .text(student.registration_number, 150, startY + 18)
        .font('Helvetica-Bold')
        .text('Department:', 50, startY + 36)
        .font('Helvetica')
        .text(deptName, 150, startY + 36);

      doc
        .font('Helvetica-Bold')
        .text('Academic Year:', 350, startY)
        .font('Helvetica')
        .text(`${student.academic_year}`, 450, startY)
        .font('Helvetica-Bold')
        .text('Current Semester:', 350, startY + 18)
        .font('Helvetica')
        .text(`${student.semester}`, 450, startY + 18)
        .font('Helvetica-Bold')
        .text('Date Generated:', 350, startY + 36)
        .font('Helvetica')
        .text(new Date().toLocaleDateString(), 450, startY + 36)
        .moveDown(3);

      // Divider Line
      doc
        .strokeColor(borderColor)
        .lineWidth(1)
        .moveTo(50, doc.y + 45)
        .lineTo(545, doc.y + 45)
        .stroke()
        .moveDown(3);

      // Grades Table Title
      doc
        .fillColor(primaryColor)
        .fontSize(11)
        .font('Helvetica-Bold')
        .text('Completed Course Unit Grades', 50, doc.y)
        .moveDown(0.5);

      // Table Header
      const tableHeaderY = doc.y;
      doc.rect(50, tableHeaderY, 495, 20).fill(lightBg);
      doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(8.5);
      doc.text('CODE', 60, tableHeaderY + 6);
      doc.text('COURSE TITLE', 130, tableHeaderY + 6);
      doc.text('CREDITS', 340, tableHeaderY + 6, { width: 50, align: 'center' });
      doc.text('MARKS', 400, tableHeaderY + 6, { width: 50, align: 'center' });
      doc.text('GRADE', 460, tableHeaderY + 6, { width: 40, align: 'center' });
      doc.text('GP', 510, tableHeaderY + 6, { width: 30, align: 'center' });

      let currentY = tableHeaderY + 20;

      // Table Rows
      doc.font('Helvetica').fontSize(8.5).fillColor(textColor);
      for (const g of grades) {
        if (currentY > 700) {
          doc.addPage();
          currentY = 50;
        }

        // Draw thin border bottom
        doc
          .strokeColor(borderColor)
          .lineWidth(0.5)
          .moveTo(50, currentY)
          .lineTo(545, currentY)
          .stroke();

        const totalMarksFormatted = g.total_marks.toFixed(1);
        const gradePointFormatted = g.grade_point.toFixed(2);
        const creditsFormatted = parseFloat(g.course.credit_value.toString()).toFixed(1);

        doc.text(g.course.course_code, 60, currentY + 6);
        doc.text(g.course.course_name, 130, currentY + 6, {
          width: 200,
          height: 12,
          ellipsis: true,
        });
        doc.text(creditsFormatted, 340, currentY + 6, { width: 50, align: 'center' });
        doc.text(totalMarksFormatted, 400, currentY + 6, { width: 50, align: 'center' });
        doc.text(g.grade, 460, currentY + 6, { width: 40, align: 'center' });
        doc.text(gradePointFormatted, 510, currentY + 6, { width: 30, align: 'center' });

        currentY += 20;
      }

      // Draw final table bottom line
      doc
        .strokeColor(borderColor)
        .lineWidth(1)
        .moveTo(50, currentY)
        .lineTo(545, currentY)
        .stroke()
        .moveDown(2);

      // GPA Summaries
      const summaryY = currentY + 15;
      doc.rect(50, summaryY, 495, 55).stroke(borderColor);

      const latestGpa = gpas[gpas.length - 1];
      const sgpaVal = latestGpa ? latestGpa.semester_gpa.toFixed(2) : '0.00';
      const cgpaVal = latestGpa ? latestGpa.cumulative_gpa.toFixed(2) : '0.00';
      const totalCreditsVal = latestGpa ? latestGpa.total_credits.toFixed(1) : '0.0';

      doc
        .fontSize(9.5)
        .fillColor(primaryColor)
        .font('Helvetica-Bold')
        .text('SUMMARY OF ACADEMIC STANDING', 60, summaryY + 8);

      doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor(textColor)
        .text('Total Semester Credits Earned: ', 60, summaryY + 24)
        .font('Helvetica-Bold')
        .text(totalCreditsVal, 210, summaryY + 24)
        .font('Helvetica')
        .text('Semester Grade Point Average (SGPA): ', 60, summaryY + 38)
        .font('Helvetica-Bold')
        .text(sgpaVal, 260, summaryY + 38);

      doc
        .font('Helvetica')
        .text('Cumulative Grade Point Average (CGPA): ', 320, summaryY + 24)
        .font('Helvetica-Bold')
        .text(cgpaVal, 515, summaryY + 24);

      // Signatures
      const signY = summaryY + 90;
      doc.strokeColor(primaryColor).lineWidth(0.5).moveTo(380, signY).lineTo(520, signY).stroke();

      doc
        .fillColor(primaryColor)
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .text('Registrar (Examinations)', 380, signY + 5, { align: 'center', width: 140 });

      doc
        .fillColor(textColor)
        .font('Helvetica-Oblique')
        .fontSize(8)
        .text(
          'This is an official computer-generated document. No physical signature is required.',
          50,
          signY + 35,
          { align: 'center' },
        );

      doc.end();
    });
  }

  async generateReportCardPdfBufferByStudentId(studentId: number): Promise<Buffer> {
    const student = await this.prisma.student.findUnique({
      where: { student_id: studentId },
    });
    if (!student) {
      throw new NotFoundException(`Student with ID ${studentId} not found`);
    }
    return this.generateReportCardPdfBuffer(student.user_id);
  }
}
