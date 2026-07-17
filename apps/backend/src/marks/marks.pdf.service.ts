import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import PDFDocument from 'pdfkit';

@Injectable()
export class MarksPdfService {
  constructor(private readonly prisma: PrismaService) {}

  async generateSubmittedMarksPdf(
    examId: number,
    executorUserId: number,
    isLecturer: boolean,
  ): Promise<Buffer> {
    // 1. Fetch Exam and Course details
    const exam = await this.prisma.exam.findUnique({
      where: { exam_id: examId },
      include: {
        course: {
          include: {
            department: true,
          },
        },
      },
    });

    if (!exam) {
      throw new NotFoundException(`Exam with ID ${examId} not found`);
    }

    // 2. Authorization check if lecturer
    if (isLecturer) {
      const lecturer = await this.prisma.lecturer.findUnique({
        where: { user_id: executorUserId },
      });
      if (!lecturer) {
        throw new NotFoundException(`Lecturer profile not found for user ID ${executorUserId}`);
      }

      const isAssigned = await this.prisma.courseLecturer.findUnique({
        where: {
          course_id_lecturer_id: {
            course_id: exam.course_id,
            lecturer_id: lecturer.lecturer_id,
          },
        },
      });

      if (!isAssigned) {
        throw new BadRequestException('You are not authorized to view marks for this course.');
      }
    }

    // 3. Fetch Exam Marks
    const marks = await this.prisma.examMark.findMany({
      where: { exam_id: examId },
      include: {
        student: true,
      },
      orderBy: {
        student: {
          registration_number: 'asc',
        },
      },
    });

    if (marks.length === 0) {
      throw new BadRequestException('Cannot export empty marksheet. Record marks first.');
    }

    // 4. Generate PDF using pdfkit
    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // Design System Colors
      const primaryColor = '#1e293b'; // Slate 800
      const accentColor = '#0f766e'; // Teal 700
      const textColor = '#334155'; // Slate 700
      const lightBg = '#f8fafc'; // Slate 50
      const borderColor = '#e2e8f0'; // Slate 200

      // Main Header
      doc
        .fillColor(primaryColor)
        .fontSize(18)
        .font('Helvetica-Bold')
        .text('METROPOLITAN UNIVERSITY OF TECHNOLOGY', { align: 'center' });

      doc
        .fontSize(9)
        .fillColor(textColor)
        .text('OFFICE OF THE REGISTRAR | EXAMINATIONS DIVISION', { align: 'center' })
        .moveDown(1.5);

      // Document Title
      doc
        .fillColor(accentColor)
        .fontSize(13)
        .font('Helvetica-Bold')
        .text('OFFICIAL ASSESSMENT MARKSHEET', { align: 'center' })
        .moveDown(1.5);

      // Metadata section (2 columns)
      const startY = doc.y;
      doc
        .fillColor(primaryColor)
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('Course Code:', 50, startY)
        .font('Helvetica')
        .text(exam.course.course_code, 140, startY)
        .font('Helvetica-Bold')
        .text('Course Name:', 50, startY + 18)
        .font('Helvetica')
        .text(exam.course.course_name, 140, startY + 18)
        .font('Helvetica-Bold')
        .text('Department:', 50, startY + 36)
        .font('Helvetica')
        .text(exam.course.department.department_name, 140, startY + 36);

      doc
        .font('Helvetica-Bold')
        .text('Assessment:', 330, startY)
        .font('Helvetica')
        .text(exam.exam_title, 420, startY)
        .font('Helvetica-Bold')
        .text('Academic Year:', 330, startY + 18)
        .font('Helvetica')
        .text(
          `Batch ${marks[0]?.student?.academic_year || 'N/A'} (Sem ${exam.course.semester})`,
          420,
          startY + 18,
        )
        .font('Helvetica-Bold')
        .text('Total Entries:', 330, startY + 36)
        .font('Helvetica')
        .text(`${marks.length} Students`, 420, startY + 36);

      doc.moveDown(3);

      // Table Header
      const tableTop = doc.y;
      doc.rect(50, tableTop, 495, 24).fill(accentColor);

      doc
        .fillColor('#ffffff')
        .font('Helvetica-Bold')
        .fontSize(10)
        .text('Index Number (Registration No)', 70, tableTop + 7)
        .text('Letter Grade', 380, tableTop + 7, { align: 'center', width: 120 });

      let currentY = tableTop + 24;

      // Table Rows
      marks.forEach((entry, idx) => {
        // Auto-wrap page break check
        if (currentY > doc.page.height - 80) {
          doc.addPage();
          currentY = 50;
        }

        const isEven = idx % 2 === 0;
        if (isEven) {
          doc.rect(50, currentY, 495, 20).fill(lightBg);
        }

        // Draw outline borders
        doc.rect(50, currentY, 495, 20).strokeColor(borderColor).lineWidth(0.5).stroke();

        const pct = (entry.marks_obtained / exam.total_marks) * 100;
        const letterGrade = this.mapPercentageToGrade(pct);

        doc
          .fillColor(textColor)
          .font('Helvetica')
          .fontSize(9.5)
          .text(entry.student.registration_number, 70, currentY + 5)
          .font('Helvetica-Bold')
          .text(letterGrade, 380, currentY + 5, { align: 'center', width: 120 });

        currentY += 20;
      });

      // Signature Area
      const signatureY = currentY + 40;
      if (signatureY > doc.page.height - 100) {
        doc.addPage();
        currentY = 50;
      }

      doc
        .moveDown(2)
        .strokeColor(primaryColor)
        .lineWidth(0.5)
        .moveTo(50, doc.y)
        .lineTo(200, doc.y)
        .stroke()
        .fontSize(8.5)
        .fillColor(textColor)
        .font('Helvetica-Bold')
        .text('Internal Examiner / Lecturer Signature', 50, doc.y + 4)
        .text(`Date: ${new Date().toLocaleDateString()}`, 50, doc.y + 16);

      doc.end();
    });
  }

  private mapPercentageToGrade(pct: number): string {
    if (pct >= 85.0) return 'A';
    if (pct >= 80.0) return 'A-';
    if (pct >= 75.0) return 'B+';
    if (pct >= 70.0) return 'B';
    if (pct >= 65.0) return 'B-';
    if (pct >= 60.0) return 'C+';
    if (pct >= 55.0) return 'C';
    if (pct >= 50.0) return 'C-';
    if (pct >= 40.0) return 'D';
    return 'F';
  }
}
