import { useState } from "react";
import { ChevronDown, ChevronUp, CheckCircle2, XCircle, AlertTriangle, Loader2, Zap } from "lucide-react";
import { usePreviewAcuerdo, type PreviewParams } from "@/hooks/usePreviewAcuerdo";
import type { EvalSeverity } from "@/lib/rules-engine";

const GATE_LABELS: Record<string, string> = {
  CONVOCATORIA:      "Convocatoria",
  CONSTITUCION:      "Constitución / Quórum",
  VOTACION:          "Votación",
  DOCUMENTACION:     "Documentación",
  convocatoria_skip: "Convocatoria (no requerida)",
  constitucion_skip: "Constitución (no requerida)",
};

function GateBadge({ severity, label }: { severity: EvalSeverity; label: string }) {
  const tone =
    severity === "OK"
      ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
      : severity === "WARNING"
      ? "bg-[var(--status-warning)] text-[var(--g-text-inverse)]"
      : "bg-[var(--status-error)] text-[var(--g-text-inverse)]";

  const Icon =
    severity === "OK" ? CheckCircle2 : severity === "WARNING" ? AlertTriangle : XCircle;

  return (
    <div className="flex items-center justify-between gap-2 py-2">
      <span className="text-sm text-[var(--g-text-primary)]">{label}</span>
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium ${tone}`}
        style={{ borderRadius: "var(--g-radius-sm)" }}
      >
        <Icon className="h-3 w-3" />
        {severity === "OK" ? "OK" : severity === "WARNING" ? "Advertencia" : "Bloqueante"}
      </span>
    </div>
  );
}

interface PreviewGatePanelProps {
  params: PreviewParams;
  className?: string;
}

export function PreviewGatePanel({ params, className = "" }: PreviewGatePanelProps) {
  const [expanded, setExpanded] = useState(false);
  const { data: result, isLoading, isFetching } = usePreviewAcuerdo(params);

  if (!params.materia) return null;

  const overallOk = result?.ok ?? null;

  return (
    <div
      className={`border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] ${className}`}
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-[var(--g-brand-3308)]" />
          <span className="text-sm font-medium text-[var(--g-text-primary)]">
            Simulación del motor LSC
          </span>
          {(isLoading || isFetching) && (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--g-text-secondary)]" />
          )}
          {!isLoading && !isFetching && overallOk !== null && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium ${
                overallOk
                  ? "bg-[var(--status-success)] text-[var(--g-text-inverse)]"
                  : "bg-[var(--status-error)] text-[var(--g-text-inverse)]"
              }`}
              style={{ borderRadius: "var(--g-radius-sm)" }}
            >
              {overallOk ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
              {overallOk ? "Viable" : "Bloqueado"}
            </span>
          )}
        </div>
        <span className="text-[var(--g-text-secondary)]">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-[var(--g-border-subtle)] px-4 pb-4 pt-3">
          <p className="mb-3 text-xs text-[var(--g-text-secondary)]">
            Evaluación con parámetros estándar (75% capital presente, 70% votos a favor). Los resultados son
            orientativos — la evaluación definitiva ocurre al cerrar la sesión.
          </p>

          {isLoading ? (
            <div className="flex items-center gap-2 py-3 text-sm text-[var(--g-text-secondary)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Ejecutando motor…
            </div>
          ) : !result ? (
            <p className="py-2 text-sm text-[var(--g-text-secondary)]">
              No se encontró rule pack para esta materia.
            </p>
          ) : (
            <div className="divide-y divide-[var(--g-border-subtle)]">
              {result.etapas.map((etapa, i) => (
                <GateBadge
                  key={i}
                  severity={etapa.severity}
                  label={GATE_LABELS[etapa.etapa] ?? etapa.etapa}
                />
              ))}

              {result.blocking_issues.length > 0 && (
                <div className="pt-3">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--status-error)]">
                    Bloqueos
                  </p>
                  <ul className="space-y-1">
                    {result.blocking_issues.map((issue, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-[var(--g-text-secondary)]">
                        <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-[var(--status-error)]" />
                        {issue}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.warnings.length > 0 && (
                <div className="pt-3">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--status-warning)]">
                    Advertencias
                  </p>
                  <ul className="space-y-1">
                    {result.warnings.map((w, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-[var(--g-text-secondary)]">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-[var(--status-warning)]" />
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
