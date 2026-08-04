import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AssistantService } from './assistant.service';
import { LlmProviderService } from './llm-provider.service';
import { FinancialToolsService } from './financial-tools.service';
import { FinancialInsightsService } from './financial-insights.service';
import { FraudDetectionModule } from './fraud-detection.module';
import { BudgetsService } from './budgets.service';
import { FxModule } from '../fx/fx.module';

@Module({
  imports: [FxModule, FraudDetectionModule],
  controllers: [AiController],
  providers: [AssistantService, LlmProviderService, FinancialToolsService, FinancialInsightsService, BudgetsService],
})
export class AiModule {}
