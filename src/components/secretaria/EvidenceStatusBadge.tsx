import { evidenceStatusDescriptor, type EvidenceTone } from "@/lib/secretaria/evidence-status-labels";

const TONE_CLASS: Record<EvidenceTone, string> = {
  success: "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  warning: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  error: "bg-[var(--status-error)] text-[var(--g-text-inverse)]",
  neutral: "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
};

interface EvidenceStatusBadgeProps {
  status?: string | null;
  /** Muestra el disclaimer legal bajo la etiqueta (default true). */
  showDisclaimer?: boolean;
}

/**
 * Chip de estado de evidencia con disclaimer legal. Garantiza que la evidencia de entorno
 * de validación funcional (sandbox/demo) no se presente como cualificada productiva.
 * Ref: informe UX 2026-06-20 §7.3 / auditoría de brechas P0-1.
 */
export function EvidenceStatusBadge({ status, showDisclaimer = true }: EvidenceStatusBadgeProps) {
  const descriptor = evidenceStatusDescriptor(status);
  return (
    <div className="space-y-1">
      <span
        className={`inline-flex w-fit items-center px-2 py-0.5 text-xs font-medium ${TONE_CLASS[descriptor.tone]}`}
        style={{ borderRadius: "var(--g-radius-full)" }}
      >
        {descriptor.label}
      </span>
      {showDisclaimer && descriptor.disclaimer && !descriptor.isQualified ? (
        <p className="max-w-[260px] text-[11px] leading-snug text-[var(--g-text-secondary)]">
          {descriptor.disclaimer}
        </p>
      ) : null}
    </div>
  );
}

export default EvidenceStatusBadge;
