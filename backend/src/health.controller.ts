import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/decorators/public.decorator';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    console.log('✅ Health endpoint was called');

    return {
      status: 'ok',
      service: 'globapay-api',
      timestamp: new Date().toISOString(),
    };
  }
}
