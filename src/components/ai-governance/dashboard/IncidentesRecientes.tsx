export interface IncidentesRecientesProps {
  incidents: { id: string; severity?: string | null; title?: string | null }[];
}

/** Los tres últimos incidentes del ámbito. Sin ninguno se dice, no se pinta un hueco. */
export function IncidentesRecientes({ incidents }: IncidentesRecientesProps) {
  return (
    <div
      className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-5"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <h2 className="text-sm font-semibold text-[var(--g-text-primary)] mb-4">Incidentes recientes</h2>
      {incidents.length === 0 ? (
        <p className="text-xs text-[var(--g-text-secondary)]">Sin incidentes registrados</p>
      ) : (
        <div className="space-y-3">
          {incidents.slice(0, 3).map((inc) => (
            <div key={inc.id} className="flex items-start gap-2">
              <span
                className={`mt-0.5 inline-flex shrink-0 items-center px-1.5 py-0.5 text-[10px] font-bold text-[var(--g-text-inverse)] ${
                  inc.severity === "ALTO" || inc.severity === "CRITICO"
                    ? "bg-[var(--status-error)]"
                    : inc.severity === "MEDIO"
                    ? "bg-[var(--status-warning)]"
                    : "bg-[var(--status-info)]"
                }`}
                style={{ borderRadius: "var(--g-radius-sm)" }}
              >
                {inc.severity}
              </span>
              <p className="text-xs text-[var(--g-text-secondary)] leading-snug line-clamp-2">{inc.title}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
