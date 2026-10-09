import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  ParseIntPipe,
  ParseBoolPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dtos/users.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserRole } from '@ems/shared';

@Controller('users')
@Roles(UserRole.ADMINISTRATOR)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getAll(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('search') search?: string,
    @Query('roleId') roleId?: string,
    @Query('isActive') isActive?: string,
  ) {
    const parsedPage = parseInt(page, 10) || 1;
    const parsedLimit = parseInt(limit, 10) || 10;
    const parsedRoleId = roleId ? parseInt(roleId, 10) : undefined;
    const parsedIsActive = isActive === 'true' ? true : isActive === 'false' ? false : undefined;

    const data = await this.usersService.findAll(
      parsedPage,
      parsedLimit,
      search,
      parsedRoleId,
      parsedIsActive,
    );
    return {
      success: true,
      message: 'Users retrieved successfully',
      data,
    };
  }

  @Get(':id')
  async getOne(@Param('id', ParseIntPipe) id: number) {
    const user = await this.usersService.findById(id);
    const safeUser = { ...(user as any) };
    delete safeUser.password_hash;
    return {
      success: true,
      message: 'User retrieved successfully',
      data: safeUser,
    };
  }

  @Post()
  async create(@Body() createUserDto: CreateUserDto, @GetUser('id') executorId: number) {
    const user = await this.usersService.create(createUserDto, executorId);
    const safeUser = { ...(user as any) };
    delete safeUser.password_hash;
    return {
      success: true,
      message: 'User created successfully',
      data: safeUser,
    };
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
    @GetUser('id') executorId: number,
  ) {
    const user = await this.usersService.update(id, updateUserDto, executorId);
    const safeUser = { ...(user as any) };
    delete safeUser.password_hash;
    return {
      success: true,
      message: 'User updated successfully',
      data: safeUser,
    };
  }

  @Patch(':id/status')
  async toggleStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('isActive', ParseBoolPipe) isActive: boolean,
    @GetUser('id') executorId: number,
  ) {
    const user = await this.usersService.updateStatus(id, isActive, executorId);
    const safeUser = { ...(user as any) };
    delete safeUser.password_hash;
    return {
      success: true,
      message: `User status changed successfully to ${isActive ? 'active' : 'inactive'}`,
      data: safeUser,
    };
  }

  @Get('students/staff-directory')
  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_DIVISION_STAFF)
  async getStudentsForStaff(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('degreeId') degreeId?: string,
    @Query('academicYear') academicYear?: string,
    @Query('batch') batch?: string,
  ) {
    const parsedPage = parseInt(page, 10) || 1;
    const parsedLimit = parseInt(limit, 10) || 10;
    const parsedDegreeId = degreeId ? parseInt(degreeId, 10) : undefined;
    const parsedAcademicYear = academicYear ? parseInt(academicYear, 10) : undefined;

    const data = await this.usersService.getStudentsForStaff(
      parsedPage,
      parsedLimit,
      search,
      status,
      parsedDegreeId,
      parsedAcademicYear,
      batch,
    );

    return {
      success: true,
      message: 'Student directory retrieved successfully',
      data,
    };
  }

  @Get('students/:studentId/full-record')
  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_DIVISION_STAFF)
  async getStudentFullRecord(@Param('studentId', ParseIntPipe) studentId: number) {
    const data = await this.usersService.getStudentFullAcademicRecord(studentId);
    return {
      success: true,
      message: 'Full student academic record retrieved successfully',
      data,
    };
  }

  @Patch('students/:studentId/academic-status')
  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_DIVISION_STAFF)
  async updateStudentAcademicStatus(
    @Param('studentId', ParseIntPipe) studentId: number,
    @Body('status') status: string,
    @Body('enrollmentDate') enrollmentDate?: string,
    @Body('graduationDate') graduationDate?: string,
    @GetUser('id') executorId?: number,
  ) {
    const data = await this.usersService.updateStudentAcademicStatus(
      studentId,
      status,
      enrollmentDate,
      graduationDate,
      executorId,
    );
    return {
      success: true,
      message: `Student academic status updated to ${status}`,
      data,
    };
  }
}
