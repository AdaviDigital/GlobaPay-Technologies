import { Module } from '@nestjs/common';
import { CryptoPricesService } from './crypto-prices.service';
import { CryptoController } from './crypto.controller';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OrdersSchedulerService } from './orders-scheduler.service';
import { WatchlistService } from './watchlist.service';
import { WatchlistController } from './watchlist.controller';
import { DepositAddressService } from './deposit-address.service';
import { WalletsModule } from '../wallets/wallets.module';
import { FxModule } from '../fx/fx.module';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [WalletsModule, FxModule, AuthModule, MailModule],
  controllers: [CryptoController, OrdersController, WatchlistController],
  providers: [CryptoPricesService, OrdersService, OrdersSchedulerService, WatchlistService, DepositAddressService],
  exports: [CryptoPricesService, OrdersService],
})
export class CryptoModule {}
