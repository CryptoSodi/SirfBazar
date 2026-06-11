import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditInput {
  userId?: string;
  role?: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');

  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditInput) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: input.userId ?? null,
          role: input.role ?? null,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId ?? null,
          oldValue: input.oldValue != null ? JSON.stringify(input.oldValue) : null,
          newValue: input.newValue != null ? JSON.stringify(input.newValue) : null,
          ipAddress: input.ipAddress ?? null,
        },
      });
    } catch (err) {
      this.logger.warn(`Audit write failed for ${input.action}: ${err}`);
    }
  }
}
