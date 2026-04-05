"use client";

import { useCallback, useMemo } from "react";
import { useSWRConfig } from "swr";
import { toast } from "sonner";
import type { DataSource, FetchPageParams, FetchPageResult } from "@/types/data-table";

interface UseApiCrudReturn<T> {
  dataSource: DataSource<T>;
  create: (item: Partial<T>) => Promise<T | null>;
  update: (id: string, updates: Partial<T>) => Promise<T | null>;
  remove: (id: string) => Promise<boolean>;
  refresh: () => void;
}

const FETCH_TIMEOUT_MS = 30_000;

/** AbortController + timeout 래핑 fetch */
function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

/** API 에러 응답에서 메시지 추출 */
async function extractApiError(res: Response): Promise<string> {
  try {
    const json = await res.json();
    return json?.error?.message ?? `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

export function useApiCrud<T = Record<string, unknown>>(
  endpoint: string,
  extraParams?: Record<string, string>,
): UseApiCrudReturn<T> {
  const { mutate } = useSWRConfig();
  const extraParamsKey = extraParams ? JSON.stringify(extraParams) : "";

  // Invalidate all SWR caches for dataTable (triggers refetch)
  const refresh = useCallback(() => {
    mutate(
      (key: unknown) => Array.isArray(key) && key[0] === "dataTable",
      undefined,
      { revalidate: true }
    );
  }, [mutate]);

  // Server-mode DataSource for DataTable
  const dataSource: DataSource<T> = useMemo(
    () => ({
      mode: "server" as const,
      fetchPage: async (params: FetchPageParams): Promise<FetchPageResult<T>> => {
        const sp = new URLSearchParams();
        sp.set("pageIndex", String(params.pageIndex));
        sp.set("pageSize", String(params.pageSize));
        if (params.globalFilter) sp.set("search", params.globalFilter);
        if (params.sorting.length > 0) {
          const s = params.sorting[0];
          sp.set("sort", `${s.id}:${s.desc ? "desc" : "asc"}`);
        }
        // Merge extraParams
        if (extraParams) {
          for (const [key, value] of Object.entries(extraParams)) {
            if (value) sp.set(key, value);
          }
        }

        const res = await fetchWithTimeout(`${endpoint}?${sp.toString()}`);
        if (res.status === 401) {
          window.location.href = "/login";
          throw new Error("Unauthorized");
        }
        if (!res.ok) {
          const msg = await extractApiError(res);
          throw new Error(msg);
        }

        const json = await res.json();
        return {
          data: json.data ?? [],
          totalCount: json.totalCount ?? 0,
          pageCount: json.pageCount ?? 0,
        };
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [endpoint, extraParamsKey]
  );

  const create = useCallback(
    async (item: Partial<T>): Promise<T | null> => {
      try {
        const res = await fetchWithTimeout(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item),
        });
        if (res.status === 401) {
          window.location.href = "/login";
          return null;
        }
        if (!res.ok) {
          const msg = await extractApiError(res);
          toast.error(`등록 실패: ${msg}`);
          return null;
        }
        const json = await res.json();
        refresh();
        toast.success("등록되었습니다");
        return json.data ?? null;
      } catch (err) {
        toast.error(isAbortError(err) ? "요청 시간이 초과되었습니다" : "네트워크 오류가 발생했습니다");
        return null;
      }
    },
    [endpoint, refresh]
  );

  const update = useCallback(
    async (id: string, updates: Partial<T>): Promise<T | null> => {
      try {
        const res = await fetchWithTimeout(`${endpoint}/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (res.status === 401) {
          window.location.href = "/login";
          return null;
        }
        if (!res.ok) {
          const msg = await extractApiError(res);
          toast.error(`수정 실패: ${msg}`);
          return null;
        }
        const json = await res.json();
        refresh();
        toast.success("수정되었습니다");
        return json.data ?? null;
      } catch (err) {
        toast.error(isAbortError(err) ? "요청 시간이 초과되었습니다" : "네트워크 오류가 발생했습니다");
        return null;
      }
    },
    [endpoint, refresh]
  );

  const remove = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const res = await fetchWithTimeout(`${endpoint}/${id}`, { method: "DELETE" });
        if (res.status === 401) {
          window.location.href = "/login";
          return false;
        }
        if (!res.ok) {
          const msg = await extractApiError(res);
          toast.error(`삭제 실패: ${msg}`);
          return false;
        }
        refresh();
        toast.success("삭제되었습니다");
        return true;
      } catch (err) {
        toast.error(isAbortError(err) ? "요청 시간이 초과되었습니다" : "네트워크 오류가 발생했습니다");
        return false;
      }
    },
    [endpoint, refresh]
  );

  return { dataSource, create, update, remove, refresh };
}
