import { Controller, Get, Query } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { AnalyticsService } from './analytics.service';

@Controller('admin/analytics')
@RequirePermissions('admin:platform')
export class AdminAnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('summary')
  summary() {
    return this.analytics.getPlatformSummary();
  }

  @Get('user-growth')
  userGrowth(@Query('days') days?: string) {
    return this.analytics.getUserGrowth(days ? parseInt(days, 10) : undefined);
  }
}
