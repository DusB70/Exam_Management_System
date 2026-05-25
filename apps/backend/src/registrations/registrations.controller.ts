import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { RegistrationsService } from './registrations.service';
import { RegisterCoursesDto, AdminRegisterCourseDto } from './dtos/registrations.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserRole } from '@ems/shared';

@Controller('registrations')
export class RegistrationsController {
  constructor(private readonly registrationsService: RegistrationsService) {}

  // ==========================================
  // STUDENT PORTAL ENDPOINTS
  // ==========================================

  @Get('active-period')
  @Roles(UserRole.STUDENT)
  async getActivePeriod(@GetUser('id') userId: number) {
    const period = await this.registrationsService.getActivePeriodForStudent(userId);
    return {
      success: true,
      message: 'Active registration period retrieved successfully',
      data: period,
    };
  }

  @Get('eligible-courses')
  @Roles(UserRole.STUDENT)
  async getEligibleCourses(@GetUser('id') userId: number) {
    const courses = await this.registrationsService.getEligibleCourses(userId);
    return {
      success: true,
      message: 'Eligible registration courses retrieved successfully',
      data: courses,
    };
  }

  @Get('my-registrations')
  @Roles(UserRole.STUDENT)
  async getMyRegistrations(@GetUser('id') userId: number) {
    const registrations = await this.registrationsService.getMyRegistrations(userId);
    return {
      success: true,
      message: 'Student registrations retrieved successfully',
      data: registrations,
    };
  }

  @Post()
  @Roles(UserRole.STUDENT)
  @HttpCode(HttpStatus.OK)
  async registerCourses(@GetUser('id') userId: number, @Body() dto: RegisterCoursesDto) {
    const registrations = await this.registrationsService.registerCourses(userId, dto);
    return {
      success: true,
      message: 'Courses registered successfully',
      data: registrations,
    };
  }

  @Delete(':id')
  @Roles(UserRole.STUDENT)
  async dropCourse(@GetUser('id') userId: number, @Param('id', ParseIntPipe) id: number) {
    const dropped = await this.registrationsService.dropCourse(userId, id);
    return {
      success: true,
      message: 'Course registration dropped successfully',
      data: dropped,
    };
  }

  // ==========================================
  // ADMINISTRATOR / DIVISION STAFF OVERRIDES
  // ==========================================

  @Get('admin/student/:studentId')
  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_DIVISION_STAFF)
  async getStudentRegistrationsForAdmin(@Param('studentId', ParseIntPipe) studentId: number) {
    const data = await this.registrationsService.getStudentRegistrationsForAdmin(studentId);
    return {
      success: true,
      message: 'Student registrations retrieved successfully for administrative view',
      data,
    };
  }

  @Post('admin/student/:studentId')
  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_DIVISION_STAFF)
  async adminRegisterCourse(
    @Param('studentId', ParseIntPipe) studentId: number,
    @Body() dto: AdminRegisterCourseDto,
    @GetUser('id') executorId: number,
  ) {
    const registration = await this.registrationsService.adminRegisterCourse(
      studentId,
      dto.courseId,
      executorId,
    );
    return {
      success: true,
      message: 'Course registered successfully via admin override',
      data: registration,
    };
  }

  @Delete('admin/student/:studentId/course/:courseId')
  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_DIVISION_STAFF)
  async adminDropCourse(
    @Param('studentId', ParseIntPipe) studentId: number,
    @Param('courseId', ParseIntPipe) courseId: number,
    @GetUser('id') executorId: number,
  ) {
    const dropped = await this.registrationsService.adminDropCourse(
      studentId,
      courseId,
      executorId,
    );
    return {
      success: true,
      message: 'Course registration dropped successfully via admin override',
      data: dropped,
    };
  }
}
