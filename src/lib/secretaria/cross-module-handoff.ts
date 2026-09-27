// ============================================================
// Cross-module handoff hacia el intake de Secretaría (READ-ONLY)
// ============================================================
// Contrato compartido entre los EMISORES (páginas GRC/AIMS que escalan a Secretaría)
// y el RECEPTOR (ReunionIntake en /secretaria/reuniones/nueva). Centraliza las CLAVES
// de query para evitar drift (p.ej. el bug `sourceId` vs `source_id`) y garantizar que
// el contexto de la propuesta (órgano, asunto, justificación) sobreviva al handoff.
//
// Guardrail CLAUDE.md: el handoff es SOLO navegación read-only; NO escribe en
// governance_module_events ni governance_module_links. Secretaría decide la
// materialización (convocatoria/orden del día) desde su propio owner.

export interface MeetingHandoffContext {
  /** Módulo origen: "grc" | "aims" (o "secretaria" para flujos internos). */
  source: string;
  /** Identificador de evento/handoff, p.ej. GRC_INCIDENT_MATERIAL, AIMS_SYSTEM_CONFORMITY. */
  event: string;
  /** Id del objeto origen (incidente, excepción, sistema IA…). */
  sourceId?: string | null;
  /**
   * Órgano propuesto, en TEXTO LIBRE (nombre visible). Los emisores no-AIMS
   * (GRC: Excepciones, IncidenteDetalle, SolvenciaII) siguen mandando aquí un
   * nombre de comité tecleado a mano o fijo ("CDA") — su semántica no cambia.
   */
  organ?: string | null;
  /**
   * F2.T14 (MOI-170/MOI-158): id del órgano propuesto, cuando el emisor lo
   * conoce con certeza (AIMS, resuelto por `useBodiesByEntity(…, {
   * adoptingOnly: true })`). Viaja JUNTO a `organ`, nunca en su lugar: un
   * emisor no-AIMS que no lo pasa no ve cambiar nada.
   */
  organId?: string | null;
  /**
   * F2.T14: sociedad del sujeto/sistema de origen. Presente ⇒ el intake abre
   * en `scope=sociedad&entity=<id>` (mismo contrato que `useSecretariaScope`,
   * donde la `entity` de la URL manda sobre lo guardado en localStorage).
   */
  entityId?: string | null;
  /** Asunto / materia propuesta para el orden del día. */
  matter?: string | null;
  /** Justificación de la propuesta. */
  rationale?: string | null;
}

export const MEETING_INTAKE_PATH = "/secretaria/reuniones/nueva";

/** Construye la query string del handoff con las claves del contrato. */
export function buildMeetingHandoffSearch(ctx: MeetingHandoffContext): string {
  const params = new URLSearchParams();
  params.set("source", ctx.source);
  params.set("event", ctx.event);
  if (ctx.sourceId) params.set("source_id", ctx.sourceId);
  if (ctx.organ) params.set("organ", ctx.organ);
  if (ctx.organId) params.set("organ_id", ctx.organId);
  if (ctx.matter) params.set("matter", ctx.matter);
  if (ctx.rationale) params.set("rationale", ctx.rationale);
  // F2.T14: la sociedad manda el intake a scope=sociedad, mismo contrato que
  // useSecretariaScope (la entity de la URL gana a la guardada en localStorage).
  if (ctx.entityId) {
    params.set("scope", "sociedad");
    params.set("entity", ctx.entityId);
  }
  return params.toString();
}

/** Ruta completa del intake de Secretaría con el handoff codificado. */
export function buildMeetingHandoffPath(ctx: MeetingHandoffContext): string {
  return `${MEETING_INTAKE_PATH}?${buildMeetingHandoffSearch(ctx)}`;
}

export interface ReadMeetingHandoff {
  source: string | null;
  event: string | null;
  sourceId: string | null;
  organ: string | null;
  /** F2.T14: id del órgano propuesto, cuando el emisor lo mandó (ver `organId`). */
  organId: string | null;
  matter: string | null;
  rationale: string | null;
  isCrossModule: boolean;
}

/**
 * Lee el handoff desde los searchParams del intake. Acepta alias retro-compatibles:
 * `event` ?? `handoff` y `source_id` ?? `ai_incident`.
 */
export function readMeetingHandoff(get: (key: string) => string | null): ReadMeetingHandoff {
  const source = get("source");
  return {
    source,
    event: get("event") ?? get("handoff"),
    sourceId: get("source_id") ?? get("ai_incident"),
    organ: get("organ"),
    organId: get("organ_id"),
    matter: get("matter"),
    rationale: get("rationale"),
    isCrossModule: source === "grc" || source === "aims",
  };
}

/**
 * MOI-56: reconstruye la query string del handoff para PROPAGARLO a un flujo
 * de creación posterior (p.ej. de `ReunionIntake` a "Reunión universal" o a
 * "Acuerdo sin sesión"). Reutiliza `buildMeetingHandoffSearch` en vez de
 * duplicar el mapeo de claves — antes de esta función, `ReunionIntake`
 * MOSTRABA la derivación pero los enlaces de "crear" la perdían: el
 * `ai_incident` no llegaba nunca al punto donde se crea la reunión.
 * Sin contexto cruzado, devuelve `basePath` intacto.
 */
export function appendHandoffParams(basePath: string, ctx: ReadMeetingHandoff): string {
  if (!ctx.isCrossModule) return basePath;
  const search = buildMeetingHandoffSearch({
    source: ctx.source ?? "",
    event: ctx.event ?? "",
    sourceId: ctx.sourceId,
    organ: ctx.organ,
    organId: ctx.organId,
    matter: ctx.matter,
    rationale: ctx.rationale,
  });
  if (!search) return basePath;
  const sep = basePath.includes("?") ? "&" : "?";
  return `${basePath}${sep}${search}`;
}
