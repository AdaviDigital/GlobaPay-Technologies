import { Module } from '@nestjs/common';
import { AdminUsersController } from './admin-users.controller';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminPlatformController } from './admin-platform.controller';
import { AdminAuditController } from './admin-audit.controller';
import { UserManagementService } from './user-management.service';
import { AnalyticsService } from './analytics.service';
import { PlatformSettingsService } from './platform-settings.service';
import { AuditLogModule } from './audit-log.module';

@Module({
  imports: [AuditLogModule],
  controllers: [AdminUsersController, AdminAnalyticsController, AdminPlatformController, AdminAuditController],
  providers: [UserManagementService, AnalyticsService, PlatformSettingsService],
})
export class AdminModule {}
