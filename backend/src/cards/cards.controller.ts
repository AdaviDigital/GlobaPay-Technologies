import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { CardsService } from './cards.service';
import { IssueCardDto, SetCardLimitDto, SimulatePurchaseDto } from './dto/card.dto';

@Controller('cards')
@RequirePermissions('card:manage')
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  @Post()
  issue(@CurrentUser() user: AuthenticatedUser, @Body() dto: IssueCardDto) {
    return this.cardsService.issueCard(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.cardsService.listForUser(user.id);
  }

  @Get(':id/statement')
  statement(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.cardsService.getStatement(user.id, id);
  }

  @Patch(':id/freeze')
  freeze(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.cardsService.freeze(user.id, id);
  }

  @Patch(':id/unfreeze')
  unfreeze(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.cardsService.unfreeze(user.id, id);
  }

  @Delete(':id')
  terminate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.cardsService.terminate(user.id, id);
  }

  @Patch(':id/limit')
  setLimit(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: SetCardLimitDto) {
    return this.cardsService.setLimit(user.id, id, dto);
  }

  @Delete(':id/limit')
  clearLimit(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.cardsService.clearLimit(user.id, id);
  }

  @Post(':id/simulate-purchase')
  simulatePurchase(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: SimulatePurchaseDto) {
    return this.cardsService.simulatePurchase(user.id, id, dto);
  }
}
