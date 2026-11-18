import { IsNotEmpty, IsString, IsArray, IsOptional, IsNumber, Min, IsEnum } from 'class-validator';

export class EvaluateProgressionDto {
  @IsNotEmpty()
  @IsString()
  batch: string;

  @IsNotEmpty()
  @IsString()
  targetSemester: string; // e.g. "3.1"

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  consideredSemesters?: string[]; // e.g. ["1.1", "1.2", "2.1"]

  @IsOptional()
  @IsNumber()
  @Min(0)
  minGpa?: number; // e.g. 2.0
}

export enum PromotionDecisionAction {
  PROMOTE = 'PROMOTE',
  HOLD_REMEDIATION = 'HOLD_REMEDIATION', // Option 1
  HOLD_BATCH_DEMOTION = 'HOLD_BATCH_DEMOTION', // Option 2
}

export class StudentDecisionItem {
  @IsNotEmpty()
  @IsNumber()
  studentId: number;

  @IsNotEmpty()
  @IsEnum(PromotionDecisionAction)
  action: PromotionDecisionAction;

  @IsOptional()
  @IsString()
  remarks?: string;
}

export class ExecutePromotionDto {
  @IsNotEmpty()
  @IsString()
  batch: string;

  @IsNotEmpty()
  @IsString()
  targetSemester: string; // e.g. "3.1"

  @IsArray()
  decisions: StudentDecisionItem[];
}
