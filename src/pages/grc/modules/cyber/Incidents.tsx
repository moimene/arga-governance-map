import { useIncidents } from "@/hooks/useIncidents";
import { Link } from "react-router-dom";

const SEV_CHIP: Record<string, string> = {
  Crítico: "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  Alto:    "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  Medio:   "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
  Bajo:    "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
};

export default function CyberIncidents() {
  const { data: incidents = [], isLoading } = useIncidents("CYBER");

  return (
    <div className="p-6 space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">Incidentes Cyber</h1>
        <p className="text-sm text-[var(--g-text-secondary)]">
          Incidentes de ciberseguridad detectados y gestionados.
        </p>
      </header>

      {isLoading && (
        <div className="text-sm text-[var(--g-text-secondary)] animate-pulse">Cargando…</div>
      )}

      {!isLoading && incidents.length === 0 && (
        <div className="py-16 text-center text-sm text-[var(--g-text-secondary)]">
          No hay incidentes CYBER registrados.
        </div>
      )}

      <div className="space-y-3">
        {incidents.map((i) => (
          <div
            key={i.id}
            className="bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-4 flex items-start gap-3"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div
              className={`h-2.5 w-2.5 rounded-full mt-1.5 shrink-0 ${
                i.severity === "Crítico" ? "bg-[var(--status-error)]" :
                i.severity === "Alto" ? "bg-[var(--status-warning)]" :
                "bg-[var(--g-sec-300)]"
              }`}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-mono text-xs text-[var(--g-text-secondary)]">{i.code}</span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ${SEV_CHIP[i.severity] ?? ""}`}
                  style={{ borderRadius: "var(--g-radius-full)" }}
                >
                  {i.severity}
                </span>
                <span className="text-xs text-[var(--g-text-secondary)]">{i.status}</span>
                <span className="text-xs text-[var(--g-text-secondary)]">{i.country_code}</span>
              </div>
              <div className="text-sm font-medium text-[var(--g-text-primary)]">{i.title}</div>
              {i.description && (
                <div className="text-xs text-[var(--g-text-secondary)] mt-1 line-clamp-2">
                  {i.description}
                </div>
              )}
            </div>
            <Link
              to={`/grc/incidentes/${i.id}`}
              className="text-sm text-[var(--g-link)] hover:text-[var(--g-link-hover)] underline shrink-0"
            >
              Abrir →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
