"use client";

import type { SystemStatusSummary } from "@/lib/types";

interface HeroBannerProps {
  summary: SystemStatusSummary;
  isProbing: boolean;
  onRefresh: () => void;
  secondsAgo: number;
}

export function HeroBanner({
  summary,
  isProbing,
  onRefresh,
  secondsAgo,
}: HeroBannerProps) {
  const isOperational = summary.level === "operational";
  const isDegraded = summary.level === "degraded_performance";
  const isOutage =
    summary.level === "major_outage" || summary.level === "partial_outage";

  const bannerColor = isOperational
    ? "from-emerald-950/40 to-slate-900 border-emerald-500/30"
    : isDegraded
      ? "from-amber-950/40 to-slate-900 border-amber-500/30"
      : isOutage
        ? "from-rose-950/40 to-slate-900 border-rose-500/30"
        : "from-sky-950/40 to-slate-900 border-sky-500/30";

  const glowColor = isOperational
    ? "bg-emerald-500"
    : isDegraded
      ? "bg-amber-400"
      : isOutage
        ? "bg-rose-500"
        : "bg-sky-400";

  const systemsSubtext =
    summary.operationalServicesCount === summary.totalServicesCount
      ? "All operational"
      : `${summary.totalServicesCount - summary.operationalServicesCount} degraded or down`;

  const incidentsSubtext =
    summary.activeIncidentsCount === 0
      ? "0 active issues"
      : `${summary.activeIncidentsCount} active issue${summary.activeIncidentsCount === 1 ? "" : "s"}`;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-b ${bannerColor} p-6 sm:p-8 shadow-2xl transition-all duration-300`}
    >
      {/* Background ambient radial glow */}
      <div
        className={`absolute -right-20 -top-20 w-80 h-80 rounded-full ${glowColor} opacity-10 blur-3xl pointer-events-none`}
      />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-3">
          {/* Status pill & Live label */}
          <div className="flex items-center gap-2.5">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                isOperational
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : isDegraded
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    : isOutage
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                      : "bg-sky-500/20 text-sky-300 border border-sky-500/30"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${glowColor} animate-pulse`}
              />
              {isOperational
                ? "Operational"
                : isOutage
                  ? "Down"
                  : isDegraded
                    ? "Degraded"
                    : "Maintenance"}
            </span>

            <span className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
              <span>
                Updated {secondsAgo === 0 ? "just now" : `${secondsAgo}s ago`}
              </span>
              <button
                type="button"
                onClick={onRefresh}
                disabled={isProbing}
                className="hover:text-slate-200 text-slate-400 p-1 rounded transition-colors disabled:opacity-50"
                title="Refresh system status now"
                aria-label="Refresh system status now"
              >
                <svg
                  className={`w-3.5 h-3.5 ${isProbing ? "animate-spin text-emerald-400" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
            </span>
          </div>

          {/* Headline & details */}
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            {summary.headline}
          </h1>
          <p className="text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
            {summary.subheadline}
          </p>
        </div>

        {/* Quick Stats Panel */}
        <div className="grid grid-cols-2 gap-3 md:min-w-[260px]">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">
              Systems
            </span>
            <span className="text-xl font-bold text-white font-mono mt-1">
              {summary.operationalServicesCount}/{summary.totalServicesCount}
            </span>
            <span className="text-[10px] text-slate-400 mt-1">
              {systemsSubtext}
            </span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">
              Incidents
            </span>
            <span className="text-xl font-bold text-white font-mono mt-1">
              {summary.activeIncidentsCount}
            </span>
            <span className="text-[10px] text-slate-400 mt-1">
              {incidentsSubtext}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
