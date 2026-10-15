"use client";

interface StatusHeaderProps {
  autoRefresh: boolean;
  onToggleAutoRefresh: () => void;
}

export function StatusHeader({
  autoRefresh,
  onToggleAutoRefresh,
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
        </div>
      </div>
    </header>
  );
}
