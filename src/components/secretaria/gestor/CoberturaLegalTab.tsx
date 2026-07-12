/**
 * CoberturaLegalTab — Vista detallada de cobertura documental por
 * combinación órgano · materia.
 *
 * Combina:
 * - Cobertura core v1.0 vía `computeCoreCoverage` (template-admin): 14
 *   combinaciones obligatorias del Sprint 1.
 * - Cobertura legal extendida vía `buildLegalTemplateCoverage`:
 *   Cloud activas / pending, fixtures locales, missing.
 *
 * Extraído del bloque de cobertura existente en `GestorPlantillas.tsx`.
 *
 * Sprint 1 — Task 5.4 (cobertura).
 */
import { type ElementType } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  FileCode2,
  ShieldCheck,
} from "lucide-react";
import { useTenantContext } from "@/context/TenantContext";
import { usePlantillasProtegidas } from "@/hooks/usePlantillasProtegidas";
import { useSecretariaScope } from "@/components/secretaria/shell";
import { ConfigurationLoadError } from "@/components/secretaria/ConfigurationLoadError";
import { labelMateria } from "@/lib/secretaria/agenda-materias";
import {
  buildLegalTemplateCoverage,
  type LegalTemplateCoverageState,
} from "@/lib/secretaria/legal-template-coverage";
import {
  computeCoreCoverage,
  CORE_V1_MATERIAS_COUNT,
  adoptionModeLabel,
  organoLabel,
  tipoLabel,
  SEMANTIC_TONE_CLASS,
  type SemanticTone,
} from "@/lib/secretaria/template-admin";

const FIVE_MINUTES = 5 * 60 * 1000;

const COVERAGE_STATE_STYLE: Record<
  LegalTemplateCoverageState,
  { tone: SemanticTone; icon: ElementType }
> = {
  cloud_active: {
    tone: "success",
    icon: CheckCircle2,
  },
  cloud_pending: {
    tone: "warning",
    icon: Clock,
  },
  fixture_pending_load: {
    tone: "warning",
    icon: FileCode2,
  },
  missing: {
    tone: "error",
    icon: AlertTriangle,
  },
};

function CoverageStateBadge({
  state,
  label,
}: {
  state: LegalTemplateCoverageState;
  label: string;
}) {
  const config = COVERAGE_STATE_STYLE[state];
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold ${SEMANTIC_TONE_CLASS[config.tone]}`}
      style={{ borderRadius: "var(--g-radius-full)" }}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>
  );
}

export function CoberturaLegalTab() {
  const { tenantId } = useTenantContext();
  const scope = useSecretariaScope();
  const plantillas = usePlantillasProtegidas();
  const selectedJurisdiction = scope.selectedEntity?.jurisdiction ?? null;

  const coreCoverage = useQuery({
    queryKey: ["cobertura", "core", tenantId],
    enabled: !!tenantId,
    staleTime: FIVE_MINUTES,
    queryFn: () => computeCoreCoverage(tenantId!),
  });

  const rows = plantillas.data ?? [];
  const coverage = buildLegalTemplateCoverage(rows, {
    jurisdiction: selectedJurisdiction,
  });

  const cloudActive = coverage.filter((row) => row.state === "cloud_active").length;
  const cloudPending = coverage.filter((row) => row.state === "cloud_pending").length;
  const fixturePending = coverage.filter((row) => row.state === "fixture_pending_load").length;
  const missing = coverage.filter((row) => row.state === "missing").length;
  const criticalPending = coverage.filter((row) => row.critical && row.state !== "cloud_active")
    .length;

  if (plantillas.isError || coreCoverage.isError) {
    return (
      <ConfigurationLoadError
        title="No se ha podido calcular la cobertura documental."
        detail="La cobertura core y la extendida se ocultan hasta recuperar todas las plantillas necesarias."
        onRetry={() => {
          void Promise.all([plantillas.refetch(), coreCoverage.refetch()]);
        }}
        retrying={plantillas.isFetching || coreCoverage.isFetching}
      />
    );
  }

  return (
    <div className="space-y-6">
      <section
        className="overflow-hidden border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="border-b border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-5 py-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Cobertura documental — Combinaciones obligatorias
          </div>
          <h2 className="mt-1 text-base font-semibold text-[var(--g-text-primary)]">
            Cobertura {coreCoverage.data?.covered ?? 0}/{CORE_V1_MATERIAS_COUNT}
          </h2>
          <p className="mt-1 max-w-3xl text-xs text-[var(--g-text-secondary)]">
            14 combinaciones órgano · materia que deben disponer de modelos de acuerdo
            vigentes para nuevos expedientes en este ámbito.
          </p>
        </div>
        {coreCoverage.isLoading ? (
          <p className="px-5 py-4 text-sm text-[var(--g-text-secondary)]">Calculando cobertura…</p>
        ) : coreCoverage.data?.gaps.length === 0 ? (
          <p className="flex items-center gap-2 px-5 py-4 text-sm text-[var(--g-text-primary)]">
            <CheckCircle2 className="h-4 w-4 text-[var(--status-success)]" aria-hidden="true" />
            Todas las combinaciones core v1.0 están cubiertas.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--g-surface-subtle)]">
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                    Órgano
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                    Materia
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--g-border-subtle)]">
                {(coreCoverage.data?.gaps ?? []).map((gap, idx) => (
                  <tr key={`gap-${idx}`} className="hover:bg-[var(--g-surface-subtle)]/50">
                    <td className="px-4 py-2 text-[var(--g-text-primary)]">
                      {organoLabel(gap.organo)}
                    </td>
                    <td className="px-4 py-2 text-[var(--g-text-secondary)]">
                      {labelMateria(gap.materia)}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold ${SEMANTIC_TONE_CLASS.error}`}
                        style={{ borderRadius: "var(--g-radius-full)" }}
                      >
                        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                        Sin modelo de acuerdo vigente
                      </span>
                      {/* G2: impacto + acción honesta del gap (puede ser artefacto de
                          tipificación ORGANO_ADMIN vs CONSEJO_ADMIN, no falta de modelo) */}
                      <p className="mt-1.5 max-w-lg text-xs text-[var(--g-text-secondary)]">
                        Impacto: la combinación core no puede considerarse cubierta.
                        Acción: revisar la tipificación de órgano del modelo activo
                        equivalente o importar una plantilla nueva. Las versiones
                        archivadas se conservan solo como histórico: no se reactivan.
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section
        className="overflow-hidden border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)]"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="flex flex-col gap-3 border-b border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
              <Database className="h-3.5 w-3.5" aria-hidden="true" />
              Cobertura legal extendida
            </div>
            <h2 className="mt-1 text-base font-semibold text-[var(--g-text-primary)]">
              Cobertura confirmada, en preparación y provisional
            </h2>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
            <div className="border-l border-[var(--g-border-subtle)] pl-3">
              <dt className="text-xs text-[var(--g-text-secondary)]">Vigentes confirmadas</dt>
              <dd className="font-semibold text-[var(--g-text-primary)]">{cloudActive}</dd>
            </div>
            <div className="border-l border-[var(--g-border-subtle)] pl-3">
              <dt className="text-xs text-[var(--g-text-secondary)]">En preparación</dt>
              <dd className="font-semibold text-[var(--g-text-primary)]">{cloudPending}</dd>
            </div>
            <div className="border-l border-[var(--g-border-subtle)] pl-3">
              <dt className="text-xs text-[var(--g-text-secondary)]">Cobertura provisional</dt>
              <dd className="font-semibold text-[var(--g-text-primary)]">{fixturePending}</dd>
            </div>
            <div className="border-l border-[var(--g-border-subtle)] pl-3">
              <dt className="text-xs text-[var(--g-text-secondary)]">Sin cobertura</dt>
              <dd className="font-semibold text-[var(--g-text-primary)]">{missing}</dd>
            </div>
            <div className="border-l border-[var(--g-border-subtle)] pl-3">
              <dt className="text-xs text-[var(--g-text-secondary)]">Críticos pendientes</dt>
              <dd className="font-semibold text-[var(--g-text-primary)]">{criticalPending}</dd>
            </div>
          </dl>
        </div>

        <div className="grid gap-0 divide-y divide-[var(--g-border-subtle)] lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          {coverage.map((row) => (
            <div key={row.key} className="flex items-start justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-[var(--g-text-primary)]">
                    {row.label}
                  </span>
                  {/* G3: los fixtures se etiquetan como cobertura provisional, no
                      como una fuente equiparable a una plantilla Cloud aprobada */}
                  <CoverageStateBadge
                    state={row.state}
                    label={
                      row.state === "fixture_pending_load"
                        ? "Cobertura provisional"
                        : row.sourceLabel
                    }
                  />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[var(--g-text-secondary)]">
                  <span>{tipoLabel(row.tipo)}</span>
                  {row.organoTipo ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{organoLabel(row.organoTipo)}</span>
                    </>
                  ) : null}
                  {row.adoptionMode ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{adoptionModeLabel(row.adoptionMode, { tipo: row.tipo })}</span>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="shrink-0 text-right text-xs text-[var(--g-text-secondary)]">
                {row.activeCloudCount > 0 ? (
                  <div>{row.activeCloudCount} vigente</div>
                ) : row.pendingCloudCount > 0 ? (
                  <div>{row.pendingCloudCount} en preparación</div>
                ) : row.fixtureAvailable ? (
                  <div>Pendiente de sustitución</div>
                ) : (
                  <div>Pendiente Legal</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
