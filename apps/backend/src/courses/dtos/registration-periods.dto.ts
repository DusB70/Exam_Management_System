import { IsDateString, IsEnum, IsInt, IsOptional, Min, IsString, Matches } from 'class-validator';

export enum PeriodStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  SUSPENDED = 'SUSPENDED',
}

export enum WindowType {
  SEMESTER_REGISTRATION = 'SEMESTER_REGISTRATION',
  MEDICAL_REPEAT_REGISTRATION = 'MEDICAL_REPEAT_REGISTRATION',
}

export class CreatePeriodDto {
  @IsInt()
  @Min(2000)
  academicYear!: number;

  @IsString()
  @IsOptional()
  batch?: string;

  @IsString()
  @Matches(/^(1\.1|1\.2|2\.1|2\.2|3\.1|3\.2|4\.1|4\.2)$/, {
    message: 'Semester must be in format X.Y (1.1 to 4.2)',
  })
  semester!: string;

  @IsString()
  @IsOptional()
  windowType?: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsEnum(PeriodStatus)
  @IsOptional()
  status?: PeriodStatus;
}

export class UpdatePeriodStatusDto {
  @IsEnum(PeriodStatus)
  status!: PeriodStatus;
}

export class UpdatePeriodEndDateDto {
  @IsDateString()
  endDate!: string;
}
