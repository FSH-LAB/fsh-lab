"use client";

import { useState } from "react";

export function FutureAppsCard() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-slate-900/30 border border-slate-800/80 rounded-xl p-5 transition-all">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 6v6m0 0v6m0-6h6m-6 0H6"
              />
            </svg>
          </div>
          <div>
            <h4 className="font-semibold text-white text-sm">
              Extensible Multi-App Architecture
            </h4>
            <p className="text-xs text-slate-400">
              Designed to automatically monitor current and future FSH Lab
              applications.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-950 flex items-center gap-1.5 transition-colors"
        >
          <span>
            {isOpen ? "Hide developer guide" : "How to add a future app"}
          </span>
          <svg
            className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
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
        </button>
      </div>

      {isOpen && (
        <div className="mt-4 pt-4 border-t border-slate-800/60 space-y-3 text-xs text-slate-300 animate-in fade-in duration-150">
          <p>
            When adding a new service under{" "}
            <code className="text-emerald-400 font-mono">
              apps/your-new-app
            </code>
            , register it in{" "}
            <code className="text-emerald-400 font-mono">
              apps/status/src/lib/services.ts
            </code>
            :
          </p>

          <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-200 overflow-x-auto">
            {`// apps/status/src/lib/services.ts
{
  id: "your-new-app",
  name: "Your New Application",
  category: "apps",
  description: "Description of your new service.",
  appUrl: "https://your-new-app.com",
  healthEndpoint: "https://your-new-app.com/api/health",
  targetUptime: 99.99,
  baseLatencyMs: 30,
  varianceMs: 10,
}`}
          </pre>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-[11px] text-slate-400">
            <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60">
              <span className="font-semibold text-slate-200 block mb-1">
                1. Standard Health Endpoint
              </span>
              The new app provides{" "}
              <code className="text-slate-300">/api/health</code> returning ok
              status, commit SHA, and uptime.
            </div>
            <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60">
              <span className="font-semibold text-slate-200 block mb-1">
                2. Live Synthetic Prober
              </span>
              The prober automatically measures HTTP latency and status codes
              every 30s.
            </div>
            <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60">
              <span className="font-semibold text-slate-200 block mb-1">
                3. Unified Feeds & API
              </span>
              Incidents, RSS feeds, and{" "}
              <code className="text-slate-300">/api/status.json</code>{" "}
              dynamically include the new app.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
