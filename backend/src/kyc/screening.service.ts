import { Injectable } from '@nestjs/common';

export interface ScreeningResult {
  riskScore: number; // 0-100, higher = riskier
  amlFlag: boolean;
  sanctionsFlag: boolean;
  pepFlag: boolean;
  notes: string;
}

// Toy keyword lists standing in for a real sanctions/PEP data feed. A name
// containing one of these substrings (case-insensitive) trips the matching
// flag — this is a demo fixture, not a fragment of any real watchlist.
const MOCK_SANCTIONS_KEYWORDS = ['sanctioned', 'blockedco', 'testsanction'];
const MOCK_PEP_KEYWORDS = ['minister', 'senator', 'governor', 'testpep'];

@Injectable()
export class ScreeningService {
  /**
   * ⚠️ MOCK SCREENING ONLY. This does a keyword match against a hardcoded
   * list, not a lookup against OFAC, UN, or any licensed sanctions/PEP
   * database. It exists so the KYC review queue and risk-score field have
   * something realistic to work with in this build. Before handling real
   * users, replace this method's internals with a call to a licensed
   * provider (e.g. ComplyAdvantage, Refinitiv World-Check, Dow Jones Risk &
   * Compliance) — the KycSubmission/review flow around it doesn't need to
   * change.
   */
  screenIndividual(fullName: string, country?: string | null): ScreeningResult {
    const normalized = fullName.toLowerCase();

    const sanctionsFlag = MOCK_SANCTIONS_KEYWORDS.some((kw) => normalized.includes(kw));
    const pepFlag = MOCK_PEP_KEYWORDS.some((kw) => normalized.includes(kw));
    const amlFlag = sanctionsFlag; // in this mock, a sanctions hit doubles as an AML flag

    let riskScore = 10; // baseline
    if (sanctionsFlag) riskScore += 60;
    if (pepFlag) riskScore += 25;
    if (!country) riskScore += 5; // missing country is a minor risk signal in this toy model

    riskScore = Math.min(riskScore, 100);

    const notes = [
      sanctionsFlag ? 'Name matched a mock sanctions keyword.' : null,
      pepFlag ? 'Name matched a mock PEP keyword.' : null,
      !sanctionsFlag && !pepFlag ? 'No mock watchlist matches found.' : null,
    ]
      .filter(Boolean)
      .join(' ');

    return { riskScore, amlFlag, sanctionsFlag, pepFlag, notes };
  }

  screenBusiness(businessName: string, country?: string | null): ScreeningResult {
    // Same toy logic, applied to the business name instead of an individual's.
    return this.screenIndividual(businessName, country);
  }
}
