import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsBoolean,
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

export class CourseSpecializationDto {
  @IsInt()
  specializationId!: number;

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

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CourseSpecializationDto)
  specializations?: CourseSpecializationDto[];

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

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CourseSpecializationDto)
  specializations?: CourseSpecializationDto[];

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

export class SetCourseLecturerDto {
  @IsInt()
  @IsOptional()
  lecturerId?: number | null;
}

export class SetCourseInChargeDto {
  @IsInt()
  @IsOptional()
  inChargeLecturerId?: number | null;
}

export class AdditionalFirstMarkerDto {
  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  type!: string;

  @IsInt()
  @IsOptional()
  lecturerId?: number | null;

  @IsString()
  @IsOptional()
  name?: string | null;

  @IsString()
  @IsOptional()
  email?: string | null;
}

export class AssignMarkersDto {
  @IsBoolean()
  @IsOptional()
  isFirstMarkerSameAsInCharge?: boolean;

  @IsInt()
  @IsOptional()
  inChargeLecturerId?: number | null;

  @IsString()
  @IsOptional()
  firstMarkerType?: string | null;

  @IsInt()
  @IsOptional()
  firstMarkerLecturerId?: number | null;

  @IsString()
  @IsOptional()
  firstMarkerName?: string | null;

  @IsString()
  @IsOptional()
  firstMarkerEmail?: string | null;

  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => AdditionalFirstMarkerDto)
  additionalFirstMarkers?: AdditionalFirstMarkerDto[];

  @IsString()
  @IsOptional()
  secondMarkerType?: string | null;

  @IsInt()
  @IsOptional()
  secondMarkerLecturerId?: number | null;

  @IsString()
  @IsOptional()
  secondMarkerName?: string | null;

  @IsString()
  @IsOptional()
  secondMarkerEmail?: string | null;
}
