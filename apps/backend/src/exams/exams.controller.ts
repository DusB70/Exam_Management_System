import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  HttpStatus,
  HttpCode,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ExamsService } from './exams.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserRole } from '@ems/shared';
import {
  CreateExamDto,
  UpdateExamDto,
  CreateHallDto,
  UpdateHallDto,
  ScheduleExamDto,
  SaveBatchTimetableDto,
  SaveBulkTimetableDto,
  UpdateProgressDto,
} from './dtos/exams.dto';

@Controller('exams')
@Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_DIVISION_STAFF)
export class ExamsController {
  constructor(private readonly examsService: ExamsService) {}

  // ==========================================
  // EXAMS ENDPOINTS
  // ==========================================

  @Get()
  async getExams() {
    const exams = await this.examsService.findAllExams();
    return {
      success: true,
      message: 'Exams retrieved successfully',
      data: exams,
    };
  }

  @Post()
  async createExam(@Body() dto: CreateExamDto, @GetUser('id') executorId: number) {
    const exam = await this.examsService.createExam(dto, executorId);
    return {
      success: true,
      message: 'Exam created successfully',
      data: exam,
    };
  }

  @Put(':id')
  async updateExam(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateExamDto,
    @GetUser('id') executorId: number,
  ) {
    const exam = await this.examsService.updateExam(id, dto, executorId);
    return {
      success: true,
      message: 'Exam updated successfully',
      data: exam,
    };
  }

  @Delete(':id')
  async deleteExam(@Param('id', ParseIntPipe) id: number, @GetUser('id') executorId: number) {
    const exam = await this.examsService.deleteExam(id, executorId);
    return {
      success: true,
      message: 'Exam deleted successfully',
      data: exam,
    };
  }

  // ==========================================
  // HALLS ENDPOINTS
  // ==========================================

  @Get('halls')
  async getHalls() {
    const halls = await this.examsService.findAllHalls();
    return {
      success: true,
      message: 'Exam Halls retrieved successfully',
      data: halls,
    };
  }

  @Post('halls')
  async createHall(@Body() dto: CreateHallDto, @GetUser('id') executorId: number) {
    const hall = await this.examsService.createHall(dto, executorId);
    return {
      success: true,
      message: 'Exam Hall created successfully',
      data: hall,
    };
  }

  @Put('halls/:id')
  async updateHall(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateHallDto,
    @GetUser('id') executorId: number,
  ) {
    const hall = await this.examsService.updateHall(id, dto, executorId);
    return {
      success: true,
      message: 'Exam Hall updated successfully',
      data: hall,
    };
  }

  @Delete('halls/:id')
  async deleteHall(@Param('id', ParseIntPipe) id: number, @GetUser('id') executorId: number) {
    const hall = await this.examsService.deleteHall(id, executorId);
    return {
      success: true,
      message: 'Exam Hall deleted successfully',
      data: hall,
    };
  }

  // ==========================================
  // SCHEDULES ENDPOINTS
  // ==========================================

  @Get('schedules')
  async getSchedules() {
    const schedules = await this.examsService.findAllSchedules();
    return {
      success: true,
      message: 'Exam Schedules retrieved successfully',
      data: schedules,
    };
  }

  @Post('schedules')
  @HttpCode(HttpStatus.OK)
  async createSchedule(@Body() dto: ScheduleExamDto, @GetUser('id') executorId: number) {
    const schedule = await this.examsService.createSchedule(dto, executorId);
    return {
      success: true,
      message: 'Exam scheduled successfully',
      data: schedule,
    };
  }

  @Delete('schedules/:id')
  async deleteSchedule(@Param('id', ParseIntPipe) id: number, @GetUser('id') executorId: number) {
    const schedule = await this.examsService.deleteSchedule(id, executorId);
    return {
      success: true,
      message: 'Exam schedule deleted successfully',
      data: schedule,
    };
  }

  // ==========================================
  // TIMETABLE ENDPOINTS
  // ==========================================

  @Get('timetable/all')
  async getAllTimetables() {
    const data = await this.examsService.getAllTimetables();
    return {
      success: true,
      message: 'All active timetables retrieved successfully',
      data,
    };
  }

  @Put('timetable/bulk')
  async saveBulkTimetable(@Body() dto: SaveBulkTimetableDto, @GetUser('id') executorId: number) {
    const data = await this.examsService.saveBulkTimetable(dto?.items || [], executorId);
    return {
      success: true,
      message: 'Timetables saved successfully',
      data,
    };
  }

  @Get(['timetable/batch/:batch(*)', 'timetable/batch/*'])
  async getTimetableByBatch(@Param() params: any, @Query('batch') queryBatch?: string) {
    const rawBatch = queryBatch || params.batch || params['0'] || '';
    const batch = decodeURIComponent(rawBatch).trim();
    const data = await this.examsService.getTimetableByBatch(batch);
    return {
      success: true,
      message: 'Timetable retrieved successfully',
      data,
    };
  }

  @Put(['timetable/batch/:batch(*)', 'timetable/batch/*'])
  async saveBatchTimetable(
    @Param() params: any,
    @Query('batch') queryBatch: string,
    @Body() dto: SaveBatchTimetableDto,
    @GetUser('id') executorId: number,
  ) {
    const rawBatch = dto?.batch || queryBatch || params.batch || params['0'] || '';
    const batch = decodeURIComponent(rawBatch).trim();
    const data = await this.examsService.saveBatchTimetable(batch, dto?.items || [], executorId);
    return {
      success: true,
      message: 'Timetable saved successfully',
      data,
    };
  }

  @Delete(['timetable/batch/:batch(*)', 'timetable/batch/*'])
  async deleteBatchTimetable(
    @Param() params: any,
    @Query('batch') queryBatch?: string,
    @Query('semester') semester?: string,
    @GetUser('id') executorId?: number,
  ) {
    const rawBatch = queryBatch || params.batch || params['0'] || '';
    const batch = decodeURIComponent(rawBatch).trim();
    const data = await this.examsService.deleteBatchTimetable(batch, semester, executorId);
    return {
      success: true,
      message: 'Timetable deleted successfully',
      data,
    };
  }

  @Post(['timetable/batch/:batch(*)/validate', 'timetable/batch/*/validate'])
  @UseInterceptors(FileInterceptor('file'))
  async validateExcelTimetable(
    @Param() params: any,
    @Query('batch') queryBatch: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('semester') semester: string,
    @Body('examName') examName: string,
  ) {
    const rawBatch = queryBatch || params.batch || params['0'] || '';
    const batch = decodeURIComponent(rawBatch).trim();
    const data = await this.examsService.validateExcelTimetable(
      batch,
      semester || 'ALL',
      examName || 'End Semester Examination 2026',
      file?.buffer,
    );
    return {
      success: true,
      message: 'Excel spreadsheet validation completed',
      data,
    };
  }

  @Post(['timetable/batch/:batch(*)/import', 'timetable/batch/*/import'])
  @UseInterceptors(FileInterceptor('file'))
  async importBatchTimetableExcel(
    @Param() params: any,
    @Query('batch') queryBatch: string,
    @UploadedFile() file: Express.Multer.File,
    @GetUser('id') executorId: number,
  ) {
    const rawBatch = queryBatch || params.batch || params['0'] || '';
    const batch = decodeURIComponent(rawBatch).trim();
    const data = await this.examsService.importBatchTimetableExcel(batch, file?.buffer, executorId);
    return {
      success: true,
      message: data.message,
      data,
    };
  }

  @Post(['timetable/batch/:batch(*)/publish', 'timetable/batch/*/publish'])
  @HttpCode(HttpStatus.OK)
  async publishBatchTimetable(
    @Param() params: any,
    @Query('batch') queryBatch: string,
    @GetUser('id') executorId: number,
  ) {
    const rawBatch = queryBatch || params.batch || params['0'] || '';
    const batch = decodeURIComponent(rawBatch).trim();
    const data = await this.examsService.publishBatchTimetable(batch, executorId);
    return {
      success: true,
      message: data.message,
      data,
    };
  }

  @Get('timetable/my-schedules')
  @Roles(UserRole.STUDENT)
  async getStudentPublishedTimetable(@GetUser('id') userId: number) {
    const data = await this.examsService.getStudentPublishedTimetable(userId);
    return {
      success: true,
      message: 'Student published exam timetable retrieved successfully',
      data,
    };
  }

  // ==========================================
  // PUBLISHING PROGRESS ENDPOINTS
  // ==========================================

  @Get('progress')
  @Roles(UserRole.LECTURER, UserRole.ADMINISTRATOR, UserRole.EXAM_DIVISION_STAFF)
  async getPublishingProgress() {
    const data = await this.examsService.getPublishingProgress();
    return {
      success: true,
      message: 'Publishing progress matrix retrieved successfully',
      data,
    };
  }

  @Put('progress/:courseId')
  async updatePublishingProgress(
    @Param('courseId', ParseIntPipe) courseId: number,
    @Body() dto: UpdateProgressDto,
    @GetUser('id') executorId: number,
  ) {
    const data = await this.examsService.updatePublishingProgress(courseId, dto, executorId);
    return {
      success: true,
      message: 'Publishing progress updated successfully',
      data,
    };
  }

  @Get('progress/my-courses')
  @Roles(UserRole.STUDENT)
  async getStudentPublishingProgress(@GetUser('id') userId: number) {
    const data = await this.examsService.getStudentPublishingProgress(userId);
    return {
      success: true,
      message: 'Student course publishing progress retrieved successfully',
      data,
    };
  }
}
