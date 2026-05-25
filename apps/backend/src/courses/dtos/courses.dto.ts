import { IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

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

  @IsInt()
  @Min(1)
  @Max(8)
  semester!: number;

  @IsInt()
  @Min(2000)
  academicYear!: number;
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

  @IsInt()
  @IsOptional()
  @Min(1)
  @Max(8)
  semester?: number;

  @IsInt()
  @IsOptional()
  @Min(2000)
  academicYear?: number;
}

export class AssignLecturerDto {
  @IsInt()
  lecturerId!: number;
}
