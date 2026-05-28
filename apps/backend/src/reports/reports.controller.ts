import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@ems/shared';

@Controller('reports')
@Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_DIVISION_STAFF, UserRole.LECTURER)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('staff-overview')
  @Roles(UserRole.EXAM_DIVISION_STAFF, UserRole.ADMINISTRATOR)
  async getStaffOverview(@Query('batch') batch?: string) {
    const data = await this.reportsService.getStaffOverview(
      batch ? parseInt(batch, 10) : undefined,
    );
    return {
      success: true,
      message: 'Staff overview statistics retrieved successfully',
      data,
    };
  }

  @Get('summary')
  async getSummary() {
    const summary = await this.reportsService.getSummary();
    return {
      success: true,
      message: 'Dashboard report summary retrieved successfully',
      data: summary,
    };
  }

  @Get('departments')
  async getDepartmentPerformance() {
    const data = await this.reportsService.getDepartmentPerformance();
    return {
      success: true,
      message: 'Department performance metrics retrieved successfully',
      data,
    };
  }

  @Get('course-grades/:courseId')
  async getCourseGradesDistribution(@Param('courseId', ParseIntPipe) courseId: number) {
    const data = await this.reportsService.getCourseGradesDistribution(courseId);
    return {
      success: true,
      message: 'Course grades distribution retrieved successfully',
      data,
    };
  }

  @Get('trends')
  async getGpaTrends() {
    const data = await this.reportsService.getGpaTrends();
    return {
      success: true,
      message: 'Academic GPA trends retrieved successfully',
      data,
    };
  }

  @Get('courses')
  async getCoursesList() {
    const data = await this.reportsService.getCoursesList();
    return {
      success: true,
      message: 'Courses lookup list retrieved successfully',
      data,
    };
  }
}
