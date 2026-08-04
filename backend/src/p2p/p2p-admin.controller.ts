import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { P2pService } from './p2p.service';
import { ResolveDisputeDto } from './dto/dispute.dto';
import { PrismaService } from '../prisma/prisma.service';

@Controller('compliance/p2p')
@RequirePermissions('escrow:manage')
export class P2pAdminController {
  constructor(
    private readonly p2pService: P2pService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('disputes')
  listDisputes() {
    return this.p2pService.listDisputes();
  }

  @Patch('disputes/:id/resolve')
  resolve(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string, @Body() dto: ResolveDisputeDto) {
    return this.p2pService.resolveDispute(admin.id, id, dto);
  }

  @Get('gift-card-validations')
  listFlaggedValidations() {
    return this.prisma.giftCardValidation.findMany({
      where: { status: { in: ['FLAGGED', 'REJECTED'] } },
      include: { order: { include: { buyer: { select: { firstName: true, lastName: true } }, seller: { select: { firstName: true, lastName: true } } } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
