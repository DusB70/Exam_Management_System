import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class NotificationsQueueService {
  constructor(@InjectQueue('notifications') private readonly notificationsQueue: Queue) {}

  async addResultsPublishedJob(academicYear: number, semester: number) {
    await this.notificationsQueue.add('results_published', {
      academicYear,
      semester,
    });
  }

  async addRegistrationOpenedJob(academicYear: number, semester: number, endDate: Date) {
    await this.notificationsQueue.add('registration_opened', {
      academicYear,
      semester,
      endDate: endDate.toISOString(),
    });
  }
}
