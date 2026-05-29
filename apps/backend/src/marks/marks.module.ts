import { Module } from '@nestjs/common';
import { MarksService } from './marks.service';
import { MarksController } from './marks.controller';
import { MarksPdfService } from './marks.pdf.service';

@Module({
  controllers: [MarksController],
  providers: [MarksService, MarksPdfService],
  exports: [MarksService, MarksPdfService],
})
export class MarksModule {}
