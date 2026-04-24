"use client";

import { useState, useEffect, useMemo } from "react";
import { Calendar, dateFnsLocalizer, type SlotInfo } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { ko } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
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
};

const platformLabels: Record<string, string> = {
  GRIP: "그립",
  CLME: "클릭메이트",
  YOUTUBE: "유튜브",
  TIKTOK: "틱톡",
  BAND: "밴드",
  OTHER: "기타",
};

const statusColorMap: Record<string, string> = {
  REQUESTED: "#f59e0b",
  SCHEDULED: "#3b82f6",
  LIVE: "#10b981",
  ENDED: "#6b7280",
  CANCELED: "#ef4444",
  REJECTED: "#9ca3af",
};

export default function BroadcastCalendarPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(false);

  // 방송 신청 모달
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestDate, setRequestDate] = useState("");
  const [requestTime, setRequestTime] = useState("10:00");
  const [requestPlatform, setRequestPlatform] = useState("GRIP");
  const [requestMemo, setRequestMemo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const userRole = (session?.user as any)?.role;
  const userId = (session?.user as any)?.userId;

  const loadMonthlyBroadcasts = async (date: Date) => {
    setLoading(true);
    try {
      const ym = format(date, "yyyy-MM");
      const res = await fetch(`/api/broadcasts/month/${ym}`);
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
  };

  useEffect(() => {
    loadMonthlyBroadcasts(currentDate);
  }, [currentDate]);

  const events: BroadcastEvent[] = useMemo(() => {
    return broadcasts.map((b) => {
      const start = new Date(b.scheduledAt);
      const end = b.endedAt
        ? new Date(b.endedAt)
        : new Date(start.getTime() + 2 * 60 * 60 * 1000);
      return {
        id: b.id,
        title: `${b.code} - ${platformLabels[b.platform] || b.platform}`,
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

  // 빈 날짜 클릭 → 방송 신청 모달
  const handleSelectSlot = (slotInfo: SlotInfo) => {
    const dateStr = format(slotInfo.start, "yyyy-MM-dd");
    setRequestDate(dateStr);
    setRequestTime("10:00");
    setRequestPlatform("GRIP");
    setRequestMemo("");
    setRequestOpen(true);
  };

  // 방송 신청 제출
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
        <h1 className="text-3xl font-bold text-grey-900">방송 캘린더</h1>
        <Button onClick={() => {
          setRequestDate(format(new Date(), "yyyy-MM-dd"));
          setRequestTime("10:00");
          setRequestPlatform("GRIP");
          setRequestMemo("");
          setRequestOpen(true);
        }}>
          <Plus className="h-4 w-4 mr-2" />
          방송 신청
        </Button>
      </div>

      <Card className="p-6">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="outline" size="sm" onClick={handlePrevMonth} disabled={loading}>
            <ChevronLeft className="h-4 w-4 mr-1" /> 이전 달
          </Button>
          <h2 className="text-xl font-semibold text-grey-900">
            {format(currentDate, "yyyy년 MM월", { locale: ko })}
          </h2>
          <Button variant="outline" size="sm" onClick={handleNextMonth} disabled={loading}>
            다음 달 <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {/* Status Legend */}
        <div className="flex flex-wrap gap-3 mb-4">
          {[
            { color: "bg-amber-500", label: "신청 대기" },
            { color: "bg-blue-500", label: "예정" },
            { color: "bg-green-500", label: "진행중" },
            { color: "bg-grey-500", label: "종료" },
            { color: "bg-red-500", label: "취소" },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded ${s.color}`} />
              <span className="text-sm text-grey-600">{s.label}</span>
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
          <div className="mt-4 text-center text-grey-500">로딩 중...</div>
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
