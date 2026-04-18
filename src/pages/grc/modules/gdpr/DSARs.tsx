const DSARS = [
  { id: "DSAR-2026-012", type: "Acceso",    status: "En curso",  sla: "2026-04-25", subject: "cliente anónimo #4412" },
  { id: "DSAR-2026-013", type: "Supresión", status: "Resuelto",  sla: "2026-04-10", subject: "cliente anónimo #1180" },
];

const STATUS_CHIP: Record<string, string> = {
  "En curso": "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  Resuelto:   "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  Pendiente:  "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
};

function slaClass(sla: string) {
  const days = Math.round((new Date(sla).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return "text-[var(--status-error)] font-semibold";
  if (days <= 5) return "text-[var(--status-warning)] font-semibold";
  return "text-[var(--g-text-secondary)]";
}

export default function DSARs() {
  return (
    <div className="p-6 space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">
          Derechos ARCO (DSARs)
        </h1>
        <p className="text-sm text-[var(--g-text-secondary)]">
          Solicitudes de ejercicio de derechos · SLA 30 días (Art. 12 GDPR).
        </p>
      </header>

      <div
        className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[var(--g-surface-subtle)]">
                {["Id", "Tipo", "Interesado", "Estado", "SLA"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--g-border-subtle)]">
              {DSARS.map((d) => (
                <tr key={d.id} className="hover:bg-[var(--g-surface-subtle)]/50 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-[var(--g-text-secondary)]">{d.id}</td>
                  <td className="px-5 py-3 font-medium text-[var(--g-text-primary)]">{d.type}</td>
                  <td className="px-5 py-3 text-[var(--g-text-secondary)]">{d.subject}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${STATUS_CHIP[d.status] ?? ""}`}
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      {d.status}
                    </span>
                  </td>
                  <td className={`px-5 py-3 text-xs ${slaClass(d.sla)}`}>{d.sla}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
