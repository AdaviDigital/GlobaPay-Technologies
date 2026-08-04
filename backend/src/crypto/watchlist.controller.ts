import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { WatchlistService } from './watchlist.service';
import { CreateAlertDto } from './dto/create-alert.dto';

@Controller('crypto')
@RequirePermissions('crypto:trade')
export class WatchlistController {
  constructor(private readonly watchlistService: WatchlistService) {}

  @Get('watchlist')
  listWatchlist(@CurrentUser() user: AuthenticatedUser) {
    return this.watchlistService.listWatchlist(user.id);
  }

  @Post('watchlist/:code')
  addToWatchlist(@CurrentUser() user: AuthenticatedUser, @Param('code') code: string) {
    return this.watchlistService.addToWatchlist(user.id, code);
  }

  @Delete('watchlist/:code')
  removeFromWatchlist(@CurrentUser() user: AuthenticatedUser, @Param('code') code: string) {
    return this.watchlistService.removeFromWatchlist(user.id, code);
  }

  @Get('alerts')
  listAlerts(@CurrentUser() user: AuthenticatedUser) {
    return this.watchlistService.listAlerts(user.id);
  }

  @Post('alerts')
  createAlert(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAlertDto) {
    return this.watchlistService.createAlert(user.id, dto);
  }

  @Delete('alerts/:id')
  deleteAlert(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.watchlistService.deleteAlert(user.id, id);
  }
}
