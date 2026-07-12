/**
 * ValidacionTab — comprobación documental global de plantillas vigentes.
 *
 * Ejecuta `validateTemplateForActivation` para cada plantilla activa del
 * tenant y consolida un informe de issues por severidad (BLOCKING / WARNING /
 * INFO). Útil para detectar regresiones tras una migración masiva o un
 * import batch.
 *
 * Operación bajo demanda: el botón "Comprobar todas las plantillas"
 * dispara el query manualmente. Resultado mostrado como tabla agrupada
 * por plantilla.
 *
 * Sprint 1 — Task 5.4 (validación).
 */
import { useState } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { useTenantContext } from "@/context/TenantContext";
import {
  gatePreIssueLabel,
  gatePreSeverityLabel,
  loadAllActiveTemplates,
  SEMANTIC_TONE_CLASS,
  SEMANTIC_TONE_DOT_CLASS,
  tipoLabel,
  validateTemplateForActivation,
  type GatePreIssue,
  type GatePreResult,
  type PlantillaCandidate,
  type SemanticTone,
} from "@/lib/secretaria/template-admin";

type RowResult = {
  template: PlantillaCandidate;
  result: GatePreResult;
};

type RunState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; rows: RowResult[] };

function severityIcon(severity: GatePreIssue["severity"]) {
  if (severity === "BLOCKING") return AlertTriangle;
  if (severity === "WARNING") return AlertCircle;
  return Info;
}

function severityTone(severity: GatePreIssue["severity"]): SemanticTone {
  if (severity === "BLOCKING") return "error";
  if (severity === "WARNING") return "warning";
  return "info";
}

export function ValidacionTab() {
  const { tenantId } = useTenantContext();
  const [run, setRun] = useState<RunState>({ status: "idle" });

  const handleRun = async () => {
    if (!tenantId) return;
    setRun({ status: "loading" });
    try {
      const active = await loadAllActiveTemplates(tenantId);
      const rows: RowResult[] = active.map((t) => ({
        template: t,
        result: validateTemplateForActivation(t, {
          tenantId,
          existingActiveTemplates: active,
        }),
      }));
      setRun({ status: "done", rows });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setRun({ status: "error", message });
    }
  };

  const rowsWithIssues =
    run.status === "done" ? run.rows.filter((r) => r.result.issues.length > 0) : [];
  const totalBlocking =
    run.status === "done"
      ? run.rows.reduce((acc, r) => acc + r.result.summary.blocking, 0)
      : 0;
  const totalWarnings =
    run.status === "done"
      ? run.rows.reduce((acc, r) => acc + r.result.summary.warning, 0)
      : 0;
  const totalInfo =
    run.status === "done" ? run.rows.reduce((acc, r) => acc + r.result.summary.info, 0) : 0;

  return (
    <div className="space-y-6">
      <section
        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-5"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Comprobación documental previa (Gate PRE)
            </div>
            <h2 className="mt-2 text-base font-semibold text-[var(--g-text-primary)]">
              Comprobación de todas las plantillas vigentes
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-[var(--g-text-secondary)]">
              Revisa la estructura, los metadatos y las referencias de cada plantilla
              vigente. Úsala después de una importación o en una revisión periódica. La
              comprobación es de solo lectura y no modifica datos.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRun}
            disabled={run.status === "loading" || !tenantId}
            className="flex min-h-11 items-center gap-2 self-start bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--g-surface-card)] disabled:opacity-50"
            style={{ borderRadius: "var(--g-radius-md)" }}
            aria-busy={run.status === "loading"}
          >
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            {run.status === "loading" ? "Comprobando…" : "Comprobar todas las plantillas"}
          </button>
        </div>
      </section>

      {run.status === "error" ? (
        <div
          className={`${SEMANTIC_TONE_CLASS.error} flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center`}
          role="alert"
          style={{ borderRadius: "var(--g-radius-md)" }}
        >
          <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 break-words text-sm font-medium">
            No se pudo completar la comprobación documental: {run.message}
          </span>
          <button
            type="button"
            onClick={handleRun}
            className="inline-flex min-h-11 items-center justify-center gap-2 bg-[var(--g-brand-3308)] px-4 py-2 text-sm font-medium text-[var(--g-text-inverse)] transition-colors hover:bg-[var(--g-sec-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--g-surface-card)]"
            style={{ borderRadius: "var(--g-radius-md)" }}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Reintentar
          </button>
        </div>
      ) : null}

      {run.status === "done" ? (
        <section className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div
              className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
              style={{ borderRadius: "var(--g-radius-lg)" }}
            >
              <div className="text-xs uppercase tracking-widest text-[var(--g-text-secondary)]">
                Plantillas evaluadas
              </div>
              <div className="mt-1 text-2xl font-bold text-[var(--g-text-primary)]">
                {run.rows.length}
              </div>
            </div>
            <div
              className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
              style={{ borderRadius: "var(--g-radius-lg)" }}
            >
              <div className="text-xs uppercase tracking-widest text-[var(--g-text-secondary)]">
                Bloqueantes
              </div>
              <div className="mt-1 text-2xl font-bold text-[var(--status-error)]">
                {totalBlocking}
              </div>
            </div>
            <div
              className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
              style={{ borderRadius: "var(--g-radius-lg)" }}
            >
              <div className="text-xs uppercase tracking-widest text-[var(--g-text-secondary)]">
                Advertencias
              </div>
              <div className="mt-1 text-2xl font-bold text-[var(--status-warning)]">
                {totalWarnings}
              </div>
            </div>
            <div
              className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-4"
              style={{ borderRadius: "var(--g-radius-lg)" }}
            >
              <div className="text-xs uppercase tracking-widest text-[var(--g-text-secondary)]">
                Informativas
              </div>
              <div className="mt-1 text-2xl font-bold text-[var(--status-info)]">{totalInfo}</div>
            </div>
          </div>

          {rowsWithIssues.length === 0 ? (
            <div
              className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-8 text-center"
              style={{ borderRadius: "var(--g-radius-lg)" }}
            >
              <CheckCircle2 className="mx-auto h-10 w-10 text-[var(--status-success)]" aria-hidden="true" />
              <h3 className="mt-3 text-base font-semibold text-[var(--g-text-primary)]">
                Sin incidencias
              </h3>
              <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
                Todas las plantillas vigentes superan la comprobación documental previa.
              </p>
            </div>
          ) : (
            <div
              className="overflow-x-auto border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--g-brand-3308)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--g-surface-card)]"
              role="region"
              aria-label="Resultado detallado de la comprobación documental"
              tabIndex={0}
              style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
            >
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="bg-[var(--g-surface-subtle)]">
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                      Plantilla
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                      Severidad
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                      Incidencia
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wider text-[var(--g-text-primary)]">
                      Mensaje
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--g-border-subtle)]">
                  {rowsWithIssues.flatMap((row) =>
                    row.result.issues.map((issue, idx) => {
                      const Icon = severityIcon(issue.severity);
                      const tone = severityTone(issue.severity);
                      return (
                        <tr key={`${row.template.id}-${idx}`}>
                          <td className="px-4 py-2 align-top">
                            <div className="font-medium text-[var(--g-text-primary)]">
                              {tipoLabel(row.template.tipo)}
                            </div>
                            <div className="text-xs text-[var(--g-text-secondary)] font-mono">
                              {row.template.id.slice(0, 8)} · v{row.template.version}
                            </div>
                          </td>
                          <td className="px-4 py-2 align-top">
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--g-text-primary)]">
                              <span
                                className={`h-2 w-2 shrink-0 ${SEMANTIC_TONE_DOT_CLASS[tone]}`}
                                style={{ borderRadius: "var(--g-radius-full)" }}
                                aria-hidden="true"
                              />
                              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                              {gatePreSeverityLabel(issue.severity)}
                            </span>
                          </td>
                          <td className="px-4 py-2 align-top">
                            <div className="text-xs text-[var(--g-text-primary)]">
                              {gatePreIssueLabel(issue.code)}
                            </div>
                            <code className="font-mono text-[10px] text-[var(--g-text-secondary)]">
                              {issue.code}
                            </code>
                          </td>
                          <td className="px-4 py-2 align-top text-[var(--g-text-secondary)]">
                            {issue.message}
                            {issue.hint ? (
                              <div className="mt-1 text-xs italic">{issue.hint}</div>
                            ) : null}
                          </td>
                        </tr>
                      );
                    }),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
