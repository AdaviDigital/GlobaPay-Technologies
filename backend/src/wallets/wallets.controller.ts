import { Controller, Get, Param } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { WalletsService } from './wallets.service';

// JwtAuthGuard, RolesGuard, and PermissionsGuard are registered globally in
// AuthModule, so every route here is already authenticated — @RequirePermissions
// below is enough to add the RBAC check.
@Controller('wallets')
export class WalletsController {
  constructor(private readonly walletsService: WalletsService) {}

  @Get()
  @RequirePermissions('wallet:read')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.walletsService.listForUser(user.id);
  }

  @Get(':id')
  @RequirePermissions('wallet:read')
  getOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.walletsService.getOne(user.id, id);
  }

  @Get(':id/statement')
  @RequirePermissions('wallet:read')
  getStatement(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.walletsService.getStatement(user.id, id);
  }
}
