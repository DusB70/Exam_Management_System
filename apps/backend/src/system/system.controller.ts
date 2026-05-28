import { Controller, Get, Res } from '@nestjs/common';
import { SystemService } from './system.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@ems/shared';
import { Response } from 'express';

@Controller('system')
@Roles(UserRole.ADMINISTRATOR)
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get('backup')
  async downloadBackup(@Res() res: Response) {
    const backupData = await this.systemService.createBackup();
    const jsonString = JSON.stringify(backupData, null, 2);
    const buffer = Buffer.from(jsonString, 'utf-8');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    res.set({
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename=ems_backup_${timestamp}.json`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Get('stats')
  async getSystemStats() {
    const stats = await this.systemService.getStats();
    return {
      success: true,
      message: 'System stats retrieved successfully',
      data: stats,
    };
  }
}
