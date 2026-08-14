import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDepartmentDto {
  @IsString()
  @IsNotEmpty({ message: 'Department name is required' })
  @MaxLength(100)
  departmentName!: string;

  @IsString()
  @IsNotEmpty({ message: 'Department code is required' })
  @MaxLength(20)
  departmentCode!: string;

  @IsInt()
  @IsOptional()
  parentDepartmentId?: number;
}

export class CreateDegreeDto {
  @IsString()
  @IsNotEmpty({ message: 'Degree name is required' })
  @MaxLength(150)
  degreeName!: string;

  @IsString()
  @IsNotEmpty({ message: 'Degree code is required' })
  @MaxLength(20)
  degreeCode!: string;

  @IsInt()
  departmentId!: number;
}

export class CreateSpecializationDto {
  @IsString()
  @IsNotEmpty({ message: 'Specialization name is required' })
  @MaxLength(150)
  specializationName!: string;

  @IsString()
  @IsNotEmpty({ message: 'Specialization code is required' })
  @MaxLength(20)
  specializationCode!: string;

  @IsInt()
  degreeId!: number;

  @IsInt()
  @IsOptional()
  departmentId?: number;
}
