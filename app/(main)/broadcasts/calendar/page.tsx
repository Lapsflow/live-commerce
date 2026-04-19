"use client";

import { useState, useEffect, useMemo } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { ko } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

// date-fns localizer 설정
const locales = {
  ko: ko,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

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
  seller: {
    id: string;
    name: string;
    email: string;
  };
};

const platformLabels: Record<string, string> = {
  GRIP: "그립",
  CLME: "클미",
  YOUTUBE: "유튜브",
  TIKTOK: "틱톡",
  BAND: "밴드",
  OTHER: "기타",
};

const statusColors: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-800",
  LIVE: "bg-green-100 text-green-800",
  ENDED: "bg-grey-100 text-grey-800",
  CANCELED: "bg-red-100 text-red-800",
};

export default function BroadcastCalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(false);

  // 월간 방송 데이터 로드
  const loadMonthlyBroadcasts = async (date: Date) => {
    setLoading(true);
    try {
      const ym = format(date, "yyyy-MM");
      const res = await fetch(`/api/broadcasts/month/${ym}`);
      const data = await res.json();

      if (res.ok && data.data) {
        setBroadcasts(data.data.broadcasts);
      } else {
        console.error("Failed to load broadcasts:", data.error);
        setBroadcasts([]);
      }
    } catch (error) {
      console.error("Error loading broadcasts:", error);
      setBroadcasts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMonthlyBroadcasts(currentDate);
  }, [currentDate]);

  // 방송 데이터를 캘린더 이벤트로 변환
  const events: BroadcastEvent[] = useMemo(() => {
    return broadcasts.map((broadcast) => {
      const start = new Date(broadcast.scheduledAt);
      const end = broadcast.endedAt
        ? new Date(broadcast.endedAt)
        : new Date(start.getTime() + 2 * 60 * 60 * 1000); // 기본 2시간

      return {
        id: broadcast.id,
        title: `${broadcast.code} - ${platformLabels[broadcast.platform] || broadcast.platform}`,
        start,
        end,
        resource: {
          code: broadcast.code,
          platform: broadcast.platform,
          status: broadcast.status,
          sellerName: broadcast.seller.name,
        },
      };
    });
  }, [broadcasts]);

  // 이전 달로 이동
  const handlePrevMonth = () => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() - 1);
      return newDate;
    });
  };

  // 다음 달로 이동
  const handleNextMonth = () => {
    setCurrentDate((prev) => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + 1);
      return newDate;
    });
  };

  // 이벤트 스타일 커스터마이징
  const eventStyleGetter = (event: BroadcastEvent) => {
    let backgroundColor = "#3174ad";
    let color = "white";

    if (event.resource.status === "LIVE") {
      backgroundColor = "#10b981";
    } else if (event.resource.status === "ENDED") {
      backgroundColor = "#6b7280";
    } else if (event.resource.status === "CANCELED") {
      backgroundColor = "#ef4444";
    }

    return {
      style: {
        backgroundColor,
        color,
        borderRadius: "4px",
        border: "none",
        fontSize: "12px",
      },
    };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-grey-900">방송 캘린더</h1>
      </div>

      {/* Calendar Card */}
      <Card className="p-6">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevMonth}
            disabled={loading}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            이전 달
          </Button>

          <h2 className="text-xl font-semibold text-grey-900">
            {format(currentDate, "yyyy년 MM월", { locale: ko })}
          </h2>

          <Button
            variant="outline"
            size="sm"
            onClick={handleNextMonth}
            disabled={loading}
          >
            다음 달
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        {/* Status Legend */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-500"></div>
            <span className="text-sm text-grey-600">예정</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500"></div>
            <span className="text-sm text-grey-600">진행중</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-grey-500"></div>
            <span className="text-sm text-grey-600">종료</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-500"></div>
            <span className="text-sm text-grey-600">취소</span>
          </div>
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
              // 이벤트 클릭 시 상세 페이지로 이동
              window.location.href = `/broadcasts?code=${event.resource.code}`;
            }}
          />
        </div>

        {loading && (
          <div className="mt-4 text-center text-grey-500">
            로딩 중...
          </div>
        )}

        {!loading && broadcasts.length === 0 && (
          <div className="mt-4 text-center text-grey-500">
            이번 달 방송 일정이 없습니다.
          </div>
        )}
      </Card>
    </div>
  );
}
