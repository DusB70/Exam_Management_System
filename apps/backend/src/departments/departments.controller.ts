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
import { CreateDepartmentDto } from './dtos/academic-structure.dto';

@Controller('departments')
@Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_DIVISION_STAFF)
export class DepartmentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  async getAll() {
    const departments = await this.prisma.department.findMany({
      orderBy: { department_name: 'asc' },
    });
    return {
      success: true,
      message: 'Departments retrieved successfully',
      data: departments,
    };
  }

  @Post()
  async create(@Body() dto: CreateDepartmentDto, @GetUser('id') executorId: number) {
    const exists = await this.prisma.department.findFirst({
      where: {
        OR: [
          { department_name: { equals: dto.departmentName, mode: 'insensitive' } },
          { department_code: { equals: dto.departmentCode, mode: 'insensitive' } },
        ],
      },
    });
    if (exists) {
      throw new BadRequestException('Department name or code already exists.');
    }

    if (dto.parentDepartmentId) {
      const parentExists = await this.prisma.department.findUnique({
        where: { department_id: dto.parentDepartmentId },
      });
      if (!parentExists) {
        throw new BadRequestException('Parent department not found.');
      }
    }

    const dept = await this.prisma.department.create({
      data: {
        department_name: dto.departmentName,
        department_code: dto.departmentCode.toUpperCase(),
        parent_department_id: dto.parentDepartmentId || null,
      },
    });

    await this.auditService.logAction(
      executorId,
      'DEPARTMENT_CREATE',
      'departments',
      dept.department_id.toString(),
      null,
      dept,
    );

    return {
      success: true,
      message: 'Department created successfully',
      data: dept,
    };
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateDepartmentDto,
    @GetUser('id') executorId: number,
  ) {
    const dept = await this.prisma.department.findUnique({ where: { department_id: id } });
    if (!dept) {
      throw new BadRequestException('Department not found.');
    }

    if (dto.parentDepartmentId === id) {
      throw new BadRequestException('A department cannot be its own parent.');
    }

    if (dto.parentDepartmentId) {
      const parentExists = await this.prisma.department.findUnique({
        where: { department_id: dto.parentDepartmentId },
      });
      if (!parentExists) {
        throw new BadRequestException('Parent department not found.');
      }
      if (parentExists.parent_department_id === id) {
        throw new BadRequestException(
          'Circular parent-child department relationship is not allowed.',
        );
      }
    }

    const exists = await this.prisma.department.findFirst({
      where: {
        OR: [
          { department_name: { equals: dto.departmentName, mode: 'insensitive' } },
          { department_code: { equals: dto.departmentCode, mode: 'insensitive' } },
        ],
        NOT: { department_id: id },
      },
    });
    if (exists) {
      throw new BadRequestException('Another department with this name or code already exists.');
    }

    const updated = await this.prisma.department.update({
      where: { department_id: id },
      data: {
        department_name: dto.departmentName,
        department_code: dto.departmentCode.toUpperCase(),
        parent_department_id: dto.parentDepartmentId || null,
      },
    });

    await this.auditService.logAction(
      executorId,
      'DEPARTMENT_UPDATE',
      'departments',
      id.toString(),
      dept,
      updated,
    );

    return {
      success: true,
      message: 'Department updated successfully',
      data: updated,
    };
  }

  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number, @GetUser('id') executorId: number) {
    const dept = await this.prisma.department.findUnique({ where: { department_id: id } });
    if (!dept) {
      throw new BadRequestException('Department not found.');
    }

    const childrenCount = await this.prisma.department.count({
      where: { parent_department_id: id },
    });
    if (childrenCount > 0) {
      throw new BadRequestException(
        'Cannot delete department because it has child sub-departments.',
      );
    }

    const degreesCount = await this.prisma.degree.count({ where: { department_id: id } });
    const lecturersCount = await this.prisma.lecturer.count({ where: { department_id: id } });
    const coursesCount = await this.prisma.course.count({ where: { department_id: id } });

    if (degreesCount > 0 || lecturersCount > 0 || coursesCount > 0) {
      throw new BadRequestException(
        'Cannot delete department because it is referenced by degrees, lecturers, or courses.',
      );
    }

    await this.prisma.department.delete({ where: { department_id: id } });

    await this.auditService.logAction(
      executorId,
      'DEPARTMENT_DELETE',
      'departments',
      id.toString(),
      dept,
      null,
    );

    return {
      success: true,
      message: 'Department deleted successfully',
      data: dept,
    };
  }
}
