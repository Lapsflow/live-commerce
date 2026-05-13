/**
 * GET /api/onewms/stock/conflicts
 *
 * List stock conflicts with pagination.
 *
 * Query params:
 *   - limit:  default 50, max 200 (페이지 사이즈)
 *   - offset: default 0
 *
 * Hotfix 2026-05-12:
 *   - 운영에서 13,000+ 충돌 발생 → 페이지네이션 없으면 브라우저 OOM crash
 *   - 응답 구조 유지: { data: { conflicts, count, hasMore, limit, offset } }
 */

import { NextRequest } from 'next/server';
import { withRole } from '@/lib/api/middleware';
import { getStockConflicts } from '@/lib/services/onewms/stockSync';
import { ok, errors } from '@/lib/api/response';

const MAX_LIMIT = 200;
const DEFAULT_LIMIT = 50;

export const GET = withRole(
  ['MASTER', 'SUB_MASTER'],
  async (req: NextRequest, _user) => {
    try {
      const { searchParams } = new URL(req.url);
      const limitRaw = parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10);
      const offsetRaw = parseInt(searchParams.get('offset') || '0', 10);

      const limit = Number.isFinite(limitRaw) && limitRaw > 0
        ? Math.min(limitRaw, MAX_LIMIT)
        : DEFAULT_LIMIT;
      const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

      // 충돌 목록 (전체 fetch 후 slice — getStockConflicts 시그니처 유지)
      // TODO: 추후 stockSync.ts에 페이지네이션 파라미터 추가하면 더 효율적
      const all = await getStockConflicts();
      const total = all.length;
      const conflicts = all.slice(offset, offset + limit);
      const hasMore = offset + conflicts.length < total;

      return ok({
        conflicts,
        count: total, // 전체 개수 (페이지 사이즈가 아님)
        returned: conflicts.length, // 이번 페이지에 실제 반환된 개수
        limit,
        offset,
        hasMore,
      });
    } catch (error) {
      console.error('Failed to fetch stock conflicts:', error);
      const message = error instanceof Error ? error.message : 'Failed to fetch conflicts';
      return errors.internal(message);
    }
  }
);
