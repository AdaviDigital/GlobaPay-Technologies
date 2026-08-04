import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  /** Fire-and-forget by design — an audit-log write failure should never break the action it's recording. */
  async record(params: {
    userId?: string;
    action: string;
    entity?: string;
    entityId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Prisma.InputJsonValue;
  }): Promise<void> {
    await this.prisma.auditLog
      .create({
        data: {
          userId: params.userId,
          action: params.action,
          entity: params.entity,
          entityId: params.entityId,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          metadata: params.metadata,
        },
      })
      .catch(() => undefined);
  }

  async search(params: { userId?: string; action?: string; skip?: number; take?: number }) {
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { userId: params.userId, action: params.action ? { contains: params.action } : undefined },
        orderBy: { createdAt: 'desc' },
        skip: params.skip ?? 0,
        take: Math.min(params.take ?? 50, 200),
      }),
      this.prisma.auditLog.count({
        where: { userId: params.userId, action: params.action ? { contains: params.action } : undefined },
      }),
    ]);
    return { items, total };
  }
}
