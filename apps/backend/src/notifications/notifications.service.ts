import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async sendResultsPublishedNotifications(academicYear: number, semester: string): Promise<void> {
    try {
      const students = await this.prisma.student.findMany({
        where: {
          academic_year: academicYear,
          semester,
        },
        include: {
          user: true,
        },
      });

      this.logger.log(
        `Sending results publication email notifications to ${students.length} students for Year ${academicYear} Sem ${semester}...`,
      );

      for (const student of students) {
        if (student.user) {
          this.logger.log(
            `[SIMULATED EMAIL SENT] To: ${student.user.email} (${student.user.full_name}) | Subject: Academic Results Published | Body: Dear ${student.user.full_name}, your academic results for Academic Year ${academicYear} Semester ${semester} have been compiled and published. Please log into the portal to view your grade sheets and SGPA/CGPA.`,
          );
        }
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send results published notifications: ${msg}`);
    }
  }

  async sendRegistrationOpenedNotifications(
    academicYear: number,
    semester: string,
    endDate: Date,
  ): Promise<void> {
    try {
      const students = await this.prisma.student.findMany({
        where: {
          academic_year: academicYear,
          semester,
        },
        include: {
          user: true,
        },
      });

      const formattedDate = endDate.toLocaleDateString();

      this.logger.log(
        `Sending course registration window email notifications to ${students.length} students for Year ${academicYear} Sem ${semester}...`,
      );

      for (const student of students) {
        if (student.user) {
          this.logger.log(
            `[SIMULATED EMAIL SENT] To: ${student.user.email} (${student.user.full_name}) | Subject: Course Registration Window Opened | Body: Dear ${student.user.full_name}, the course registration window for Academic Year ${academicYear} Semester ${semester} is now OPEN. It will remain open until ${formattedDate}. Please complete your registration within the deadline.`,
          );
        }
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send registration opened notifications: ${msg}`);
    }
  }
}
