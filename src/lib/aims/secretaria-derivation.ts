/**
 * Contrato de la conexión persistente AIMS -> Secretaría (MOI-56).
 *
 * Ver docs/superpowers/specs/2026-09-27-contrato-conexion-aims-secretaria.md.
 * Decisión D-18 (delegada por Moisés): estructura propia — prohibido escribir
 * en `governance_module_events`/`governance_module_links`.
 *
 * Módulo HOJA: no importa Supabase ni React, para poder testear la arista sin
 * levantar ningún doble de red (mismo patrón que `rule-pack-selection.ts`).
 * `buildDerivationInsert` es el punto único que decide qué fila se inserta;
 * si falta el tenant, el origen, el evento o el destino, LANZA en vez de
 * dejar pasar una fila con la relación a medias — esa es la arista que la
 * pantalla y la sonda no pueden perder.
 */

export interface DerivationTargetMeeting {
  kind: "meeting";
  meetingId: string;
}
export interface DerivationTargetAgreement {
  kind: "agreement";
  agreementId: string;
}
export type DerivationTarget = DerivationTargetMeeting | DerivationTargetAgreement;

export interface AimsSecretariaDerivationInput {
  tenantId: string | null | undefined;
  sourceIncidentId: string | null | undefined;
  sourceEvent: string | null | undefined;
  target: DerivationTarget | null | undefined;
}

export interface AimsSecretariaDerivationInsert {
  tenant_id: string;
  source_incident_id: string;
  source_event: string;
  target_meeting_id: string | null;
  target_agreement_id: string | null;
}

/**
 * Construye la fila a insertar en `aims_secretaria_derivations`. Lanza si
 * falta cualquiera de los cuatro campos del contrato — es la arista: si una
 * pantalla deja de pasar el `sourceId` del handoff o el id del destino recién
 * creado, esto revienta en vez de guardar una relación coja.
 */
export function buildDerivationInsert(
  input: AimsSecretariaDerivationInput,
): AimsSecretariaDerivationInsert {
  const { tenantId, sourceIncidentId, sourceEvent, target } = input;
  if (!tenantId) {
    throw new Error("DERIVACION_SIN_TENANT: falta tenant_id");
  }
  if (!sourceIncidentId) {
    throw new Error("DERIVACION_SIN_ORIGEN: falta el id del incidente AIMS de origen");
  }
  if (!sourceEvent) {
    throw new Error("DERIVACION_SIN_EVENTO: falta el evento de la derivación");
  }
  if (!target) {
    throw new Error("DERIVACION_SIN_DESTINO: falta la reunión o el acuerdo creado");
  }
  return {
    tenant_id: tenantId,
    source_incident_id: sourceIncidentId,
    source_event: sourceEvent,
    target_meeting_id: target.kind === "meeting" ? target.meetingId : null,
    target_agreement_id: target.kind === "agreement" ? target.agreementId : null,
  };
}

/**
 * Código de violación de unicidad de Postgres (23505): la derivación ya
 * existe para ese par origen/destino — la escritura es idempotente y debe
 * tratarse como éxito, no como fallo.
 */
export const DERIVATION_UNIQUE_VIOLATION_CODE = "23505";
