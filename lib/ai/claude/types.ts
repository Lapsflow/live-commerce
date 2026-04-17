/**
 * AI API Types
 */

export interface GeminiConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

// Backward compatibility
export type ClaudeConfig = GeminiConfig;

export interface ClaudeApiError extends Error {
  type: string;
  status: number;
}

export interface PricingContext {
  productName: string;
  barcode: string;
  ourPrice: number;
  marginRate: number;
  marketAvgPrice: number;
  marketMinPrice: number;
  naverAvgPrice: number;
  coupangAvgPrice: number;
  stockQuantity: number;
}

export interface PricingAnalysis {
  competitiveness: {
    score: number; // 0-100
    position: 'low' | 'mid' | 'high';
    insights: string[];
  };
  marginHealth: {
    isHealthy: boolean;
    currentMargin: number;
    recommendedMargin: number;
    reasoning: string;
  };
  actionItems: string[];
  broadcastScript: string;
  targetCustomers: string[];
  bundleRecommendations: string[];
  cautions: string[];
}

export interface SalesContext {
  productName: string;
  barcode: string;
  price: number;
  stockQuantity: number;
  category: string;
  recentSalesCount?: number;
  avgOrderValue?: number;
  rfmScore?: number;
}

export interface SalesAnalysis {
  keyPoints: string[];
  targetCustomer: string;
  broadcastScript: string;
  recommendedBundle: string[];
  cautions: string[];
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number; // USD
}
