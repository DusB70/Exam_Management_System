import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get('health')
  getHealth(): { status: string; timestamp: string } {
    return this.appService.getHealth();
  }

  @Public()
  @Get('public-stats')
  async getPublicStats() {
    const stats = await this.appService.getPublicStats();
    return {
      success: true,
      data: stats,
    };
  }
}
