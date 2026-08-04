import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/decorators/public.decorator';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { MerchantService } from './merchant.service';
import { PayCheckoutDto } from './dto/pay-checkout.dto';

@Controller('checkout')
export class CheckoutController {
  constructor(private readonly merchantService: MerchantService) {}

  @Public()
  @Get('pay/:slug')
  getPaymentLink(@Param('slug') slug: string) {
    return this.merchantService.getPublicPaymentLink(slug);
  }

  @Public()
  @Get('invoice/:reference')
  getInvoice(@Param('reference') reference: string) {
    return this.merchantService.getPublicInvoice(reference);
  }

  @Public()
  @Post('pay/:slug/session')
  createSessionFromLink(@Param('slug') slug: string) {
    return this.merchantService.createCheckoutSession({ paymentLinkSlug: slug });
  }

  @Public()
  @Post('invoice/:reference/session')
  createSessionFromInvoice(@Param('reference') reference: string) {
    return this.merchantService.createCheckoutSession({ invoiceReference: reference });
  }

  @Public()
  @Get('sessions/:reference')
  getSession(@Param('reference') reference: string) {
    return this.merchantService.getCheckoutSession(reference);
  }

  // Paying requires an authenticated GlobaPay user — reuses transfer:create
  // since a checkout payment is, functionally, an outbound payment.
  @RequirePermissions('transfer:create')
  @Throttle({ default: { limit: 15, ttl: 60_000 } }) // PIN-protected — see TransfersController
  @Post('sessions/:reference/pay')
  pay(@CurrentUser() user: AuthenticatedUser, @Param('reference') reference: string, @Body() dto: PayCheckoutDto) {
    return this.merchantService.payCheckoutSession(user.id, reference, dto);
  }
}
