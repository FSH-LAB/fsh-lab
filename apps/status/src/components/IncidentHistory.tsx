import type { Incident } from "@/lib/types";

interface IncidentHistoryProps {
  activeIncidents: Incident[];
  pastIncidents: Incident[];
}

export function IncidentHistory({
  activeIncidents,
  pastIncidents,
}: IncidentHistoryProps) {
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

  return (
    <div className="space-y-6">
      {/* Active Incidents */}
      {activeIncidents.length > 0 && (
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
      )}

      {/* Past Incidents */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-lg font-bold text-white tracking-tight">
            Past Incident History
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            Showing past 90 days
          </span>
        </div>

        {pastIncidents.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-8 text-center space-y-2">
            <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
              ✓
            </div>
            <h4 className="font-semibold text-white text-sm">
              No incidents reported
            </h4>
            <p className="text-xs text-slate-400">
              All systems experienced 100% operational uptime with zero recorded
              incidents.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pastIncidents.map((incident) => (
              <div
                key={incident.id}
                className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-5 space-y-3 hover:border-slate-700/60 transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="font-semibold text-white text-sm">
                      {incident.title}
                    </h4>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Affected:{" "}
                      <span className="text-slate-300 font-mono">
                        {incident.affectedServiceIds.join(", ")}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium border uppercase tracking-wider ${getStatusColor(incident.status)}`}
                  >
                    {incident.status}
                  </span>
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-800/60">
                  {incident.updates.map((update) => (
                    <div key={update.id} className="text-xs space-y-1">
                      <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
                        <span className="font-semibold text-slate-200 capitalize">
                          {update.status}
                        </span>
                        <span>•</span>
                        <span>{new Date(update.timestamp).toUTCString()}</span>
                      </div>
                      <p className="text-slate-300 text-xs leading-relaxed pl-2.5 border-l border-slate-700">
                        {update.message}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
