import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
  Matches,
} from 'class-validator';

export class StudentProfileDto {
  @IsString()
  @IsNotEmpty({ message: 'Registration number is required' })
  registrationNumber!: string;

  @IsInt()
  departmentId!: number;

  @IsInt()
  academicYear!: number;

  @IsString()
  @Matches(/^(1\.1|1\.2|2\.1|2\.2|3\.1|3\.2|4\.1|4\.2)$/, {
    message: 'Semester must be in format X.Y (1.1 to 4.2)',
  })
  semester!: string;

  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;
}

export class LecturerProfileDto {
  @IsString()
  @IsNotEmpty({ message: 'Employee number is required' })
  employeeNumber!: string;

  @IsInt()
  departmentId!: number;

  @IsString()
  @IsOptional()
  specialization?: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;
}

export class CreateUserDto {
  @IsEmail({}, { message: 'Invalid email address' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  fullName!: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  password!: string;

  @IsInt()
  roleId!: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => StudentProfileDto)
  studentProfile?: StudentProfileDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => LecturerProfileDto)
  lecturerProfile?: LecturerProfileDto;
}

export class UpdateUserDto {
  @IsEmail({}, { message: 'Invalid email address' })
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  fullName?: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  @IsOptional()
  password?: string;

  @IsInt()
  @IsOptional()
  roleId?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => StudentProfileDto)
  studentProfile?: StudentProfileDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => LecturerProfileDto)
  lecturerProfile?: LecturerProfileDto;
}
