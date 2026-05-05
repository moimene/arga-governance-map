export const STATUS_LABEL: Record<string, string> = {
  // Estados maestros
  ACTIVE:       "Activa",
  Active:       "Activa",
  INACTIVE:     "Inactiva",
  Inactive:     "Inactiva",
  ELEVATED:     "Elevada a público",
  SUBMITTED:    "Preparada para tramitación",

  // Acuerdos sin sesión
  BORRADOR:     "Borrador",
  VOTING_OPEN:  "Votación abierta",
  APROBADO:     "Aprobado",
  RECHAZADO:    "Rechazado",

  // Tramitador
  PREPARADA:    "Preparada",
  PRESENTADA:   "Preparada para tramitación",
  EN_TRAMITE:   "En trámite",
  SUBSANACION:  "Subsanación",
  INSCRITA:     "Inscrita",
  DENEGADA:     "Denegada",

  // Reuniones
  PROGRAMADA:   "Programada",
  CONVOCADA:    "Convocada",
  EN_CURSO:     "En curso",
  CELEBRADA:    "Celebrada",
  CANCELADA:    "Cancelada",

  // Plantillas / modelos
  REVISADA:     "Revisada",
  APROBADA:     "Aprobada",
  ACTIVA:       "Activa",
  ARCHIVADA:    "Archivada",

  // Convocatorias
  EMITIDA:      "Emitida",
  ENVIADA:      "Enviada",
  CONFIRMADA:   "Confirmada",

  // Libros obligatorios — legalización
  PENDIENTE:    "Pendiente",
  PRESENTADO:   "Preparado para legalización",
  LEGALIZADO:   "Legalizado",

  // Decisiones unipersonales
  FIRMADA:      "Firmada",

  // Expediente acuerdo
  DRAFT:        "Borrador",
  PROPOSED:     "Propuesto",
  ADOPTED:      "Adoptado",
  CERTIFIED:    "Certificado",
  INSTRUMENTED: "Instrumentado",
  FILED:        "Preparado para registro",
  REGISTERED:   "Inscrito",
  PUBLISHED:    "Publicado",
  REJECTED_REGISTRY: "Denegado en registro",
};

export function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}
