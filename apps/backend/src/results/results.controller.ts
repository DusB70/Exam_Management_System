import {
  Controller,
  Get,
  Post,
  Body,
  HttpStatus,
  HttpCode,
  BadRequestException,
  Param,
  Res,
  ParseIntPipe,
} from '@nestjs/common';
import { ResultsService } from './results.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserRole } from '@ems/shared';
import { Response } from 'express';

class PublishResultsDto {
  academicYear!: number;
  semester!: string;
}

@Controller('results')
export class ResultsController {
  constructor(private readonly resultsService: ResultsService) {}

  @Post('publish')
  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_DIVISION_STAFF)
  @HttpCode(HttpStatus.OK)
  async publishResults(@Body() dto: PublishResultsDto, @GetUser('id') executorId: number) {
    if (!dto.academicYear || !dto.semester) {
      throw new BadRequestException('Both academicYear and semester are required.');
    }
    const result = await this.resultsService.publishResults(
      dto.academicYear,
      dto.semester,
      executorId,
    );
    return {
      success: true,
      message: `Successfully computed GPAs and published results for ${result.count} students.`,
      data: result,
    };
  }

  @Get('my-report')
  @Roles(UserRole.STUDENT)
  async getMyReport(@GetUser('id') studentUserId: number) {
    const report = await this.resultsService.getStudentReportCard(studentUserId);
    return {
      success: true,
      message: 'Student academic report retrieved successfully',
      data: report,
    };
  }

  @Get('my-report/pdf')
  @Roles(UserRole.STUDENT)
  async getMyReportPdf(@GetUser('id') studentUserId: number, @Res() res: Response) {
    const buffer = await this.resultsService.generateReportCardPdfBuffer(studentUserId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename=report_card.pdf',
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('my-report/excel')
  @Roles(UserRole.STUDENT)
  async getMyReportExcel(@GetUser('id') studentUserId: number, @Res() res: Response) {
    const buffer = await this.resultsService.generateReportCardExcelBuffer(studentUserId);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename=report_card.xlsx',
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('student/:studentId/pdf')
  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_DIVISION_STAFF)
  async getStudentReportPdf(
    @Param('studentId', ParseIntPipe) studentId: number,
    @Res() res: Response,
  ) {
    const buffer = await this.resultsService.generateReportCardPdfBufferByStudentId(studentId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename=student_${studentId}_report.pdf`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('course/:courseId/combined')
  @Roles(UserRole.EXAM_DIVISION_STAFF, UserRole.ADMINISTRATOR)
  async getCombinedCourseResults(@Param('courseId', ParseIntPipe) courseId: number) {
    const data = await this.resultsService.getCombinedCourseMarks(courseId);
    return {
      success: true,
      message: 'Combined course results retrieved successfully',
      data,
    };
  }

  @Get('course/:courseId/combined/excel')
  @Roles(UserRole.EXAM_DIVISION_STAFF, UserRole.ADMINISTRATOR)
  async getCombinedCourseResultsExcel(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Res() res: Response,
  ) {
    const { buffer, fileName } =
      await this.resultsService.generateCombinedCourseMarksExcel(courseId);
    res.set({
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=${fileName}`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
