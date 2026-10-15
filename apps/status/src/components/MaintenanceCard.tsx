import type { ScheduledMaintenance } from "@/lib/types";

interface MaintenanceCardProps {
  maintenance: ScheduledMaintenance;
}

export function MaintenanceCard({ maintenance }: MaintenanceCardProps) {
  const startDate = new Date(maintenance.scheduledStart).toUTCString();
  const endDate = new Date(maintenance.scheduledEnd).toUTCString();

  return (
    <div className="bg-sky-950/30 border border-sky-500/30 rounded-xl p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse" />
          <h4 className="font-semibold text-sky-200 text-sm">
            Scheduled Maintenance: {maintenance.title}
          </h4>
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30 uppercase">
          {maintenance.status.replace("_", " ")}
        </span>
      </div>

      <p className="text-xs text-slate-300 leading-relaxed">
        {maintenance.description}
      </p>

      <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-sky-500/20 font-mono">
        <div>
          <span>Window: </span>
          <span className="text-slate-200">{startDate}</span>
          <span> &rarr; </span>
          <span className="text-slate-200">{endDate}</span>
        </div>
        <div>
          <span>Affected: </span>
          <span className="text-slate-300 font-sans">
            {maintenance.affectedServiceIds.join(", ")}
          </span>
        </div>
      </div>
    </div>
  );
}
