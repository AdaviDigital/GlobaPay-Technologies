import { Injectable } from '@nestjs/common';

// Deterministic, dependency-free categorization. Runs on every transfer at
// creation time so budget tracking and spending insights work even with no
// LLM provider configured. An LLM-based re-categorization pass could sit on
// top of this later for narrations these keywords miss — this stays as the
// reliable baseline either way.
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Transfers: ['transfer to', 'transfer from', 'wallet-to-wallet', 'p2p'],
  Bills: ['electricity', 'water bill', 'rent', 'utility', 'utilities'],
  Shopping: ['amazon', 'shop', 'store', 'mall', 'retail'],
  'Food & Dining': ['restaurant', 'food', 'grocery', 'cafe', 'coffee'],
  Transport: ['uber', 'bolt', 'taxi', 'fuel', 'transport', 'flight', 'airline'],
  Entertainment: ['netflix', 'spotify', 'cinema', 'game', 'subscription'],
  'Crypto & Trading': ['convert to', 'converted from', 'buy', 'sell', 'trading'],
  Business: ['invoice', 'checkout', 'merchant', 'payment link'],
};

@Injectable()
export class CategorizationService {
  categorize(description: string | null | undefined): string {
    if (!description) return 'Other';
    const normalized = description.toLowerCase();

    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      if (keywords.some((kw) => normalized.includes(kw))) {
        return category;
      }
    }
    return 'Other';
  }
}
