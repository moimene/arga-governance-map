/**
 * UX-7.B — Badge de cohorte de plantilla. Clasifica la ficha (pura, sobre
 * metadatos reales) y la presenta con tokens Garrigues. Reutilizado en la lista
 * (mobile + desktop) y en el panel de detalle de `Plantillas.tsx`.
 */
import {
  clasificarCohortePlantilla,
  cohorteDescripcion,
  cohorteLabel,
  cohorteTone,
  type PlantillaCohorteInput,
} from "@/lib/secretaria/template-admin";

const TONE_CLASS: Record<"success" | "warning" | "neutral", string> = {
  success: "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  warning: "bg-[var(--status-warning)] text-[var(--g-text-inverse)]",
  neutral: "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
};

export function CohorteBadge({
  plantilla,
  className,
}: {
  plantilla: PlantillaCohorteInput;
  className?: string;
}) {
  const cohorte = clasificarCohortePlantilla(plantilla);
  return (
    <span
      title={cohorteDescripcion(cohorte)}
      className={`inline-block px-2 py-0.5 text-[11px] font-medium ${TONE_CLASS[cohorteTone(cohorte)]} ${className ?? ""}`}
      style={{ borderRadius: "var(--g-radius-sm)" }}
    >
      {cohorteLabel(cohorte)}
    </span>
  );
}
