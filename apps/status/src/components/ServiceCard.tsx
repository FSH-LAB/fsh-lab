"use client";

import { getStatusBadgeInfo } from "@/lib/status";
import type { ServiceComponent } from "@/lib/types";
import { LatencyChart } from "./LatencyChart";

interface ServiceCardProps {
  service: ServiceComponent;
}

export function ServiceCard({ service }: ServiceCardProps) {
  const badge = getStatusBadgeInfo(service.status);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 hover:border-slate-700/70 transition-all duration-200 space-y-4">
      {/* Top row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h3 className="font-semibold text-white text-base tracking-tight">
            {service.name}
          </h3>
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

        {/* Status Pill & Live Latency */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          {service.probeType === "platform_managed" &&
          service.currentLatencyMs === 0 ? (
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
              title="Live health probe ping latency"
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

      {/* 24-hour Response Latency Telemetry Chart */}
      <LatencyChart
        points={service.metrics24h.points}
        avgLatencyMs={service.metrics24h.avgLatencyMs}
        p95LatencyMs={service.metrics24h.p95LatencyMs}
      />
    </div>
  );
}
