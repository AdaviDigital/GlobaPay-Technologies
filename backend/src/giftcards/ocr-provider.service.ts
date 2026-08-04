import { Injectable } from '@nestjs/common';

export interface OcrResult {
  extractedText: string;
  confidence: number;
}

/**
 * ⚠️ MOCK OCR ONLY. Real gift-card image validation needs a real vision/OCR
 * provider (e.g. AWS Textract, Google Cloud Vision, Azure Document
 * Intelligence) to actually read the card's printed code and compare it
 * against what the seller typed. This implementation does no real image
 * analysis — it exists so the validation pipeline (upload → extract →
 * cross-check → risk score) has a concrete shape to plug a real provider
 * into later. Swapping in a real one only touches this file.
 */
@Injectable()
export class OcrProviderService {
  isConfigured(): boolean {
    return false; // flip once a real provider is wired in
  }

  async extractText(_imagePath: string): Promise<OcrResult> {
    return { extractedText: '', confidence: 0 };
  }
}
