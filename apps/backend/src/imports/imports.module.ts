import { Module } from '@nestjs/common';
import { ImportsService } from './imports.service';
import { ImportsController } from './imports.controller';
import { XlsxParserService } from './xlsx-parser.service';

@Module({
  controllers: [ImportsController],
  providers: [ImportsService, XlsxParserService],
  exports: [ImportsService],
})
export class ImportsModule {}
