import type { Incident } from "@/lib/types";

interface IncidentHistoryProps {
  activeIncidents: Incident[];
}

export function IncidentHistory({ activeIncidents }: IncidentHistoryProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "investigating":
        return "bg-rose-500/20 text-rose-300 border-rose-500/30";
      case "identified":
        return "bg-amber-500/20 text-amber-300 border-amber-500/30";
      case "monitoring":
        return "bg-sky-500/20 text-sky-300 border-sky-500/30";
      case "resolved":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  if (activeIncidents.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold text-rose-400 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
        Active Incidents ({activeIncidents.length})
      </h3>

      {activeIncidents.map((incident) => (
        <div
          key={incident.id}
          className="bg-rose-950/20 border border-rose-500/30 rounded-xl p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="font-semibold text-white text-base">
              {incident.title}
            </h4>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium border uppercase tracking-wider ${getStatusColor(incident.status)}`}
            >
              {incident.status}
            </span>
          </div>

          {/* Updates timeline */}
          <div className="space-y-3 pt-2 border-t border-rose-500/20">
            {incident.updates.map((update) => (
              <div key={update.id} className="text-xs space-y-1">
                <div className="flex items-center gap-2 text-slate-400 font-mono">
                  <span className="font-semibold text-slate-200 capitalize">
                    {update.status}
                  </span>
                  <span>—</span>
                  <span>{new Date(update.timestamp).toUTCString()}</span>
                </div>
                <p className="text-slate-300 leading-relaxed pl-2 border-l-2 border-slate-700">
                  {update.message}
                </p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
