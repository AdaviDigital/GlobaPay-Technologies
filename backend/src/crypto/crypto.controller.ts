import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CryptoPricesService } from './crypto-prices.service';
import { DepositAddressService } from './deposit-address.service';

@Controller('crypto')
export class CryptoController {
  constructor(
    private readonly prices: CryptoPricesService,
    private readonly depositAddresses: DepositAddressService,
  ) {}

  @Public()
  @Get('prices')
  listPrices(@Query('quote') quote?: string) {
    return this.prices.listPrices(quote);
  }

  @Public()
  @Get('prices/:code')
  getPrice(@Param('code') code: string, @Query('quote') quote?: string) {
    return this.prices.getPrice(code, quote);
  }

  @Get('deposit-address/:code')
  @RequirePermissions('crypto:trade')
  getDepositAddress(@CurrentUser() user: AuthenticatedUser, @Param('code') code: string) {
    return this.depositAddresses.getOrCreate(user.id, code);
  }
}
