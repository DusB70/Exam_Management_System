import { Controller, Get, Put, Body, Post, HttpCode, HttpStatus } from '@nestjs/common';
import { UsersService } from './users.service';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UpdateProfileDto, ChangePasswordDto } from './dtos/profile.dto';

@Controller('profile')
export class ProfileController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async getProfile(@GetUser('id') userId: number) {
    const user = await this.usersService.findById(userId);
    const safeUser = { ...(user as any) };
    delete safeUser.password_hash;
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
