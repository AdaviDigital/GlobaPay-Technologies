import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UserManagementService } from './user-management.service';
import { UpdateUserStatusDto } from './dto/admin.dto';

@Controller('admin/users')
@RequirePermissions('admin:platform')
export class AdminUsersController {
  constructor(private readonly userManagement: UserManagementService) {}

  @Get()
  search(@Query('q') query?: string, @Query('status') status?: string, @Query('skip') skip?: string, @Query('take') take?: string) {
    return this.userManagement.search({
      query,
      status,
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
    });
  }

  @Get(':id')
  getDetail(@Param('id') id: string) {
    return this.userManagement.getDetail(id);
  }

  @Patch(':id/status')
  updateStatus(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateUserStatusDto) {
    return this.userManagement.updateStatus(admin.id, id, dto);
  }
}
