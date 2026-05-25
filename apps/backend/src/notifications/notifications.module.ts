import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsQueueService } from './notifications.queue.service';
import { NotificationsProcessor } from './notifications.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'notifications',
    }),
  ],
  providers: [NotificationsQueueService, NotificationsProcessor],
  exports: [NotificationsQueueService],
})
export class NotificationsModule {}
