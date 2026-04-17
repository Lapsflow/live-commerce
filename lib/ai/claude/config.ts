/**
 * Gemini AI Configuration
 */

import { GeminiConfig } from './types';

export function getGeminiConfig(): GeminiConfig {
  const apiKey = process.env.GEMINI_KEY;

  if (!apiKey) {
    throw new Error(
      'Gemini API key not configured. Set GEMINI_KEY environment variable.'
    );
  }

  return {
    apiKey,
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    maxTokens: parseInt(process.env.GEMINI_MAX_TOKENS || '4096'),
  };
}

/**
 * Gemini pricing (per 1K tokens, approximate)
 * Gemini 2.5 Flash: very low cost
 */
export const GEMINI_PRICING = {
  INPUT_PER_1K: 0.000075, // $0.000075 per 1K input tokens
  OUTPUT_PER_1K: 0.0003, // $0.0003 per 1K output tokens
} as const;

/**
 * Calculate cost for token usage
 */
export function calculateCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1000) * GEMINI_PRICING.INPUT_PER_1K;
  const outputCost = (outputTokens / 1000) * GEMINI_PRICING.OUTPUT_PER_1K;
  return inputCost + outputCost;
}

// Backward compatibility alias
export const getClaudeConfig = getGeminiConfig;
