/**
 * Claude API Configuration
 */

import { ClaudeConfig } from './types';

export function getClaudeConfig(): ClaudeConfig {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error(
      'Claude API key not configured. Set ANTHROPIC_API_KEY environment variable.'
    );
  }

  return {
    apiKey,
    model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
    maxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS || '4096'),
  };
}

/**
 * Pricing constants
 * Based on Claude 3.5 Sonnet pricing as of 2024
 */
export const CLAUDE_PRICING = {
  INPUT_PER_1K: 0.003, // $0.003 per 1K input tokens
  OUTPUT_PER_1K: 0.015, // $0.015 per 1K output tokens
} as const;

/**
 * Calculate cost for token usage
 */
export function calculateCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1000) * CLAUDE_PRICING.INPUT_PER_1K;
  const outputCost = (outputTokens / 1000) * CLAUDE_PRICING.OUTPUT_PER_1K;
  return inputCost + outputCost;
}
