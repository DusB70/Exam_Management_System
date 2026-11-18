import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) {}

  getHealth(): { status: string; timestamp: string } {
    return {
      status: 'OK',
      timestamp: new Date().toISOString(),
    };
  }

  async getPublicStats() {
    const [students, lecturers, courses] = await Promise.all([
      this.prisma.student.count(),
      this.prisma.lecturer.count(),
      this.prisma.course.count(),
    ]);

    return {
      students,
      lecturers,
      courses,
    };
  }
}
