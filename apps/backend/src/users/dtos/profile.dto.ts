import { IsString, IsNotEmpty, MinLength, IsOptional } from 'class-validator';

export class UpdateProfileDto {
  @IsString()
  @IsOptional()
  phoneNumber?: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Current password is required' })
  currentPassword!: string;

  @IsString()
  @MinLength(6, { message: 'New password must be at least 6 characters' })
  newPassword!: string;

  @IsString()
  @MinLength(6, { message: 'Confirmation password must be at least 6 characters' })
  confirmPassword!: string;
}
