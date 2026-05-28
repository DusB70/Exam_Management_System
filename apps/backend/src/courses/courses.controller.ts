import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CreateCourseDto, UpdateCourseDto, AssignLecturerDto } from './dtos/courses.dto';
import { CreatePeriodDto, UpdatePeriodStatusDto } from './dtos/registration-periods.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserRole } from '@ems/shared';

@Controller('courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  async getAll(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('search') search?: string,
    @Query('departmentId') departmentId?: string,
    @Query('semester') semester?: string,
    @Query('academicYear') academicYear?: string,
  ) {
    const parsedPage = parseInt(page, 10) || 1;
    const parsedLimit = parseInt(limit, 10) || 10;
    const parsedDeptId = departmentId ? parseInt(departmentId, 10) : undefined;
    const parsedSemester = semester || undefined;
    const parsedYear = academicYear ? parseInt(academicYear, 10) : undefined;

    const data = await this.coursesService.findAll(
      parsedPage,
      parsedLimit,
      search,
      parsedDeptId,
      parsedSemester,
      parsedYear,
    );

    return {
      success: true,
      message: 'Courses retrieved successfully',
      data,
    };
  }

  // ==========================================
  // REGISTRATION PERIODS
  // ==========================================

  @Get('periods')
  async getAllPeriods() {
    const periods = await this.coursesService.findAllPeriods();
    return {
      success: true,
      message: 'Registration periods retrieved successfully',
      data: periods,
    };
  }

  @Post('periods')
  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_DIVISION_STAFF)
  async createPeriod(@Body() dto: CreatePeriodDto, @GetUser('id') executorId: number) {
    const period = await this.coursesService.createPeriod(dto, executorId);
    return {
      success: true,
      message: 'Registration period created successfully',
      data: period,
    };
  }

  @Patch('periods/:id/status')
  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_DIVISION_STAFF)
  async updatePeriodStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePeriodStatusDto,
    @GetUser('id') executorId: number,
  ) {
    const period = await this.coursesService.updatePeriodStatus(id, dto.status, executorId);
    return {
      success: true,
      message: `Registration period status updated to ${dto.status}`,
      data: period,
    };
  }

  // ==========================================
  // COURSES SPECIFIC CRUD
  // ==========================================

  @Get(':id')
  async getOne(@Param('id', ParseIntPipe) id: number) {
    const course = await this.coursesService.findOne(id);
    return {
      success: true,
      message: 'Course retrieved successfully',
      data: course,
    };
  }

  @Post()
  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_DIVISION_STAFF)
  async create(@Body() dto: CreateCourseDto, @GetUser('id') executorId: number) {
    const course = await this.coursesService.create(dto, executorId);
    return {
      success: true,
      message: 'Course created successfully',
      data: course,
    };
  }

  @Put(':id')
  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_DIVISION_STAFF)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCourseDto,
    @GetUser('id') executorId: number,
  ) {
    const course = await this.coursesService.update(id, dto, executorId);
    return {
      success: true,
      message: 'Course updated successfully',
      data: course,
    };
  }

  @Delete(':id')
  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_DIVISION_STAFF)
  async delete(@Param('id', ParseIntPipe) id: number, @GetUser('id') executorId: number) {
    await this.coursesService.delete(id, executorId);
    return {
      success: true,
      message: 'Course deleted successfully',
    };
  }

  // ==========================================
  // LECTURER ASSIGNMENTS
  // ==========================================

  @Post(':id/lecturers')
  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_DIVISION_STAFF)
  async assignLecturer(
    @Param('id', ParseIntPipe) courseId: number,
    @Body() dto: AssignLecturerDto,
    @GetUser('id') executorId: number,
  ) {
    const assignment = await this.coursesService.assignLecturer(
      courseId,
      dto.lecturerId,
      executorId,
    );
    return {
      success: true,
      message: 'Lecturer assigned to course successfully',
      data: assignment,
    };
  }

  @Delete(':id/lecturers/:lecturerId')
  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_DIVISION_STAFF)
  async removeLecturer(
    @Param('id', ParseIntPipe) courseId: number,
    @Param('lecturerId', ParseIntPipe) lecturerId: number,
    @GetUser('id') executorId: number,
  ) {
    await this.coursesService.removeLecturer(courseId, lecturerId, executorId);
    return {
      success: true,
      message: 'Lecturer removed from course successfully',
    };
  }
}
