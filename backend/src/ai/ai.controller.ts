import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { AssistantService } from './assistant.service';
import { FinancialInsightsService } from './financial-insights.service';
import { FraudDetectionService } from './fraud-detection.service';
import { BudgetsService } from './budgets.service';
import { SendMessageDto } from './dto/send-message.dto';
import { UpsertBudgetDto } from './dto/upsert-budget.dto';

@Controller('ai')
@RequirePermissions('ai:use')
export class AiController {
  constructor(
    private readonly assistant: AssistantService,
    private readonly insights: FinancialInsightsService,
    private readonly fraudDetection: FraudDetectionService,
    private readonly budgets: BudgetsService,
  ) {}

  @Get('status')
  status() {
    return { configured: this.assistant.isConfigured() };
  }

  @Get('conversations')
  listConversations(@CurrentUser() user: AuthenticatedUser) {
    return this.assistant.listConversations(user.id);
  }

  @Get('conversations/:id')
  getConversation(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.assistant.getConversation(user.id, id);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('chat')
  chat(@CurrentUser() user: AuthenticatedUser, @Body() dto: SendMessageDto) {
    return this.assistant.sendMessage(user.id, dto.conversationId, dto.message);
  }

  @Get('insights/spending')
  spendingByCategory(@CurrentUser() user: AuthenticatedUser) {
    return this.insights.getSpendingByCategory(user.id);
  }

  @Get('insights/health-score')
  healthScore(@CurrentUser() user: AuthenticatedUser) {
    return this.insights.getFinancialHealthScore(user.id);
  }

  @Get('budgets')
  listBudgets(@CurrentUser() user: AuthenticatedUser) {
    return this.insights.getBudgetStatus(user.id);
  }

  @Post('budgets')
  upsertBudget(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpsertBudgetDto) {
    return this.budgets.upsert(user.id, dto);
  }

  @Delete('budgets/:id')
  removeBudget(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.budgets.remove(user.id, id);
  }

  @Get('fraud-alerts')
  listFraudAlerts(@CurrentUser() user: AuthenticatedUser) {
    return this.fraudDetection.listForUser(user.id);
  }

  @Post('fraud-alerts/:id/dismiss')
  dismissFraudAlert(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.fraudDetection.dismiss(user.id, id);
  }
}
