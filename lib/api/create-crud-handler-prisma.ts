/**
 * Prisma 기반 CRUD 팩토리 (Simplified for live-commerce)
 *
 * 핵심 기능:
 * - Role-based access control
 * - Pagination, sorting, search
 * - Zod validation
 * - Rate limiting
 * - Prisma error handling
 */
import { NextRequest, NextResponse } from "next/server";
import type { ZodSchema } from "zod";
import { ok, created, paginated, errors } from "./response";
import { withRole, type Role, type AuthUser, type NextHandler } from "./middleware";
import { logger, sanitizeError } from "@/lib/logger";
import { stripBlockedFields, extractIdFromUrl, filterFields, handlePrismaError } from "./crud-utils";
import { isRateLimitedDb } from "./rate-limit-db";
import { prisma } from "@/lib/db/prisma";

type PrismaModel = "product" | "user" | "order" | "orderItem" | "broadcast" | "sale";

interface CrudConfig<TData = Record<string, unknown>> {
  model: PrismaModel;
  roles: {
    read: Role[];
    write?: Role[];
    delete?: Role[];
  };
  createSchema?: ZodSchema;
  updateSchema?: ZodSchema;
  sortableFields?: string[];
  searchFields?: string[];
  excludeFields?: string[];
  transformRecord?: (record: TData) => unknown;
}

/**
 * Query params 파싱
 */
function parseListParams(req: NextRequest) {
  const url = new URL(req.url);
  const pageIndex = Math.max(0, parseInt(url.searchParams.get("pageIndex") ?? "0"));
  const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") ?? "20")));
  const search = url.searchParams.get("search") ?? "";
  const sort = url.searchParams.get("sort") ?? "";

  return { pageIndex, pageSize, search, sort };
}

/**
 * Search 조건 빌더
 */
function buildSearchWhere(search: string, searchFields?: string[]) {
  if (!search || !searchFields || searchFields.length === 0) return {};

  return {
    OR: searchFields.map(field => ({
      [field]: { contains: search, mode: "insensitive" as const },
    })),
  };
}

/**
 * Sort 조건 빌더
 */
function buildOrderBy(sort: string, sortableFields?: string[]) {
  if (!sort) return { createdAt: "desc" as const };

  const [field, direction] = sort.split(":");
  if (!sortableFields?.includes(field)) return { createdAt: "desc" as const };

  return { [field]: direction === "desc" ? "desc" : "asc" } as const;
}

/**
 * 6 모델 공통 CRUD 팩토리
 */
export function createCrudHandler<TData = Record<string, unknown>>(
  config: CrudConfig<TData>
) {
  const {
    model,
    roles,
    createSchema,
    updateSchema,
    sortableFields,
    searchFields,
    excludeFields,
    transformRecord,
  } = config;

  const omit = excludeFields?.length
    ? Object.fromEntries(excludeFields.map((f) => [f, true]))
    : undefined;

  function applyTransform(record: unknown) {
    const transformed = transformRecord ? transformRecord(record as TData) : record;
    return excludeFields ? filterFields(transformed as Record<string, unknown>, excludeFields) : transformed;
  }

  /** Zod 검증 + blocked fields 제거 */
  function validateBody(
    body: Record<string, unknown>,
    schema?: ZodSchema,
    requestId?: string,
  ): { ok: true; data: Record<string, unknown> } | { ok: false; response: NextResponse } {
    if (schema) {
      const result = schema.safeParse(body);
      if (!result.success) {
        logger.warn("validation_failed", { model, requestId });
        const details = process.env.NODE_ENV === "development" ? result.error.format() : undefined;
        return { ok: false, response: errors.badRequest("유효성 검증 실패", details) };
      }
      body = result.data as Record<string, unknown>;
    }
    body = stripBlockedFields(body);
    return { ok: true, data: body };
  }

  /** Write Rate Limit 검증 */
  async function checkWriteRateLimit(user: AuthUser, action: string, requestId: string): Promise<NextResponse | null> {
    const writeKey = `write:${model}:${user.userId}`;
    if (await isRateLimitedDb(writeKey, { max: 30, windowMs: 60_000 })) {
      logger.warn("rate_limit_exceeded", { model, userId: user.userId, action, requestId });
      return errors.tooManyRequests();
    }
    return null;
  }

  /** JSON body 파싱 */
  async function parseBody(req: NextRequest): Promise<Record<string, unknown> | NextResponse> {
    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return errors.badRequest("Content-Type must be application/json");
    }
    try {
      return await req.json();
    } catch {
      return errors.badRequest("유효하지 않은 JSON");
    }
  }

  // ──────────────────────── Handlers ────────────────────────

  /** GET — 목록 조회 */
  const list = withRole(roles.read, async (req: NextRequest) => {
    const params = parseListParams(req);

    const where = buildSearchWhere(params.search, searchFields);
    const orderBy = buildOrderBy(params.sort, sortableFields);

    try {
      // Note: Type assertion needed for union delegate access
      const delegate = prisma[model] as any;
      const [records, total] = await Promise.all([
        delegate.findMany({
          where,
          take: params.pageSize,
          skip: params.pageIndex * params.pageSize,
          orderBy,
          ...(omit && { omit }),
        }),
        delegate.count({ where }),
      ]);

      const mapped = records.map(applyTransform);
      const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
      logger.info("list", { model, total, pageSize: params.pageSize, pageIndex: params.pageIndex, requestId });

      return paginated(mapped, total, params.pageSize);
    } catch (err: unknown) {
      return handlePrismaError(err, model);
    }
  });

  /** POST — 생성 */
  const create: NextHandler = roles.write
    ? withRole(roles.write, async (req: NextRequest, user: AuthUser) => {
        const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
        const rateLimitError = await checkWriteRateLimit(user, "create", requestId);
        if (rateLimitError) return rateLimitError;

        const bodyOrError = await parseBody(req);
        if (bodyOrError instanceof NextResponse) return bodyOrError;

        const validated = validateBody(bodyOrError, createSchema, requestId);
        if (!validated.ok) return validated.response;

        try {
          // Note: Type assertion needed for union delegate access
          const delegate = prisma[model] as any;
          const record = await delegate.create({ data: validated.data });
          logger.info("create", { model, id: record.id, requestId });
          return created(applyTransform(record));
        } catch (err: unknown) {
          return handlePrismaError(err, model);
        }
      })
    : async () => errors.forbidden("쓰기 권한이 설정되지 않았습니다");

  /** GET /[id] — 단건 조회 */
  const get = withRole(roles.read, async (req: NextRequest) => {
    const id = extractIdFromUrl(req.url);

    try {
      // Note: Type assertion needed for union delegate access
      const delegate = prisma[model] as any;
      const record = await delegate.findUnique({
        where: { id },
        ...(omit && { omit }),
      });

      if (!record) return errors.notFound(model);
      return ok(applyTransform(record));
    } catch (err: unknown) {
      return handlePrismaError(err, model);
    }
  });

  /** PUT /[id] — 수정 */
  const update: NextHandler = roles.write
    ? withRole(roles.write, async (req: NextRequest, user: AuthUser) => {
        const id = extractIdFromUrl(req.url);
        const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
        const rateLimitError = await checkWriteRateLimit(user, "update", requestId);
        if (rateLimitError) return rateLimitError;

        const bodyOrError = await parseBody(req);
        if (bodyOrError instanceof NextResponse) return bodyOrError;

        const validated = validateBody(bodyOrError, updateSchema, requestId);
        if (!validated.ok) return validated.response;

        try {
          // Note: Type assertion needed for union delegate access
          const delegate = prisma[model] as any;
          const record = await delegate.update({
            where: { id },
            data: validated.data,
          });
          logger.info("update", { model, id, requestId });
          return ok(applyTransform(record));
        } catch (err: unknown) {
          return handlePrismaError(err, model);
        }
      })
    : async () => errors.forbidden("쓰기 권한이 설정되지 않았습니다");

  /** DELETE /[id] — 삭제 */
  const deleteRoles = roles.delete ?? roles.write;
  const remove: NextHandler = deleteRoles
    ? withRole(deleteRoles, async (req: NextRequest, user: AuthUser) => {
        const id = extractIdFromUrl(req.url);
        const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
        const rateLimitError = await checkWriteRateLimit(user, "delete", requestId);
        if (rateLimitError) return rateLimitError;

        try {
          // Note: Type assertion needed for union delegate access
          const delegate = prisma[model] as any;
          await delegate.delete({ where: { id } });
          logger.info("delete", { model, id, requestId });
          return ok({ deleted: true });
        } catch (err: unknown) {
          return handlePrismaError(err, model);
        }
      })
    : async () => errors.forbidden("삭제 권한이 설정되지 않았습니다");

  return { list, create, get, update, remove };
}
