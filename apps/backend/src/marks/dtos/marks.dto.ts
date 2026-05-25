import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNumber, Min, ValidateNested } from 'class-validator';

export class RecordMarkEntry {
  @IsInt()
  studentId!: number;

  @IsNumber()
  @Min(0)
  marksObtained!: number;
}

export class BulkRecordMarksDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecordMarkEntry)
  marks!: RecordMarkEntry[];
}
