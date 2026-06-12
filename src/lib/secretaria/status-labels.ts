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

  // ITEM-070: claves de estado en inglés que la BD emite en
  // certificaciones/actas/workflow y que aparecían sin traducir en la UI.
  SIGNED:       "Firmada",
  APPROVED:     "Aprobado",
  REJECTED:     "Rechazado",
  PENDING:      "Pendiente",
  ISSUED:       "Emitida",
  SEALED:       "Sellada",
  REVISED:      "Revisada",

  // ITEM-067: estados de comunicaciones (nivel campaña) y de entrega por
  // destinatario, que ComunicacionDetalle/Comunicaciones mostraban en crudo.
  // BORRADOR/PROGRAMADA/ENVIADA/CANCELADA ya cubiertos arriba.
  ENVIANDO:           "Enviando",
  ENTREGADA_PARCIAL:  "Entregada parcial",
  ENTREGADA_TOTAL:    "Entregada",
  RESPONDIDA_PARCIAL: "Respondida parcial",
  RESPONDIDA_TOTAL:   "Respondida",
  EXPIRADA:           "Expirada",
  ERROR:              "Error",
  // Entrega por destinatario
  ENVIADO:    "Enviado",
  ENTREGADO:  "Entregado",
  LEIDO:      "Leído",
  RESPONDIDO: "Respondido",
  REBOTADO:   "Rebotado",
};

export function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}
