import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { DepartmentsModule } from './departments/departments.module';
import { CoursesModule } from './courses/courses.module';
import { RegistrationsModule } from './registrations/registrations.module';
import { MarksModule } from './marks/marks.module';
import { ImportsModule } from './imports/imports.module';
import { ResultsModule } from './results/results.module';
import { ReportsModule } from './reports/reports.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ExamsModule } from './exams/exams.module';
import { SystemModule } from './system/system.module';
import { RequestsModule } from './requests/requests.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env.local', '.env'],
    }),
    PrismaModule,
    UsersModule,
    AuthModule,
    AuditModule,
    DepartmentsModule,
    CoursesModule,
    RegistrationsModule,
    MarksModule,
    ImportsModule,
    ResultsModule,
    ReportsModule,
    NotificationsModule,
    ExamsModule,
    SystemModule,
    RequestsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
