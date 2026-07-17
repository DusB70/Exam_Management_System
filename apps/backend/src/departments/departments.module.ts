import { Module } from '@nestjs/common';
import { DepartmentsController } from './departments.controller';
import { DegreesController } from './degrees.controller';
import { SpecializationsController } from './specializations.controller';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [DepartmentsController, DegreesController, SpecializationsController],
})
export class DepartmentsModule {}
