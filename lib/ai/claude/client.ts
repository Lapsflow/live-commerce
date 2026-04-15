/**
 * Claude API Client
 * API Documentation: https://docs.anthropic.com/claude/reference/
 * Cost Management: Track token usage and estimated costs
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  ClaudeConfig,
  ClaudeApiError,
  PricingContext,
  PricingAnalysis,
  SalesContext,
  SalesAnalysis,
  TokenUsage,
} from './types';
import { getClaudeConfig, calculateCost } from './config';
import { PRICING_ANALYSIS_PROMPT, SALES_ANALYSIS_PROMPT } from './prompts';

export class ClaudeClient {
  private client: Anthropic;
  private config: ClaudeConfig;
  private requestCount: number = 0;
  private totalTokensUsed: number = 0;
  private totalCost: number = 0;

  constructor(config?: ClaudeConfig) {
    this.config = config || getClaudeConfig();
    this.client = new Anthropic({
      apiKey: this.config.apiKey,
    });
  }

  /**
   * Make API request
   */
  private async request(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    options: {
      system?: string;
      temperature?: number;
    } = {}
  ): Promise<{ text: string; usage: TokenUsage }> {
    try {
      const response = await this.client.messages.create({
        model: this.config.model!,
        max_tokens: this.config.maxTokens!,
        messages,
        system: options.system,
        temperature: options.temperature || 1.0,
      });

      // Track token usage
      const usage: TokenUsage = {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
        estimatedCost: calculateCost(
          response.usage.input_tokens,
          response.usage.output_tokens
        ),
      };

      this.requestCount++;
      this.totalTokensUsed += usage.totalTokens;
      this.totalCost += usage.estimatedCost;

      // Extract text from response
      const text = response.content
        .filter((block) => block.type === 'text')
        .map((block) => (block as any).text)
        .join('\n');

      return { text, usage };
    } catch (error: any) {
      const apiError = new Error(
        error.message || 'Claude API request failed'
      ) as ClaudeApiError;
      apiError.type = error.type || 'unknown_error';
      apiError.status = error.status || -1;
      throw apiError;
    }
  }

  /**
   * Analyze pricing strategy
   */
  async analyzePricing(context: PricingContext): Promise<{
    analysis: PricingAnalysis;
    usage: TokenUsage;
  }> {
    const prompt = PRICING_ANALYSIS_PROMPT(context);

    const { text, usage } = await this.request(
      [{ role: 'user', content: prompt }],
      {
        system:
          'You are a pricing strategy expert for live commerce. Provide analysis in valid JSON format only.',
        temperature: 0.7,
      }
    );

    try {
      // Parse JSON response
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/{[\s\S]*}/);
      const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
      const analysis: PricingAnalysis = JSON.parse(jsonText);

      return { analysis, usage };
    } catch (error) {
      console.error('Failed to parse Claude response:', text);
      throw new Error('Failed to parse AI analysis response');
    }
  }

  /**
   * Analyze sales strategy
   */
  async analyzeSales(context: SalesContext): Promise<{
    analysis: SalesAnalysis;
    usage: TokenUsage;
  }> {
    const prompt = SALES_ANALYSIS_PROMPT(context);

    const { text, usage } = await this.request(
      [{ role: 'user', content: prompt }],
      {
        system:
          'You are a live commerce sales strategy expert. Provide analysis in valid JSON format only.',
        temperature: 0.8,
      }
    );

    try {
      // Parse JSON response
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/{[\s\S]*}/);
      const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
      const analysis: SalesAnalysis = JSON.parse(jsonText);

      return { analysis, usage };
    } catch (error) {
      console.error('Failed to parse Claude response:', text);
      throw new Error('Failed to parse AI analysis response');
    }
  }

  /**
   * Get usage statistics
   */
  getUsageStats(): {
    requestCount: number;
    totalTokens: number;
    totalCost: number;
  } {
    return {
      requestCount: this.requestCount,
      totalTokens: this.totalTokensUsed,
      totalCost: this.totalCost,
    };
  }

  /**
   * Reset usage statistics
   */
  resetUsageStats(): void {
    this.requestCount = 0;
    this.totalTokensUsed = 0;
    this.totalCost = 0;
  }
}

/**
 * Create a new Claude client instance
 */
export function createClaudeClient(config?: ClaudeConfig): ClaudeClient {
  return new ClaudeClient(config);
}
