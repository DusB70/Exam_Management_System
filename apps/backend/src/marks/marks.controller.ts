import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
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

  @Get('courses/:courseId/grid')
  @Roles(UserRole.LECTURER, UserRole.ADMINISTRATOR, UserRole.EXAM_DIVISION_STAFF)
  async getCourseGridData(
    @Param('courseId', ParseIntPipe) courseId: number,
    @GetUser('id') executorUserId: number,
    @GetUser('role') role: string,
  ) {
    const isLecturer = role === UserRole.LECTURER;
    const data = await this.marksService.getCourseGridData(courseId, executorUserId, isLecturer);
    return {
      success: true,
      message: 'Course grading grid data retrieved successfully',
      data,
    };
  }

  @Post('courses/:courseId/config')
  @Roles(UserRole.LECTURER, UserRole.ADMINISTRATOR, UserRole.EXAM_DIVISION_STAFF)
  async updateCourseConfig(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() config: any,
    @GetUser('id') executorUserId: number,
    @GetUser('role') role: string,
  ) {
    const isLecturer = role === UserRole.LECTURER;
    const course = await this.marksService.updateCourseConfig(
      courseId,
      config,
      executorUserId,
      isLecturer,
    );
    return {
      success: true,
      message: 'Course configuration updated successfully',
      data: course,
    };
  }

  @Post('courses/:courseId/exams')
  @Roles(UserRole.LECTURER, UserRole.ADMINISTRATOR, UserRole.EXAM_DIVISION_STAFF)
  async createCourseExam(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() body: { exam_type: string; exam_title: string; total_marks: number },
    @GetUser('id') executorUserId: number,
    @GetUser('role') role: string,
  ) {
    const isLecturer = role === UserRole.LECTURER;
    const exam = await this.marksService.createCourseExam(
      courseId,
      body,
      executorUserId,
      isLecturer,
    );
    return {
      success: true,
      message: 'Course assessment added successfully',
      data: exam,
    };
  }

  @Patch('courses/:courseId/exams/:examId')
  @Roles(UserRole.LECTURER, UserRole.ADMINISTRATOR, UserRole.EXAM_DIVISION_STAFF)
  async updateCourseExam(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('examId', ParseIntPipe) examId: number,
    @Body() body: { exam_title?: string; total_marks?: number },
    @GetUser('id') executorUserId: number,
    @GetUser('role') role: string,
  ) {
    const isLecturer = role === UserRole.LECTURER;
    const exam = await this.marksService.updateCourseExam(
      courseId,
      examId,
      body,
      executorUserId,
      isLecturer,
    );
    return {
      success: true,
      message: 'Course assessment updated successfully',
      data: exam,
    };
  }

  @Delete('courses/:courseId/exams/:examId')
  @Roles(UserRole.LECTURER, UserRole.ADMINISTRATOR, UserRole.EXAM_DIVISION_STAFF)
  async deleteCourseExam(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Param('examId', ParseIntPipe) examId: number,
    @GetUser('id') executorUserId: number,
    @GetUser('role') role: string,
  ) {
    const isLecturer = role === UserRole.LECTURER;
    await this.marksService.deleteCourseExam(courseId, examId, executorUserId, isLecturer);
    return {
      success: true,
      message: 'Course assessment deleted successfully',
    };
  }

  @Post('courses/:courseId/submit-grid')
  @Roles(UserRole.LECTURER, UserRole.ADMINISTRATOR, UserRole.EXAM_DIVISION_STAFF)
  async submitCourseGrid(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body()
    body: {
      marks: { studentId: number; examMarks: { [examId: string]: number } }[];
      submissionType?: 'PROVISIONAL' | 'FINAL' | 'UPDATED' | null;
    },
    @GetUser('id') executorUserId: number,
    @GetUser('role') role: string,
  ) {
    const isLecturer = role === UserRole.LECTURER;
    const result = await this.marksService.submitCourseGrid(
      courseId,
      body,
      executorUserId,
      isLecturer,
    );
    return {
      success: true,
      message: body.submissionType
        ? `Course evaluation marks submitted as ${body.submissionType} successfully`
        : 'Course evaluation marks saved as draft successfully',
      data: result,
    };
  }

  @Get('courses/:courseId/students/excel')
  @Roles(UserRole.LECTURER, UserRole.ADMINISTRATOR, UserRole.EXAM_DIVISION_STAFF)
  async downloadStudentListExcel(
    @Param('courseId', ParseIntPipe) courseId: number,
    @GetUser('id') executorUserId: number,
    @GetUser('role') role: string,
    @Res() res: Response,
  ) {
    const isLecturer = role === UserRole.LECTURER;
    const { buffer, fileName } = await this.marksService.generateStudentListExcel(
      courseId,
      executorUserId,
      isLecturer,
    );

    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=${fileName}`,
      'Content-Length': buffer.length,
    });

    res.end(buffer);
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

  // ==========================================
  // DEPARTMENT HEAD & DEAN ENDPOINTS
  // ==========================================

  @Get('head/pending-approvals')
  @Roles(UserRole.LECTURER)
  async getHeadPendingApprovals(@GetUser('id') lecturerUserId: number) {
    const data = await this.marksService.getHeadPendingApprovals(lecturerUserId);
    return {
      success: true,
      message: 'Head/Dean pending approvals retrieved successfully',
      data,
    };
  }

  @Post('courses/:courseId/head-approve')
  @Roles(UserRole.LECTURER)
  @HttpCode(HttpStatus.OK)
  async headApproveCourse(
    @Param('courseId', ParseIntPipe) courseId: number,
    @GetUser('id') lecturerUserId: number,
  ) {
    const result = await this.marksService.headApproveCourse(courseId, lecturerUserId);
    return {
      success: true,
      message: 'Course evaluation sheet approved successfully',
      data: result,
    };
  }

  @Post('courses/:courseId/head-reject')
  @Roles(UserRole.LECTURER)
  @HttpCode(HttpStatus.OK)
  async headRejectCourse(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() body: { reason: string },
    @GetUser('id') lecturerUserId: number,
  ) {
    const result = await this.marksService.headRejectCourse(courseId, body.reason, lecturerUserId);
    return {
      success: true,
      message: 'Course evaluation sheet rejected successfully',
      data: result,
    };
  }

  @Post('courses/:courseId/publish-ca')
  @Roles(UserRole.LECTURER)
  @HttpCode(HttpStatus.OK)
  async publishCourseCA(
    @Param('courseId', ParseIntPipe) courseId: number,
    @GetUser('id') lecturerUserId: number,
  ) {
    const result = await this.marksService.publishCourseCA(courseId, lecturerUserId);
    return {
      success: true,
      message:
        'Course Continuous Assessment (CA) marks published directly to students successfully',
      data: result,
    };
  }

  // ==========================================
  // STAFF COURSE QUEUES & ACTIONS
  // ==========================================

  @Get('staff/review-queue')
  @Roles(UserRole.EXAM_DIVISION_STAFF, UserRole.ADMINISTRATOR)
  async getStaffReviewQueue() {
    const data = await this.marksService.getStaffReviewQueue();
    return {
      success: true,
      message: 'Staff review queue retrieved successfully',
      data,
    };
  }

  @Get('staff/received-queue')
  @Roles(UserRole.EXAM_DIVISION_STAFF, UserRole.ADMINISTRATOR)
  async getStaffReceivedQueue() {
    const data = await this.marksService.getStaffReceivedQueue();
    return {
      success: true,
      message: 'Staff received queue retrieved successfully',
      data,
    };
  }

  @Get('staff/approved-directory')
  @Roles(UserRole.EXAM_DIVISION_STAFF, UserRole.ADMINISTRATOR)
  async getStaffApprovedDirectory() {
    const data = await this.marksService.getStaffApprovedDirectory();
    return {
      success: true,
      message: 'Staff approved directory retrieved successfully',
      data,
    };
  }

  @Post('courses/:courseId/staff-receive')
  @Roles(UserRole.EXAM_DIVISION_STAFF, UserRole.ADMINISTRATOR)
  @HttpCode(HttpStatus.OK)
  async staffReceiveCourse(@Param('courseId', ParseIntPipe) courseId: number) {
    const result = await this.marksService.staffReceiveCourse(courseId);
    return {
      success: true,
      message: 'Course final marksheet marked as received successfully',
      data: result,
    };
  }

  @Post('courses/:courseId/staff-reject')
  @Roles(UserRole.EXAM_DIVISION_STAFF, UserRole.ADMINISTRATOR)
  @HttpCode(HttpStatus.OK)
  async staffRejectCourse(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() body: { reason: string },
  ) {
    const result = await this.marksService.staffRejectCourse(courseId, body.reason);
    return {
      success: true,
      message: 'Course final marksheet rejected successfully',
      data: result,
    };
  }

  @Post('courses/:courseId/staff-approve')
  @Roles(UserRole.EXAM_DIVISION_STAFF, UserRole.ADMINISTRATOR)
  @HttpCode(HttpStatus.OK)
  async staffApproveCourse(@Param('courseId', ParseIntPipe) courseId: number) {
    const result = await this.marksService.staffApproveCourse(courseId);
    return {
      success: true,
      message: 'Course final marksheet approved and published successfully',
      data: result,
    };
  }
}
