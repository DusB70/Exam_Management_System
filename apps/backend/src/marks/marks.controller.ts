import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  HttpStatus,
  HttpCode,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { MarksService } from './marks.service';
import { MarksPdfService } from './marks.pdf.service';
import { BulkRecordMarksDto } from './dtos/marks.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserRole } from '@ems/shared';

@Controller('marks')
export class MarksController {
  constructor(
    private readonly marksService: MarksService,
    private readonly marksPdfService: MarksPdfService,
  ) {}

  // ==========================================
  // LECTURER GRADE ENTRY PORTAL
  // ==========================================

  @Get('my-courses')
  @Roles(UserRole.LECTURER)
  async getMyCourses(@GetUser('id') userId: number) {
    const courses = await this.marksService.findMyCourses(userId);
    return {
      success: true,
      message: 'Lecturer assigned courses retrieved successfully',
      data: courses,
    };
  }

  @Get('my-students-overview')
  @Roles(UserRole.LECTURER)
  async getMyStudentsOverview(@GetUser('id') userId: number) {
    const overview = await this.marksService.getMyStudentsOverview(userId);
    return {
      success: true,
      message: 'Lecturer students overview retrieved successfully',
      data: overview,
    };
  }

  @Get('courses/:courseId/students')
  @Roles(UserRole.LECTURER, UserRole.ADMINISTRATOR, UserRole.EXAM_DIVISION_STAFF)
  async getStudentsForCourse(@Param('courseId', ParseIntPipe) courseId: number) {
    const students = await this.marksService.getStudentsRegisteredForCourse(courseId);
    return {
      success: true,
      message: 'Course registered students retrieved successfully',
      data: students,
    };
  }

  @Get('courses/:courseId/exams')
  @Roles(UserRole.LECTURER, UserRole.ADMINISTRATOR, UserRole.EXAM_DIVISION_STAFF)
  async getExamsForCourse(@Param('courseId', ParseIntPipe) courseId: number) {
    const exams = await this.marksService.getExamsForCourse(courseId);
    return {
      success: true,
      message: 'Course exams retrieved successfully',
      data: exams,
    };
  }

  @Get('exams/:examId')
  @Roles(UserRole.LECTURER, UserRole.ADMINISTRATOR, UserRole.EXAM_DIVISION_STAFF)
  async getExamMarks(@Param('examId', ParseIntPipe) examId: number) {
    const marks = await this.marksService.getExamMarks(examId);
    return {
      success: true,
      message: 'Exam marks entries retrieved successfully',
      data: marks,
    };
  }

  @Post('exams/:examId/bulk')
  @Roles(UserRole.LECTURER, UserRole.ADMINISTRATOR, UserRole.EXAM_DIVISION_STAFF)
  @HttpCode(HttpStatus.OK)
  async recordMarksBulk(
    @Param('examId', ParseIntPipe) examId: number,
    @Body() dto: BulkRecordMarksDto,
    @GetUser('id') executorUserId: number,
    @GetUser('role') role: string,
  ) {
    const isLecturer = role === UserRole.LECTURER;
    const marks = await this.marksService.recordMarksBulk(examId, dto, executorUserId, isLecturer);
    return {
      success: true,
      message: 'Exam marks recorded successfully',
      data: marks,
    };
  }

  @Post('exams/:examId/submit')
  @Roles(UserRole.LECTURER, UserRole.ADMINISTRATOR, UserRole.EXAM_DIVISION_STAFF)
  @HttpCode(HttpStatus.OK)
  async submitMarks(
    @Param('examId', ParseIntPipe) examId: number,
    @GetUser('id') executorUserId: number,
    @GetUser('role') role: string,
  ) {
    const isLecturer = role === UserRole.LECTURER;
    const count = await this.marksService.submitMarks(examId, executorUserId, isLecturer);
    return {
      success: true,
      message: `Marksheet with ${count} entries submitted for approval successfully`,
    };
  }

  // ==========================================
  // REVIEW & APPROVAL ENDPOINTS (STAFF/ADMIN)
  // ==========================================

  @Get('pending-approvals')
  @Roles(UserRole.EXAM_DIVISION_STAFF, UserRole.ADMINISTRATOR)
  async getPendingApprovals() {
    const items = await this.marksService.getSubmittedMarksheetsForReview();
    return {
      success: true,
      message: 'Submitted marksheets retrieved successfully',
      data: items,
    };
  }

  @Get('approved-marksheets')
  @Roles(UserRole.EXAM_DIVISION_STAFF, UserRole.ADMINISTRATOR)
  async getApprovedMarksheets() {
    const items = await this.marksService.getApprovedMarksheets();
    return {
      success: true,
      message: 'Approved marksheets retrieved successfully',
      data: items,
    };
  }

  @Post('exams/:examId/approve')
  @Roles(UserRole.EXAM_DIVISION_STAFF, UserRole.ADMINISTRATOR)
  @HttpCode(HttpStatus.OK)
  async approveMarks(
    @Param('examId', ParseIntPipe) examId: number,
    @GetUser('id') executorUserId: number,
  ) {
    const result = await this.marksService.approveMarks(examId, executorUserId);
    return {
      success: true,
      message: result.message,
    };
  }

  @Post('exams/:examId/reject')
  @Roles(UserRole.EXAM_DIVISION_STAFF, UserRole.ADMINISTRATOR)
  @HttpCode(HttpStatus.OK)
  async rejectMarks(
    @Param('examId', ParseIntPipe) examId: number,
    @GetUser('id') executorUserId: number,
  ) {
    const result = await this.marksService.rejectMarks(examId, executorUserId);
    return {
      success: true,
      message: result.message,
    };
  }

  @Get('exams/:examId/pdf')
  @Roles(UserRole.LECTURER, UserRole.EXAM_DIVISION_STAFF, UserRole.ADMINISTRATOR)
  async downloadSubmittedMarksPdf(
    @Param('examId', ParseIntPipe) examId: number,
    @GetUser('id') executorUserId: number,
    @GetUser('role') role: string,
    @Res() res: Response,
  ) {
    const isLecturer = role === UserRole.LECTURER;
    const buffer = await this.marksPdfService.generateSubmittedMarksPdf(
      examId,
      executorUserId,
      isLecturer,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=marksheet_exam_${examId}.pdf`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
  }
}
