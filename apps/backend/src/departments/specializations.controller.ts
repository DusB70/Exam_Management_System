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
import { CreateSpecializationDto } from './dtos/academic-structure.dto';

@Controller('specializations')
@Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_DIVISION_STAFF)
export class SpecializationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  async getAll() {
    const specializations = await this.prisma.specialization.findMany({
      include: {
        degree: {
          include: {
            department: true,
          },
        },
      },
      orderBy: { specialization_name: 'asc' },
    });
    return {
      success: true,
      message: 'Specializations retrieved successfully',
      data: specializations,
    };
  }

  @Post()
  async create(@Body() dto: CreateSpecializationDto, @GetUser('id') executorId: number) {
    const degreeExists = await this.prisma.degree.findUnique({
      where: { degree_id: dto.degreeId },
    });
    if (!degreeExists) {
      throw new BadRequestException('Target degree does not exist.');
    }

    const exists = await this.prisma.specialization.findFirst({
      where: {
        degree_id: dto.degreeId,
        specialization_code: { equals: dto.specializationCode, mode: 'insensitive' },
      },
    });
    if (exists) {
      throw new BadRequestException(
        `Specialization code "${dto.specializationCode}" already exists for this degree.`,
      );
    }

    const specialization = await this.prisma.specialization.create({
      data: {
        specialization_name: dto.specializationName,
        specialization_code: dto.specializationCode.toUpperCase(),
        degree_id: dto.degreeId,
      },
    });

    await this.auditService.logAction(
      executorId,
      'SPECIALIZATION_CREATE',
      'specializations',
      specialization.specialization_id.toString(),
      null,
      specialization,
    );

    return {
      success: true,
      message: 'Specialization created successfully',
      data: specialization,
    };
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateSpecializationDto,
    @GetUser('id') executorId: number,
  ) {
    const specialization = await this.prisma.specialization.findUnique({
      where: { specialization_id: id },
    });
    if (!specialization) {
      throw new BadRequestException('Specialization not found.');
    }

    const degreeExists = await this.prisma.degree.findUnique({
      where: { degree_id: dto.degreeId },
    });
    if (!degreeExists) {
      throw new BadRequestException('Target degree does not exist.');
    }

    const exists = await this.prisma.specialization.findFirst({
      where: {
        degree_id: dto.degreeId,
        specialization_code: { equals: dto.specializationCode, mode: 'insensitive' },
        NOT: { specialization_id: id },
      },
    });
    if (exists) {
      throw new BadRequestException(
        `Another specialization with code "${dto.specializationCode}" already exists for this degree.`,
      );
    }

    const updated = await this.prisma.specialization.update({
      where: { specialization_id: id },
      data: {
        specialization_name: dto.specializationName,
        specialization_code: dto.specializationCode.toUpperCase(),
        degree_id: dto.degreeId,
      },
    });

    await this.auditService.logAction(
      executorId,
      'SPECIALIZATION_UPDATE',
      'specializations',
      id.toString(),
      specialization,
      updated,
    );

    return {
      success: true,
      message: 'Specialization updated successfully',
      data: updated,
    };
  }

  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number, @GetUser('id') executorId: number) {
    const specialization = await this.prisma.specialization.findUnique({
      where: { specialization_id: id },
    });
    if (!specialization) {
      throw new BadRequestException('Specialization not found.');
    }

    const studentsCount = await this.prisma.student.count({ where: { specialization_id: id } });
    if (studentsCount > 0) {
      throw new BadRequestException(
        'Cannot delete specialization because it is referenced by students.',
      );
    }

    await this.prisma.specialization.delete({ where: { specialization_id: id } });

    await this.auditService.logAction(
      executorId,
      'SPECIALIZATION_DELETE',
      'specializations',
      id.toString(),
      specialization,
      null,
    );

    return {
      success: true,
      message: 'Specialization deleted successfully',
      data: specialization,
    };
  }
}
