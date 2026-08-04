import { Injectable } from '@nestjs/common';

// Known public format specs for a handful of major brands (length and
// character set only — this can confirm a code is well-formed, not that
// it's genuine or has value on it). Anything not in this list falls back to
// a generic alphanumeric/length sanity check rather than being rejected
// outright, since new brands are added to the marketplace over time.
const FORMAT_RULES: Record<string, RegExp> = {
  AMAZON_USD: /^[A-Z0-9]{4}-?[A-Z0-9]{6}-?[A-Z0-9]{4}$/i,
  GOOGLE_PLAY: /^[A-Z0-9]{4}-?[A-Z0-9]{4}-?[A-Z0-9]{4}-?[A-Z0-9]{4}-?[A-Z0-9]{4}$/i,
  STEAM: /^[A-Z0-9]{5}-?[A-Z0-9]{5}-?[A-Z0-9]{5}$/i,
  APPLE: /^[A-Z0-9]{16}$/i,
  VISA: /^[A-Z0-9]{16,19}$/i,
  MASTERCARD: /^[A-Z0-9]{16,19}$/i,
};

const GENERIC_FALLBACK = /^[A-Z0-9-]{8,25}$/i;

@Injectable()
export class GiftCardFormatService {
  check(brandCode: string, code: string): { passed: boolean; reason: string } {
    const rule = FORMAT_RULES[brandCode.toUpperCase()];
    const pattern = rule ?? GENERIC_FALLBACK;
    const cleaned = code.trim();

    if (!pattern.test(cleaned)) {
      return {
        passed: false,
        reason: rule
          ? `Code doesn't match the expected ${brandCode} format`
          : 'Code doesn\'t look like a valid gift card code (unexpected length or characters)',
      };
    }

    return { passed: true, reason: 'Format check passed' };
  }
}
