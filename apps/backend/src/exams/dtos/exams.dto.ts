import { IsInt, IsString, IsNotEmpty, IsPositive, IsDateString, IsOptional } from 'class-validator';

export class CreateExamDto {
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  courseId!: number;

  @IsString()
  @IsNotEmpty()
  examType!: string; // e.g. CA, FINAL

  @IsString()
  @IsNotEmpty()
  examTitle!: string;

  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  totalMarks!: number;

  @IsDateString()
  @IsNotEmpty()
  examDate!: string;

  @IsString()
  @IsNotEmpty()
  startTime!: string; // e.g. "09:00:00" or ISO timestamp

  @IsString()
  @IsNotEmpty()
  endTime!: string; // e.g. "12:00:00" or ISO timestamp
}

export class UpdateExamDto {
  @IsString()
  @IsOptional()
  examType?: string;

  @IsString()
  @IsOptional()
  examTitle?: string;

  @IsInt()
  @IsPositive()
  @IsOptional()
  totalMarks?: number;

  @IsDateString()
  @IsOptional()
  examDate?: string;

  @IsString()
  @IsOptional()
  startTime?: string;

  @IsString()
  @IsOptional()
  endTime?: string;
}

export class CreateHallDto {
  @IsString()
  @IsNotEmpty()
  hallName!: string;

  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  capacity!: number;
}

export class UpdateHallDto {
  @IsString()
  @IsOptional()
  hallName?: string;

  @IsInt()
  @IsPositive()
  @IsOptional()
  capacity?: number;
}

export class ScheduleExamDto {
  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  examId!: number;

  @IsInt()
  @IsPositive()
  @IsNotEmpty()
  hallId!: number;
}
