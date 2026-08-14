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
} from 'class-validator';

export class StudentProfileDto {
  @IsString()
  @IsNotEmpty({ message: 'Registration number is required' })
  registrationNumber!: string;

  @IsString()
  @IsNotEmpty({ message: 'Index number is required' })
  indexNumber!: string;

  @IsInt()
  degreeId!: number;

  @IsInt()
  @IsOptional()
  specializationId?: number;

  @IsInt()
  academicYear!: number;
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

  @IsBoolean()
  @IsOptional()
  isHead?: boolean;

  @IsBoolean()
  @IsOptional()
  isDean?: boolean;
}

export class CreateUserDto {
  @IsEmail({}, { message: 'Invalid email address' })
  email!: string;

  @IsString()
  @IsNotEmpty({ message: 'Full name is required' })
  fullName!: string;

  @IsString()
  @IsNotEmpty({ message: 'Name with initials is required' })
  nameWithInitials!: string;

  @IsString()
  @IsNotEmpty({ message: 'NIC number is required' })
  nicNo!: string;

  @IsDateString({}, { message: 'Birthday must be a valid date' })
  dateOfBirth!: string;

  @IsString()
  @IsNotEmpty({ message: 'Contact number is required' })
  phoneNumber!: string;

  @IsString()
  @IsNotEmpty({ message: 'Address is required' })
  address!: string;

  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters' })
  @IsOptional()
  password?: string;

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
  @IsOptional()
  nameWithInitials?: string;

  @IsString()
  @IsOptional()
  nicNo?: string;

  @IsDateString()
  @IsOptional()
  dateOfBirth?: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @IsString()
  @IsOptional()
  address?: string;

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
