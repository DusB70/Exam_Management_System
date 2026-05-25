import { IsDateString, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export enum PeriodStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  SUSPENDED = 'SUSPENDED',
}

export class CreatePeriodDto {
  @IsInt()
  @Min(2000)
  academicYear!: number;

  @IsInt()
  @Min(1)
  @Max(8)
  semester!: number;

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
