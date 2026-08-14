import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Res,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { RequestsService } from './requests.service';
import { RequestsPdfService } from './requests-pdf.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserRole } from '@ems/shared';
import * as mime from 'mime-types';

@Controller('requests')
export class RequestsController {
  constructor(
    private readonly requestsService: RequestsService,
    private readonly pdfService: RequestsPdfService,
  ) {}

  // 1. Submit Medical Certificate Form (Files upload)
  @Post('medical')
  @Roles(UserRole.STUDENT)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'medical_certificate', maxCount: 1 },
      { name: 'request_letter', maxCount: 1 },
    ]),
  )
  async submitMedical(
    @GetUser('id') userId: number,
    @Body('exam_name') examName: string,
    @Body('subjects') subjectsRaw: string,
    @UploadedFiles()
    files: {
      medical_certificate?: Express.Multer.File[];
      request_letter?: Express.Multer.File[];
    },
  ) {
    if (!files || !files.medical_certificate || files.medical_certificate.length === 0) {
      throw new BadRequestException('Medical certificate file is required.');
    }

    let subjects: any[] = [];
    try {
      subjects = JSON.parse(subjectsRaw);
    } catch {
      throw new BadRequestException('Invalid subjects data format.');
    }

    const medicalCert = files.medical_certificate[0];
    const requestLetter = files.request_letter ? files.request_letter[0] : undefined;

    const result = await this.requestsService.createMedicalSubmission(
      userId,
      examName,
      subjects,
      medicalCert,
      requestLetter,
    );

    return {
      success: true,
      message: 'Medical certificate form submitted successfully.',
      data: result,
    };
  }

  // 2. Submit Grace Chance Application
  @Post('grace-chance')
  @Roles(UserRole.STUDENT)
  async submitGraceChance(@GetUser('id') userId: number, @Body() dto: any) {
    const result = await this.requestsService.createGraceChanceApplication(userId, dto);
    return {
      success: true,
      message: 'Grace chance application submitted successfully.',
      data: result,
    };
  }

  // 3. Submit Marks Verification / Recorrection Request
  @Post('recorrection')
  @Roles(UserRole.STUDENT)
  @UseInterceptors(FileInterceptor('receipt'))
  async submitRecorrection(
    @GetUser('id') userId: number,
    @Body('exam_name') examName: string,
    @Body('academic_year') academicYear: number,
    @Body('semester') semester: string,
    @Body('subjects') subjectsRaw: string,
    @Body('total_amount_paid') totalAmountPaid: number,
    @UploadedFile() receiptFile: Express.Multer.File,
  ) {
    if (!receiptFile) {
      throw new BadRequestException('Payment receipt file is required.');
    }

    let subjects: any[] = [];
    try {
      subjects = JSON.parse(subjectsRaw);
    } catch {
      throw new BadRequestException('Invalid subjects format.');
    }

    const result = await this.requestsService.createRecorrectionRequest(
      userId,
      examName,
      academicYear,
      semester,
      subjects,
      totalAmountPaid,
      receiptFile,
    );

    return {
      success: true,
      message: 'Recorrection request submitted successfully.',
      data: result,
    };
  }

  // 4. Student view: Fetch own list of submissions
  @Get('student')
  @Roles(UserRole.STUDENT)
  async getStudentSubmissions(@GetUser('id') userId: number) {
    const data = await this.requestsService.getStudentRequests(userId);
    return {
      success: true,
      data,
    };
  }

  // 5. Staff/Admin view: Fetch all requests
  @Get('all')
  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_DIVISION_STAFF)
  async getAllSubmissions() {
    const data = await this.requestsService.getAllSubmissions();
    return {
      success: true,
      data,
    };
  }

  // 6. Staff/Admin: Approve/Reject request status
  @Patch(':type/:id/status')
  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_DIVISION_STAFF)
  async updateRequestStatus(
    @Param('type') type: 'medical' | 'grace' | 'recorrection',
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: string,
  ) {
    const result = await this.requestsService.updateStatus(type, id, status);
    return {
      success: true,
      message: `Request status updated to ${status} successfully.`,
      data: result,
    };
  }

  // 7. Secure file serving endpoint
  @Get('files/:filename')
  async serveFile(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = this.requestsService.getFilePath(filename);
    const mimeType = mime.lookup(filePath) || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);
    res.sendFile(filePath);
  }

  // 8. Generate official filled PDF using Puppeteer
  @Get(':type/:id/pdf')
  async downloadPdf(
    @Param('type') type: 'medical' | 'grace' | 'recorrection',
    @Param('id', ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const data = await this.requestsService.getRequestDetails(type, id);

    let pdfBuffer: Buffer;
    let filename = '';

    if (type === 'medical') {
      pdfBuffer = await this.pdfService.generateMedicalPdf(data);
      filename = `Medical_${data.student.registration_number.replace(/\//g, '_')}.pdf`;
    } else if (type === 'grace') {
      pdfBuffer = await this.pdfService.generateGraceChancePdf(data);
      filename = `GraceChance_${data.student.registration_number.replace(/\//g, '_')}.pdf`;
    } else if (type === 'recorrection') {
      pdfBuffer = await this.pdfService.generateRecorrectionPdf(data);
      filename = `Recorrection_${data.student.registration_number.replace(/\//g, '_')}.pdf`;
    } else {
      throw new BadRequestException('Invalid request type.');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  }
}
