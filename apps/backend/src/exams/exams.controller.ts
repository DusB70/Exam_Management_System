import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
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
}
