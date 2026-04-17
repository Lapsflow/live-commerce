/**
 * AI Analysis Prompts
 * Templates for pricing and sales strategy analysis
 */

import { PricingContext, SalesContext } from './types';

/**
 * Pricing analysis prompt template
 */
export function PRICING_ANALYSIS_PROMPT(context: PricingContext): string {
  return `당신은 라이브커머스 가격 전략 전문가입니다. 다음 상품의 가격 경쟁력을 분석해주세요.

## 상품 정보
- 상품명: ${context.productName}
- 바코드: ${context.barcode}
- 우리 가격: ${context.ourPrice.toLocaleString()}원
- 마진율: ${context.marginRate}%
- 재고: ${context.stockQuantity}개

## 시장 가격 정보
- 시장 평균가: ${context.marketAvgPrice.toLocaleString()}원
- 시장 최저가: ${context.marketMinPrice.toLocaleString()}원
- 네이버 평균가: ${context.naverAvgPrice.toLocaleString()}원
- 쿠팡 평균가: ${context.coupangAvgPrice.toLocaleString()}원

다음 JSON 형식으로 **정확하게** 응답해주세요:

\`\`\`json
{
  "competitiveness": {
    "score": 85,
    "position": "mid",
    "insights": [
      "시장 평균 대비 5% 저렴하여 경쟁력 있는 가격입니다",
      "네이버 최저가와 비슷한 수준으로 가격 매력도가 높습니다"
    ]
  },
  "marginHealth": {
    "isHealthy": true,
    "currentMargin": ${context.marginRate},
    "recommendedMargin": 35,
    "reasoning": "현재 마진율은 건강한 수준입니다. 라이브 방송 시 추가 할인 여력이 있습니다."
  },
  "actionItems": [
    "방송 시 특가 이벤트로 추가 5% 할인 제안",
    "묶음 구매 시 배송비 무료 혜택 강조",
    "선착순 100명 한정 특가 진행"
  ],
  "broadcastScript": "여러분! 지금 보시는 이 상품, 시장 최저가보다도 저렴한 ${context.ourPrice.toLocaleString()}원입니다! 네이버, 쿠팡 다 찾아봐도 이 가격 없어요. 게다가 오늘 방송 보시는 분들만! 추가 5% 할인까지 드립니다. 지금 바로 주문하세요!",
  "targetCustomers": [
    "가격 비교를 꼼꼼히 하는 합리적 소비자",
    "온라인 쇼핑 경험이 많은 30-40대",
    "실속형 제품을 선호하는 주부 고객"
  ],
  "bundleRecommendations": [
    "동일 카테고리 베스트 상품 2+1 구성",
    "관련 소모품과 함께 패키지 구성",
    "계절 상품과 함께 기획전 구성"
  ],
  "cautions": [
    "무리한 추가 할인은 마진을 위협할 수 있습니다",
    "시장 가격 변동을 주기적으로 모니터링하세요"
  ]
}
\`\`\`

**중요**: 반드시 위의 JSON 형식을 정확히 따라주세요. 추가 설명이나 다른 텍스트는 포함하지 마세요.`;
}

/**
 * Sales strategy analysis prompt template
 */
export function SALES_ANALYSIS_PROMPT(context: SalesContext): string {
  const recentSalesInfo = context.recentSalesCount
    ? `- 최근 판매량: ${context.recentSalesCount}건`
    : '';
  const avgOrderInfo = context.avgOrderValue
    ? `- 평균 주문액: ${context.avgOrderValue.toLocaleString()}원`
    : '';
  const rfmInfo = context.rfmScore ? `- RFM 스코어: ${context.rfmScore}점` : '';

  return `당신은 라이브커머스 판매 전략 전문가입니다. 다음 상품의 판매 전략을 분석해주세요.

## 상품 정보
- 상품명: ${context.productName}
- 바코드: ${context.barcode}
- 판매가: ${context.price.toLocaleString()}원
- 재고: ${context.stockQuantity}개
- 카테고리: ${context.category}

## 판매 데이터
${recentSalesInfo}
${avgOrderInfo}
${rfmInfo}

다음 JSON 형식으로 **정확하게** 응답해주세요:

\`\`\`json
{
  "keyPoints": [
    "이 상품의 핵심 매력 포인트 1",
    "이 상품의 핵심 매력 포인트 2",
    "이 상품의 핵심 매력 포인트 3"
  ],
  "targetCustomer": "구체적인 타겟 고객 페르소나 설명 (연령대, 라이프스타일, 구매 동기 등)",
  "broadcastScript": "30초 분량의 라이브 방송 스크립트. 시청자의 마음을 사로잡고 즉시 구매를 유도하는 멘트. 감정적 호소와 합리적 근거를 균형있게 포함.",
  "recommendedBundle": [
    "함께 구매하면 좋은 상품 1",
    "함께 구매하면 좋은 상품 2",
    "함께 구매하면 좋은 상품 3"
  ],
  "cautions": [
    "판매 시 주의할 점 1",
    "판매 시 주의할 점 2"
  ]
}
\`\`\`

**중요**: 반드시 위의 JSON 형식을 정확히 따라주세요. 추가 설명이나 다른 텍스트는 포함하지 마세요.`;
}

/**
 * Product analysis prompt (combines pricing + sales)
 */
export function PRODUCT_ANALYSIS_PROMPT(
  pricingContext: PricingContext,
  salesContext: SalesContext
): string {
  return `당신은 라이브커머스 종합 전략 전문가입니다. 다음 상품의 가격 전략과 판매 전략을 모두 분석해주세요.

## 상품 정보
- 상품명: ${pricingContext.productName}
- 바코드: ${pricingContext.barcode}

## 가격 정보
- 우리 가격: ${pricingContext.ourPrice.toLocaleString()}원
- 시장 평균: ${pricingContext.marketAvgPrice.toLocaleString()}원
- 마진율: ${pricingContext.marginRate}%

## 재고 & 판매 데이터
- 재고: ${pricingContext.stockQuantity}개
${salesContext.recentSalesCount ? `- 최근 판매: ${salesContext.recentSalesCount}건` : ''}
${salesContext.rfmScore ? `- RFM 스코어: ${salesContext.rfmScore}점` : ''}

가격 경쟁력과 판매 전략을 종합적으로 분석하여 라이브 방송에 최적화된 전략을 제시해주세요.

JSON 형식으로 응답하되, 위의 PRICING_ANALYSIS와 SALES_ANALYSIS의 필드를 모두 포함해주세요.`;
}
