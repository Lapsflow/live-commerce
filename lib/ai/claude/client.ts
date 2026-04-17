/**
 * Gemini AI Client
 * Uses Google Generative AI SDK
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  GeminiConfig,
  ClaudeApiError,
  PricingContext,
  PricingAnalysis,
  SalesContext,
  SalesAnalysis,
  TokenUsage,
} from './types';
import { getGeminiConfig, calculateCost } from './config';
import { PRICING_ANALYSIS_PROMPT, SALES_ANALYSIS_PROMPT } from './prompts';

export class GeminiClient {
  private genAI: GoogleGenerativeAI;
  private config: GeminiConfig;
  private requestCount: number = 0;
  private totalTokensUsed: number = 0;
  private totalCost: number = 0;

  constructor(config?: GeminiConfig) {
    this.config = config || getGeminiConfig();
    this.genAI = new GoogleGenerativeAI(this.config.apiKey);
  }

  private static readonly RETRY_DELAYS = [1000, 3000, 6000];
  private static readonly FALLBACK_MODEL = 'gemini-2.0-flash';

  /**
   * Make API request with retry and fallback
   */
  private async request(
    prompt: string,
    options: {
      systemInstruction?: string;
      temperature?: number;
    } = {}
  ): Promise<{ text: string; usage: TokenUsage }> {
    const primaryModel = this.config.model || 'gemini-2.5-flash';
    const models = [primaryModel, GeminiClient.FALLBACK_MODEL];

    for (const modelName of models) {
      for (let attempt = 0; attempt <= GeminiClient.RETRY_DELAYS.length; attempt++) {
        try {
          const model = this.genAI.getGenerativeModel({
            model: modelName,
            systemInstruction: options.systemInstruction,
            generationConfig: {
              temperature: options.temperature || 1.0,
              maxOutputTokens: this.config.maxTokens || 4096,
            },
          });

          const result = await model.generateContent(prompt);
          const response = result.response;
          const text = response.text();

          const usageMetadata = response.usageMetadata;
          const inputTokens = usageMetadata?.promptTokenCount || 0;
          const outputTokens = usageMetadata?.candidatesTokenCount || 0;

          const usage: TokenUsage = {
            inputTokens,
            outputTokens,
            totalTokens: inputTokens + outputTokens,
            estimatedCost: calculateCost(inputTokens, outputTokens),
          };

          this.requestCount++;
          this.totalTokensUsed += usage.totalTokens;
          this.totalCost += usage.estimatedCost;

          return { text, usage };
        } catch (error: any) {
          const status = error.status || error.httpStatusCode || -1;
          const isRetryable = status === 503 || status === 429 || status === 500;

          if (isRetryable && attempt < GeminiClient.RETRY_DELAYS.length) {
            const delay = GeminiClient.RETRY_DELAYS[attempt];
            console.warn(`Gemini ${modelName} returned ${status}, retrying in ${delay}ms (attempt ${attempt + 1})`);
            await new Promise(r => setTimeout(r, delay));
            continue;
          }

          // If all retries failed for this model, try fallback
          if (modelName !== GeminiClient.FALLBACK_MODEL) {
            console.warn(`Gemini ${modelName} failed, falling back to ${GeminiClient.FALLBACK_MODEL}`);
            break;
          }

          const apiError = new Error(
            error.message || 'Gemini API request failed'
          ) as ClaudeApiError;
          apiError.type = error.type || 'unknown_error';
          apiError.status = status;
          throw apiError;
        }
      }
    }

    throw new Error('All Gemini models failed');
  }

  /**
   * Analyze pricing strategy
   */
  async analyzePricing(context: PricingContext): Promise<{
    analysis: PricingAnalysis;
    usage: TokenUsage;
  }> {
    const prompt = PRICING_ANALYSIS_PROMPT(context);

    const { text, usage } = await this.request(prompt, {
      systemInstruction:
        'You are a pricing strategy expert for live commerce. Provide analysis in valid JSON format only.',
      temperature: 0.7,
    });

    try {
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/{[\s\S]*}/);
      const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
      const analysis: PricingAnalysis = JSON.parse(jsonText);

      return { analysis, usage };
    } catch (error) {
      console.error('Failed to parse Gemini response:', text);
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

    const { text, usage } = await this.request(prompt, {
      systemInstruction:
        'You are a live commerce sales strategy expert. Provide analysis in valid JSON format only.',
      temperature: 0.8,
    });

    try {
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/{[\s\S]*}/);
      const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
      const analysis: SalesAnalysis = JSON.parse(jsonText);

      return { analysis, usage };
    } catch (error) {
      console.error('Failed to parse Gemini response:', text);
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

// Backward compatibility alias
export const ClaudeClient = GeminiClient;

/**
 * Create a new Gemini client instance
 */
export function createGeminiClient(config?: GeminiConfig): GeminiClient {
  return new GeminiClient(config);
}

// Backward compatibility alias
export const createClaudeClient = createGeminiClient;
