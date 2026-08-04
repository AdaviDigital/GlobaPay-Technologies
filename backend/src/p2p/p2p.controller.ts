import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { P2PAssetType, P2POfferStatus } from '@prisma/client';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { P2pService } from './p2p.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import { DeliverCodeDto } from './dto/deliver-code.dto';
import { RaiseDisputeDto } from './dto/dispute.dto';
import { CreateReviewDto } from './dto/create-review.dto';

@Controller('p2p')
@RequirePermissions('p2p:trade')
@Throttle({ default: { limit: 15, ttl: 60_000 } }) // orders accept a PIN — see TransfersController
export class P2pController {
  constructor(private readonly p2pService: P2pService) {}

  @Post('offers')
  createOffer(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateOfferDto) {
    return this.p2pService.createOffer(user.id, dto);
  }

  @Get('offers')
  listOffers(@Query('assetType') assetType?: P2PAssetType, @Query('assetCode') assetCode?: string) {
    return this.p2pService.listOffers({ assetType, assetCode });
  }

  @Get('offers/mine')
  listMyOffers(@CurrentUser() user: AuthenticatedUser) {
    return this.p2pService.listMyOffers(user.id);
  }

  @Patch('offers/:id/pause')
  pauseOffer(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.p2pService.setOfferStatus(user.id, id, P2POfferStatus.PAUSED);
  }

  @Patch('offers/:id/resume')
  resumeOffer(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.p2pService.setOfferStatus(user.id, id, P2POfferStatus.ACTIVE);
  }

  @Patch('offers/:id/close')
  closeOffer(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.p2pService.setOfferStatus(user.id, id, P2POfferStatus.CLOSED);
  }

  @Post('offers/:id/orders')
  createOrder(@CurrentUser() user: AuthenticatedUser, @Param('id') offerId: string, @Body() dto: CreateOrderDto) {
    return this.p2pService.createOrder(user.id, offerId, dto);
  }

  @Get('orders')
  listOrders(@CurrentUser() user: AuthenticatedUser) {
    return this.p2pService.listOrdersForUser(user.id);
  }

  @Get('orders/:id')
  getOrder(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.p2pService.getOwnedOrder(user.id, id);
  }

  @Post('orders/:id/deliver')
  deliver(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: DeliverCodeDto) {
    return this.p2pService.deliverGiftCardCode(user.id, id, dto.code);
  }

  @Get('orders/:id/code')
  getCode(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.p2pService.getGiftCardCode(user.id, id);
  }

  @Get('orders/:id/validation')
  getValidation(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.p2pService.getGiftCardValidation(user.id, id);
  }

  @Post('orders/:id/confirm')
  confirm(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.p2pService.confirmDelivery(user.id, id);
  }

  @Post('orders/:id/dispute')
  dispute(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: RaiseDisputeDto) {
    return this.p2pService.raiseDispute(user.id, id, dto.reason);
  }

  @Post('orders/:id/review')
  review(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CreateReviewDto) {
    return this.p2pService.createReview(user.id, id, dto);
  }

  @Get('reputation/:userId')
  reputation(@Param('userId') userId: string) {
    return this.p2pService.getReputation(userId);
  }
}
