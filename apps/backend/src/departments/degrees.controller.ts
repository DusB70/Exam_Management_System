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
import { CreateDegreeDto } from './dtos/academic-structure.dto';

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
      },
      orderBy: { degree_name: 'asc' },
    });
    return {
      success: true,
      message: 'Degrees retrieved successfully',
      data: degrees,
    };
  }

  @Post()
  async create(@Body() dto: CreateDegreeDto, @GetUser('id') executorId: number) {
    const departmentExists = await this.prisma.department.findUnique({
      where: { department_id: dto.departmentId },
    });
    if (!departmentExists) {
      throw new BadRequestException('Target department does not exist.');
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
        department_id: dto.departmentId,
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

    const departmentExists = await this.prisma.department.findUnique({
      where: { department_id: dto.departmentId },
    });
    if (!departmentExists) {
      throw new BadRequestException('Target department does not exist.');
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
        department_id: dto.departmentId,
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
}
