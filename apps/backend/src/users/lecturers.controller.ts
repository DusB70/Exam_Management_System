import { Controller, Get } from '@nestjs/common';
import { UsersService } from './users.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@ems/shared';

@Controller('lecturers')
@Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_DIVISION_STAFF)
export class LecturersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getAll() {
    const lecturers = await this.usersService.findAllLecturers();
    return {
      success: true,
      message: 'Lecturers retrieved successfully',
      data: lecturers,
    };
  }
}
