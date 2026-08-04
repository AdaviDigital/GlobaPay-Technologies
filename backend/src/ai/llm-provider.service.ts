import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export type ChatMessage = OpenAI.Chat.Completions.ChatCompletionMessageParam;

/**
 * Thin wrapper around the OpenAI SDK. This is the one place a different
 * provider (Anthropic, a local model via an OpenAI-compatible endpoint,
 * etc.) would be swapped in — AssistantService only calls this interface,
 * never the SDK directly.
 *
 * Requires OPENAI_API_KEY. Without it, every method throws a clear 503
 * rather than returning a canned/fake response — an AI assistant that
 * silently pretends to work when it isn't configured is worse than one
 * that visibly isn't there.
 */
@Injectable()
export class LlmProviderService {
  private readonly logger = new Logger(LlmProviderService.name);
  private readonly client: OpenAI | null;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('ai.openaiApiKey');
    this.model = this.config.get<string>('ai.model') ?? 'gpt-4o-mini';
    this.client = apiKey ? new OpenAI({ apiKey }) : null;

    if (!this.client) {
      this.logger.warn('OPENAI_API_KEY is not set — the AI assistant endpoints will return 503 until it is configured.');
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  private requireClient(): OpenAI {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'The AI assistant is not configured on this deployment. Set OPENAI_API_KEY to enable it.',
      );
    }
    return this.client;
  }

  async chat(messages: ChatMessage[], tools?: ToolDefinition[]): Promise<OpenAI.Chat.Completions.ChatCompletionMessage> {
    const client = this.requireClient();
    const completion = await client.chat.completions.create({
      model: this.model,
      messages,
      tools,
      tool_choice: tools ? 'auto' : undefined,
      temperature: 0.3,
    });
    return completion.choices[0].message;
  }
}
