import {
  IsInt,
  IsString,
  IsNotEmpty,
  IsPositive,
  IsDateString,
  IsOptional,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

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

export class TimetableItemDto {
  @IsString()
  @IsOptional()
  batch?: string;

  @IsString()
  @IsOptional()
  semester?: string;

  @IsInt()
  @IsNotEmpty()
  courseId!: number;

  @IsString()
  @IsOptional()
  examName?: string;

  @IsString()
  @IsNotEmpty()
  examDate!: string;

  @IsString()
  @IsNotEmpty()
  startTime!: string;

  @IsString()
  @IsNotEmpty()
  endTime!: string;

  @IsString()
  @IsOptional()
  venue?: string;
}

export class SaveBatchTimetableDto {
  @IsString()
  @IsOptional()
  batch?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimetableItemDto)
  @IsOptional()
  items?: TimetableItemDto[];
}

export class SaveBulkTimetableDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TimetableItemDto)
  items!: TimetableItemDto[];
}

export class UpdateProgressDto {
  @IsString()
  @IsOptional()
  examHeld?: string; // PENDING, HELD, POSTPONED

  @IsOptional()
  firstMarkingCollected?: boolean;

  @IsOptional()
  firstMarkingReturned?: boolean;

  @IsOptional()
  secondMarkingCollected?: boolean;

  @IsOptional()
  secondMarkingReturned?: boolean;

  @IsOptional()
  examBoard?: boolean;
}
