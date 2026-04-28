"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Calendar, dateFnsLocalizer, type SlotInfo } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { ko } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Plus, Filter, X, Search } from "lucide-react";
import { useSession } from "next-auth/react";
import { useToast } from "@/hooks/use-toast";

const locales = { ko };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

type BroadcastEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: {
    code: string;
    platform: string;
    status: string;
    sellerName: string;
  };
};

type Broadcast = {
  id: string;
  code: string;
  platform: string;
  scheduledAt: string;
  startedAt?: string;
  endedAt?: string;
  status: string;
  seller: { id: string; name: string; email: string };
  center?: { id: string; name: string; code: string } | null;
};

const platformLabels: Record<string, string> = {
  GRIP: "그립",
  CLME: "클릭메이트",
  YOUTUBE: "유튜브",
  TIKTOK: "틱톡",
  BAND: "밴드",
  OTHER: "기타",
};

const statusLabels: Record<string, string> = {
  REQUESTED: "신청 대기",
  SCHEDULED: "예정",
  LIVE: "진행중",
  ENDED: "종료",
  CANCELED: "취소",
  REJECTED: "반려",
};

const statusColorMap: Record<string, string> = {
  REQUESTED: "#f59e0b",
  SCHEDULED: "#3b82f6",
  LIVE: "#10b981",
  ENDED: "#6b7280",
  CANCELED: "#ef4444",
  REJECTED: "#9ca3af",
};

const ALL_PLATFORMS = ["GRIP", "CLME", "YOUTUBE", "TIKTOK", "BAND", "OTHER"];
const ALL_STATUSES = ["REQUESTED", "SCHEDULED", "LIVE", "ENDED", "CANCELED", "REJECTED"];

export default function BroadcastCalendarPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(false);

  // CAL-04: 필터 상태
  const [showFilters, setShowFilters] = useState(false);
  const [filterPlatforms, setFilterPlatforms] = useState<string[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [filterSellerName, setFilterSellerName] = useState("");
  const [filterCenterId, setFilterCenterId] = useState("");
  const [centers, setCenters] = useState<{ id: string; name: string; code: string }[]>([]);

  // 방송 신청 모달
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestDate, setRequestDate] = useState("");
  const [requestTime, setRequestTime] = useState("10:00");
  const [requestPlatform, setRequestPlatform] = useState("GRIP");
  const [requestMemo, setRequestMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const userRole = (session?.user as any)?.role;
  const userId = (session?.user as any)?.userId;
  const isMaster = userRole === "MASTER" || userRole === "SUB_MASTER";

  // 센터 목록 로드 (마스터만)
  useEffect(() => {
    if (isMaster) {
      fetch("/api/centers")
        .then((r) => r.json())
        .then((data) => {
          if (data.data) {
            const list = Array.isArray(data.data) ? data.data : data.data.data || [];
            setCenters(list);
          }
        })
        .catch(() => {});
    }
  }, [isMaster]);

  const loadMonthlyBroadcasts = useCallback(async (date: Date) => {
    setLoading(true);
    try {
      const ym = format(date, "yyyy-MM");
      const params = new URLSearchParams();
      if (filterPlatforms.length > 0) params.set("platform", filterPlatforms.join(","));
      if (filterStatuses.length > 0) params.set("status", filterStatuses.join(","));
      if (filterSellerName.trim()) params.set("sellerName", filterSellerName.trim());
      if (filterCenterId) params.set("centerId", filterCenterId);

      const qs = params.toString();
      const url = `/api/broadcasts/month/${ym}${qs ? `?${qs}` : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && data.data) {
        setBroadcasts(data.data.broadcasts);
      } else {
        setBroadcasts([]);
      }
    } catch {
      setBroadcasts([]);
    } finally {
      setLoading(false);
    }
  }, [filterPlatforms, filterStatuses, filterSellerName, filterCenterId]);

  useEffect(() => {
    loadMonthlyBroadcasts(currentDate);
  }, [currentDate, loadMonthlyBroadcasts]);

  const events: BroadcastEvent[] = useMemo(() => {
    return broadcasts.map((b) => {
      const start = new Date(b.scheduledAt);
      const end = b.endedAt
        ? new Date(b.endedAt)
        : new Date(start.getTime() + 2 * 60 * 60 * 1000);
      return {
        id: b.id,
        title: `${b.seller.name} - ${platformLabels[b.platform] || b.platform}`,
        start,
        end,
        resource: {
          code: b.code,
          platform: b.platform,
          status: b.status,
          sellerName: b.seller.name,
        },
      };
    });
  }, [broadcasts]);

  const handlePrevMonth = () => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      d.setMonth(prev.getMonth() - 1);
      return d;
    });
  };

  const handleNextMonth = () => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      d.setMonth(prev.getMonth() + 1);
      return d;
    });
  };

  const handleSelectSlot = (slotInfo: SlotInfo) => {
    const dateStr = format(slotInfo.start, "yyyy-MM-dd");
    setRequestDate(dateStr);
    setRequestTime("10:00");
    setRequestPlatform("GRIP");
    setRequestMemo("");
    setRequestOpen(true);
  };

  const handleSubmitRequest = async () => {
    if (!requestDate || !requestTime || !requestPlatform) return;

    setSubmitting(true);
    try {
      const scheduledAt = new Date(`${requestDate}T${requestTime}:00`).toISOString();
      const code = `BR-${format(new Date(), "yyMMdd")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

      const res = await fetch("/api/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          sellerId: userId,
          platform: requestPlatform,
          scheduledAt,
          status: "REQUESTED",
          requestMemo: requestMemo || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast({
          title: "신청 실패",
          description: data.error?.message || "방송 신청에 실패했습니다",
          variant: "destructive",
        });
      } else {
        toast({ title: "방송 신청 완료", description: "관리자 승인 후 확정됩니다." });
        setRequestOpen(false);
        loadMonthlyBroadcasts(currentDate);
      }
    } catch {
      toast({ title: "오류", description: "네트워크 오류가 발생했습니다", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // CAL-04: 필터 토글 헬퍼
  const toggleFilter = (arr: string[], val: string, setter: (v: string[]) => void) => {
    setter(arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]);
  };

  const clearFilters = () => {
    setFilterPlatforms([]);
    setFilterStatuses([]);
    setFilterSellerName("");
    setFilterCenterId("");
  };

  const hasActiveFilters =
    filterPlatforms.length > 0 ||
    filterStatuses.length > 0 ||
    filterSellerName.trim() !== "" ||
    filterCenterId !== "";

  const eventStyleGetter = (event: BroadcastEvent) => ({
    style: {
      backgroundColor: statusColorMap[event.resource.status] || "#3174ad",
      color: "white",
      borderRadius: "4px",
      border: "none",
      fontSize: "12px",
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">방송 캘린더</h1>
        <div className="flex gap-2">
          <Button
            variant={showFilters ? "default" : "outline"}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            필터
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-2 text-xs">
                ON
              </Badge>
            )}
          </Button>
          <Button
            onClick={() => {
              setRequestDate(format(new Date(), "yyyy-MM-dd"));
              setRequestTime("10:00");
              setRequestPlatform("GRIP");
              setRequestMemo("");
              setRequestOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            방송 신청
          </Button>
        </div>
      </div>

      {/* CAL-04: 필터 패널 */}
      {showFilters && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">필터</h3>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-3 w-3 mr-1" />
                초기화
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 채널 필터 */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">채널</Label>
              <div className="flex flex-wrap gap-1">
                {ALL_PLATFORMS.map((p) => (
                  <Badge
                    key={p}
                    variant={filterPlatforms.includes(p) ? "default" : "outline"}
                    className="cursor-pointer text-xs"
                    onClick={() => toggleFilter(filterPlatforms, p, setFilterPlatforms)}
                  >
                    {platformLabels[p]}
                  </Badge>
                ))}
              </div>
            </div>

            {/* 상태 필터 */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">상태</Label>
              <div className="flex flex-wrap gap-1">
                {ALL_STATUSES.map((s) => (
                  <Badge
                    key={s}
                    variant={filterStatuses.includes(s) ? "default" : "outline"}
                    className="cursor-pointer text-xs"
                    style={
                      filterStatuses.includes(s)
                        ? { backgroundColor: statusColorMap[s], color: "white" }
                        : {}
                    }
                    onClick={() => toggleFilter(filterStatuses, s, setFilterStatuses)}
                  >
                    {statusLabels[s]}
                  </Badge>
                ))}
              </div>
            </div>

            {/* 셀러 검색 */}
            {userRole !== "SELLER" && (
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">셀러 검색</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="셀러명 입력"
                    value={filterSellerName}
                    onChange={(e) => setFilterSellerName(e.target.value)}
                    className="pl-7 h-8 text-sm"
                  />
                </div>
              </div>
            )}

            {/* 센터 필터 (마스터만) */}
            {isMaster && centers.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">센터</Label>
                <Select value={filterCenterId} onValueChange={(v) => setFilterCenterId(v || "")}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="전체 센터" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">전체 센터</SelectItem>
                    {centers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.code} - {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card className="p-6">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="outline" size="sm" onClick={handlePrevMonth} disabled={loading}>
            <ChevronLeft className="h-4 w-4 mr-1" /> 이전 달
          </Button>
          <h2 className="text-xl font-semibold">
            {format(currentDate, "yyyy년 MM월", { locale: ko })}
            {hasActiveFilters && (
              <span className="text-sm text-muted-foreground ml-2">
                ({broadcasts.length}건 필터됨)
              </span>
            )}
          </h2>
          <Button variant="outline" size="sm" onClick={handleNextMonth} disabled={loading}>
            다음 달 <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {/* Status Legend */}
        <div className="flex flex-wrap gap-3 mb-4">
          {Object.entries(statusColorMap).map(([status, color]) => (
            <div key={status} className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: color }} />
              <span className="text-sm text-muted-foreground">{statusLabels[status]}</span>
            </div>
          ))}
        </div>

        {/* Calendar */}
        <div style={{ height: "600px" }}>
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: "100%" }}
            culture="ko"
            selectable
            onSelectSlot={handleSelectSlot}
            messages={{
              next: "다음",
              previous: "이전",
              today: "오늘",
              month: "월",
              week: "주",
              day: "일",
              agenda: "일정",
              date: "날짜",
              time: "시간",
              event: "방송",
              showMore: (total) => `+${total} 더보기`,
            }}
            eventPropGetter={eventStyleGetter}
            onSelectEvent={(event) => {
              window.location.href = `/broadcasts?code=${event.resource.code}`;
            }}
          />
        </div>

        {loading && (
          <div className="mt-4 text-center text-muted-foreground">로딩 중...</div>
        )}
      </Card>

      {/* 방송 신청 모달 */}
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>방송 신청</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>방송 날짜</Label>
                <Input
                  type="date"
                  value={requestDate}
                  onChange={(e) => setRequestDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>시작 시간</Label>
                <Input
                  type="time"
                  value={requestTime}
                  onChange={(e) => setRequestTime(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>플랫폼</Label>
              <Select value={requestPlatform} onValueChange={(v) => v && setRequestPlatform(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(platformLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>메모 (선택)</Label>
              <Textarea
                value={requestMemo}
                onChange={(e) => setRequestMemo(e.target.value)}
                placeholder="방송 관련 메모를 입력하세요"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRequestOpen(false)}
              disabled={submitting}
            >
              취소
            </Button>
            <Button onClick={handleSubmitRequest} disabled={submitting}>
              {submitting ? "신청 중..." : "방송 신청"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
