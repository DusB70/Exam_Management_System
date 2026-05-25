import {
  Controller,
  Get,
  Post,
  Body,
  HttpStatus,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { ResultsService } from './results.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserRole } from '@ems/shared';

class PublishResultsDto {
  academicYear!: number;
  semester!: number;
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
}
