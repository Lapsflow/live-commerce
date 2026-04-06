"use client";

import { useState } from "react";
import { Calendar } from "lucide-react";

interface DateRangePickerProps {
  fromDate: string;
  toDate: string;
  onDateChange: (fromDate: string, toDate: string) => void;
}

export function DateRangePicker({
  fromDate,
  toDate,
  onDateChange,
}: DateRangePickerProps) {
  const [localFromDate, setLocalFromDate] = useState(fromDate);
  const [localToDate, setLocalToDate] = useState(toDate);

  const handleApply = () => {
    onDateChange(localFromDate, localToDate);
  };

  const handlePreset = (days: number) => {
    const today = new Date();
    const from = new Date();
    from.setDate(today.getDate() - days);

    const toDateStr = today.toISOString().split("T")[0];
    const fromDateStr = from.toISOString().split("T")[0];

    setLocalFromDate(fromDateStr);
    setLocalToDate(toDateStr);
    onDateChange(fromDateStr, toDateStr);
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
      {/* Date Inputs */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-end">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            시작일
          </label>
          <input
            type="date"
            value={localFromDate}
            onChange={(e) => setLocalFromDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <span className="text-gray-500 self-center">~</span>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">
            종료일
          </label>
          <input
            type="date"
            value={localToDate}
            onChange={(e) => setLocalToDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          onClick={handleApply}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
        >
          <Calendar className="h-4 w-4 inline mr-2" />
          조회
        </button>
      </div>

      {/* Preset Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => handlePreset(7)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
        >
          최근 7일
        </button>
        <button
          onClick={() => handlePreset(30)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
        >
          최근 30일
        </button>
        <button
          onClick={() => handlePreset(90)}
          className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
        >
          최근 90일
        </button>
      </div>
    </div>
  );
}
