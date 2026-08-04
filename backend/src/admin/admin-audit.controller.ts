import { Controller, Get, Query } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { AuditLogService } from './audit-log.service';

@Controller('admin/audit-log')
@RequirePermissions('admin:platform')
export class AdminAuditController {
  constructor(private readonly auditLog: AuditLogService) {}

  @Get()
  search(@Query('userId') userId?: string, @Query('action') action?: string, @Query('skip') skip?: string, @Query('take') take?: string) {
    return this.auditLog.search({
      userId,
      action,
      skip: skip ? parseInt(skip, 10) : undefined,
      take: take ? parseInt(take, 10) : undefined,
    });
  }
}
