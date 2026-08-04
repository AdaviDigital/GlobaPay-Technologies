import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from './audit-log.service';
import { UpdateUserStatusDto } from './dto/admin.dto';

@Injectable()
export class UserManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  async search(params: { query?: string; status?: string; skip?: number; take?: number }) {
    const where = {
      status: params.status as never,
      OR: params.query
        ? [
            { email: { contains: params.query, mode: 'insensitive' as const } },
            { phone: { contains: params.query } },
            { firstName: { contains: params.query, mode: 'insensitive' as const } },
            { lastName: { contains: params.query, mode: 'insensitive' as const } },
          ]
        : undefined,
    };

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: params.skip ?? 0,
        take: Math.min(params.take ?? 25, 100),
        orderBy: { createdAt: 'desc' },
        include: { roles: { include: { role: true } } },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      total,
      items: items.map((u) => ({
        id: u.id,
        email: u.email,
        phone: u.phone,
        firstName: u.firstName,
        lastName: u.lastName,
        status: u.status,
        kycTier: u.kycTier,
        roles: u.roles.map((ur) => ur.role.name),
        createdAt: u.createdAt,
      })),
    };
  }

  async getDetail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: { include: { role: true } },
        wallets: { include: { currency: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const [transferCount, statusHistory] = await Promise.all([
      this.prisma.transfer.count({ where: { userId } }),
      this.prisma.userStatusChange.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20 }),
    ]);

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      kycTier: user.kycTier,
      country: user.country,
      twoFactorEnabled: user.twoFactorEnabled,
      roles: user.roles.map((ur) => ur.role.name),
      wallets: user.wallets.map((w) => ({ currency: w.currency.code, balance: w.balance.toString() })),
      transferCount,
      statusHistory,
      createdAt: user.createdAt,
    };
  }

  async updateStatus(adminId: string, userId: string, dto: UpdateUserStatusDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.status === dto.status) {
      throw new BadRequestException(`User is already ${dto.status}`);
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { status: dto.status } }),
      this.prisma.userStatusChange.create({
        data: { userId, fromStatus: user.status, toStatus: dto.status, reason: dto.reason, changedById: adminId },
      }),
    ]);

    this.auditLog.record({
      userId: adminId,
      action: 'admin.user_status_changed',
      entity: 'User',
      entityId: userId,
      metadata: { from: user.status, to: dto.status, reason: dto.reason },
    });

    return updated;
  }
}
