import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  FileSearch,
  Loader2,
  RefreshCw,
  UserCheck,
  UserPlus,
  XCircle,
} from "lucide-react";
import {
  REVIEW_EVENTS_TABLE,
  REVIEW_STATE_VIEW,
  probeReviewStateSchema,
  staticReviewStateSchemaGate,
} from "@/lib/motor-plantillas";

const ACTIONS = [
  { label: "Asignar", icon: UserPlus },
  { label: "Aprobar", icon: CheckCircle2 },
  { label: "Rechazar", icon: XCircle },
  { label: "Reasignar", icon: UserCheck },
];

export default function DocumentosPendientesRevision() {
  const fallback = staticReviewStateSchemaGate();
  const gate = useQuery({
    queryKey: ["motor-plantillas", "review-state-schema-gate"],
    queryFn: probeReviewStateSchema,
    enabled: false,
    initialData: fallback,
    retry: false,
    staleTime: 60_000,
  });
  const data = gate.data;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[var(--g-brand-3308)]">
            <FileSearch className="h-3.5 w-3.5" />
            Motor de plantillas
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--g-text-primary)]">
            Documentos pendientes de revision
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-[var(--g-text-secondary)]">
            Bandeja de revision para documentos generados y archivados como DEMO_OPERATIVA.
          </p>
        </div>
        <button
          type="button"
          onClick={() => gate.refetch()}
          className="inline-flex items-center gap-2 border border-[var(--g-border-subtle)] px-3 py-2 text-sm text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)]"
          style={{ borderRadius: "var(--g-radius-md)" }}
          aria-busy={gate.isFetching}
        >
          {gate.isFetching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Verificar schema
        </button>
      </div>

      <div
        className="border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] p-5"
        style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
      >
        {gate.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-[var(--g-text-secondary)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Verificando contrato de revision documental...
          </div>
        ) : data.supported ? (
          <div className="flex items-start gap-3 text-sm text-[var(--status-success)]">
            <CheckCircle2 className="mt-0.5 h-4 w-4" />
            <div>
              <p className="font-medium">Schema de revision disponible.</p>
              <p className="mt-1 text-[var(--g-text-secondary)]">
                La bandeja puede consultar {REVIEW_STATE_VIEW}.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 text-sm text-[var(--status-warning)]">
            <AlertTriangle className="mt-0.5 h-4 w-4" />
            <div className="space-y-3">
              <div>
                <p className="font-medium">Revision bloqueada por schema pendiente.</p>
                <p className="mt-1 text-[var(--g-text-secondary)]">
                  No se escriben columnas inexistentes ni se simula persistencia local.
                </p>
              </div>
              <div className="grid gap-3 text-xs text-[var(--g-text-secondary)] md:grid-cols-2">
                <div>
                  <p className="font-semibold text-[var(--g-text-primary)]">Tabla requerida</p>
                  <p className="font-mono">{REVIEW_EVENTS_TABLE}</p>
                </div>
                <div>
                  <p className="font-semibold text-[var(--g-text-primary)]">Vista requerida</p>
                  <p className="font-mono">{REVIEW_STATE_VIEW}</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--g-text-primary)]">Campos bloqueantes</p>
                <ul className="mt-2 grid gap-1 text-xs text-[var(--g-text-secondary)] sm:grid-cols-2">
                  {data.missing.map((item) => (
                    <li key={item} className="font-mono">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              {data.error ? (
                <p className="text-xs text-[var(--status-warning)]">
                  Probe: {data.error}
                </p>
              ) : null}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              type="button"
              disabled
              className="inline-flex items-center justify-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-4 py-3 text-sm font-medium text-[var(--g-text-secondary)] disabled:cursor-not-allowed disabled:opacity-60"
              style={{ borderRadius: "var(--g-radius-md)" }}
            >
              <Icon className="h-4 w-4" />
              {action.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
