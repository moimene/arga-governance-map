export const STATUS_LABEL: Record<string, string> = {
  // Estados maestros
  ACTIVE:       "Activa",
  Active:       "Activa",
  INACTIVE:     "Inactiva",
  Inactive:     "Inactiva",
  // ITEM-102: claves inglesas legacy del Tramitador (ya migradas en Cloud al
  // vocabulario español canónico, se mantienen por compatibilidad de lectura).
  ELEVATED:     "Elevada a público (legacy)",
  SUBMITTED:    "Presentada (legacy)",
  INSCRIBED:    "Inscrita (legacy)",

  // Acuerdos sin sesión
  BORRADOR:     "Borrador",
  VOTING_OPEN:  "Votación abierta",
  APROBADO:     "Aprobado",
  RECHAZADO:    "Rechazado",

  // Tramitador — vocabulario canónico español (ITEM-102: PRESENTADA ya no colisiona
  // con SUBMITTED; ELEVADA es la elevación a público).
  PREPARADA:    "Preparada",
  PRESENTADA:   "Presentada",
  EN_TRAMITE:   "En trámite",
  SUBSANACION:  "Subsanación",
  INSCRITA:     "Inscrita",
  ELEVADA:      "Elevada a público",
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
  NO_APLICA:    "No aplica",  // ITEM-070: libros sin legalización obligatoria

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

  // Pipeline documental (informes/certificaciones autónomas) — copy validado por el
  // Comité Legal. Ref: docs/superpowers/reviews/2026-06-20-informe-ux-redesign-copy-legal.md §7.2
  // y auditoría 2026-06-20-auditoria-brechas-ux-secretaria.md (P1-1). Antes se renderizaban
  // crudos en inglés vía status.replace(/_/g," ").
  SOURCE_LOCKED:        "Fuente fijada",
  GENERATED:            "Documento generado",
  IN_REVIEW:            "En revisión",
  EMITTED:              "Emitida",
  ARCHIVED:             "Archivado",
  ATTACHED:             "Anexado",
  SUPERSEDED:           "Sustituido",
  REVOKED:              "Revocado",
  FAILED:               "Fallido",
  WAIVED_WITH_OVERRIDE: "Omitido con autorización",
  VERIFIED:             "Verificada",
};

export function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

/**
 * Efecto jurídico declarado de una certificación (`standalone_certifications.legal_effect`).
 * Copy validado por Legal (§7.1 / §6.4.1 del informe UX 2026-06-20): nombrar el efecto,
 * no exponer el valor crudo del enum.
 */
export const LEGAL_EFFECT_LABEL: Record<string, string> = {
  INTERNO:    "Efecto interno",
  SOCIO:      "Efecto frente a socio",
  AUDITOR:    "Efecto frente a auditor",
  TERCERO:    "Efecto frente a terceros",
  REGISTRAL:  "Efecto registral",
  SUPERVISOR: "Efecto frente a supervisor",
  PROBATORIO: "Efecto probatorio",
};

export function legalEffectLabel(effect: string | null | undefined): string {
  if (!effect) return "Efecto no declarado";
  return LEGAL_EFFECT_LABEL[effect] ?? effect;
}
