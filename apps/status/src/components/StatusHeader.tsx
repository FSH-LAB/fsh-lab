"use client";

interface StatusHeaderProps {
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
  onOpenSubscribe: () => void;
}

export function StatusHeader({
  autoRefresh,
  onToggleAutoRefresh,
  onOpenSubscribe,
}: StatusHeaderProps) {
  return (
    <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-base tracking-tight">
                FSH LAB
              </span>
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                STATUS
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Uptime & Performance Monitoring
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Auto refresh button */}
          <button
            type="button"
            onClick={onToggleAutoRefresh}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-colors ${
              autoRefresh
                ? "bg-slate-900 border-slate-700 text-slate-200 hover:border-slate-600"
                : "bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-400"
            }`}
            title={
              autoRefresh
                ? "Auto-refresh is active (30s)"
                : "Auto-refresh is paused"
            }
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                autoRefresh ? "bg-emerald-400" : "bg-slate-600"
              }`}
            />
            <span className="hidden xs:inline">Auto-refresh</span>
            <span className="text-[10px] font-mono text-slate-400">
              {autoRefresh ? "30s" : "Off"}
            </span>
          </button>

          {/* Subscribe to updates button */}
          <button
            type="button"
            onClick={onOpenSubscribe}
            className="text-xs px-3.5 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition-colors shadow-sm flex items-center gap-1.5"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
              />
            </svg>
            <span>Subscribe to Updates</span>
          </button>
        </div>
      </div>
    </header>
  );
}
