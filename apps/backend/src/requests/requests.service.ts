import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class RequestsService {
  private readonly uploadsDir = path.join(process.cwd(), 'uploads');

  constructor(private readonly prisma: PrismaService) {
    // Ensure uploads directory exists
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  // Helper to resolve student profile from user_id
  async getStudentByUserId(userId: number) {
    const student = await this.prisma.student.findUnique({
      where: { user_id: userId },
      include: { user: true },
    });
    if (!student) {
      throw new ForbiddenException('User is not registered as a student.');
    }
    return student;
  }

  // Save an uploaded file buffer to local disk and return unique filename
  async saveFile(file: Express.Multer.File): Promise<string> {
    if (!file) {
      throw new BadRequestException('File upload is missing.');
    }
    const fileExt = path.extname(file.originalname);
    const randomName = crypto.randomBytes(16).toString('hex');
    const filename = `${randomName}${fileExt}`;
    const filePath = path.join(this.uploadsDir, filename);

    await fs.promises.writeFile(filePath, file.buffer);
    return filename;
  }

  // Retrieve local file path securely
  getFilePath(filename: string): string {
    const filePath = path.join(this.uploadsDir, filename);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Requested file not found on disk.');
    }
    return filePath;
  }

  // ==========================================
  // MEDICAL SUBMISSIONS
  // ==========================================

  async createMedicalSubmission(
    userId: number,
    examName: string,
    subjects: any[],
    medicalCertFile: Express.Multer.File,
    requestLetterFile?: Express.Multer.File,
  ) {
    const student = await this.getStudentByUserId(userId);

    if (!examName || examName.trim() === '') {
      throw new BadRequestException('Examination name is required.');
    }
    if (!subjects || subjects.length === 0) {
      throw new BadRequestException('At least one missed course entry is required.');
    }

    const medicalCertUrl = await this.saveFile(medicalCertFile);
    let requestLetterUrl = null;
    if (requestLetterFile) {
      requestLetterUrl = await this.saveFile(requestLetterFile);
    }

    return this.prisma.medicalSubmission.create({
      data: {
        student_id: student.student_id,
        exam_name: examName,
        subjects: subjects,
        medical_certificate_url: medicalCertUrl,
        request_letter_url: requestLetterUrl,
        status: 'PENDING',
      },
    });
  }

  // ==========================================
  // GRACE CHANCE APPLICATIONS
  // ==========================================

  async createGraceChanceApplication(userId: number, dto: any) {
    const student = await this.getStudentByUserId(userId);

    return this.prisma.graceChanceApplication.create({
      data: {
        student_id: student.student_id,
        date_of_registration: new Date(dto.date_of_registration),
        address: dto.address,
        phone: dto.phone,
        faculty: dto.faculty || 'Technology',
        total_credits: parseFloat(dto.total_credits) || 0,
        internship_credits: parseFloat(dto.internship_credits) || 0,
        research_credits: parseFloat(dto.research_credits) || 0,
        industrial_credits: parseFloat(dto.industrial_credits) || 0,
        course_credits: parseFloat(dto.course_credits) || 0,
        incomplete_subjects: dto.incomplete_subjects || [],
        total_incomplete_credits: parseFloat(dto.total_incomplete_credits) || 0,
        credit_percentage: parseFloat(dto.credit_percentage) || 0,
        status: 'PENDING',
        declaration_signed: dto.declaration_signed === true,
      },
    });
  }

  // ==========================================
  // RECORRECTION REQUESTS
  // ==========================================

  async createRecorrectionRequest(
    userId: number,
    examName: string,
    academicYear: number,
    semester: string,
    subjects: any[],
    totalAmountPaid: number,
    receiptFile: Express.Multer.File,
  ) {
    const student = await this.getStudentByUserId(userId);

    if (!examName) throw new BadRequestException('Exam name is required.');
    if (!academicYear) throw new BadRequestException('Academic year is required.');
    if (!semester) throw new BadRequestException('Semester is required.');
    if (!subjects || subjects.length === 0)
      throw new BadRequestException('Subjects list is required.');
    if (!receiptFile) throw new BadRequestException('Payment receipt file is required.');

    const receiptUrl = await this.saveFile(receiptFile);

    return this.prisma.recorrectionRequest.create({
      data: {
        student_id: student.student_id,
        exam_name: examName,
        academic_year: Number(academicYear),
        semester: semester,
        subjects: subjects,
        total_amount_paid: Number(totalAmountPaid) || 0,
        receipt_url: receiptUrl,
        status: 'PENDING',
      },
    });
  }

  // ==========================================
  // QUERY & MANAGEMENT ENDPOINTS
  // ==========================================

  // Fetch all requests submitted by a specific student user
  async getStudentRequests(userId: number) {
    const student = await this.getStudentByUserId(userId);
    const studentId = student.student_id;

    const [medicals, graces, recorrections] = await Promise.all([
      this.prisma.medicalSubmission.findMany({
        where: { student_id: studentId },
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.graceChanceApplication.findMany({
        where: { student_id: studentId },
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.recorrectionRequest.findMany({
        where: { student_id: studentId },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    return { medicals, graces, recorrections };
  }

  // Staff endpoint: Fetch all requests from all students
  async getAllSubmissions() {
    const includeStudent = {
      include: {
        student: {
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
    };

    const [medicals, graces, recorrections] = await Promise.all([
      this.prisma.medicalSubmission.findMany({
        ...includeStudent,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.graceChanceApplication.findMany({
        ...includeStudent,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.recorrectionRequest.findMany({
        ...includeStudent,
        orderBy: { created_at: 'desc' },
      }),
    ]);

    return { medicals, graces, recorrections };
  }

  // Update submission status (Approve/Reject)
  async updateStatus(type: 'medical' | 'grace' | 'recorrection', id: number, status: string) {
    const validStatuses = ['PENDING', 'APPROVED', 'REJECTED'];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException(
        'Invalid status value. Must be PENDING, APPROVED, or REJECTED.',
      );
    }

    if (type === 'medical') {
      const record = await this.prisma.medicalSubmission.findUnique({ where: { medical_id: id } });
      if (!record) throw new NotFoundException('Medical submission not found.');
      return this.prisma.medicalSubmission.update({
        where: { medical_id: id },
        data: { status },
      });
    } else if (type === 'grace') {
      const record = await this.prisma.graceChanceApplication.findUnique({
        where: { grace_id: id },
      });
      if (!record) throw new NotFoundException('Grace chance application not found.');
      return this.prisma.graceChanceApplication.update({
        where: { grace_id: id },
        data: { status },
      });
    } else if (type === 'recorrection') {
      const record = await this.prisma.recorrectionRequest.findUnique({
        where: { recorrection_id: id },
      });
      if (!record) throw new NotFoundException('Recorrection request not found.');
      return this.prisma.recorrectionRequest.update({
        where: { recorrection_id: id },
        data: { status },
      });
    } else {
      throw new BadRequestException('Invalid request type.');
    }
  }

  // Fetch full details of a specific request including student info
  async getRequestDetails(type: 'medical' | 'grace' | 'recorrection', id: number) {
    const includeStudent = {
      include: {
        student: {
          include: {
            user: true,
          },
        },
      },
    };

    if (type === 'medical') {
      const record = await this.prisma.medicalSubmission.findUnique({
        where: { medical_id: id },
        ...includeStudent,
      });
      if (!record) throw new NotFoundException('Medical record not found.');
      return record;
    } else if (type === 'grace') {
      const record = await this.prisma.graceChanceApplication.findUnique({
        where: { grace_id: id },
        ...includeStudent,
      });
      if (!record) throw new NotFoundException('Grace chance record not found.');
      return record;
    } else if (type === 'recorrection') {
      const record = await this.prisma.recorrectionRequest.findUnique({
        where: { recorrection_id: id },
        ...includeStudent,
      });
      if (!record) throw new NotFoundException('Recorrection record not found.');
      return record;
    } else {
      throw new BadRequestException('Invalid request type.');
    }
  }
}
