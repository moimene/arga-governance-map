/**
 * Procedencia del rule pack usado por el dictamen de validez del expediente.
 *
 * MOI-207 — mismo criterio que `RegistryRuleProvenanceNotice` del Tramitador
 * (advertir, no bloquear), pero con texto propio: aquí no hay elevación a
 * escritura ni efectos registrales, hay un dictamen de cumplimiento (plazos,
 * quórum, mayorías) que puede estar leyendo la regla de un órgano distinto al
 * que adopta el acuerdo.
 *
 * Si con discrepancia de órgano el dictamen debe bloquear en vez de advertir
 * es criterio del Comité Legal (MOI-198), no de este componente.
 */
import { AlertTriangle } from "lucide-react";
import { bodyTypeLabel } from "@/lib/secretaria/body-labels";
import {
  isUnreliableRulePackSelection,
  type RulePackSelectionReason,
} from "@/lib/secretaria/rule-pack-selection";

export function AgreementRulePackProvenanceNotice({
  reason,
  packOrgano,
  agreementOrgano,
  className,
}: {
  reason?: RulePackSelectionReason | null;
  packOrgano?: string | null;
  agreementOrgano?: string | null;
  className?: string;
}) {
  if (!isUnreliableRulePackSelection(reason)) return null;

  const mensaje =
    reason === "FALLBACK_ORGANO_DISTINTO" ? (
      <>
        El dictamen de validez usa la regla de {bodyTypeLabel(packOrgano)}: no hay una regla activa
        para esta materia del órgano que adopta el acuerdo, {bodyTypeLabel(agreementOrgano)}. Revise
        el dictamen antes de utilizarlo: no constituye validación legal productiva.
      </>
    ) : (
      <>
        Hay varias reglas activas para esta materia y no se ha podido determinar el órgano que
        adopta el acuerdo, así que el dictamen de validez usa una de ellas sin preferencia
        acreditada. Revise el dictamen antes de utilizarlo.
      </>
    );

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-start gap-2 border border-[var(--g-border-subtle)] bg-[var(--g-surface-muted)] px-4 py-3 text-sm text-[var(--g-text-secondary)] ${className ?? ""}`}
      style={{ borderRadius: "var(--g-radius-md)" }}
      data-agreement-rule-provenance={reason}
    >
      <AlertTriangle
        className="mt-0.5 h-4 w-4 shrink-0 text-[var(--status-warning)]"
        aria-hidden="true"
      />
      <span>{mensaje}</span>
    </div>
  );
}
