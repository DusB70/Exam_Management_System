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
        const spec = safeUser.student.specialization;

        const compulsoryCourseMap = new Map<number, number>();
        const optionalCourseMap = new Map<number, number>();

        // 1. Direct degree courses (CourseDegree)
        for (const cd of deg.courses || []) {
          if (!cd.course) continue;
          const cId = cd.course_id;
          const cred = Number(cd.course.credit_value || 0);
          const status = (cd.status || '').toUpperCase();
          if (status === 'COMPULSORY') {
            compulsoryCourseMap.set(cId, cred);
          } else if (status === 'OPTIONAL') {
            optionalCourseMap.set(cId, cred);
          }
        }

        // 2. Specialization courses (if student is assigned to a specialization)
        for (const cs of spec?.course_specializations || []) {
          if (!cs.course) continue;
          const cId = cs.course_id;
          const cred = Number(cs.course.credit_value || 0);
          const status = (cs.status || '').toUpperCase();
          if (status === 'COMPULSORY') {
            compulsoryCourseMap.set(cId, cred);
            optionalCourseMap.delete(cId);
          } else if (status === 'OPTIONAL' && !compulsoryCourseMap.has(cId)) {
            optionalCourseMap.set(cId, cred);
          }
        }

        let compulsoryCredits = 0;
        for (const cred of compulsoryCourseMap.values()) {
          compulsoryCredits += cred;
        }

        const totalCreditsRequired = 120;
        const minOptionalCredits = Math.max(0, totalCreditsRequired - compulsoryCredits);

        safeUser.student.degree.total_credits_required = totalCreditsRequired;
        safeUser.student.degree.compulsory_credits = compulsoryCredits;
        safeUser.student.degree.min_optional_credits = minOptionalCredits;
        safeUser.student.degree.optional_credits_required = minOptionalCredits;
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
