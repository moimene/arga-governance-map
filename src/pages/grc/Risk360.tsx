import { useMemo, useState } from "react";
import { useRisks, type RiskRow } from "@/hooks/useRisks";
import { Link, useSearchParams } from "react-router-dom";
import { Activity, Pencil, PlusCircle, Route } from "lucide-react";
import { useSecretariaScope } from "@/components/secretaria/shell";
import type { SecretariaScopeController } from "@/components/secretaria/shell";
import { useTenantBranding } from "@/context/TenantBrandContext";
import { groupFullLabel } from "@/lib/tenant-brand-labels";
import {
  ORDEN_BANDAS, COLOR_BANDA, ETIQUETA_BANDA, NOTA_ESCALA, tieneEjes,
  riskScore, matchesScoreFilter, countSeverity,
} from "@/lib/grc/assessed-band";

const FILTER_ALL = "Todos";

const SCORE_BG = (score: number | null, band?: string | null) => {
  if (score !== null) {
    if (score >= 20) return "bg-[var(--status-error)]";
    if (score >= 15) return "bg-[var(--status-error)]/80";
    if (score >= 10) return "bg-[var(--status-warning)]";
    if (score >= 5) return "bg-[var(--g-sec-300)]";
    return "bg-[var(--g-surface-muted)]";
  }
  if (band === "ROJO") return "bg-[var(--status-error)]";
  if (band === "NARANJA") return "bg-[var(--status-warning)]";
  if (band === "AMARILLO") return "bg-[var(--status-warning)]/70";
  if (band === "VERDE") return "bg-[var(--status-success)]";
  return "bg-[var(--g-surface-muted)]";
};

const MODULE_LABEL: Record<string, string> = {
  dora: "DORA",
  DORA: "DORA",
  gdpr: "Protección de datos",
  GDPR: "Protección de datos",
  cyber: "Ciberseguridad",
  CYBER: "Ciberseguridad",
  audit: "Auditoría",
  AUDIT: "Auditoría",
  penal: "Cumplimiento penal",
  PENAL: "Cumplimiento penal",
  risk: "Riesgos penales",
  RISK: "Riesgos penales",
};

const SCORE_FILTERS = [
  { value: FILTER_ALL, label: "Todos" },
  { value: "criticos", label: "Críticos" },
  { value: "altos", label: "Altos" },
  { value: "medios", label: "Medios" },
  { value: "bajos", label: "Bajos" },
];


function scoreLabel(score: number | null, risk?: RiskRow) {
  if (score === null) {
    if (risk?.assessed_band) return ETIQUETA_BANDA[risk.assessed_band];
    return "Sin evaluar";
  }
  if (score >= 20) return "Crítico";
  if (score >= 15) return "Alto";
  if (score >= 10) return "Medio";
  if (score >= 5) return "Bajo";
  return "Mínimo";
}

function moduleLabel(value?: string | null) {
  if (!value) return "Sin módulo";
  if (MODULE_LABEL[value]) return MODULE_LABEL[value];
  return value
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function handoffLabel(value: string | null) {
  if (!value) return "Señal recibida";
  if (value === "AIMS_TECHNICAL_FILE_GAP") return "brecha en expediente técnico";
  return value
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function SelectField({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={id} className="space-y-1 text-sm font-medium text-[var(--g-text-primary)]">
      <span>{label}</span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full min-w-0 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 text-sm text-[var(--g-text-primary)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)]"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        {children}
      </select>
    </label>
  );
}

function RiskCard({
  risk,
  scope,
}: {
  risk: RiskRow;
  scope: SecretariaScopeController;
}) {
  const score = riskScore(risk);

  return (
    <article
      className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-3"
      style={{ borderRadius: "var(--g-radius-md)" }}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-xs text-[var(--g-text-secondary)]">{risk.code}</div>
          <h2 className="mt-1 break-words text-sm font-semibold leading-5 text-[var(--g-text-primary)]">
            <Link
              to={scope.createScopedTo(`/grc/risk-360/${risk.id}`)}
              className="hover:text-[var(--g-link)] hover:underline"
            >
              {risk.title}
            </Link>
          </h2>
        </div>
        <span
          className={`inline-flex shrink-0 items-center px-2 py-0.5 text-xs font-semibold ${SCORE_BG(score, risk.assessed_band)} ${
            (score !== null && score >= 10) || risk.assessed_band === "ROJO"
              ? "text-[var(--g-text-inverse)]"
              : "text-[var(--g-text-primary)]"
          }`}
          style={{ borderRadius: "var(--g-radius-full)" }}
        >
          {scoreLabel(score, risk)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {tieneEjes(risk) ? (
          <span
            className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-[var(--g-surface-subtle)] text-[var(--g-text-primary)]"
            style={{ borderRadius: "var(--g-radius-full)" }}
          >
            Prob. {risk.probability} · Impacto {risk.impact}
          </span>
        ) : risk.assessed_band ? (
          <span
            className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]"
            style={{ borderRadius: "var(--g-radius-full)" }}
            title={NOTA_ESCALA}
          >
            <span
              aria-hidden="true"
              className="inline-block h-2.5 w-2.5 border border-[var(--g-border-subtle)]"
              style={{ backgroundColor: COLOR_BANDA[risk.assessed_band], borderRadius: "var(--g-radius-sm)" }}
            />
            {ETIQUETA_BANDA[risk.assessed_band]}
          </span>
        ) : null}
        {risk.residual_score !== null && (
          <span
            className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]"
            style={{ borderRadius: "var(--g-radius-full)" }}
          >
            Residual {risk.residual_score}
          </span>
        )}
        <span
          className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-[var(--g-brand-3308)] text-[var(--g-text-inverse)]"
          style={{ borderRadius: "var(--g-radius-full)" }}
        >
          {moduleLabel(risk.module_id)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {risk.obligations?.code && (
          <Link
            to={`/obligaciones/${risk.obligations.code}`}
            className="text-xs text-[var(--g-link)] underline hover:text-[var(--g-link-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)]"
          >
            Obligación {risk.obligations.code}
          </Link>
        )}
        {risk.findings?.code && (
          <Link
            to={`/hallazgos/${risk.findings.code}`}
            className="text-xs text-[var(--g-link)] underline hover:text-[var(--g-link-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)]"
          >
            Hallazgo {risk.findings.code}
          </Link>
        )}
        <Link
          to={scope.createScopedTo(`/grc/risk-360/${risk.id}`)}
          className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-[var(--g-link)] hover:text-[var(--g-link-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)]"
        >
          Ver detalle
        </Link>
        <Link
          to={scope.createScopedTo(`/grc/risk-360/${risk.id}/editar`)}
          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--g-text-secondary)] hover:text-[var(--g-link-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)]"
        >
          <Pencil className="h-3 w-3" aria-hidden="true" />
          Editar
        </Link>
      </div>
    </article>
  );
}

export default function Risk360() {
  const [params] = useSearchParams();
  const branding = useTenantBranding();
  const scope = useSecretariaScope();
  const scopedEntityId = scope.mode === "sociedad" ? scope.selectedEntity?.id ?? null : null;
  const scopeLabel =
    scope.mode === "sociedad" && scope.selectedEntity
      ? scope.selectedEntity.legalName
      : groupFullLabel(branding);
  const findingFilter = params.get("finding");
  const handoff = params.get("handoff");
  const handoffSource = params.get("source");
  const { data: allRisks = [], isLoading } = useRisks({ entityId: scopedEntityId });
  const [moduleFilter, setModuleFilter] = useState(FILTER_ALL);
  const [scoreFilter, setScoreFilter] = useState(FILTER_ALL);

  const risksForContext = useMemo(
    () =>
      findingFilter
        ? allRisks.filter((risk) => risk.findings?.code === findingFilter)
        : allRisks,
    [allRisks, findingFilter],
  );

  const moduleOptions = useMemo(
    () => Array.from(new Set(risksForContext.map((risk) => risk.module_id).filter(Boolean))).sort(),
    [risksForContext],
  );

  const risks = useMemo(
    () =>
      risksForContext.filter((risk) => {
        const moduleMatches = moduleFilter === FILTER_ALL || risk.module_id === moduleFilter;
        return moduleMatches && matchesScoreFilter(risk, scoreFilter);
      }),
    [risksForContext, moduleFilter, scoreFilter],
  );

  const conEjes = useMemo(() => risks.filter(tieneEjes), [risks]);
  const porBanda = useMemo(
    () =>
      ORDEN_BANDAS.map((b) => ({
        banda: b,
        items: risks.filter((r) => !tieneEjes(r) && r.assessed_band === b),
      })).filter((g) => g.items.length > 0),
    [risks],
  );

  const grid: RiskRow[][][] = Array.from({ length: 5 }, () =>
    Array.from({ length: 5 }, () => [] as RiskRow[]),
  );
  conEjes.forEach((risk) => {
    const probability = Math.min(5, Math.max(1, risk.probability!));
    const impact = Math.min(5, Math.max(1, risk.impact!));
    grid[5 - impact][probability - 1].push(risk);
  });

  // Los KPI de severidad se calculan SOLO sobre score, como promete §10 del
  // diseño de G5: "los riesgos sin score no entran ni suman". Sumar aquí las
  // bandas les ponía nombre castellano por la puerta de atrás.
  const { criticos: criticalCount, altos: highCount, sinEjes: sinEjesCount } =
    countSeverity(risksForContext);
  const linkedFindings = risksForContext.filter((risk) => !!risk.findings?.code).length;
  const hasFilters = moduleFilter !== FILTER_ALL || scoreFilter !== FILTER_ALL;
  // La Prioridad ordena por probabilidad × impacto. Si en el perímetro no hay
  // NINGÚN riesgo con esos ejes, el selector solo puede producir listas vacías:
  // se retira y se explica, en vez de dejar cuatro opciones muertas que el
  // usuario prueba una a una sin entender por qué no pasa nada.
  const hayRiesgosConEjes = sinEjesCount < risksForContext.length;

  return (
    <div className="min-w-0 space-y-6 p-4 sm:p-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <Activity className="mt-1 h-5 w-5 shrink-0 text-[var(--g-brand-3308)]" />
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-[var(--g-text-primary)] sm:text-2xl">
              Risk 360
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-[var(--g-text-secondary)]">
              Mesa de priorización para revisar exposición, origen y acciones de mitigación en {scopeLabel}.
              {findingFilter && (
                <>
                  {" "}Filtrada por el hallazgo{" "}
                  <strong className="text-[var(--g-text-primary)]">{findingFilter}</strong>.
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {findingFilter && (
            <Link
              to={scope.createScopedTo("/grc/risk-360")}
              className="inline-flex h-10 items-center justify-center border border-[var(--g-border-subtle)] bg-transparent px-4 text-sm font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)]"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              Limpiar hallazgo
            </Link>
          )}
          <Link
            to={scope.createScopedTo("/grc/risk-360/nuevo")}
            className="inline-flex h-10 items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-4 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            Nuevo riesgo
          </Link>
        </div>
      </header>

      {handoffSource === "aims" && handoff && (
        <div
          className="flex flex-col gap-3 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-4 md:flex-row md:items-center md:justify-between"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <div className="flex min-w-0 items-start gap-3">
            <Route className="mt-0.5 h-5 w-5 shrink-0 text-[var(--g-brand-3308)]" />
            <div className="min-w-0">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-[var(--g-text-primary)]">
                  Entrada desde AIMS
                </h2>
                <p className="text-sm leading-6 text-[var(--g-text-secondary)]">
                  Se recibe la señal de {handoffLabel(handoff)} para decidir si procede abrir riesgo, control o plan de acción en GRC.
                </p>
              </div>
            </div>
          </div>
          <Link
            to={scope.createScopedTo("/grc/m/audit/operate/plans")}
            className="inline-flex w-full items-center justify-center bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)] sm:w-auto"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Ver planes GRC
          </Link>
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Prioridad de riesgos">
        {[
          {
            label: "Críticos",
            value: criticalCount,
            // Un "0" mudo sobre un perímetro evaluado por bandas se lee como
            // "no hay exposición alta", que es lo contrario de lo que dice el
            // mapa. El helper dice cuántos quedan fuera del recuento y por qué.
            helper: sinEjesCount
              ? `Exposición alta que requiere decisión. ${sinEjesCount} riesgo${sinEjesCount === 1 ? "" : "s"} fuera del recuento: evaluados por banda, sin probabilidad × impacto.`
              : "Exposición alta que requiere decisión",
          },
          {
            label: "Altos",
            value: highCount,
            helper: sinEjesCount ? "Seguimiento reforzado. Solo riesgos con ejes." : "Seguimiento reforzado",
          },
          { label: "Con hallazgo", value: linkedFindings, helper: "Riesgos trazados a auditoría o control" },
        ].map((item) => (
          <div
            key={item.label}
            className="border border-[var(--g-border-default)] bg-[var(--g-surface-card)] p-4"
            style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          >
            <div className="text-2xl font-bold text-[var(--g-text-primary)]">{item.value}</div>
            <div className="text-sm font-semibold text-[var(--g-text-primary)]">{item.label}</div>
            <p className="mt-1 text-xs leading-5 text-[var(--g-text-secondary)]">{item.helper}</p>
          </div>
        ))}
      </section>

      <section
        className="border border-[var(--g-border-default)] bg-[var(--g-surface-card)] p-4"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
        aria-labelledby="grc-risk-filters"
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="grc-risk-filters" className="text-sm font-semibold text-[var(--g-text-primary)]">
              Filtros
            </h2>
            <p className="text-xs text-[var(--g-text-secondary)]">
              {risks.length} de {risksForContext.length} riesgos visibles.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setModuleFilter(FILTER_ALL);
              setScoreFilter(FILTER_ALL);
            }}
            disabled={!hasFilters}
            className="inline-flex h-9 w-full items-center justify-center border border-[var(--g-border-subtle)] bg-transparent px-3 text-sm font-medium text-[var(--g-text-primary)] transition-colors hover:bg-[var(--g-surface-subtle)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--g-border-focus)] sm:w-auto"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            Limpiar filtros
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <SelectField id="risk-module-filter" label="Módulo" value={moduleFilter} onChange={setModuleFilter}>
            <option value={FILTER_ALL}>{FILTER_ALL}</option>
            {moduleOptions.map((module) => (
              <option key={module} value={module}>{moduleLabel(module)}</option>
            ))}
          </SelectField>
          {hayRiesgosConEjes ? (
            <SelectField id="risk-score-filter" label="Prioridad" value={scoreFilter} onChange={setScoreFilter}>
              {SCORE_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </SelectField>
          ) : (
            <p className="self-end text-xs text-[var(--g-text-secondary)]">
              Sin filtro de prioridad: este perímetro está evaluado por bandas, no por
              probabilidad × impacto.
            </p>
          )}
        </div>
      </section>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section
          className="min-w-0 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] p-4"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          aria-label="Mapa de calor de riesgos"
        >
          {conEjes.length > 0 && (
            <>
              <div className="mb-3 text-xs font-semibold uppercase text-[var(--g-text-secondary)]">
                Mapa de calor: probabilidad por impacto
              </div>
              {isLoading ? (
                <div className="py-8 text-center text-sm text-[var(--g-text-secondary)] animate-pulse">
                  Cargando riesgos...
                </div>
              ) : (
                <div className="min-w-0 overflow-hidden">
                  <div className="grid grid-cols-[auto_repeat(5,minmax(0,1fr))] gap-1">
                    <div />
                    {[1, 2, 3, 4, 5].map((probability) => (
                      <div
                        key={`ph-${probability}`}
                        className="pb-1 text-center text-xs text-[var(--g-text-secondary)]"
                      >
                        P {probability}
                      </div>
                    ))}
                    {grid.map((row, rowIndex) => (
                      <div key={`row-${rowIndex}`} className="contents">
                        <div className="self-center pr-1 text-right text-xs text-[var(--g-text-secondary)]">
                          I {5 - rowIndex}
                        </div>
                        {row.map((cell, columnIndex) => {
                          const score = (5 - rowIndex) * (columnIndex + 1);
                          const hasRisks = cell.length > 0;
                          return (
                            <div
                              key={`cell-${rowIndex}-${columnIndex}`}
                              title={
                                hasRisks
                                  ? cell.map((risk) => `${risk.code}: ${risk.title}`).join("\n")
                                  : `Score ${score}`
                              }
                              className={`flex aspect-square min-h-10 items-center justify-center text-sm font-semibold transition-all ${
                                hasRisks
                                  ? `${SCORE_BG(score)} ${score >= 10 ? "text-[var(--g-text-inverse)]" : "text-[var(--g-text-primary)]"} hover:opacity-80`
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
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-3">
                {[
                  { label: "Crítico", cls: "bg-[var(--status-error)]" },
                  { label: "Alto", cls: "bg-[var(--status-error)]/80" },
                  { label: "Medio", cls: "bg-[var(--status-warning)]" },
                  { label: "Bajo", cls: "bg-[var(--g-sec-300)]" },
                  { label: "Mínimo", cls: "bg-[var(--g-surface-muted)]" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-1">
                    <div
                      className={`h-3 w-3 ${item.cls}`}
                      style={{ borderRadius: "var(--g-radius-sm)" }}
                    />
                    <span className="text-xs text-[var(--g-text-secondary)]">{item.label}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {porBanda.length > 0 && (
            <div className={conEjes.length > 0 ? "mt-6 pt-6 border-t border-[var(--g-border-subtle)]" : ""}>
              <div className="mb-1 text-xs font-semibold uppercase text-[var(--g-text-secondary)]">
                Mapa de riesgos evaluados por bandas
              </div>
              <p className="mb-4 text-xs leading-5 text-[var(--g-text-secondary)]">
                {NOTA_ESCALA}
              </p>
              <div className="space-y-4">
                {porBanda.map((grupo) => (
                  <div
                    key={grupo.banda}
                    className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-page)] p-3"
                    style={{ borderRadius: "var(--g-radius-md)" }}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 border border-[var(--g-border-subtle)]"
                          style={{
                            backgroundColor: COLOR_BANDA[grupo.banda],
                            borderRadius: "var(--g-radius-sm)",
                          }}
                        />
                        <span className="text-xs font-bold text-[var(--g-text-primary)]">
                          {ETIQUETA_BANDA[grupo.banda]}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-[var(--g-text-secondary)]">
                        {grupo.items.length} {grupo.items.length === 1 ? "delito" : "delitos"}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      {grupo.items.slice(0, 6).map((item) => (
                        <Link
                          key={item.id}
                          to={scope.createScopedTo(`/grc/risk-360/${item.id}`)}
                          className="flex items-center justify-between p-2 text-xs bg-[var(--g-surface-card)] border border-[var(--g-border-subtle)] hover:bg-[var(--g-surface-subtle)]"
                          style={{ borderRadius: "var(--g-radius-sm)" }}
                        >
                          <span className="truncate text-[var(--g-text-primary)] font-medium mr-2">
                            {item.title}
                          </span>
                          <span className="font-mono text-[10px] text-[var(--g-text-secondary)] shrink-0">
                            {item.code}
                          </span>
                        </Link>
                      ))}
                    </div>
                    {grupo.items.length > 6 && (
                      <div className="mt-2 text-right">
                        <span className="text-[11px] text-[var(--g-text-secondary)]">
                          +{grupo.items.length - 6} más en la lista lateral
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section
          className="min-w-0 border border-[var(--g-border-default)] bg-[var(--g-surface-card)] p-4"
          style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
          aria-label="Lista priorizada de riesgos"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase text-[var(--g-text-secondary)]">
              Lista priorizada
            </h2>
            <span className="text-xs text-[var(--g-text-secondary)]">{risks.length}</span>
          </div>

          {risks.length === 0 && !isLoading && (
            <div className="py-8 text-center text-sm text-[var(--g-text-secondary)]">
              No hay riesgos para los filtros seleccionados.
            </div>
          )}

          <div className="max-h-none space-y-2 overflow-y-visible xl:max-h-[520px] xl:overflow-y-auto">
            {risks
              .slice()
              .sort((a, b) => {
                const sa = riskScore(a);
                const sb = riskScore(b);
                if (sa !== null && sb !== null) return sb - sa;
                if (sa !== null) return -1;
                if (sb !== null) return 1;
                const oa = ORDEN_BANDAS.indexOf(a.assessed_band ?? "NO_EVALUADA");
                const ob = ORDEN_BANDAS.indexOf(b.assessed_band ?? "NO_EVALUADA");
                return oa - ob;
              })
              .map((risk) => (
                <RiskCard key={risk.id} risk={risk} scope={scope} />
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}
