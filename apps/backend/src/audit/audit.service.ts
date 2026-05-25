import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async logAction(
    userId: number | null,
    action: string,
    entityName: string,
    entityId: string,
    oldValues: any = null,
    newValues: any = null,
    ipAddress?: string,
    userAgent?: string,
  ) {
    return this.prisma.auditLog.create({
      data: {
        user_id: userId,
        action,
        entity_name: entityName,
        entity_id: entityId,
        old_values: oldValues || undefined,
        new_values: newValues || undefined,
        ip_address: ipAddress || undefined,
        user_agent: userAgent || undefined,
      },
    });
  }
}
