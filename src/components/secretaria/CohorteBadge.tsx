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
  SEMANTIC_TONE_CLASS,
  type PlantillaCohorteInput,
} from "@/lib/secretaria/template-admin";

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
      className={`inline-block px-2 py-0.5 text-[11px] font-medium ${SEMANTIC_TONE_CLASS[cohorteTone(cohorte)]} ${className ?? ""}`}
      style={{ borderRadius: "var(--g-radius-sm)" }}
    >
      {cohorteLabel(cohorte)}
    </span>
  );
}
