import { Module, OnModuleInit } from '@nestjs/common';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { KycService } from './kyc.service';
import { ScreeningService } from './screening.service';
import { KycController } from './kyc.controller';
import { KycAdminController } from './kyc-admin.controller';
import { AuditLogModule } from '../admin/audit-log.module';

@Module({
  imports: [AuditLogModule],
  controllers: [KycController, KycAdminController],
  providers: [KycService, ScreeningService],
  exports: [KycService],
})
export class KycModule implements OnModuleInit {
  onModuleInit() {
    // multer's diskStorage does not create its destination directory itself.
    mkdirSync(join(process.cwd(), 'uploads', 'kyc'), { recursive: true });
  }
}
