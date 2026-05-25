import { IsArray, IsInt, IsNotEmpty, Min } from 'class-validator';

export class RegisterCoursesDto {
  @IsArray()
  @IsInt({ each: true })
  @IsNotEmpty({ message: 'courseIds must not be empty' })
  courseIds!: number[];
}

export class AdminRegisterCourseDto {
  @IsInt()
  @Min(1)
  courseId!: number;
}
