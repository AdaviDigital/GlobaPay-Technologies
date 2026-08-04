import { Injectable } from '@nestjs/common';
import { AiRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LlmProviderService, ChatMessage } from './llm-provider.service';
import { FinancialToolsService } from './financial-tools.service';
import { FINANCIAL_TOOLS } from './tools/financial-tools.definitions';

const SYSTEM_PROMPT = `You are GlobaPay's financial assistant. You help the user understand their own
spending, balances, and financial health using the tools available to you — always call a tool
rather than guessing at numbers. Keep answers concise and concrete. You cannot move money, change
settings, or take any action on the user's behalf — if asked to do something like that, explain
that you can only provide information and point them to the relevant page in the app. Never invent
transaction data; if a tool returns nothing, say so.`;

const MAX_TOOL_ROUNDS = 4;

@Injectable()
export class AssistantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmProviderService,
    private readonly tools: FinancialToolsService,
  ) {}

  isConfigured(): boolean {
    return this.llm.isConfigured();
  }

  async listConversations(userId: string) {
    return this.prisma.aiConversation.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, updatedAt: true },
    });
  }

  async getConversation(userId: string, conversationId: string) {
    const conversation = await this.prisma.aiConversation.findFirst({
      where: { id: conversationId, userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    return conversation;
  }

  async sendMessage(userId: string, conversationId: string | undefined, userMessage: string) {
    const conversation = conversationId
      ? await this.prisma.aiConversation.findFirstOrThrow({ where: { id: conversationId, userId } })
      : await this.prisma.aiConversation.create({
          data: { userId, title: userMessage.slice(0, 60) },
        });

    await this.prisma.aiMessage.create({
      data: { conversationId: conversation.id, role: AiRole.USER, content: userMessage },
    });

    const history = await this.prisma.aiMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
      take: 30, // keep the context window bounded
    });

    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.map((m): ChatMessage => {
        if (m.role === AiRole.USER) return { role: 'user', content: m.content };
        if (m.role === AiRole.ASSISTANT) return { role: 'assistant', content: m.content };
        return { role: 'system', content: m.content };
      }),
    ];

    const assistantText = await this.runToolLoop(userId, messages);

    const saved = await this.prisma.aiMessage.create({
      data: { conversationId: conversation.id, role: AiRole.ASSISTANT, content: assistantText },
    });
    await this.prisma.aiConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });

    return { conversationId: conversation.id, message: saved };
  }

  private async runToolLoop(userId: string, messages: ChatMessage[]): Promise<string> {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await this.llm.chat(messages, FINANCIAL_TOOLS);

      if (!response.tool_calls || response.tool_calls.length === 0) {
        return response.content ?? '';
      }

      messages.push({ role: 'assistant', content: response.content, tool_calls: response.tool_calls });

      for (const call of response.tool_calls) {
        const args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
        const result = await this.executeTool(userId, call.function.name, args);
        messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
      }
    }

    return "I wasn't able to finish looking that up — try asking again, or a more specific question.";
  }

  private async executeTool(userId: string, name: string, args: Record<string, unknown>) {
    switch (name) {
      case 'get_wallet_balances':
        return this.tools.getWalletBalances(userId);
      case 'get_recent_transactions':
        return this.tools.getRecentTransactions(userId, args as { limit?: number; category?: string });
      case 'get_spending_by_category':
        return this.tools.getSpendingByCategory(userId, args.days as number | undefined);
      case 'get_financial_health_score':
        return this.tools.getFinancialHealthScore(userId);
      case 'get_budget_status':
        return this.tools.getBudgetStatus(userId);
      case 'get_crypto_portfolio':
        return this.tools.getCryptoPortfolio(userId);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  }
}
