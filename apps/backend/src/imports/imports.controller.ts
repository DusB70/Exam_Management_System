import {
  Controller,
  Post,
  Param,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ImportsService } from './imports.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserRole } from '@ems/shared';

@Controller('imports')
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post('students')
  @Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_DIVISION_STAFF)
  @UseInterceptors(FileInterceptor('file'))
  async importStudents(
    @UploadedFile() file: Express.Multer.File,
    @GetUser('id') executorId: number,
  ) {
    if (!file) {
      throw new BadRequestException('Excel/CSV spreadsheet file is required.');
    }
    const result = await this.importsService.importStudents(file.buffer, executorId);
    return {
      success: true,
      message: `Successfully imported ${result.count} students in bulk.`,
      data: result,
    };
  }

  @Post('exams/:examId/marks')
  @Roles(UserRole.LECTURER, UserRole.ADMINISTRATOR)
  @UseInterceptors(FileInterceptor('file'))
  async importMarks(
    @Param('examId', ParseIntPipe) examId: number,
    @UploadedFile() file: Express.Multer.File,
    @GetUser('id') executorId: number,
    @GetUser('role') role: string,
  ) {
    if (!file) {
      throw new BadRequestException('Excel/CSV spreadsheet file is required.');
    }
    const isLecturer = role === UserRole.LECTURER;
    const result = await this.importsService.importMarks(
      examId,
      file.buffer,
      executorId,
      isLecturer,
    );
    return {
      success: true,
      message: `Successfully imported ${result.count} exam marks in bulk.`,
      data: result,
    };
  }
}
