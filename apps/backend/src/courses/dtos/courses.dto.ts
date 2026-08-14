import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  Matches,
  IsArray,
  ValidateNested,
  IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum DegreeCourseStatus {
  COMPULSORY = 'COMPULSORY',
  OPTIONAL = 'OPTIONAL',
}

export class CourseDegreeDto {
  @IsInt()
  degreeId!: number;

  @IsEnum(DegreeCourseStatus)
  status!: DegreeCourseStatus;
}

export class CreateCourseDto {
  @IsString()
  @IsNotEmpty({ message: 'Course code is required' })
  courseCode!: string;

  @IsString()
  @IsNotEmpty({ message: 'Course name is required' })
  courseName!: string;

  @IsNumber()
  @Min(0)
  @Max(10)
  creditValue!: number;

  @IsInt()
  departmentId!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CourseDegreeDto)
  degrees!: CourseDegreeDto[];

  @IsInt()
  @IsOptional()
  specializationId?: number;

  @IsString()
  @IsNotEmpty({ message: 'Semester is required' })
  @Matches(/^(1\.1|1\.2|2\.1|2\.2|3\.1|3\.2|4\.1|4\.2)$/, {
    message: 'Semester must be in format X.Y (1.1 to 4.2)',
  })
  semester!: string;

  @IsInt()
  @IsOptional()
  lecturerId?: number;
}

export class UpdateCourseDto {
  @IsString()
  @IsOptional()
  courseCode?: string;

  @IsString()
  @IsOptional()
  courseName?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(10)
  creditValue?: number;

  @IsInt()
  @IsOptional()
  departmentId?: number;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CourseDegreeDto)
  degrees?: CourseDegreeDto[];

  @IsInt()
  @IsOptional()
  specializationId?: number;

  @IsString()
  @IsOptional()
  @Matches(/^(1\.1|1\.2|2\.1|2\.2|3\.1|3\.2|4\.1|4\.2)$/, {
    message: 'Semester must be in format X.Y (1.1 to 4.2)',
  })
  semester?: string;

  @IsInt()
  @IsOptional()
  lecturerId?: number;
}

export class AssignLecturerDto {
  @IsInt()
  lecturerId!: number;
}
