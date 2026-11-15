import { Controller, Get, Post, Delete, Param, Body, Query, ParseIntPipe } from '@nestjs/common';
import { AuditService } from './audit.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@ems/shared';

@Controller('audit-logs')
@Roles(UserRole.ADMINISTRATOR)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  async getLogs(
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('search') search?: string,
  ) {
    const parsedPage = parseInt(page, 10) || 1;
    const parsedLimit = parseInt(limit, 10) || 10;
    const data = await this.auditService.findAll(parsedPage, parsedLimit, search);
    return {
      success: true,
      message: 'Audit logs retrieved successfully',
      data,
    };
  }

  @Post('bulk-delete')
  async bulkDeleteLogs(@Body('ids') ids: number[]) {
    const parsedIds = Array.isArray(ids)
      ? ids.map((id) => Number(id)).filter((id) => !isNaN(id))
      : [];
    const data = await this.auditService.deleteMany(parsedIds);
    return {
      success: true,
      message: `${data.deletedCount} audit log(s) deleted successfully`,
      data,
    };
  }

  @Delete(':id')
  async deleteLog(@Param('id', ParseIntPipe) id: number) {
    const data = await this.auditService.deleteMany([id]);
    return {
      success: true,
      message: 'Audit log deleted successfully',
      data,
    };
  }
}
