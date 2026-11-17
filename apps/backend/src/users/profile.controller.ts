import { Controller, Get, Put, Body, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { UsersService } from './users.service';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UpdateProfileDto, ChangePasswordDto } from './dtos/profile.dto';

@Controller('profile')
export class ProfileController {
  constructor(private readonly usersService: UsersService) {}

  private enrichUserData(safeUser: any) {
    if (safeUser.student) {
      if (safeUser.student.degree) {
        const deg = safeUser.student.degree;
        const compulsoryCredits = deg.courses
          ? deg.courses
              .filter((cd: any) => cd.status === 'COMPULSORY')
              .reduce((sum: number, cd: any) => sum + Number(cd.course.credit_value), 0)
          : 0;

        const totalCreditsRequired = Number(deg.total_credits_required || 0);
        const optionalCreditsRequired = Math.max(0, totalCreditsRequired - compulsoryCredits);

        safeUser.student.degree.compulsory_credits = compulsoryCredits;
        safeUser.student.degree.optional_credits_required = optionalCreditsRequired;
      }

      const registeredSemesters = (safeUser.student.registrations || [])
        .map((r: any) => r.course?.semester)
        .filter(Boolean);
      if (registeredSemesters.length > 0) {
        registeredSemesters.sort();
        safeUser.student.latest_registered_semester =
          registeredSemesters[registeredSemesters.length - 1];
      } else {
        safeUser.student.latest_registered_semester = null;
      }
    }
    return safeUser;
  }

  @Get()
  async getProfile(@GetUser('id') userId: number) {
    const user = await this.usersService.findById(userId);
    const safeUser = { ...(user as any) };
    delete safeUser.password_hash;

    this.enrichUserData(safeUser);

    return {
      success: true,
      message: 'Profile retrieved successfully',
      data: safeUser,
    };
  }

  @Put()
  async updateProfile(@GetUser('id') userId: number, @Body() dto: UpdateProfileDto) {
    const user = await this.usersService.updateProfile(userId, dto);
    const safeUser = { ...(user as any) };
    delete safeUser.password_hash;

    this.enrichUserData(safeUser);

    return {
      success: true,
      message: 'Profile updated successfully',
      data: safeUser,
    };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  async changePassword(@GetUser('id') userId: number, @Body() dto: ChangePasswordDto) {
    await this.usersService.changePassword(userId, dto);
    return {
      success: true,
      message: 'Password changed successfully',
    };
  }
}
