"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { calculateSystemStatus } from "@/lib/status";
import type {
  Incident,
  ProbeResult,
  ProbeType,
  ScheduledMaintenance,
  ServiceCategory,
  ServiceComponent,
  ServiceStatus,
  SystemStatusSummary,
} from "@/lib/types";
import { FutureAppsCard } from "./FutureAppsCard";
import { HeroBanner } from "./HeroBanner";
import { IncidentHistory } from "./IncidentHistory";
import { MaintenanceCard } from "./MaintenanceCard";
import { ServiceCard } from "./ServiceCard";
import { StatusHeader } from "./StatusHeader";
import { SubscribeModal } from "./SubscribeModal";

interface StatusDashboardProps {
  initialServices: ServiceComponent[];
  initialSummary: SystemStatusSummary;
  activeIncidents: Incident[];
  pastIncidents: Incident[];
  scheduledMaintenances: ScheduledMaintenance[];
}

export function StatusDashboard({
  initialServices,
  initialSummary,
  activeIncidents,
  pastIncidents,
  scheduledMaintenances,
}: StatusDashboardProps) {
  const [services, setServices] = useState<ServiceComponent[]>(initialServices);
  const [summary, setSummary] = useState<SystemStatusSummary>(initialSummary);
  const [selectedCategory, setSelectedCategory] = useState<
    ServiceCategory | "all"
  >("all");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isSubscribeOpen, setIsSubscribeOpen] = useState(false);
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
      const res = await fetch("/api/probe", {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return;
      const data = await res.json();
      const results = data.results as Record<string, ProbeResult>;

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

  // Auto-refresh interval (every 30 seconds)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      runLiveProbe();
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, runLiveProbe]);

  const filteredServices =
    selectedCategory === "all"
      ? services
      : services.filter((s) => s.category === selectedCategory);

  const appsCount = services.filter((s) => s.category === "apps").length;
  const platformCount = services.filter(
    (s) => s.category === "platform",
  ).length;
  const infraCount = services.filter((s) => s.category === "infra").length;

  return (
    <div className="flex flex-col min-h-screen bg-[#090d16]">
      {/* Header */}
      <StatusHeader
        autoRefresh={autoRefresh}
        onToggleAutoRefresh={() => setAutoRefresh(!autoRefresh)}
        onOpenSubscribe={() => setIsSubscribeOpen(true)}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 flex-1 w-full space-y-10">
        {/* Hero status banner */}
        <HeroBanner
          summary={summary}
          services={services}
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

        {/* Services Section */}
        <section className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Services & Applications
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Current operational status and continuous 90-day uptime metrics
              </p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-800 text-xs font-medium">
              <button
                type="button"
                onClick={() => setSelectedCategory("all")}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  selectedCategory === "all"
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                All ({services.length})
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory("apps")}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  selectedCategory === "apps"
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Apps ({appsCount})
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory("platform")}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  selectedCategory === "platform"
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Platform ({platformCount})
              </button>
              <button
                type="button"
                onClick={() => setSelectedCategory("infra")}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  selectedCategory === "infra"
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Infra ({infraCount})
              </button>
            </div>
          </div>

          {/* Service Cards List */}
          <div className="space-y-3">
            {filteredServices.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        </section>

        {/* Future Apps Guide Callout */}
        <FutureAppsCard />

        {/* Incident History Section */}
        <section className="pt-4 border-t border-slate-800/80">
          <IncidentHistory
            activeIncidents={activeIncidents}
            pastIncidents={pastIncidents}
          />
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/60 py-8 mt-12 text-xs text-slate-400">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-white tracking-tight">
              FSH Lab Operations
            </span>
            <span>•</span>
            <span className="font-mono text-[11px] text-slate-400">
              Europe/Oslo (CET) &amp; UTC
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <a
              href="/api/status.json"
              target="_blank"
              rel="noreferrer"
              className="text-slate-400 hover:text-slate-200 hover:underline transition-colors font-mono"
            >
              JSON Status API
            </a>
            <a
              href="/api/feed.xml"
              target="_blank"
              rel="noreferrer"
              className="text-slate-400 hover:text-slate-200 hover:underline transition-colors font-mono"
            >
              Atom / RSS
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

      {/* Subscription Modal */}
      <SubscribeModal
        isOpen={isSubscribeOpen}
        onClose={() => setIsSubscribeOpen(false)}
      />
    </div>
  );
}
