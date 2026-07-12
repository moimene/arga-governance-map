import { AlertTriangle, RefreshCw } from "lucide-react";

interface ConfigurationLoadErrorProps {
  title: string;
  detail?: string;
  onRetry: () => void;
  retrying?: boolean;
}

/** Estado compartido para impedir que un fallo Cloud parezca un catálogo vacío. */
export function ConfigurationLoadError({
  title,
  detail = "No se muestran datos parciales para evitar decisiones sobre una configuración incompleta.",
  onRetry,
  retrying = false,
}: ConfigurationLoadErrorProps) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 border border-[var(--status-error)] bg-[var(--g-surface-card)] p-4 sm:flex-row sm:items-center sm:justify-between"
      style={{ borderRadius: "var(--g-radius-lg)", boxShadow: "var(--g-shadow-card)" }}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          className="mt-0.5 h-5 w-5 shrink-0 text-[var(--status-error)]"
          aria-hidden="true"
        />
        <div>
          <p className="text-sm font-semibold text-[var(--g-text-primary)]">{title}</p>
          <p className="mt-1 text-sm text-[var(--g-text-secondary)]">{detail}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        aria-busy={retrying}
        className="inline-flex shrink-0 items-center justify-center gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-card)] px-3 py-2 text-sm font-medium text-[var(--g-text-primary)] hover:bg-[var(--g-surface-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--g-brand-3308)] disabled:cursor-not-allowed disabled:opacity-60"
        style={{ borderRadius: "var(--g-radius-md)" }}
      >
        <RefreshCw className={`h-4 w-4 ${retrying ? "animate-spin" : ""}`} aria-hidden="true" />
        {retrying ? "Reintentando…" : "Reintentar carga"}
      </button>
    </div>
  );
}
