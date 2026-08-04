import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });

    if (!user) throw new NotFoundException('User not found');

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
      hasPinSet: Boolean(user.pinHash),
      emailVerified: Boolean(user.emailVerifiedAt),
      phoneVerified: Boolean(user.phoneVerifiedAt),
      roles: user.roles.map((ur) => ur.role.name),
      createdAt: user.createdAt,
    };
  }

  async updateProfile(userId: string, data: { firstName?: string; lastName?: string; country?: string }) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
    });
    return this.getProfile(user.id);
  }

  /** Admin-facing lookup — gated by the `user:read` permission at the controller. */
  async findById(userId: string) {
    return this.getProfile(userId);
  }

  async list(params: { skip?: number; take?: number }) {
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        skip: params.skip ?? 0,
        take: params.take ?? 25,
        orderBy: { createdAt: 'desc' },
        include: { roles: { include: { role: true } } },
      }),
      this.prisma.user.count(),
    ]);

    return {
      total,
      items: items.map((user) => ({
        id: user.id,
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status,
        kycTier: user.kycTier,
        roles: user.roles.map((ur) => ur.role.name),
        createdAt: user.createdAt,
      })),
    };
  }
}
