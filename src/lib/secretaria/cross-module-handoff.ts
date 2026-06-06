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
  /** Órgano propuesto (CDA, JUNTA, comisión…). */
  organ?: string | null;
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
  if (ctx.matter) params.set("matter", ctx.matter);
  if (ctx.rationale) params.set("rationale", ctx.rationale);
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
    matter: get("matter"),
    rationale: get("rationale"),
    isCrossModule: source === "grc" || source === "aims",
  };
}
