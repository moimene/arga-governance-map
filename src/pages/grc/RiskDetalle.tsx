import { useParams, useNavigate, Link } from "react-router-dom";
import { Activity, ChevronLeft, Pencil, ShieldCheck, Link2 } from "lucide-react";
import { useRiskById } from "@/hooks/useRisks";
import { useSecretariaScope } from "@/components/secretaria/shell";
import {
  COLOR_BANDA,
  ETIQUETA_BANDA,
  COLOR_CELDA,
  ETIQUETA_CELDA,
  NOTA_ESCALA,
  tieneEjes,
  type Celda,
} from "@/lib/grc/assessed-band";

export default function RiskDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const scope = useSecretariaScope();
  const riskListPath = scope.createScopedTo("/grc/risk-360");
  const { data: risk, isLoading, error } = useRiskById(id);

  if (isLoading) {
    return (
      <div className="p-6 max-w-[920px] mx-auto space-y-4">
        {[1, 2, 3].map((item) => (
          <div key={item} className="skeleton h-24" style={{ borderRadius: "var(--g-radius-lg)" }} />
        ))}
      </div>
    );
  }

  if (error || !risk) {
    return (
      <div className="p-6 max-w-[920px] mx-auto">
        <button
          type="button"
          onClick={() => navigate(riskListPath)}
          className="mb-4 flex items-center gap-1.5 text-sm text-[var(--g-text-secondary)] hover:text-[var(--g-brand-3308)]"
        >
          <ChevronLeft className="h-4 w-4" />
          Volver a Risk 360
        </button>
        <div
          className="p-6 bg-[var(--g-surface-card)] border border-[var(--status-error)]"
          style={{ borderRadius: "var(--g-radius-lg)" }}
        >
          <p className="text-sm font-medium text-[var(--status-error)]">
            No se pudo encontrar el riesgo solicitado.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[920px] mx-auto space-y-6">
      <button
        type="button"
        onClick={() => navigate(riskListPath)}
        className="flex items-center gap-1.5 text-sm text-[var(--g-text-secondary)] transition-colors hover:text-[var(--g-brand-3308)]"
      >
        <ChevronLeft className="h-4 w-4" />
        Risk 360
      </button>

      <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Activity className="h-5 w-5 text-[var(--g-brand-3308)]" />
            <div className="font-mono text-xs text-[var(--g-text-secondary)]">{risk.code}</div>
          </div>
          <h1 className="text-xl font-bold text-[var(--g-text-primary)] sm:text-2xl">
            {risk.title}
          </h1>
          {risk.description && (
            <p className="mt-2 text-sm leading-6 text-[var(--g-text-secondary)]">
              {risk.description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={scope.createScopedTo(`/grc/risk-360/${risk.id}/editar`)}
            className="inline-flex items-center gap-1.5 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-xs font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Link>
          <div
            className="inline-flex items-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-3 py-2 text-xs font-semibold text-[var(--g-text-primary)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <ShieldCheck className="h-4 w-4 text-[var(--g-brand-3308)]" />
            {risk.module_id?.toUpperCase() ?? "RISK"}
          </div>
        </div>
      </header>

      {/* Resumen de valoración */}
      <section
        className="grid gap-4 sm:grid-cols-3 bg-[var(--g-surface-card)] border border-[var(--g-border-default)] p-4"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div>
          <div className="text-xs font-semibold uppercase text-[var(--g-text-secondary)]">Estado</div>
          <div className="mt-1 text-base font-bold text-[var(--g-text-primary)]">
            {risk.status ?? "Abierto"}
          </div>
        </div>

        {tieneEjes(risk) ? (
          <>
            <div>
              <div className="text-xs font-semibold uppercase text-[var(--g-text-secondary)]">
                Probabilidad x Impacto
              </div>
              <div className="mt-1 text-base font-bold text-[var(--g-text-primary)]">
                {risk.probability} x {risk.impact} (Score: {risk.probability! * risk.impact!})
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase text-[var(--g-text-secondary)]">
                Score residual
              </div>
              <div className="mt-1 text-base font-bold text-[var(--g-text-primary)]">
                {risk.residual_score ?? "—"}
              </div>
            </div>
          </>
        ) : risk.assessed_band ? (
          <div className="sm:col-span-2">
            <div className="text-xs font-semibold uppercase text-[var(--g-text-secondary)]">
              Banda evaluada en origen
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 border border-[var(--g-border-subtle)]"
                style={{
                  backgroundColor: COLOR_BANDA[risk.assessed_band],
                  borderRadius: "var(--g-radius-sm)",
                }}
              />
              <span className="text-base font-bold text-[var(--g-text-primary)]">
                {ETIQUETA_BANDA[risk.assessed_band]}
              </span>
            </div>
          </div>
        ) : null}
      </section>

      {/* Desglose por las 18 columnas del mapa */}
      {risk.assessment_breakdown && (
        <section
          className="bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] p-4"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
            Exposición evaluada por ámbito
          </h2>
          <p className="mt-1 text-xs leading-5 text-[var(--g-text-secondary)]">{NOTA_ESCALA}</p>

          {([
            ["Áreas de negocio", risk.assessment_breakdown.areas_negocio],
            ["Departamentos internos", risk.assessment_breakdown.departamentos_internos],
          ] as const).map(([titulo, cols]) => (
            <div key={titulo} className="mt-4">
              <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--g-text-secondary)]">
                {titulo}
              </h3>
              <ul className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(cols ?? {}).map(([nombre, celda]) => {
                  const sinEvaluar = celda?.motivo === "NO_EVALUADA";
                  const colorKey = celda?.color as Celda | undefined;
                  return (
                    <li
                      key={nombre}
                      className="flex items-center gap-2 border border-[var(--g-border-subtle)] px-2 py-1.5"
                      style={{ borderRadius: "var(--g-radius-sm)" }}
                    >
                      <span
                        aria-hidden="true"
                        className="inline-block h-3 w-3 shrink-0 border border-[var(--g-border-subtle)]"
                        style={{
                          backgroundColor: sinEvaluar
                            ? "rgb(217,217,217)"
                            : colorKey && COLOR_CELDA[colorKey]
                            ? `rgb(${COLOR_CELDA[colorKey]})`
                            : "rgb(217,217,217)",
                          borderRadius: "var(--g-radius-sm)",
                        }}
                      />
                      <span className="min-w-0 truncate text-xs text-[var(--g-text-primary)] font-medium">
                        {nombre}
                      </span>
                      <span className="ml-auto shrink-0 text-xs text-[var(--g-text-secondary)]">
                        {sinEvaluar
                          ? "Sin evaluar"
                          : colorKey && ETIQUETA_CELDA[colorKey]
                          ? ETIQUETA_CELDA[colorKey]
                          : "Evaluado"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      )}

      {/* Relaciones normativas / auditoría */}
      {(risk.obligations || risk.findings) && (
        <section
          className="bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] p-4 space-y-3"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        >
          <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
            Trazabilidad y referencias cruzadas
          </h2>
          <div className="flex flex-wrap gap-4">
            {risk.obligations && (
              <Link
                to={`/obligaciones/${risk.obligations.code}`}
                className="inline-flex items-center gap-1.5 text-xs text-[var(--g-link)] hover:underline"
              >
                <Link2 className="h-3.5 w-3.5" />
                Obligación {risk.obligations.code}: {risk.obligations.title}
              </Link>
            )}
            {risk.findings && (
              <Link
                to={`/hallazgos/${risk.findings.code}`}
                className="inline-flex items-center gap-1.5 text-xs text-[var(--g-link)] hover:underline"
              >
                <Link2 className="h-3.5 w-3.5" />
                Hallazgo {risk.findings.code}: {risk.findings.title}
              </Link>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
