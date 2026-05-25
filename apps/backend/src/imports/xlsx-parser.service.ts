import { Injectable, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';

@Injectable()
export class XlsxParserService {
  parseBuffer<T>(buffer: Buffer): T[] {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      if (workbook.SheetNames.length === 0) {
        throw new BadRequestException('The uploaded spreadsheet contains no worksheets.');
      }
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      return XLSX.utils.sheet_to_json<T>(worksheet, { defval: '' });
    } catch (err: any) {
      throw new BadRequestException(`Failed to parse spreadsheet file: ${err.message}`);
    }
  }
}
