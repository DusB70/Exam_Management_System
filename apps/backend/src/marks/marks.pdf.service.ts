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
          `Batch ${marks[0]?.student?.batch || '21/22'} (Sem ${exam.course.semester})`,
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

  // =========================================================================
  // DETAILED MARKSHEET PDF (Rajarata University - Faculty of Technology Format)
  // Structure: S.No, Registration No., Index No, R/P, Q1..Qn, Total, Final
  // =========================================================================
  async generateDetailedMarksheetPdf(
    courseId: number,
    executorUserId: number,
    isLecturer: boolean,
    liveData?: any,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const course = await this.prisma.course.findUnique({
      where: { course_id: courseId },
      include: {
        department: true,
        exams: true,
        registrations: {
          include: { student: true },
          orderBy: { student: { registration_number: 'asc' } },
        },
      },
    });

    if (!course) {
      throw new NotFoundException(`Course with ID ${courseId} not found`);
    }

    if (isLecturer) {
      await this.verifyLecturerCourseAccess(executorUserId, course);
    }

    let subConfig: any = course.marks_config || {};
    if (typeof subConfig === 'string') {
      try {
        subConfig = JSON.parse(subConfig);
      } catch {
        subConfig = {};
      }
    }

    const isCaOnly = Boolean(subConfig.is_ca_only || subConfig.evaluation_type === 'CA_ONLY');
    if (isCaOnly) {
      throw new BadRequestException(
        'Detailed Marksheet is not applicable for Continuous Assessment (CA) only courses.',
      );
    }

    const is2ndSubmitted = Boolean(
      subConfig.secondMarkerSheet?.submitted ||
      (course as any).publishing_progress?.second_marking_submitted ||
      (liveData?.secondMarkerMarks && Object.keys(liveData.secondMarkerMarks).length > 0),
    );
    if (!is2ndSubmitted) {
      throw new BadRequestException(
        'Detailed Marksheet cannot be generated until the 2nd marker evaluation has been submitted.',
      );
    }

    const courseCode = course.course_code || 'COURSE';
    const courseName = course.course_name || 'Course Title';
    const semester = course.semester || 'I';

    // Questions
    const questions: any[] =
      liveData?.questions && Array.isArray(liveData.questions) && liveData.questions.length > 0
        ? liveData.questions
        : subConfig.questions &&
            Array.isArray(subConfig.questions) &&
            subConfig.questions.length > 0
          ? subConfig.questions
          : [
              { key: 'q1', label: 'Q1', maxMarks: 20 },
              { key: 'q2', label: 'Q2', maxMarks: 20 },
              { key: 'q3', label: 'Q3', maxMarks: 20 },
              { key: 'q4', label: 'Q4', maxMarks: 20 },
              { key: 'q5', label: 'Q5', maxMarks: 20 },
              { key: 'q6', label: 'Q6', maxMarks: 20 },
            ];

    const firstMarkerMarks = liveData?.firstMarkerMarks || subConfig.firstMarkerSheet?.marks || {};
    const secondMarkerMarks =
      liveData?.secondMarkerMarks || subConfig.secondMarkerSheet?.marks || {};
    const reconciliationDecisions =
      liveData?.reconciliationDecisions || subConfig.reconciliation || {};

    // Students list
    let studentsList: any[] = [];
    if (liveData?.students && Array.isArray(liveData.students) && liveData.students.length > 0) {
      studentsList = liveData.students;
    } else {
      studentsList = course.registrations.map((r) => ({
        student_id: r.student.student_id,
        registration_number: r.student.registration_number,
        index_number: r.student.index_number,
        attempt_type: r.attempt_type,
      }));
    }

    const totalQuestionsMax =
      questions.reduce((sum, q) => sum + (Number(q.maxMarks) || 20), 0) || 100;

    return new Promise<{ buffer: Buffer; filename: string }>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 25 });
      const chunks: Buffer[] = [];

      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () =>
        resolve({
          buffer: Buffer.concat(chunks),
          filename: `${courseCode.replace(/[^a-zA-Z0-9_-]/g, '_')}_Detailed_Marksheet.pdf`,
        }),
      );
      doc.on('error', (err) => reject(err));

      const startX = 25;
      const pageWidth = doc.page.width; // 841.89
      const contentWidth = pageWidth - 50; // 791.89

      // Top right
      doc
        .fontSize(8)
        .font('Helvetica-Bold')
        .text('Confidential', pageWidth - 120, 18, { align: 'right', width: 95 });
      doc.text('Office Use Only', pageWidth - 120, 28, { align: 'right', width: 95 });

      // Centered Headings
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('Rajarata University of Sri Lanka', startX, 20, {
          align: 'center',
          width: contentWidth,
        });
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .text('Faculty of Technology', startX, 36, { align: 'center', width: contentWidth });
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('DETAIL MARK SHEET', startX, 51, { align: 'center', width: contentWidth });

      // Metadata
      doc.fontSize(9).font('Helvetica-Bold').text('Name of Examination', startX, 72);
      doc
        .font('Helvetica')
        .text(
          `: Bachelor of Technology (Honours) Examination - Semester ${semester}`,
          startX + 130,
          72,
        );

      doc.font('Helvetica-Bold').text('Title of Question Paper', startX, 86);
      doc.font('Helvetica').text(`: ${courseName}`, startX + 130, 86);

      doc.font('Helvetica-Bold').text('Course Code', startX, 100);
      doc.font('Helvetica').text(`: ${courseCode}`, startX + 130, 100);
      doc
        .font('Helvetica-Bold')
        .text('Theory/Practical', contentWidth - 100, 100, { align: 'right', width: 100 });

      // Notes
      doc.fontSize(8).font('Helvetica-Bold').text('Note:', startX, 116);
      doc
        .font('Helvetica')
        .text(
          '(a) Please enter the marks clearly in ink. Alterations, if any Should be initiated.',
          startX + 30,
          116,
        );
      doc.text('(b) R- Repeat, P - Proper', startX + 30, 126);

      // Table layout
      let currentY = 140;

      // Calculate column widths
      const snoW = 32;
      const rpW = 32;
      const totalW = 55;
      const finalW = 55;
      const regW = 125;
      const idxW = 95;
      const fixedTotal = snoW + rpW + totalW + finalW + regW + idxW;
      const remainingForQ = Math.max(contentWidth - fixedTotal, 150);
      const qW = Math.max(28, remainingForQ / Math.max(questions.length, 1));
      const adjustedContentWidth = fixedTotal + qW * questions.length;

      const drawTableHeader = (y: number) => {
        doc.rect(startX, y, adjustedContentWidth, 20).fillAndStroke('#f1f5f9', '#000000');
        doc.fillColor('#000000').font('Helvetica-Bold').fontSize(8);

        let curX = startX;
        doc.text('S.No', curX, y + 5, { width: snoW, align: 'center' });
        curX += snoW;
        doc.text('Registration No.', curX, y + 5, { width: regW, align: 'center' });
        curX += regW;
        doc.text('Index No', curX, y + 5, { width: idxW, align: 'center' });
        curX += idxW;
        doc.text('R/P', curX, y + 5, { width: rpW, align: 'center' });
        curX += rpW;

        questions.forEach((q) => {
          doc.text(q.label || q.key?.toUpperCase(), curX, y + 5, { width: qW, align: 'center' });
          curX += qW;
        });

        doc.text('Total', curX, y + 5, { width: totalW, align: 'center' });
        curX += totalW;
        doc.text('Final', curX, y + 5, { width: finalW, align: 'center' });

        // Vertical separators
        let lx = startX;
        const colWs = [snoW, regW, idxW, rpW, ...questions.map(() => qW), totalW, finalW];
        colWs.forEach((w) => {
          lx += w;
          doc
            .moveTo(lx, y)
            .lineTo(lx, y + 20)
            .stroke('#000000');
        });
      };

      drawTableHeader(currentY);
      currentY += 20;

      // Table Rows
      studentsList.forEach((student, idx) => {
        if (currentY > doc.page.height - 55) {
          doc.addPage();
          currentY = 35;
          drawTableHeader(currentY);
          currentY += 20;
        }

        const sId = student.student_id;
        const row1st = firstMarkerMarks[sId] || {};
        const row2nd = secondMarkerMarks[sId] || row1st;
        const decision = reconciliationDecisions[sId] || 'MAX';

        let studentTotal = 0;
        const studentQVals: { [key: string]: number } = {};
        questions.forEach((q) => {
          const m1 = Number(row1st[q.key]) || 0;
          const m2 = Number(row2nd[q.key]) || 0;
          let res = m1;
          if (decision === 'MAX') res = Math.max(m1, m2);
          else if (decision === 'MIN') res = Math.min(m1, m2);
          else res = Math.round(((m1 + m2) / 2) * 10) / 10;
          studentQVals[q.key] = res;
          studentTotal += res;
        });

        const final100 =
          totalQuestionsMax > 0
            ? Math.round((studentTotal / totalQuestionsMax) * 100 * 10) / 10
            : studentTotal;

        const isRep =
          student.attempt_type === 'REPEAT' ||
          student.registrations?.[0]?.attempt_type === 'REPEAT';

        const rowH = 15;
        doc.rect(startX, currentY, adjustedContentWidth, rowH).stroke('#000000');
        doc.font('Helvetica').fontSize(8).fillColor('#000000');

        let curX = startX;
        doc.text(String(idx + 1), curX, currentY + 3.5, { width: snoW, align: 'center' });
        curX += snoW;
        doc.text(student.registration_number || '', curX, currentY + 3.5, {
          width: regW,
          align: 'center',
        });
        curX += regW;
        doc.text(student.index_number || '', curX, currentY + 3.5, {
          width: idxW,
          align: 'center',
        });
        curX += idxW;
        doc.text(isRep ? 'R' : 'P', curX, currentY + 3.5, { width: rpW, align: 'center' });
        curX += rpW;

        questions.forEach((q) => {
          const val = studentQVals[q.key];
          doc.text(val !== undefined ? String(val) : '0', curX, currentY + 3.5, {
            width: qW,
            align: 'center',
          });
          curX += qW;
        });

        doc.text(String(studentTotal), curX, currentY + 3.5, { width: totalW, align: 'center' });
        curX += totalW;
        doc.text(String(final100), curX, currentY + 3.5, { width: finalW, align: 'center' });

        // Vertical lines
        let lx = startX;
        const colWs = [snoW, regW, idxW, rpW, ...questions.map(() => qW), totalW, finalW];
        colWs.forEach((w) => {
          lx += w;
          doc
            .moveTo(lx, currentY)
            .lineTo(lx, currentY + rowH)
            .stroke('#000000');
        });

        currentY += rowH;
      });

      // Signature area
      currentY += 25;
      if (currentY > doc.page.height - 45) {
        doc.addPage();
        currentY = 45;
      }
      doc.font('Helvetica-Bold').fontSize(9).fillColor('#000000');
      doc.text('1st Examiner: ___________________________', startX + 40, currentY);
      doc.text('2nd Examiner: ___________________________', contentWidth - 260, currentY);

      doc.end();
    });
  }

  // =========================================================================
  // FINAL MARKSHEET PDF (Rajarata University - Faculty of Technology Format)
  // Structure: S.No, Reg. No., Index No., R/P, CA 1 (%), CA 2 (%), ..., End (%), Final, Grade
  // Strictly NO Total CA and NO Total SA columns in the PDF!
  // Followed by: CA Score Distribution, Grading Scale, Cutoff Marks, Signatures
  // =========================================================================
  async generateFinalMarksheetPdf(
    courseId: number,
    executorUserId: number,
    isLecturer: boolean,
    liveData?: any,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const course = await this.prisma.course.findUnique({
      where: { course_id: courseId },
      include: {
        department: true,
        exams: true,
        registrations: {
          include: { student: true },
          orderBy: { student: { registration_number: 'asc' } },
        },
      },
    });

    if (!course) {
      throw new NotFoundException(`Course with ID ${courseId} not found`);
    }

    if (isLecturer) {
      await this.verifyLecturerCourseAccess(executorUserId, course);
    }

    let subConfig: any = course.marks_config || {};
    if (typeof subConfig === 'string') {
      try {
        subConfig = JSON.parse(subConfig);
      } catch {
        subConfig = {};
      }
    }

    const isCaOnly = Boolean(subConfig.is_ca_only || subConfig.evaluation_type === 'CA_ONLY');

    const courseCode = course.course_code || 'COURSE';
    const courseName = course.course_name || 'Course Title';
    const semester = course.semester || 'I';

    const customConfig = liveData?.customConfig || subConfig || {};
    const cutoffs = customConfig.cutoffs || { ca: 40, final: 35 };
    const caCutoff = cutoffs.ca ?? 40;
    const finalCutoff = cutoffs.final ?? 35;

    const gradeRanges =
      customConfig.grade_ranges && customConfig.grade_ranges.length > 0
        ? customConfig.grade_ranges
        : [
            { grade: 'A', min: 85.0 },
            { grade: 'A-', min: 80.0 },
            { grade: 'B+', min: 75.0 },
            { grade: 'B', min: 70.0 },
            { grade: 'B-', min: 65.0 },
            { grade: 'C+', min: 60.0 },
            { grade: 'C', min: 55.0 },
            { grade: 'C-', min: 50.0 },
            { grade: 'D', min: 40.0 },
            { grade: 'F', min: 0.0 },
          ];

    // Exams & CA list
    const examsList: any[] = liveData?.exams || course.exams || [];
    const caExams = examsList.filter((e: any) => e.exam_type?.toUpperCase() === 'CA');
    const weightsMap = customConfig.weights || {};
    const contribsMap = customConfig.contributes || {};

    const totalCAWeight = examsList.reduce((acc: number, e: any) => {
      if (e.exam_type?.toUpperCase() !== 'CA') return acc;
      const isContrib = contribsMap[e.exam_id] !== undefined ? !!contribsMap[e.exam_id] : true;
      if (!isContrib) return acc;
      const w =
        weightsMap[e.exam_id] !== undefined
          ? parseFloat(weightsMap[e.exam_id])
          : parseFloat(e.weight) || 0;
      return acc + (isNaN(w) ? 0 : w);
    }, 0);

    const totalSAWeight = examsList.reduce((acc: number, e: any) => {
      if (e.exam_type?.toUpperCase() === 'CA') return acc;
      const isContrib = contribsMap[e.exam_id] !== undefined ? !!contribsMap[e.exam_id] : true;
      if (!isContrib) return acc;
      const w =
        weightsMap[e.exam_id] !== undefined
          ? parseFloat(weightsMap[e.exam_id])
          : parseFloat(e.weight) || 0;
      return acc + (isNaN(w) ? 0 : w);
    }, 0);

    const caWeight = totalCAWeight > 0 ? totalCAWeight : 40;
    const saWeight = totalSAWeight > 0 ? totalSAWeight : 60;

    // Questions and Reconciled Final Marks
    const questions: any[] =
      liveData?.questions && Array.isArray(liveData.questions) && liveData.questions.length > 0
        ? liveData.questions
        : subConfig.questions &&
            Array.isArray(subConfig.questions) &&
            subConfig.questions.length > 0
          ? subConfig.questions
          : [];

    const totalQuestionsMax =
      questions.reduce((sum, q) => sum + (Number(q.maxMarks) || 20), 0) || 100;

    const firstMarkerMarks = liveData?.firstMarkerMarks || subConfig.firstMarkerSheet?.marks || {};
    const secondMarkerMarks =
      liveData?.secondMarkerMarks || subConfig.secondMarkerSheet?.marks || {};
    const reconciliationDecisions =
      liveData?.reconciliationDecisions || subConfig.reconciliation || {};
    const caMarksData = liveData?.caMarksData || subConfig.caMarks || {};
    const gridMarksDraft = liveData?.gridMarksDraft || {};

    // Students list
    let studentsList: any[] = [];
    if (liveData?.students && Array.isArray(liveData.students) && liveData.students.length > 0) {
      studentsList = liveData.students;
    } else {
      studentsList = course.registrations.map((r) => ({
        student_id: r.student.student_id,
        registration_number: r.student.registration_number,
        index_number: r.student.index_number,
        attempt_type: r.attempt_type,
      }));
    }

    return new Promise<{ buffer: Buffer; filename: string }>((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 25 });
      const chunks: Buffer[] = [];

      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () =>
        resolve({
          buffer: Buffer.concat(chunks),
          filename: `${courseCode.replace(/[^a-zA-Z0-9_-]/g, '_')}_Final_Marksheet.pdf`,
        }),
      );
      doc.on('error', (err) => reject(err));

      const startX = 25;
      const pageWidth = doc.page.width; // 841.89
      const contentWidth = pageWidth - 50; // 791.89

      // Top right
      doc
        .fontSize(8)
        .font('Helvetica-Bold')
        .text('Confidential', pageWidth - 120, 18, { align: 'right', width: 95 });
      doc.text('Office Use Only', pageWidth - 120, 28, { align: 'right', width: 95 });

      // Centered Headings
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('Rajarata University of Sri Lanka', startX, 20, {
          align: 'center',
          width: contentWidth,
        });
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .text('Faculty of Technology', startX, 36, { align: 'center', width: contentWidth });
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('FINAL MARK SHEET', startX, 51, { align: 'center', width: contentWidth });

      // Metadata
      doc.fontSize(9).font('Helvetica-Bold').text('Name of Examination', startX, 72);
      doc
        .font('Helvetica')
        .text(
          `: Bachelor of Technology (Honours) Examination - Semester ${semester}`,
          startX + 130,
          72,
        );

      doc.font('Helvetica-Bold').text('Title of Question Paper', startX, 86);
      doc.font('Helvetica').text(`: ${courseName}`, startX + 130, 86);

      doc.font('Helvetica-Bold').text('Course Code', startX, 100);
      doc.font('Helvetica').text(`: ${courseCode}`, startX + 130, 100);
      doc
        .font('Helvetica-Bold')
        .text('Theory/Practical', contentWidth - 100, 100, { align: 'right', width: 100 });

      // Notes
      doc.fontSize(8).font('Helvetica-Bold').text('Note:', startX, 116);
      doc
        .font('Helvetica')
        .text(
          '(a) Please enter the marks clearly in ink. Alterations, if any Should be initiated.',
          startX + 30,
          116,
        );
      doc.text('(b) R- Repeat, P - Proper', startX + 30, 126);

      // Table Setup
      let currentY = 140;

      // Available CAs for table
      const caCols =
        caExams.length > 0
          ? caExams.map((ca: any, i: number) => ({
              id: ca.exam_id,
              label: ca.exam_title || `CA ${i + 1} (%)`,
            }))
          : [{ id: 'ca1', label: 'CA 1 (%)' }];

      const snoW = 32;
      const rpW = 32;
      const endW = isCaOnly ? 0 : 60;
      const finalW = 75;
      const gradeW = 55;
      const regW = 130;
      const idxW = 100;
      const fixedTotal = snoW + rpW + endW + finalW + gradeW + regW + idxW;
      const remainingForCA = Math.max(contentWidth - fixedTotal, 140);
      const caColW = Math.max(45, remainingForCA / Math.max(caCols.length, 1));
      const adjustedContentWidth = fixedTotal + caColW * caCols.length;

      const drawTableHeader = (y: number) => {
        doc.rect(startX, y, adjustedContentWidth, 20).fillAndStroke('#f1f5f9', '#000000');
        doc.fillColor('#000000').font('Helvetica-Bold').fontSize(8);

        let curX = startX;
        doc.text('S.No', curX, y + 5, { width: snoW, align: 'center' });
        curX += snoW;
        doc.text('Reg. No.', curX, y + 5, { width: regW, align: 'center' });
        curX += regW;
        doc.text('Index No.', curX, y + 5, { width: idxW, align: 'center' });
        curX += idxW;
        doc.text('R/P', curX, y + 5, { width: rpW, align: 'center' });
        curX += rpW;

        caCols.forEach((ca) => {
          doc.text(ca.label, curX, y + 5, { width: caColW, align: 'center' });
          curX += caColW;
        });

        if (!isCaOnly) {
          doc.text('End (%)', curX, y + 5, { width: endW, align: 'center' });
          curX += endW;
        }
        doc.text('Total Combined', curX, y + 5, { width: finalW, align: 'center' });
        curX += finalW;
        doc.text('Grade', curX, y + 5, { width: gradeW, align: 'center' });

        // Vertical separators
        let lx = startX;
        const colWs = [
          snoW,
          regW,
          idxW,
          rpW,
          ...caCols.map(() => caColW),
          ...(isCaOnly ? [] : [endW]),
          finalW,
          gradeW,
        ];
        colWs.forEach((w) => {
          lx += w;
          doc
            .moveTo(lx, y)
            .lineTo(lx, y + 20)
            .stroke('#000000');
        });
      };

      drawTableHeader(currentY);
      currentY += 20;

      // Table Rows
      studentsList.forEach((student, idx) => {
        if (currentY > doc.page.height - 55) {
          doc.addPage();
          currentY = 35;
          drawTableHeader(currentY);
          currentY += 20;
        }

        const sId = student.student_id;
        const row1st = firstMarkerMarks[sId] || {};
        const row2nd = secondMarkerMarks[sId] || row1st;
        const decision = reconciliationDecisions[sId] || 'MAX';

        let studentQTotal = 0;
        questions.forEach((q) => {
          const m1 = Number(row1st[q.key]) || 0;
          const m2 = Number(row2nd[q.key]) || 0;
          let res = m1;
          if (decision === 'MAX') res = Math.max(m1, m2);
          else if (decision === 'MIN') res = Math.min(m1, m2);
          else res = Math.round(((m1 + m2) / 2) * 10) / 10;
          studentQTotal += res;
        });

        const final100 =
          totalQuestionsMax > 0
            ? Math.round((studentQTotal / totalQuestionsMax) * 100 * 10) / 10
            : studentQTotal;

        // Individual CA scores & Total CA %
        let caScoreSum = 0;
        let caAllocWeight = 0;
        const studentCaMarks: { [key: string]: number | string } = {};

        if (caExams.length > 0) {
          caExams.forEach((caExam: any) => {
            const rawVal = gridMarksDraft[sId]?.[caExam.exam_id];
            const maxMarks = Number(caExam.total_marks) || 100;
            const w =
              weightsMap[caExam.exam_id] !== undefined
                ? parseFloat(weightsMap[caExam.exam_id])
                : parseFloat(caExam.weight) || 0;
            let valNum: number | null = null;

            if (rawVal !== undefined && rawVal !== '') {
              const parsed = parseFloat(rawVal);
              if (!isNaN(parsed)) valNum = parsed;
            } else if (caMarksData[sId] !== undefined && caExams.length === 1) {
              valNum = Number(caMarksData[sId]);
            }

            if (valNum !== null) {
              studentCaMarks[caExam.exam_id] = valNum;
              caScoreSum += (valNum / maxMarks) * w;
              caAllocWeight += w;
            } else {
              studentCaMarks[caExam.exam_id] = 0;
            }
          });
        } else {
          const val = caMarksData[sId] !== undefined ? Number(caMarksData[sId]) : 0;
          studentCaMarks['ca1'] = val;
          caScoreSum = val;
          caAllocWeight = 100;
        }

        const caPercentage =
          caAllocWeight > 0 ? Math.round((caScoreSum / caAllocWeight) * 100 * 10) / 10 : 0;

        const isRep =
          student.attempt_type === 'REPEAT' ||
          student.registrations?.[0]?.attempt_type === 'REPEAT';

        // Calculation: combining CA totals and Final(100) total converted to 100 percentage
        const caTotalVal = Math.round(((caPercentage * caWeight) / 100) * 10) / 10;
        const saTotalVal = Math.round(((final100 * saWeight) / 100) * 10) / 10;
        const totalWeight = caWeight + saWeight || 100;
        const rawFinal = isCaOnly
          ? caPercentage
          : totalWeight > 0
            ? ((caTotalVal + saTotalVal) / totalWeight) * 100
            : caTotalVal + saTotalVal;

        // User rule: if total combined value got any decimal value such as 10.2, it should always round up to next digit which is 11.
        const finalPercentage = Math.ceil(rawFinal);

        // Grade Resolution
        const failedCA = caWeight > 0 && caPercentage < caCutoff;
        const failedFinal = !isCaOnly && saWeight > 0 && final100 < finalCutoff;

        let letterGrade = '';
        if (failedCA && failedFinal) letterGrade = 'E(CA)/E(SA)';
        else if (failedCA) letterGrade = 'E(CA)';
        else if (failedFinal) letterGrade = 'E(SA)';
        else {
          for (const range of gradeRanges) {
            if (finalPercentage >= range.min) {
              letterGrade = range.grade;
              break;
            }
          }
          if (!letterGrade) letterGrade = 'F';
          if (isRep && ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+'].includes(letterGrade)) {
            letterGrade = 'C';
          }
        }

        const rowH = 15;
        doc.rect(startX, currentY, adjustedContentWidth, rowH).stroke('#000000');
        doc.font('Helvetica').fontSize(8).fillColor('#000000');

        let curX = startX;
        doc.text(String(idx + 1), curX, currentY + 3.5, { width: snoW, align: 'center' });
        curX += snoW;
        doc.text(student.registration_number || '', curX, currentY + 3.5, {
          width: regW,
          align: 'center',
        });
        curX += regW;
        doc.text(student.index_number || '', curX, currentY + 3.5, {
          width: idxW,
          align: 'center',
        });
        curX += idxW;
        doc.text(isRep ? 'R' : 'P', curX, currentY + 3.5, { width: rpW, align: 'center' });
        curX += rpW;

        caCols.forEach((ca) => {
          const val = studentCaMarks[ca.id];
          doc.text(val !== undefined ? String(val) : '0', curX, currentY + 3.5, {
            width: caColW,
            align: 'center',
          });
          curX += caColW;
        });

        if (!isCaOnly) {
          doc.text(String(final100), curX, currentY + 3.5, { width: endW, align: 'center' });
          curX += endW;
        }
        doc.text(String(finalPercentage), curX, currentY + 3.5, { width: finalW, align: 'center' });
        curX += finalW;
        doc
          .font('Helvetica-Bold')
          .text(letterGrade, curX, currentY + 3.5, { width: gradeW, align: 'center' })
          .font('Helvetica');

        // Vertical lines
        let lx = startX;
        const colWs = [
          snoW,
          regW,
          idxW,
          rpW,
          ...caCols.map(() => caColW),
          ...(isCaOnly ? [] : [endW]),
          finalW,
          gradeW,
        ];
        colWs.forEach((w) => {
          lx += w;
          doc
            .moveTo(lx, currentY)
            .lineTo(lx, currentY + rowH)
            .stroke('#000000');
        });

        currentY += rowH;
      });

      // Summary Sections (Distribution, Grading Scale, Cutoffs)
      if (currentY > doc.page.height - 180) {
        doc.addPage();
        currentY = 35;
      } else {
        currentY += 15;
      }

      const summaryTop = currentY;

      // 1. Continuous Assessment Score Distribution
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000000');
      doc.text('Continuous Assessment Score Distribution', startX, summaryTop);
      let distY = summaryTop + 14;
      if (caExams.length > 0) {
        caExams.forEach((ca: any, i: number) => {
          const w = weightsMap[ca.exam_id] !== undefined ? weightsMap[ca.exam_id] : ca.weight;
          doc
            .font('Helvetica')
            .fontSize(8)
            .text(ca.exam_title || `CA ${i + 1}`, startX, distY, { width: 100 });
          doc.text(`: ${w}%`, startX + 75, distY);
          distY += 12;
        });
      } else {
        doc.font('Helvetica').fontSize(8).text('CA 1', startX, distY, { width: 100 });
        doc.text(`: ${caWeight}%`, startX + 75, distY);
        distY += 12;
      }
      if (!isCaOnly) {
        doc.font('Helvetica').fontSize(8).text('End Exam', startX, distY, { width: 100 });
        doc.text(`: ${saWeight}%`, startX + 75, distY);
        distY += 14;
      }

      // 2. Grading Scale Table
      const gradeScaleX = startX + 220;
      doc.font('Helvetica-Bold').fontSize(8.5).text('Grading Scale', gradeScaleX, summaryTop);
      let gsY = summaryTop + 14;
      doc.rect(gradeScaleX, gsY, 180, 13).fillAndStroke('#f8fafc', '#000000');
      doc.fillColor('#000000').font('Helvetica-Bold').fontSize(7.5);
      doc.text('Lower', gradeScaleX, gsY + 3, { width: 55, align: 'center' });
      doc.text('Upper', gradeScaleX + 55, gsY + 3, { width: 55, align: 'center' });
      doc.text('Grade', gradeScaleX + 110, gsY + 3, { width: 70, align: 'center' });
      gsY += 13;

      gradeRanges.forEach((g: any, i: number) => {
        const lower = g.min !== undefined ? String(g.min) : '0';
        const nextHigher = i > 0 ? (gradeRanges[i - 1].min - 1).toString() : '100';
        const upper = g.max !== undefined ? String(g.max) : nextHigher;
        doc.rect(gradeScaleX, gsY, 180, 11).stroke('#000000');
        doc.font('Helvetica').fontSize(7).fillColor('#000000');
        doc.text(lower, gradeScaleX, gsY + 2, { width: 55, align: 'center' });
        doc.text(upper, gradeScaleX + 55, gsY + 2, { width: 55, align: 'center' });
        doc
          .font('Helvetica-Bold')
          .text(g.grade, gradeScaleX + 110, gsY + 2, { width: 70, align: 'center' });
        gsY += 11;
      });

      // 3. Cutoff Marks
      const cutoffX = gradeScaleX + 220;
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000000');
      doc.text('Cutoff Marks', cutoffX, summaryTop);
      let cutY = summaryTop + 14;
      doc.font('Helvetica').fontSize(8);
      doc.text('CA Cutoff', cutoffX, cutY, { width: 100 });
      doc.text(`: ${caCutoff}%`, cutoffX + 75, cutY);
      cutY += 13;
      if (!isCaOnly) {
        doc.text('End Exam Cutoff', cutoffX, cutY, { width: 100 });
        doc.text(`: ${finalCutoff}%`, cutoffX + 75, cutY);
      }

      // Signatures
      const sigY = Math.max(gsY, distY, cutY) + 20;
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000000');
      if (isCaOnly) {
        doc.text('Course Lecturer: ____________________', startX, sigY);
        doc.text('Head of Department: ____________________', startX + 380, sigY);
      } else {
        doc.text('1st Examiner: ____________________', startX, sigY);
        doc.text('2nd Examiner: ____________________', startX + 260, sigY);
        doc.text('Head of Department: ____________________', startX + 520, sigY);
      }

      doc.end();
    });
  }

  private async verifyLecturerCourseAccess(executorUserId: number, course: any) {
    const lecturer = await this.prisma.lecturer.findUnique({
      where: { user_id: executorUserId },
    });
    if (!lecturer) {
      throw new NotFoundException(`Lecturer profile not found for user ID ${executorUserId}`);
    }

    if (lecturer.is_head || lecturer.is_dean) {
      return;
    }

    const isAssigned = await this.prisma.courseLecturer.findUnique({
      where: {
        course_id_lecturer_id: {
          course_id: course.course_id,
          lecturer_id: lecturer.lecturer_id,
        },
      },
    });

    if (isAssigned || course.first_marker_lecturer_id === lecturer.lecturer_id) {
      return;
    }

    let subConfig: any = course.marks_config || {};
    if (typeof subConfig === 'string') {
      try {
        subConfig = JSON.parse(subConfig);
      } catch {
        subConfig = {};
      }
    }

    if (Number(subConfig.inChargeLecturerId) === lecturer.lecturer_id) {
      return;
    }

    throw new BadRequestException(
      'You are not authorized to view or download marks for this course.',
    );
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
