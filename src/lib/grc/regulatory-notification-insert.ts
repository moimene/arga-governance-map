// MOI-149 (D-23, alta por pantalla): construye la fila de INSERT para
// `regulatory_notifications` desde el formulario de la ficha de incidente.
//
// Dos trampas conocidas del propio issue que este módulo hoja existe para no
// repetir en cada pantalla que dé de alta una notificación:
//   1. La columna es `notification_deadline`, NUNCA `deadline`.
//   2. `tenant_id` debe llegar EXPLÍCITO desde el contexto de tenant de la
//      sesión (`useTenantContext`), nunca inferido: sin RLS con DEFAULT (esta
//      tabla no lo tiene), un INSERT sin tenant_id fallaría por NOT NULL, pero
//      un tenantId equivocado aterrizaría silenciosamente en otro tenant.
// `authority` es NOT NULL en el esquema (grc_schema_002): se valida aquí para
// fallar antes del round-trip, con el mismo mensaje que el usuario necesita.
export type RegulatoryNotificationFormInput = {
  tenantId: string;
  authority: string;
  notificationType?: string | null;
  notificationDeadline?: string | null;
  incidentId?: string | null;
  referenceNumber?: string | null;
};

export type RegulatoryNotificationInsertRow = {
  tenant_id: string;
  authority: string;
  notification_type: string | null;
  notification_deadline: string | null;
  incident_id: string | null;
  reference_number: string | null;
};

export function buildRegulatoryNotificationInsert(
  input: RegulatoryNotificationFormInput
): RegulatoryNotificationInsertRow {
  if (!input.tenantId) {
    throw new Error("Falta el tenant de la sesión: no se puede dar de alta la notificación.");
  }
  const authority = input.authority.trim();
  if (!authority) {
    throw new Error("La autoridad es obligatoria (columna NOT NULL en regulatory_notifications).");
  }
  return {
    tenant_id: input.tenantId,
    authority,
    notification_type: input.notificationType?.trim() || null,
    notification_deadline: input.notificationDeadline || null,
    incident_id: input.incidentId || null,
    reference_number: input.referenceNumber?.trim() || null,
  };
}
