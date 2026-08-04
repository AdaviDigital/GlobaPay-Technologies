import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { OrdersService } from './orders.service';
import { PlaceOrderDto } from './dto/place-order.dto';

@Controller('crypto/orders')
@RequirePermissions('crypto:trade')
@Throttle({ default: { limit: 15, ttl: 60_000 } }) // orders accept a PIN — see TransfersController
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  place(@CurrentUser() user: AuthenticatedUser, @Body() dto: PlaceOrderDto) {
    return this.ordersService.placeOrder(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.listForUser(user.id);
  }

  @Get('portfolio')
  portfolio(@CurrentUser() user: AuthenticatedUser) {
    return this.ordersService.getPortfolio(user.id);
  }

  @Delete(':id')
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ordersService.cancelOrder(user.id, id);
  }
}
