import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { FxService } from './fx.service';

@Controller('fx')
export class FxController {
  constructor(private readonly fx: FxService) {}

  @Public()
  @Get('rates')
  listRates() {
    return this.fx.listRates();
  }

  @Public()
  @Get('quote')
  async quote(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('amount') amount = '1',
  ) {
    const { rate, convertedAmount } = await this.fx.convert(amount, from, to);
    return { from, to, amount, rate, convertedAmount };
  }
}
