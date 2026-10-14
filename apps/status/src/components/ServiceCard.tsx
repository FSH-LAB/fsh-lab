"use client";

import { useState } from "react";
import { getStatusBadgeInfo } from "@/lib/status";
import type { ServiceComponent } from "@/lib/types";
import { LatencyChart } from "./LatencyChart";
import { UptimeBar } from "./UptimeBar";

interface ServiceCardProps {
  service: ServiceComponent;
}

export function ServiceCard({ service }: ServiceCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const badge = getStatusBadgeInfo(service.status);

  // Compute 7d, 30d, 90d uptimes
  const days = service.days;
  const days7 = days.slice(-7);
  const days30 = days.slice(-30);

  const uptime7d = (
    days7.reduce((acc, d) => acc + d.uptimePercentage, 0) / (days7.length || 1)
  ).toFixed(2);
  const uptime30d = (
    days30.reduce((acc, d) => acc + d.uptimePercentage, 0) /
    (days30.length || 1)
  ).toFixed(2);
  const uptime90d = service.uptime90d.toFixed(2);

  // Derive 24-hour uptime from live status and today's observation
  const todayEntry = days[days.length - 1];
  let uptime24h = (todayEntry?.uptimePercentage ?? 100.0).toFixed(1);
  let uptime24hColor = "text-emerald-400";
  if (service.status === "major_outage") {
    uptime24h = "0.0";
    uptime24hColor = "text-rose-400";
  } else if (
    service.status === "partial_outage" ||
    service.status === "degraded_performance"
  ) {
    uptime24h = Math.min(Number(uptime24h), 95.0).toFixed(1);
    uptime24hColor = "text-amber-400";
  } else if (todayEntry && todayEntry.uptimePercentage < 100) {
    uptime24hColor = "text-amber-400";
  }

  const categoryName =
    service.category === "apps"
      ? "Application"
      : service.category === "platform"
        ? "Platform"
        : "Infrastructure";

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 hover:border-slate-700/70 transition-all duration-200">
      {/* Top row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="font-semibold text-white text-base tracking-tight">
              {service.name}
            </h3>
            <span className="text-[11px] font-medium tracking-wide uppercase px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/50">
              {categoryName}
            </span>
            {service.appUrl && (
              <a
                href={service.appUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
                title={`Visit ${service.name}`}
              >
                <span>Visit app</span>
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">{service.description}</p>
        </div>

        {/* Status Pill & Live Latency */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          {service.probeType === "platform_managed" ? (
            <span
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-slate-800/80 border-slate-700/60 text-slate-400"
              title="Cloud platform managed component"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
              <span>Platform Managed</span>
            </span>
          ) : (
            <span
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-slate-800/80 border-slate-700/60 text-slate-300"
              title="Live ping latency"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono">{service.currentLatencyMs}ms</span>
            </span>
          )}

          <span
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${badge.badgeBg} ${badge.badgeText} ${badge.borderColor}`}
          >
            <span className={`w-2 h-2 rounded-full ${badge.dotColor}`} />
            {badge.label}
          </span>
        </div>
      </div>

      {/* 90-day Interactive Timeline Bar */}
      <div className="pt-1 pb-3">
        <UptimeBar days={service.days} uptime90d={service.uptime90d} />
      </div>

      {/* Accordion Expand Button */}
      <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition-colors focus:outline-none"
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
          <span>
            {isExpanded ? "Hide metrics & details" : "View latency & details"}
          </span>
        </button>

        <span className="text-[11px] text-slate-500 font-mono">
          Last 90 days: <span className="text-slate-300">{uptime90d}%</span>
        </span>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-4 animate-in fade-in duration-200">
          {/* Uptime breakdowns */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
            <div className="bg-slate-950/40 border border-slate-800/60 rounded-lg p-2.5">
              <div className="text-[11px] text-slate-400">Past 24 Hours</div>
              <div
                className={`text-sm font-semibold ${uptime24hColor} font-mono mt-0.5`}
              >
                {uptime24h}%
              </div>
            </div>
            <div className="bg-slate-950/40 border border-slate-800/60 rounded-lg p-2.5">
              <div className="text-[11px] text-slate-400">Past 7 Days</div>
              <div className="text-sm font-semibold text-emerald-400 font-mono mt-0.5">
                {uptime7d}%
              </div>
            </div>
            <div className="bg-slate-950/40 border border-slate-800/60 rounded-lg p-2.5">
              <div className="text-[11px] text-slate-400">Past 30 Days</div>
              <div className="text-sm font-semibold text-emerald-400 font-mono mt-0.5">
                {uptime30d}%
              </div>
            </div>
            <div className="bg-slate-950/40 border border-slate-800/60 rounded-lg p-2.5">
              <div className="text-[11px] text-slate-400">Past 90 Days</div>
              <div className="text-sm font-semibold text-emerald-400 font-mono mt-0.5">
                {uptime90d}%
              </div>
            </div>
          </div>

          {/* Response latency chart */}
          <LatencyChart
            points={service.metrics24h.points}
            avgLatencyMs={service.metrics24h.avgLatencyMs}
            p95LatencyMs={service.metrics24h.p95LatencyMs}
          />

          {/* Endpoint info */}
          {service.healthEndpoint && (
            <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-950/30 px-3 py-2 rounded-lg border border-slate-800/50">
              <span className="flex items-center gap-1.5 font-mono">
                <span className="text-slate-500">Probe target:</span>
                <span className="text-slate-300">{service.healthEndpoint}</span>
              </span>
              <span className="text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Active Health Probe
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
