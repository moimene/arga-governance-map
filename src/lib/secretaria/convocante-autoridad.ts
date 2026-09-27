import type { TipoOrgano } from "@/lib/rules-engine/types";

type Evidencia = { body_id: string | null; cargo: string };

/**
 * Quién convoca (MOI-142). Criterio único para la validación de emisión y para
 * el texto de la convocatoria: separarlos dejó una Junta emitida con «Firma del
 * órgano convocante: .» vacío.
 *
 * - Junta: el órgano de administración de la misma sociedad —Presidente del
 *   Consejo o administrador único— (art. 166 LSC), nunca el órgano de la Junta,
 *   que no tiene Presidente propio.
 * - Resto: el Presidente vigente del propio órgano, como hasta ahora (el
 *   Consejo exige además que el cargo sea PRESIDENTE en la validación).
 */
export function autoridadConvocante<E extends Evidencia>(input: {
  organoTipo: TipoOrgano;
  presidenteDelOrgano: E | null | undefined;
  organoAdministracionId: string | null;
  evidenciasEntidad: E[];
}): E | null {
  if (input.organoTipo !== "JUNTA_GENERAL") return input.presidenteDelOrgano ?? null;
  if (!input.organoAdministracionId) return null;
  return (
    input.evidenciasEntidad.find(
      (ev) =>
        ev.body_id === input.organoAdministracionId &&
        (ev.cargo === "PRESIDENTE" || ev.cargo === "ADMIN_UNICO"),
    ) ?? null
  );
}
