const DPIAS = [
  { id: "DPIA-01", name: "Modelo IA de scoring de siniestros", status: "Aprobada",    risk: "Alto",  date: "2026-01-20" },
  { id: "DPIA-02", name: "Analítica comportamiento web",        status: "En revisión", risk: "Medio", date: "2026-03-04" },
];

const STATUS_CHIP: Record<string, string> = {
  Aprobada:     "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  "En revisión":"bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  Rechazada:    "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
};

const RISK_CHIP: Record<string, string> = {
  Alto:  "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  Medio: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  Bajo:  "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
};

export default function DPIAs() {
  return (
    <div className="p-6 space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">
          Evaluaciones de Impacto (DPIAs)
        </h1>
        <p className="text-sm text-[var(--g-text-secondary)]">
          Art. 35 GDPR · {DPIAS.length} DPIAs registradas.
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
                {["Id", "Nombre del tratamiento", "Estado", "Nivel de riesgo", "Fecha"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--g-border-subtle)]">
              {DPIAS.map((d) => (
                <tr key={d.id} className="hover:bg-[var(--g-surface-subtle)]/50 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-[var(--g-text-secondary)]">{d.id}</td>
                  <td className="px-5 py-3 font-medium text-[var(--g-text-primary)]">{d.name}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${STATUS_CHIP[d.status] ?? ""}`}
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      {d.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${RISK_CHIP[d.risk] ?? ""}`}
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      {d.risk}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[var(--g-text-secondary)]">{d.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
