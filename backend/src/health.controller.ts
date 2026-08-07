import {
  Controller,
  Get,
  Version,
  VERSION_NEUTRAL,
} from '@nestjs/common';

import { Public } from './auth/decorators/public.decorator';

@Controller('health')
export class HealthController {

  @Public()
  @Version(VERSION_NEUTRAL)
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'globapay-api',
      timestamp: new Date().toISOString(),
    };
  }
}