import { Module } from '@nestjs/common';
import { P2pService } from './p2p.service';
import { P2pController } from './p2p.controller';
import { P2pAdminController } from './p2p-admin.controller';
import { P2pSchedulerService } from './p2p-scheduler.service';
import { WalletsModule } from '../wallets/wallets.module';
import { AuthModule } from '../auth/auth.module';
import { GiftCardsModule } from '../giftcards/giftcards.module';
import { AuditLogModule } from '../admin/audit-log.module';

@Module({
  imports: [WalletsModule, AuthModule, GiftCardsModule, AuditLogModule],
  controllers: [P2pController, P2pAdminController],
  providers: [P2pService, P2pSchedulerService],
  exports: [P2pService],
})
export class P2pModule {}
