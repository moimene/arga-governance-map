import { useRisks, type RiskRow } from "@/hooks/useRisks";
import { Link, useSearchParams } from "react-router-dom";
import { Activity, Pencil, PlusCircle, Route } from "lucide-react";

const SCORE_BG = (score: number) => {
  if (score >= 20) return "bg-[var(--status-error)]";
  if (score >= 15) return "bg-[var(--status-error)]/80";
  if (score >= 10) return "bg-[var(--status-warning)]";
  if (score >= 5)  return "bg-[var(--g-sec-300)]";
  return "bg-[var(--g-surface-muted)]";
};

const MODULE_LABEL: Record<string, string> = {
  dora: "DORA",
  gdpr: "GDPR",
  cyber: "CYBER",
  audit: "AUDIT",
  penal: "PENAL",
};

export default function Risk360() {
  const [params] = useSearchParams();
  const findingFilter = params.get("finding");
  const handoff = params.get("handoff");
  const handoffSource = params.get("source");
  const { data: allRisks = [], isLoading } = useRisks();

  const risks = findingFilter
    ? allRisks.filter((r) => r.findings?.code === findingFilter)
    : allRisks;

  // Construir matriz 5×5: filas = impacto 5..1, cols = probabilidad 1..5
  const grid: RiskRow[][][] = Array.from({ length: 5 }, () =>
    Array.from({ length: 5 }, () => [] as RiskRow[])
  );
  risks.forEach((r) => {
    const p = Math.min(5, Math.max(1, r.probability ?? 1));
    const i = Math.min(5, Math.max(1, r.impact ?? 1));
    grid[5 - i][p - 1].push(r);
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-[var(--g-brand-3308)]" />
          <div>
            <h1 className="text-2xl font-bold text-[var(--g-text-primary)]">Risk 360</h1>
            <p className="text-sm text-[var(--g-text-secondary)]">
              Vista transversal del universo de riesgos GRC.
              {findingFilter && (
                <>
                  {" "}Filtrando por hallazgo{" "}
                  <strong className="text-[var(--g-text-primary)]">{findingFilter}</strong>.
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {findingFilter && (
            <Link
              to="/grc/risk-360"
              className="text-sm text-[var(--g-link)] hover:text-[var(--g-link-hover)] underline"
            >
              Limpiar filtro
            </Link>
          )}
          <Link
            to="/grc/risk-360/nuevo"
            className="inline-flex items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <PlusCircle className="h-4 w-4" />
            Nuevo riesgo
          </Link>
        </div>
      </header>

      {handoffSource === "aims" && handoff && (
        <div
          className="flex flex-col gap-3 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-4 md:flex-row md:items-center md:justify-between"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <div className="flex items-start gap-3">
            <Route className="mt-0.5 h-5 w-5 text-[var(--g-brand-3308)]" />
            <div>
              <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
                Intake read-only desde AIMS
              </h2>
              <p className="text-sm leading-6 text-[var(--g-text-secondary)]">
                {handoff} se muestra como contexto de entrada. GRC decidirá si abre riesgo,
                control o plan owner; esta ruta no escribe eventos ni links cross-module.
              </p>
            </div>
          </div>
          <Link
            to="/grc/m/audit/operate/plans"
            className="inline-flex items-center justify-center bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Ver planes GRC
          </Link>
        </div>
      )}

      <div className="flex gap-4 flex-col lg:flex-row">
        {/* Heatmap */}
        <div
          className="flex-1 bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-4"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="text-xs font-semibold text-[var(--g-text-secondary)] uppercase mb-3">
            Mapa de calor (Probabilidad × Impacto)
          </div>
          {isLoading ? (
            <div className="text-sm text-[var(--g-text-secondary)] py-8 text-center animate-pulse">
              Cargando…
            </div>
          ) : (
            <div className="grid grid-cols-[auto_repeat(5,1fr)] gap-1">
              {/* Header row */}
              <div />
              {[1, 2, 3, 4, 5].map((p) => (
                <div
                  key={`ph-${p}`}
                  className="text-xs text-center pb-1 text-[var(--g-text-secondary)]"
                >
                  P={p}
                </div>
              ))}
              {/* Grid rows */}
              {grid.map((row, ridx) => (
                <div key={`row-${ridx}`} className="contents">
                  <div className="text-xs text-right self-center pr-1 text-[var(--g-text-secondary)]">
                    I={5 - ridx}
                  </div>
                  {row.map((cell, cidx) => {
                    const score = (5 - ridx) * (cidx + 1);
                    const hasRisks = cell.length > 0;
                    return (
                      <div
                        key={`cell-${ridx}-${cidx}`}
                        title={
                          hasRisks
                            ? cell.map((r) => `${r.code}: ${r.title}`).join("\n")
                            : `Score ${score}`
                        }
                        className={`aspect-square flex items-center justify-center text-sm font-semibold transition-all ${
                          hasRisks
                            ? `${SCORE_BG(score)} text-[var(--g-text-inverse)] cursor-pointer hover:opacity-80`
                            : "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]"
                        }`}
                        style={{ borderRadius: "var(--g-radius-sm)" }}
                      >
                        {hasRisks ? cell.length : "·"}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {/* Legend */}
          <div className="flex gap-3 mt-4 flex-wrap">
            {[
              { label: "Crítico (≥20)", cls: "bg-[var(--status-error)]" },
              { label: "Alto (15-19)", cls: "bg-[var(--status-error)]/80" },
              { label: "Medio (10-14)", cls: "bg-[var(--status-warning)]" },
              { label: "Bajo (5-9)", cls: "bg-[var(--g-sec-300)]" },
              { label: "Mínimo (<5)", cls: "bg-[var(--g-surface-muted)]" },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1">
                <div
                  className={`h-3 w-3 rounded-sm ${l.cls}`}
                />
                <span className="text-xs text-[var(--g-text-secondary)]">{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Risk list */}
        <div
          className="w-full lg:w-[360px] bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-4"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <div className="text-xs font-semibold uppercase text-[var(--g-text-secondary)] mb-3">
            Riesgos ({risks.length})
          </div>

          {risks.length === 0 && !isLoading && (
            <div className="py-8 text-center text-sm text-[var(--g-text-secondary)]">
              No hay riesgos{findingFilter ? " para este filtro" : ""}.
            </div>
          )}

          <div className="space-y-2 overflow-y-auto max-h-[480px]">
            {risks.map((r) => (
              <div
                key={r.id}
                className="p-3 border border-[var(--g-border-subtle)] bg-[var(--g-surface-page)]"
                style={{ borderRadius: "var(--g-radius-md)" }}
              >
                <div className="text-sm font-semibold text-[var(--g-text-primary)]">
                  {r.code}
                </div>
                <div className="text-xs text-[var(--g-text-secondary)] mt-0.5 leading-snug">
                  {r.title}
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span
                    className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-[var(--g-surface-subtle)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]"
                    style={{ borderRadius: "var(--g-radius-full)" }}
                  >
                    P{r.probability}·I{r.impact}·RS{r.residual_score}
                  </span>
                  {r.module_id && (
                    <span
                      className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
                      style={{ borderRadius: "var(--g-radius-full)" }}
                    >
                      {MODULE_LABEL[r.module_id] ?? r.module_id.toUpperCase()}
                    </span>
                  )}
                  {r.obligations?.code && (
                    <Link
                      to={`/obligaciones/${r.obligations.code}`}
                      className="text-[11px] underline text-[var(--g-link)] hover:text-[var(--g-link-hover)]"
                    >
                      {r.obligations.code}
                    </Link>
                  )}
                  {r.findings?.code && (
                    <Link
                      to={`/hallazgos/${r.findings.code}`}
                      className="text-[11px] underline text-[var(--g-link)] hover:text-[var(--g-link-hover)]"
                    >
                      {r.findings.code}
                    </Link>
                  )}
                  <Link
                    to={`/grc/risk-360/${r.id}/editar`}
                    className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-[var(--g-link)] hover:text-[var(--g-link-hover)]"
                  >
                    <Pencil className="h-3 w-3" />
                    Editar
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
