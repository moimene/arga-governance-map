const ROPA_DATA = [
  { id: "R-01", purpose: "Contratación de pólizas",    legal_basis: "Contrato",          data_subjects: "Clientes",            retention: "10 años",              risk: "Medio" },
  { id: "R-02", purpose: "Marketing renovaciones",      legal_basis: "Consentimiento",    data_subjects: "Clientes",            retention: "Hasta revocación",     risk: "Bajo" },
  { id: "R-03", purpose: "Siniestros y fraude",         legal_basis: "Interés legítimo",  data_subjects: "Clientes, terceros",  retention: "15 años",              risk: "Alto" },
];

const RISK_CHIP: Record<string, string> = {
  Alto:  "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  Medio: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  Bajo:  "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
};

export default function ROPA() {
  return (
    <div className="p-6 space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">
          Registro de Actividades de Tratamiento (ROPA)
        </h1>
        <p className="text-sm text-[var(--g-text-secondary)]">
          Art. 30 GDPR · {ROPA_DATA.length} tratamientos registrados.
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
                {["Id", "Finalidad", "Base legal", "Afectados", "Retención", "Riesgo"].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-medium text-[var(--g-text-primary)] uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--g-border-subtle)]">
              {ROPA_DATA.map((r) => (
                <tr key={r.id} className="hover:bg-[var(--g-surface-subtle)]/50 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-[var(--g-text-secondary)]">{r.id}</td>
                  <td className="px-5 py-3 font-medium text-[var(--g-text-primary)]">{r.purpose}</td>
                  <td className="px-5 py-3 text-[var(--g-text-secondary)]">{r.legal_basis}</td>
                  <td className="px-5 py-3 text-[var(--g-text-secondary)]">{r.data_subjects}</td>
                  <td className="px-5 py-3 text-[var(--g-text-secondary)]">{r.retention}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${RISK_CHIP[r.risk] ?? ""}`}
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      {r.risk}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
