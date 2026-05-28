import { Controller, Get, Query } from '@nestjs/common';
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
}
