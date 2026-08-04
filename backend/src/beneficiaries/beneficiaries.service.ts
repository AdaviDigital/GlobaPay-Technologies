import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BeneficiaryType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBeneficiaryDto, UpdateBeneficiaryDto } from './dto/beneficiary.dto';

@Injectable()
export class BeneficiariesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateBeneficiaryDto) {
    let beneficiaryUserId: string | undefined;

    if (dto.type === BeneficiaryType.GLOBAPAY_USER) {
      if (!dto.beneficiaryTag) {
        throw new BadRequestException('An email or phone number is required to add a GlobaPay user');
      }
      const target = await this.prisma.user.findFirst({
        where: { OR: [{ email: dto.beneficiaryTag }, { phone: dto.beneficiaryTag }] },
      });
      if (!target) {
        throw new NotFoundException('No GlobaPay user found with that email or phone number');
      }
      if (target.id === userId) {
        throw new BadRequestException('You cannot add yourself as a beneficiary');
      }
      beneficiaryUserId = target.id;
    }

    return this.prisma.beneficiary.create({
      data: {
        userId,
        type: dto.type,
        label: dto.label,
        isFavorite: dto.isFavorite ?? false,
        beneficiaryUserId,
        beneficiaryTag: dto.beneficiaryTag,
        bankName: dto.bankName,
        accountNumber: dto.accountNumber,
        accountName: dto.accountName,
        bankCountry: dto.bankCountry,
        currencyCode: dto.currencyCode,
        swiftBic: dto.swiftBic,
        routingNumber: dto.routingNumber,
        iban: dto.iban,
        sortCode: dto.sortCode,
      },
    });
  }

  async list(userId: string) {
    return this.prisma.beneficiary.findMany({
      where: { userId },
      orderBy: [{ isFavorite: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getOwned(userId: string, id: string) {
    const beneficiary = await this.prisma.beneficiary.findUnique({ where: { id } });
    if (!beneficiary) throw new NotFoundException('Beneficiary not found');
    if (beneficiary.userId !== userId) throw new ForbiddenException('This beneficiary does not belong to you');
    return beneficiary;
  }

  async update(userId: string, id: string, dto: UpdateBeneficiaryDto) {
    await this.getOwned(userId, id);
    return this.prisma.beneficiary.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string) {
    await this.getOwned(userId, id);
    await this.prisma.beneficiary.delete({ where: { id } });
    return { deleted: true };
  }
}
