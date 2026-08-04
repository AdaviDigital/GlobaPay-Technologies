import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { PlatformSettingsService } from './platform-settings.service';
import { UpdateExchangeRateDto, UpsertFeatureFlagDto } from './dto/admin.dto';

@Controller('admin/platform')
@RequirePermissions('admin:platform')
export class AdminPlatformController {
  constructor(private readonly settings: PlatformSettingsService) {}

  @Get('feature-flags')
  listFlags() {
    return this.settings.listFeatureFlags();
  }

  @Post('feature-flags')
  upsertFlag(@Body() dto: UpsertFeatureFlagDto) {
    return this.settings.upsertFeatureFlag(dto);
  }

  @Get('fee-rules')
  listFeeRules() {
    return this.settings.listFeeRules();
  }

  @Patch('fee-rules/:id')
  updateFeeRule(@Param('id') id: string, @Body() data: { percentageFee?: string; flatFee?: string; minFee?: string; maxFee?: string }) {
    return this.settings.updateFeeRule(id, data);
  }

  @Patch('fee-rules/:id/active')
  setFeeRuleActive(@Param('id') id: string, @Body('isActive') isActive: boolean) {
    return this.settings.setFeeRuleActive(id, isActive);
  }

  @Get('exchange-rates')
  listRates() {
    return this.settings.listExchangeRates();
  }

  @Post('exchange-rates')
  setRate(@Body() dto: UpdateExchangeRateDto) {
    return this.settings.setExchangeRate(dto);
  }
}
