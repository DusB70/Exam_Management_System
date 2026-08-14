import { Controller, Get, Res } from '@nestjs/common';
import { ResultsService } from './results.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserRole } from '@ems/shared';
import { Response } from 'express';

@Controller('results')
export class ResultsController {
  constructor(private readonly resultsService: ResultsService) {}

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
}
