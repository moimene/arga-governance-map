/**
 * Labels y transiciones canónicas de plantillas (template-admin).
 *
 * ITEM-138: antes estos mapas estaban copiados (con divergencias) en
 * `Plantillas.tsx`, `CatalogoTab.tsx` y `CoberturaLegalTab.tsx`, y dos mapas de
 * transición independientes (`WORKFLOW_TRANSITIONS` / `TRANSITION_MAP`) debían
 * mantenerse a mano sincronizados con `TRANSITION_MATRIX` del servicio. Aquí se
 * centralizan los supersets y las transiciones se derivan/validan contra la
 * state machine canónica.
 *
 * Las clases de color de los badges de estado NO se centralizan: cada superficie
 * tiene matices visuales legítimos (icono, tono). Solo se comparten las ETIQUETAS.
 */
import type { EstadoPlantilla } from "./types";
import { TRANSITION_MATRIX } from "./template-admin-service";

export const ESTADO_LABEL: Record<string, string> = {
  BORRADOR: "Borrador",
  REVISADA: "Revisada",
  APROBADA: "Aprobada",
  ACTIVA: "Activa",
  ARCHIVADA: "Archivada",
  DEPRECADA: "Deprecada",
};

export const TIPO_LABEL: Record<string, string> = {
  ACTA_SESION: "Acta de sesión",
  ACTA_CONSIGNACION: "Acta de consignación",
  ACTA_ACUERDO_ESCRITO: "Acta acuerdo escrito sin sesión",
  ACTA_DECISION_CONJUNTA: "Acta decisión conjunta",
  ACTA_ORGANO_ADMIN: "Acta órgano de administración",
  CERTIFICACION: "Certificación de acuerdos",
  CONVOCATORIA: "Convocatoria",
  CONVOCATORIA_SL_NOTIFICACION: "Convocatoria SL con notificación",
  MODELO_ACUERDO: "Modelo de acuerdo",
  INFORME_PRECEPTIVO: "Informe preceptivo",
  INFORME_DOCUMENTAL_PRE: "Informe documental PRE",
  INFORME_GESTION: "Informe de gestión",
  DOCUMENTO_REGISTRAL: "Documento registral",
  SUBSANACION_REGISTRAL: "Subsanación registral",
};

export const ORGANO_LABEL: Record<string, string> = {
  JUNTA_GENERAL: "Junta General",
  CONSEJO: "Consejo de Administración",
  CONSEJO_ADMIN: "Consejo de Administración",
  ORGANO_ADMIN: "Órgano de Administración",
};

export const MODE_LABEL: Record<string, string> = {
  MEETING: "Sesión",
  UNIVERSAL: "Universal",
  NO_SESSION: "Sin sesión",
  UNIPERSONAL_SOCIO: "Socio único",
  UNIPERSONAL_ADMIN: "Admin. único",
  CO_APROBACION: "Co-aprobación",
  SOLIDARIO: "Admin. solidario",
};

export const JURISDICTION_LABEL: Record<string, string> = {
  ES: "España",
  PT: "Portugal",
  BR: "Brasil",
  MX: "México",
  GLOBAL: "Global",
  MULTI: "Multijurisdicción",
};

export function tipoLabel(value?: string | null): string {
  if (!value) return "—";
  return TIPO_LABEL[value] ?? value.replace(/_/g, " ");
}

export function organoLabel(value?: string | null): string {
  if (!value) return "—";
  return ORGANO_LABEL[value] ?? value;
}

export function modeLabel(value?: string | null): string {
  if (!value) return "—";
  return MODE_LABEL[value] ?? value;
}

export function estadoLabel(value?: string | null): string {
  if (!value) return "Estado pendiente";
  return ESTADO_LABEL[value] ?? value.replace(/_/g, " ");
}

export function jurisdictionLabel(code?: string | null): string {
  if (!code) return "Jurisdicción pendiente";
  return JURISDICTION_LABEL[code] ?? code;
}

/**
 * Transición primaria "hacia adelante" del flujo de aprobación, derivada de la
 * state machine canónica. Solo cubre el camino feliz BORRADOR→…→ARCHIVADA; el
 * resto de transiciones permitidas (retrocesos, archivado lateral) las gestiona
 * directamente `TRANSITION_MATRIX`/`isTransitionAllowed`.
 */
export interface PrimaryTransition {
  next: EstadoPlantilla;
  label: string;
  confirm: string;
}

const PRIMARY_FORWARD: Partial<Record<EstadoPlantilla, PrimaryTransition>> = {
  BORRADOR: {
    next: "REVISADA",
    label: "Marcar como revisada",
    confirm: "¿Confirmar que el contenido jurídico ha sido revisado?",
  },
  REVISADA: {
    next: "APROBADA",
    label: "Aprobar",
    confirm: "¿Confirmar la aprobación formal por el Comité Legal?",
  },
  APROBADA: {
    next: "ACTIVA",
    label: "Activar en producción",
    confirm: "¿Activar esta plantilla para uso en producción? Esta acción habilita el Gate PRE.",
  },
  ACTIVA: {
    next: "ARCHIVADA",
    label: "Archivar",
    confirm: "¿Archivar esta plantilla? Dejará de seleccionarse como plantilla activa.",
  },
};

// Guard de coherencia: cada transición primaria debe estar permitida por la
// state machine canónica. Si TRANSITION_MATRIX cambia y deja de permitir un
// salto del camino feliz, esto lo expone en dev/test en vez de divergir en
// silencio.
export const TEMPLATE_PRIMARY_TRANSITIONS: Partial<Record<EstadoPlantilla, PrimaryTransition>> =
  Object.fromEntries(
    Object.entries(PRIMARY_FORWARD).filter(([from, t]) =>
      TRANSITION_MATRIX[from as EstadoPlantilla]?.includes(t.next),
    ),
  );
