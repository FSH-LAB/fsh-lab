"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { calculateSystemStatus } from "@/lib/status";
import type {
  Incident,
  ProbeResult,
  ProbeType,
  ScheduledMaintenance,
  ServiceComponent,
  ServiceStatus,
  SystemStatusSummary,
} from "@/lib/types";
import { HeroBanner } from "./HeroBanner";
import { IncidentHistory } from "./IncidentHistory";
import { MaintenanceCard } from "./MaintenanceCard";
import { ServiceCard } from "./ServiceCard";
import { StatusHeader } from "./StatusHeader";

interface StatusDashboardProps {
  initialServices: ServiceComponent[];
  initialSummary: SystemStatusSummary;
  activeIncidents: Incident[];
  scheduledMaintenances: ScheduledMaintenance[];
}

export function StatusDashboard({
  initialServices,
  initialSummary,
  activeIncidents,
  scheduledMaintenances,
}: StatusDashboardProps) {
  const [services, setServices] = useState<ServiceComponent[]>(initialServices);
  const [summary, setSummary] = useState<SystemStatusSummary>(initialSummary);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [isPending, startTransition] = useTransition();

  // Seconds ago counter
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsAgo((s) => s + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Perform live probe against registered endpoints
  const runLiveProbe = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/services/probe", {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return;
      const data = await res.json();
      const results = (data.data?.results ?? data.results) as Record<
        string,
        ProbeResult
      >;

      startTransition(() => {
        setServices((prev) => {
          const updated = prev.map((service) => {
            const probe = results[service.id];
            if (!probe) return service;
            return {
              ...service,
              status: (probe.status as ServiceStatus) || service.status,
              probeType: (probe.probeType as ProbeType) || service.probeType,
              currentLatencyMs: probe.latencyMs,
            };
          });
          setSummary(
            calculateSystemStatus(
              updated,
              activeIncidents,
              scheduledMaintenances,
            ),
          );
          return updated;
        });
        setSecondsAgo(0);
      });
    } catch {
      // Gracefully handle network interruptions / dev server restarts
    }
  }, [activeIncidents, scheduledMaintenances]);

  // Initial live probe on mount and periodic auto-refresh (every 30 seconds)
  useEffect(() => {
    if (!autoRefresh) return;
    runLiveProbe();
    const interval = setInterval(() => {
      runLiveProbe();
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, runLiveProbe]);

  return (
    <div className="flex flex-col min-h-screen bg-[#090d16]">
      {/* Header */}
      <StatusHeader
        autoRefresh={autoRefresh}
        onToggleAutoRefresh={() => setAutoRefresh(!autoRefresh)}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 flex-1 w-full space-y-10">
        {/* Hero status banner */}
        <HeroBanner
          summary={summary}
          isProbing={isPending}
          onRefresh={runLiveProbe}
          secondsAgo={secondsAgo}
        />

        {/* Scheduled Maintenance if any */}
        {scheduledMaintenances.length > 0 && (
          <div className="space-y-3">
            {scheduledMaintenances.map((m) => (
              <MaintenanceCard key={m.id} maintenance={m} />
            ))}
          </div>
        )}

        {/* Services & Applications Section */}
        <section className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Services &amp; Applications
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Real-time operational status and active response telemetry
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {services.length} Monitored Service
              {services.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="space-y-3">
            {services.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        </section>

        {/* Active Incidents (only rendered during active incidents) */}
        {activeIncidents.length > 0 && (
          <section className="pt-4 border-t border-slate-800/80">
            <IncidentHistory activeIncidents={activeIncidents} />
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/60 py-8 mt-12 text-xs text-slate-400">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-white tracking-tight">
              FSH LAB
            </span>
            <span>•</span>
            <span className="font-mono text-[11px] text-slate-400">
              Europe/Oslo (CET) &amp; UTC
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <a
              href="/api/v1/status"
              target="_blank"
              rel="noreferrer"
              className="text-slate-400 hover:text-slate-200 hover:underline transition-colors font-mono"
            >
              REST Status API
            </a>
            <a
              href="/api/v1/feed"
              target="_blank"
              rel="noreferrer"
              className="text-slate-400 hover:text-slate-200 hover:underline transition-colors font-mono"
            >
              Atom Feed
            </a>
            <a
              href="https://github.com/FSH-LAB/fsh-lab"
              target="_blank"
              rel="noreferrer"
              className="text-slate-400 hover:text-slate-200 hover:underline transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
