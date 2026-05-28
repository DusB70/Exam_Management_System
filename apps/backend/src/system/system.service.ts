import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SystemService {
  constructor(private readonly prisma: PrismaService) {}

  async createBackup() {
    const roles = await this.prisma.role.findMany();
    const users = await this.prisma.user.findMany();
    const departments = await this.prisma.department.findMany();
    const students = await this.prisma.student.findMany();
    const lecturers = await this.prisma.lecturer.findMany();
    const courses = await this.prisma.course.findMany();
    const courseRegistrations = await this.prisma.courseRegistration.findMany();
    const exams = await this.prisma.exam.findMany();
    const examHalls = await this.prisma.examHall.findMany();
    const examSchedules = await this.prisma.examSchedule.findMany();
    const refreshTokens = await this.prisma.refreshToken.findMany();
    const courseLecturers = await this.prisma.courseLecturer.findMany();
    const registrationPeriods = await this.prisma.registrationPeriod.findMany();
    const examMarks = await this.prisma.examMark.findMany();
    const studentCourseGrades = await this.prisma.studentCourseGrade.findMany();
    const studentSemesterGpas = await this.prisma.studentSemesterGpa.findMany();
    const auditLogs = await this.prisma.auditLog.findMany();

    return {
      backupVersion: '1.0',
      timestamp: new Date().toISOString(),
      databaseHealth: 'OK',
      tablesCount: 17,
      data: {
        roles,
        users,
        departments,
        students,
        lecturers,
        courses,
        courseRegistrations,
        exams,
        examHalls,
        examSchedules,
        refreshTokens,
        courseLecturers,
        registrationPeriods,
        examMarks,
        studentCourseGrades,
        studentSemesterGpas,
        auditLogs,
      },
    };
  }

  async getStats() {
    const totalUsers = await this.prisma.user.count();
    const totalStudents = await this.prisma.student.count();
    const totalLecturers = await this.prisma.lecturer.count();
    const totalLogs = await this.prisma.auditLog.count();
    return {
      totalUsers,
      totalStudents,
      totalLecturers,
      totalLogs,
      databaseStatus: 'ONLINE',
    };
  }
}
