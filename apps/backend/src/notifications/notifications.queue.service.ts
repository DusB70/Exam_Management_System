import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class NotificationsQueueService {
  private readonly logger = new Logger(NotificationsQueueService.name);

  constructor(@InjectQueue('notifications') private readonly notificationsQueue: Queue) {}

  async addResultsPublishedJob(academicYear: number, semester: string) {
    try {
      await this.notificationsQueue.add('results_published', {
        academicYear,
        semester,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to enqueue results_published job (Redis may be unavailable): ${msg}`,
      );
    }
  }

  async addRegistrationOpenedJob(academicYear: number, semester: string, endDate: Date) {
    try {
      await this.notificationsQueue.add('registration_opened', {
        academicYear,
        semester,
        endDate: endDate.toISOString(),
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Failed to enqueue registration_opened job (Redis may be unavailable): ${msg}`,
      );
    }
  }
}
