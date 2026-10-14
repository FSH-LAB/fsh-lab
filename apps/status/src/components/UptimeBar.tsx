"use client";

import { useState } from "react";
import type { DayUptime } from "@/lib/types";

interface UptimeBarProps {
  days: DayUptime[];
  uptime90d: number;
}

export function UptimeBar({ days, uptime90d }: UptimeBarProps) {
  const [hoveredDay, setHoveredDay] = useState<DayUptime | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);

  const getBarColor = (day: DayUptime) => {
    switch (day.status) {
      case "operational":
        return "bg-emerald-500 hover:bg-emerald-400";
      case "degraded_performance":
        return "bg-amber-400 hover:bg-amber-300";
      case "partial_outage":
        return "bg-orange-500 hover:bg-orange-400";
      case "major_outage":
        return "bg-rose-500 hover:bg-rose-400";
      case "maintenance":
        return "bg-sky-400 hover:bg-sky-300";
      default:
        return "bg-emerald-500";
    }
  };

  return (
    <div className="relative w-full space-y-2">
      {/* Tooltip */}
      {hoveredDay && (
        <div
          className="absolute -top-14 z-20 -translate-x-1/2 pointer-events-none transition-all duration-150"
          style={{ left: `${hoverPosition}%` }}
        >
          <div className="bg-slate-900 border border-slate-700/80 shadow-xl rounded-md px-2.5 py-1.5 text-xs whitespace-nowrap text-slate-200">
            <div className="font-semibold text-white flex items-center gap-1.5">
              <span>{hoveredDay.date}</span>
              <span className="text-slate-400">•</span>
              <span
                className={
                  hoveredDay.status === "operational"
                    ? "text-emerald-400"
                    : "text-amber-400"
                }
              >
                {hoveredDay.uptimePercentage.toFixed(1)}% uptime
              </span>
            </div>
            <div className="text-[11px] text-slate-400">
              {hoveredDay.incidentCount === 0
                ? "No incidents reported"
                : hoveredDay.description ||
                  `${hoveredDay.incidentCount} incident recorded`}
            </div>
          </div>
        </div>
      )}

      {/* 90-day bars */}
      <div className="flex items-center gap-[2.5px] h-8 py-1 w-full overflow-hidden">
        {days.map((day, idx) => {
          const pct = ((idx + 0.5) / days.length) * 100;
          return (
            <div
              key={day.date}
              onMouseEnter={() => {
                setHoveredDay(day);
                setHoverPosition(pct);
              }}
              onMouseLeave={() => setHoveredDay(null)}
              className={`flex-1 h-full rounded-[2px] transition-all cursor-pointer ${getBarColor(day)}`}
              aria-label={`${day.date}: ${day.status}`}
            />
          );
        })}
      </div>

      {/* Axis labels */}
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>90 days ago</span>
        <span className="font-medium text-slate-400">
          {uptime90d.toFixed(2)}% uptime
        </span>
        <span>Today</span>
      </div>
    </div>
  );
}
