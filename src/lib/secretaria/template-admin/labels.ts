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
 * Los ejes de estado (ciclo, disponibilidad, cobertura y salud) conservan sus
 * nombres propios, pero comparten un vocabulario de tonos semánticos accesible.
 */
import type {
  EstadoPlantilla,
  SemanticTone,
  TemplateMetadataPolicy,
} from "./types";
import { TRANSITION_MATRIX } from "./template-admin-service";

function normalizeLabelCode(value?: string | null): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[.\s/-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function humanizeCode(value?: string | null, emptyLabel = "No informado"): string {
  const normalized = normalizeLabelCode(value);
  if (!normalized) return emptyLabel;
  const words = normalized.toLowerCase().replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export const ESTADO_LABEL: Record<string, string> = {
  BORRADOR: "Borrador",
  REVISADA: "Revisada",
  APROBADA: "Aprobada",
  ACTIVA: "Vigente",
  ARCHIVADA: "Archivada",
  DEPRECADA: "Deprecada",
};

export const TIPO_LABEL: Record<string, string> = {
  ACTA_SESION: "Acta de sesión",
  ACTA_CONSIGNACION: "Acta de consignación",
  ACTA_ACUERDO_ESCRITO: "Acta de acuerdo escrito sin sesión",
  ACTA_DECISION_CONJUNTA: "Acta de decisión conjunta",
  ACTA_ORGANO_ADMIN: "Acta de órgano de administración",
  CERTIFICACION: "Certificación de acuerdos",
  COMISION_DELEGADA: "Acta de comisión delegada",
  CONVOCATORIA: "Convocatoria",
  CONVOCATORIA_SL_NOTIFICACION: "Convocatoria de S.L. con notificación individual",
  MODELO_ACUERDO: "Modelo de acuerdo",
  INFORME_PRECEPTIVO: "Informe preceptivo",
  INFORME_DOCUMENTAL_PRE: "Informe de comprobación documental previa",
  INFORME_GESTION: "Informe de gestión",
  DOCUMENTO_REGISTRAL: "Documento registral",
  SUBSANACION_REGISTRAL: "Subsanación registral",
};

export const ORGANO_LABEL: Record<string, string> = {
  ANY: "Cualquier órgano",
  JUNTA: "Junta General",
  JUNTA_GENERAL: "Junta General",
  ASAMBLEA: "Junta General / Asamblea",
  JUNTA_GENERAL_O_CONSEJO: "Junta General o Consejo de Administración",
  CDA: "Consejo de Administración",
  CONSEJO: "Consejo de Administración",
  CONSEJO_ADMIN: "Consejo de Administración",
  CONSEJO_ADMINISTRACION: "Consejo de Administración",
  ORGANO_ADMIN: "Órgano de Administración",
  SOCIO_UNICO: "Socio único",
  ADMIN_UNICO: "Administrador único",
  ADMINISTRADOR_UNICO: "Administrador único",
  ADMIN_CONJUNTA: "Administradores mancomunados",
  ADMIN_MANCOMUNADO: "Administradores mancomunados",
  ADMIN_CONJUNTA_O_COAPROBADORES: "Administradores mancomunados o coaprobadores",
  ADMINISTRADORES_MANCOMUNADOS: "Administradores mancomunados",
  ADMIN_SOLIDARIO: "Administradores solidarios",
  ADMIN_SOLIDARIOS: "Administradores solidarios",
  ADMINISTRADORES_SOLIDARIOS: "Administradores solidarios",
  COMISION: "Comisión delegada",
  COMISION_DELEGADA: "Comisión delegada",
  SOPORTE_INTERNO: "Soporte interno",
  DERIVADO_DEL_ACTO: "Derivado del acto societario",
};

export const MODE_LABEL: Record<string, string> = {
  ANY: "Cualquier forma de adopción",
  MEETING: "Sesión formal",
  UNIVERSAL: "Junta universal",
  NO_SESSION: "Acuerdo sin sesión",
  UNIPERSONAL_SOCIO: "Decisión de socio único",
  UNIPERSONAL_ADMIN: "Decisión de administrador único",
  CO_APROBACION: "Decisión mancomunada",
  SOLIDARIO: "Decisión de administrador solidario",
};

export const TIPO_SOCIAL_LABEL: Record<string, string> = {
  ANY: "Todos los tipos sociales",
  SA: "S.A.",
  SAU: "S.A.U.",
  SL: "S.L.",
  SLU: "S.L.U.",
  SRL: "S.L.",
};

export const JURISDICTION_LABEL: Record<string, string> = {
  ES: "España",
  PT: "Portugal",
  BR: "Brasil",
  MX: "México",
  GLOBAL: "Global",
  MULTI: "Multijurisdicción",
};

// Política de metadatos: vive en el módulo HOJA metadata-policy.ts (los gates
// la importan directamente; importar labels.ts desde el Gate PRE crearía un
// ciclo con TDZ vía TRANSITION_MATRIX). Se re-exporta para los consumidores
// existentes de labels.
export {
  NON_ADOPTABLE_DOCUMENT_TYPES,
  hasSpecificTemplateMetadata,
  isAdoptionMetadataRequired,
  requiresLegalReference,
  templateMetadataPolicy,
} from "./metadata-policy";
import { isAdoptionMetadataRequired } from "./metadata-policy";

export function tipoLabel(value?: string | null): string {
  const normalized = normalizeLabelCode(value);
  if (!normalized) return "Tipo documental no informado";
  return TIPO_LABEL[normalized] ?? humanizeCode(normalized);
}

export function organoLabel(value?: string | null): string {
  const normalized = normalizeLabelCode(value);
  if (!normalized) return "Órgano no informado";
  return ORGANO_LABEL[normalized] ?? humanizeCode(normalized);
}

export function adoptionModeLabel(
  value?: string | null,
  context: { tipo?: string | null } = {},
): string {
  const normalized = normalizeLabelCode(value);
  if (!normalized) {
    return isAdoptionMetadataRequired(context.tipo) ? "Adopción no informada" : "No aplica";
  }
  return MODE_LABEL[normalized] ?? humanizeCode(normalized);
}

/** Alias público histórico. */
export function modeLabel(value?: string | null): string {
  return adoptionModeLabel(value);
}

export function tipoSocialLabel(value?: string | null): string {
  const normalized = normalizeLabelCode(value);
  if (!normalized || normalized === "ANY") return "Todos los tipos sociales";
  return TIPO_SOCIAL_LABEL[normalized] ?? humanizeCode(normalized);
}

export function estadoLabel(value?: string | null): string {
  if (!value) return "Estado pendiente";
  const normalized = normalizeLabelCode(value);
  return ESTADO_LABEL[normalized] ?? humanizeCode(normalized);
}

export function jurisdictionLabel(code?: string | null): string {
  if (!code) return "Jurisdicción pendiente";
  const normalized = normalizeLabelCode(code);
  return JURISDICTION_LABEL[normalized] ?? humanizeCode(normalized);
}

export const SEMANTIC_TONE_CLASS: Record<SemanticTone, string> = {
  success:
    "border border-[var(--status-success)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)]",
  warning:
    "border border-[var(--status-warning)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)]",
  info: "border border-[var(--status-info)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)]",
  error:
    "border border-[var(--status-error)] bg-[var(--g-surface-card)] text-[var(--g-text-primary)]",
  neutral:
    "border border-[var(--g-border-subtle)] bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)]",
};

export const SEMANTIC_TONE_DOT_CLASS: Record<SemanticTone, string> = {
  success: "bg-[var(--status-success)]",
  warning: "bg-[var(--status-warning)]",
  info: "bg-[var(--status-info)]",
  error: "bg-[var(--status-error)]",
  neutral: "bg-[var(--g-border-default)]",
};

export const TEMPLATE_STATE_TONE: Record<EstadoPlantilla, SemanticTone> = {
  BORRADOR: "info",
  REVISADA: "info",
  APROBADA: "info",
  ACTIVA: "success",
  ARCHIVADA: "neutral",
  DEPRECADA: "neutral",
};

export function templateStateTone(value?: string | null): SemanticTone {
  const normalized = normalizeLabelCode(value) as EstadoPlantilla;
  return TEMPLATE_STATE_TONE[normalized] ?? "neutral";
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
    label: "Marcar como vigente",
    confirm:
      "¿Marcar esta plantilla como vigente para nuevos expedientes? La comprobación documental previa la tendrá en cuenta.",
  },
  ACTIVA: {
    next: "ARCHIVADA",
    label: "Archivar",
    confirm: "¿Archivar esta plantilla? Dejará de estar vigente para nuevos expedientes.",
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
