import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { Logger } from '@nestjs/common';

@Processor('notifications')
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);

    switch (job.name) {
      case 'results_published':
        await this.handleResultsPublished(job.data);
        break;
      case 'registration_opened':
        await this.handleRegistrationOpened(job.data);
        break;
      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  private async handleResultsPublished(data: { academicYear: number; semester: string }) {
    const students = await this.prisma.student.findMany({
      where: {
        academic_year: data.academicYear,
        semester: data.semester,
      },
      include: {
        user: true,
      },
    });

    this.logger.log(
      `Sending results publication email notifications to ${students.length} students for Year ${data.academicYear} Sem ${data.semester}...`,
    );

    for (const student of students) {
      if (student.user) {
        this.logger.log(
          `[SIMULATED EMAIL SENT] To: ${student.user.email} (${student.user.full_name}) | Subject: Academic Results Published | Body: Dear ${student.user.full_name}, your academic results for Academic Year ${data.academicYear} Semester ${data.semester} have been compiled and published. Please log into the portal to view your grade sheets and SGPA/CGPA.`,
        );
      }
    }
  }

  private async handleRegistrationOpened(data: {
    academicYear: number;
    semester: string;
    endDate: string;
  }) {
    const students = await this.prisma.student.findMany({
      where: {
        academic_year: data.academicYear,
        semester: data.semester,
      },
      include: {
        user: true,
      },
    });

    const formattedDate = new Date(data.endDate).toLocaleDateString();

    this.logger.log(
      `Sending course registration window email notifications to ${students.length} students for Year ${data.academicYear} Sem ${data.semester}...`,
    );

    for (const student of students) {
      if (student.user) {
        this.logger.log(
          `[SIMULATED EMAIL SENT] To: ${student.user.email} (${student.user.full_name}) | Subject: Course Registration Window Opened | Body: Dear ${student.user.full_name}, the course registration window for Academic Year ${data.academicYear} Semester ${data.semester} is now OPEN. It will remain open until ${formattedDate}. Please complete your registration within the deadline.`,
        );
      }
    }
  }
}
