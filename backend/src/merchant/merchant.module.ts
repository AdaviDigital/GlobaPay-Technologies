import { Module } from '@nestjs/common';
import { MerchantService } from './merchant.service';
import { MerchantController } from './merchant.controller';
import { CheckoutController } from './checkout.controller';
import { WalletsModule } from '../wallets/wallets.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [WalletsModule, AuthModule],
  controllers: [MerchantController, CheckoutController],
  providers: [MerchantService],
  exports: [MerchantService],
})
export class MerchantModule {}
