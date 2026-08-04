import { ToolDefinition } from '../llm-provider.service';

export const FINANCIAL_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'get_wallet_balances',
      description: "Get the user's current balance in every wallet (fiat and crypto).",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_recent_transactions',
      description: "Get the user's recent transfers, optionally filtered by category.",
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max results, default 10, max 50' },
          category: { type: 'string', description: 'Filter to one category, e.g. "Food & Dining"' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_spending_by_category',
      description: 'Get total spending grouped by category over a recent window.',
      parameters: {
        type: 'object',
        properties: { days: { type: 'number', description: 'Lookback window in days, default 30' } },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_financial_health_score',
      description: "Get the user's financial health score (0-100) with the factors behind it.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_budget_status',
      description: "Get the user's budgets and how much of each has been spent this month.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_crypto_portfolio',
      description: "Get the user's crypto holdings and their value in USDT.",
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
];
