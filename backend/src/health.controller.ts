import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/decorators/public.decorator'; // adjust path

@Controller('health')
export class HealthController {

  @Public()
  @Get()
  check() {
    return {
      status: 'ok',
      service: 'globapay-api',
      timestamp: new Date().toISOString(),
    };
  }
}
