import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('departments')
export class DepartmentsController {
  constructor(private readonly prisma: PrismaService) {}

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
}
