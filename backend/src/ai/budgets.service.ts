import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertBudgetDto } from './dto/upsert-budget.dto';

@Injectable()
export class BudgetsService {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(userId: string, dto: UpsertBudgetDto) {
    return this.prisma.budget.upsert({
      where: { userId_category_currencyCode: { userId, category: dto.category, currencyCode: dto.currencyCode } },
      update: { monthlyLimit: new Prisma.Decimal(dto.monthlyLimit) },
      create: { userId, category: dto.category, currencyCode: dto.currencyCode, monthlyLimit: new Prisma.Decimal(dto.monthlyLimit) },
    });
  }

  async list(userId: string) {
    return this.prisma.budget.findMany({ where: { userId }, orderBy: { category: 'asc' } });
  }

  async remove(userId: string, budgetId: string) {
    const budget = await this.prisma.budget.findUnique({ where: { id: budgetId } });
    if (!budget) throw new NotFoundException('Budget not found');
    if (budget.userId !== userId) throw new ForbiddenException('This budget does not belong to you');
    await this.prisma.budget.delete({ where: { id: budgetId } });
    return { deleted: true };
  }
}
