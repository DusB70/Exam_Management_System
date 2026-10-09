import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserRole } from '@ems/shared';
import { CreateDegreeDto, CreateSemesterLimitDto } from './dtos/academic-structure.dto';

@Controller('degrees')
@Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_DIVISION_STAFF)
export class DegreesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  async getAll() {
    const degrees = await this.prisma.degree.findMany({
      include: {
        department: true,
        specializations: true,
        courses: {
          include: {
            course: true,
          },
        },
      },
      orderBy: { degree_name: 'asc' },
    });

    const mapped = degrees.map((deg) => {
      const calculatedCompulsory = deg.courses
        .filter((cd) => cd.status === 'COMPULSORY')
        .reduce((sum, cd) => sum + Number(cd.course.credit_value), 0);

      const compulsoryCredits =
        deg.compulsory_credits != null && deg.compulsory_credits > 0
          ? deg.compulsory_credits
          : calculatedCompulsory;

      const totalCreditsRequired = Number(deg.total_credits_required || 0);
      const minOptionalCredits =
        deg.min_optional_credits != null && deg.min_optional_credits > 0
          ? deg.min_optional_credits
          : Math.max(0, totalCreditsRequired - compulsoryCredits);

      return {
        degree_id: deg.degree_id,
        degree_name: deg.degree_name,
        degree_code: deg.degree_code,
        department_id: deg.department_id,
        duration_years: deg.duration_years ?? 4,
        total_credits_required: deg.total_credits_required,
        compulsory_credits: compulsoryCredits,
        min_optional_credits: minOptionalCredits,
        optional_credits_required: minOptionalCredits,
        department: deg.department,
        specializations: deg.specializations,
      };
    });

    return {
      success: true,
      message: 'Degrees retrieved successfully',
      data: mapped,
    };
  }

  @Post()
  async create(@Body() dto: CreateDegreeDto, @GetUser('id') executorId: number) {
    if (dto.departmentId) {
      const departmentExists = await this.prisma.department.findUnique({
        where: { department_id: dto.departmentId },
      });
      if (!departmentExists) {
        throw new BadRequestException('Target department does not exist.');
      }
    }

    const exists = await this.prisma.degree.findFirst({
      where: {
        OR: [
          { degree_name: { equals: dto.degreeName, mode: 'insensitive' } },
          { degree_code: { equals: dto.degreeCode, mode: 'insensitive' } },
        ],
      },
    });
    if (exists) {
      throw new BadRequestException('Degree name or code already exists.');
    }

    const degree = await this.prisma.degree.create({
      data: {
        degree_name: dto.degreeName,
        degree_code: dto.degreeCode.toUpperCase(),
        department_id: dto.departmentId || null,
        duration_years: dto.durationYears != null ? Number(dto.durationYears) : 4,
        total_credits_required:
          dto.totalCreditsRequired != null ? Number(dto.totalCreditsRequired) : 0,
        compulsory_credits: dto.compulsoryCredits != null ? Number(dto.compulsoryCredits) : 0,
        min_optional_credits: dto.minOptionalCredits != null ? Number(dto.minOptionalCredits) : 0,
      },
    });

    await this.auditService.logAction(
      executorId,
      'DEGREE_CREATE',
      'degrees',
      degree.degree_id.toString(),
      null,
      degree,
    );

    return {
      success: true,
      message: 'Degree created successfully',
      data: degree,
    };
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateDegreeDto,
    @GetUser('id') executorId: number,
  ) {
    const degree = await this.prisma.degree.findUnique({ where: { degree_id: id } });
    if (!degree) {
      throw new BadRequestException('Degree not found.');
    }

    if (dto.departmentId) {
      const departmentExists = await this.prisma.department.findUnique({
        where: { department_id: dto.departmentId },
      });
      if (!departmentExists) {
        throw new BadRequestException('Target department does not exist.');
      }
    }

    const exists = await this.prisma.degree.findFirst({
      where: {
        OR: [
          { degree_name: { equals: dto.degreeName, mode: 'insensitive' } },
          { degree_code: { equals: dto.degreeCode, mode: 'insensitive' } },
        ],
        NOT: { degree_id: id },
      },
    });
    if (exists) {
      throw new BadRequestException('Another degree with this name or code already exists.');
    }

    const updated = await this.prisma.degree.update({
      where: { degree_id: id },
      data: {
        degree_name: dto.degreeName,
        degree_code: dto.degreeCode.toUpperCase(),
        department_id: dto.departmentId !== undefined ? dto.departmentId || null : undefined,
        duration_years: dto.durationYears !== undefined ? Number(dto.durationYears) : undefined,
        total_credits_required:
          dto.totalCreditsRequired !== undefined ? Number(dto.totalCreditsRequired) : undefined,
        compulsory_credits:
          dto.compulsoryCredits !== undefined ? Number(dto.compulsoryCredits) : undefined,
        min_optional_credits:
          dto.minOptionalCredits !== undefined ? Number(dto.minOptionalCredits) : undefined,
      },
    });

    await this.auditService.logAction(
      executorId,
      'DEGREE_UPDATE',
      'degrees',
      id.toString(),
      degree,
      updated,
    );

    return {
      success: true,
      message: 'Degree updated successfully',
      data: updated,
    };
  }

  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number, @GetUser('id') executorId: number) {
    const degree = await this.prisma.degree.findUnique({ where: { degree_id: id } });
    if (!degree) {
      throw new BadRequestException('Degree not found.');
    }

    const studentsCount = await this.prisma.student.count({ where: { degree_id: id } });
    const specializationsCount = await this.prisma.specialization.count({
      where: { degree_id: id },
    });

    if (studentsCount > 0 || specializationsCount > 0) {
      throw new BadRequestException(
        'Cannot delete degree because it is referenced by students or specializations.',
      );
    }

    await this.prisma.degree.delete({ where: { degree_id: id } });

    await this.auditService.logAction(
      executorId,
      'DEGREE_DELETE',
      'degrees',
      id.toString(),
      degree,
      null,
    );

    return {
      success: true,
      message: 'Degree deleted successfully',
      data: degree,
    };
  }

  @Get(':id/limits')
  async getSemesterLimits(@Param('id', ParseIntPipe) id: number) {
    const limits = await this.prisma.degreeSemesterLimit.findMany({
      where: { degree_id: id },
      orderBy: [{ academic_year: 'asc' }, { semester: 'asc' }],
    });
    return {
      success: true,
      message: 'Semester limits retrieved successfully',
      data: limits,
    };
  }

  @Post(':id/limits')
  async setSemesterLimit(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateSemesterLimitDto,
    @GetUser('id') executorId: number,
  ) {
    const degree = await this.prisma.degree.findUnique({ where: { degree_id: id } });
    if (!degree) {
      throw new BadRequestException('Degree not found.');
    }

    const limit = await this.prisma.degreeSemesterLimit.upsert({
      where: {
        degree_id_academic_year_semester: {
          degree_id: id,
          academic_year: dto.academicYear,
          semester: dto.semester,
        },
      },
      update: {
        max_credits: dto.maxCredits,
      },
      create: {
        degree_id: id,
        academic_year: dto.academicYear,
        semester: dto.semester,
        max_credits: dto.maxCredits,
      },
    });

    await this.auditService.logAction(
      executorId,
      'DEGREE_SEMESTER_LIMIT_SET',
      'degree_semester_limits',
      limit.limit_id.toString(),
      null,
      limit,
    );

    return {
      success: true,
      message: 'Semester limit configured successfully',
      data: limit,
    };
  }

  @Delete(':id/limits/:limitId')
  async deleteSemesterLimit(
    @Param('id', ParseIntPipe) id: number,
    @Param('limitId', ParseIntPipe) limitId: number,
    @GetUser('id') executorId: number,
  ) {
    const limit = await this.prisma.degreeSemesterLimit.findFirst({
      where: { limit_id: limitId, degree_id: id },
    });
    if (!limit) {
      throw new BadRequestException('Semester limit not found for this degree.');
    }

    await this.prisma.degreeSemesterLimit.delete({
      where: { limit_id: limitId },
    });

    await this.auditService.logAction(
      executorId,
      'DEGREE_SEMESTER_LIMIT_DELETE',
      'degree_semester_limits',
      limitId.toString(),
      limit,
      null,
    );

    return {
      success: true,
      message: 'Semester limit deleted successfully',
      data: limit,
    };
  }
}
