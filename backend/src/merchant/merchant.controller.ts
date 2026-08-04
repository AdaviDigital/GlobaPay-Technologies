import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { MerchantService } from './merchant.service';
import { CreateInvoiceDto, CreateMerchantAccountDto, CreatePaymentLinkDto } from './dto/merchant.dto';

@Controller('merchant')
@RequirePermissions('merchant:manage')
export class MerchantController {
  constructor(private readonly merchantService: MerchantService) {}

  @Post('account')
  createAccount(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateMerchantAccountDto) {
    return this.merchantService.createAccount(user.id, dto);
  }

  @Get('account')
  getAccount(@CurrentUser() user: AuthenticatedUser) {
    return this.merchantService.getMyAccount(user.id);
  }

  @Get('dashboard')
  getDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.merchantService.getDashboardSummary(user.id);
  }

  @Post('payment-links')
  createPaymentLink(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePaymentLinkDto) {
    return this.merchantService.createPaymentLink(user.id, dto);
  }

  @Get('payment-links')
  listPaymentLinks(@CurrentUser() user: AuthenticatedUser) {
    return this.merchantService.listPaymentLinks(user.id);
  }

  @Patch('payment-links/:id/deactivate')
  deactivatePaymentLink(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.merchantService.deactivatePaymentLink(user.id, id);
  }

  @Post('invoices')
  createInvoice(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateInvoiceDto) {
    return this.merchantService.createInvoice(user.id, dto);
  }

  @Get('invoices')
  listInvoices(@CurrentUser() user: AuthenticatedUser) {
    return this.merchantService.listInvoices(user.id);
  }

  @Delete('invoices/:id')
  voidInvoice(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.merchantService.voidInvoice(user.id, id);
  }

  @Get('webhook-deliveries')
  listWebhookDeliveries(@CurrentUser() user: AuthenticatedUser) {
    return this.merchantService.listWebhookDeliveries(user.id);
  }
}
