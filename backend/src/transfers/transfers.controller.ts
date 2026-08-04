import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { TransfersService } from './transfers.service';
import { WalletToWalletDto } from './dto/wallet-to-wallet.dto';
import { CurrencyConversionDto } from './dto/currency-conversion.dto';
import { BankTransferDto } from './dto/bank-transfer.dto';

@Controller('transfers')
@RequirePermissions('transfer:create')
// A wrong 4-digit PIN is a much smaller keyspace than a password — cap
// attempts across all money-movement endpoints in this controller tighter
// than the global default so brute-forcing it isn't practical.
@Throttle({ default: { limit: 15, ttl: 60_000 } })
export class TransfersController {
  constructor(private readonly transfersService: TransfersService) {}

  @Post('wallet-to-wallet')
  createWalletToWallet(@CurrentUser() user: AuthenticatedUser, @Body() dto: WalletToWalletDto) {
    return this.transfersService.createWalletToWallet(user.id, dto);
  }

  @Post('convert')
  createConversion(@CurrentUser() user: AuthenticatedUser, @Body() dto: CurrencyConversionDto) {
    return this.transfersService.createCurrencyConversion(user.id, dto);
  }

  @Post('bank')
  createBankTransfer(@CurrentUser() user: AuthenticatedUser, @Body() dto: BankTransferDto) {
    return this.transfersService.createBankTransfer(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.transfersService.listForUser(user.id);
  }

  @Get(':id')
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.transfersService.getOne(user.id, id);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.transfersService.cancelScheduled(user.id, id);
  }
}
