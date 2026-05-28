import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsQueueService } from './notifications.queue.service';
import { getQueueToken } from '@nestjs/bullmq';

describe('NotificationsQueueService', () => {
  let service: NotificationsQueueService;
  let queueMock: any;

  beforeEach(async () => {
    queueMock = {
      add: jest.fn().mockResolvedValue({ id: 'job_id' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsQueueService,
        {
          provide: getQueueToken('notifications'),
          useValue: queueMock,
        },
      ],
    }).compile();

    service = module.get<NotificationsQueueService>(NotificationsQueueService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addResultsPublishedJob', () => {
    it('should add results_published job to the queue with correct payload', async () => {
      await service.addResultsPublishedJob(2026, '2.2');

      expect(queueMock.add).toHaveBeenCalledWith('results_published', {
        academicYear: 2026,
        semester: '2.2',
      });
    });
  });

  describe('addRegistrationOpenedJob', () => {
    it('should add registration_opened job to the queue with correct payload', async () => {
      const endDate = new Date('2026-06-30T23:59:59Z');
      await service.addRegistrationOpenedJob(2026, '1.1', endDate);

      expect(queueMock.add).toHaveBeenCalledWith('registration_opened', {
        academicYear: 2026,
        semester: '1.1',
        endDate: endDate.toISOString(),
      });
    });
  });
});
