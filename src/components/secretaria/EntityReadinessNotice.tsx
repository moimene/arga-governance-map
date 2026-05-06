import { AlertTriangle } from "lucide-react";
import {
  DEMO_READINESS_REASON_LABELS,
  demoReadinessMessage,
  type DemoReadiness,
} from "@/lib/secretaria/entity-demo-readiness";

export function EntityReadinessNotice({
  readiness,
  compact = false,
}: {
  readiness: DemoReadiness | null | undefined;
  compact?: boolean;
}) {
  if (!readiness || readiness.status === "complete") return null;

  const blocking = readiness.status === "reference_only";
  const message = blocking
    ? demoReadinessMessage(readiness)
    : `Sociedad parcialmente preparada: ${readiness.reasons.map((reason) => DEMO_READINESS_REASON_LABELS[reason]).join(", ")}.`;

  return (
    <div
      className="flex items-start gap-3 border border-[var(--g-border-subtle)] bg-[var(--g-surface-subtle)] p-3"
      style={{ borderRadius: "var(--g-radius-md)" }}
      role={blocking ? "alert" : "status"}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warning)]" aria-hidden="true" />
      <div>
        <p className="text-sm font-medium text-[var(--g-text-primary)]">
          {blocking ? "Sociedad no operable para este flujo" : "Contrato demo parcial"}
        </p>
        {!compact ? (
          <p className="mt-1 text-sm text-[var(--g-text-secondary)]">
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
