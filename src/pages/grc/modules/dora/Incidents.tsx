import { useIncidents } from "@/hooks/useIncidents";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Plus } from "lucide-react";
import { deadlineLabel } from "@/hooks/useRegulatoryNotif";

const SEV_CHIP: Record<string, string> = {
  Crítico: "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  Alto:    "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  Medio:   "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
  Bajo:    "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
};

export default function DoraIncidents() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const obligationFilter = params.get("obligation");
  const { data: all = [], isLoading } = useIncidents("DORA");

  const data = obligationFilter
    ? all.filter((i: any) => (i.obligations as any)?.code === obligationFilter)
    : all;

  return (
    <div className="p-6 space-y-5">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">Incidentes DORA</h1>
          <p className="text-sm text-[var(--g-text-secondary)]">
            {obligationFilter ? (
              <>Filtrando por obligación <strong>{obligationFilter}</strong>. <Link to="/grc/m/dora/operate/incidents" className="text-[var(--g-link)] underline">Limpiar</Link></>
            ) : (
              "Operativa DORA · Resiliencia ICT"
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/grc/incidentes/nuevo")}
          className="inline-flex items-center gap-2 px-4 h-10 text-sm font-medium bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)] hover:bg-[var(--g-sec-700)] transition-colors"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Nuevo incidente
        </button>
      </header>

      {isLoading && <div className="text-sm text-[var(--g-text-secondary)] animate-pulse">Cargando…</div>}

      {!isLoading && data.length === 0 && (
        <div className="py-16 text-center text-sm text-[var(--g-text-secondary)]">
          No hay incidentes DORA{obligationFilter ? " para esta obligación" : ""}.
        </div>
      )}

      <div className="space-y-3">
        {data.map((i: any) => {
          const notif = (i.regulatory_notifications ?? []).find((n: any) => n.status === "Pendiente");
          return (
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
                  {i.is_major_incident && (
                    <span
                      className="inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-[var(--status-error)] text-[var(--g-text-inverse)]"
                      style={{ borderRadius: "var(--g-radius-sm)" }}
                    >
                      MAJOR
                    </span>
                  )}
                  <span className="text-xs text-[var(--g-text-secondary)]">{i.status}</span>
                </div>
                <div className="text-sm font-medium text-[var(--g-text-primary)]">{i.title}</div>
                <div className="flex items-center gap-3 mt-1 text-xs text-[var(--g-text-secondary)] flex-wrap">
                  {(i.obligations as any)?.code && (
                    <span>Obligación: {(i.obligations as any).code}</span>
                  )}
                  {i.regulatory_notifications?.map((n: any) => (
                    <span
                      key={n.id}
                      className="inline-flex items-center px-2 py-0.5 border border-[var(--g-border-default)] text-[var(--g-text-secondary)] bg-transparent"
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      {n.authority} · {n.status}
                    </span>
                  ))}
                  {notif && (
                    <span className="font-semibold text-[var(--status-warning)]">
                      {deadlineLabel(notif.notification_deadline)}
                    </span>
                  )}
                </div>
              </div>
              <Link
                to={`/grc/incidentes/${i.id}`}
                className="text-sm text-[var(--g-link)] hover:text-[var(--g-link-hover)] underline shrink-0"
              >
                Abrir →
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
