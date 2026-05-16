// Agenda search routing helpers — extracted out of GlobalSearch.tsx so the
// component file only exports the React component (avoids react-refresh warning).
// Used to compute the navigation target for an agenda_item search hit based on
// the agenda_item.kind v3.1 matrix (DECISORIO+agreement → /acuerdos/:id, else
// → meeting hash #punto-N).

import type { AgendaItemKind } from "@/lib/secretaria/agenda-kind";

/**
 * Surface shape of an agenda_item search result.
 *
 * Exposes `meeting_id` + `order_number` so the routing helper can build a hash
 * navigation target for non-DECISORIO points (or for DECISORIO points whose
 * agreement has not yet been materialized — see `agreement_id` optional).
 */
export interface AgendaSearchResult {
  type: "agenda_item";
  meeting_id: string;
  order_number: number;
  kind: AgendaItemKind;
  agreement_id?: string;
  title: string;
}

/**
 * Resolves the navigation route for an agenda item search hit.
 *
 * Routing matrix (agenda_item.kind v3.1):
 *   - DECISORIO + agreement_id present  → /secretaria/acuerdos/:agreement_id
 *   - DECISORIO without agreement_id    → /secretaria/reuniones/:meeting_id#punto-:order_number
 *                                         (pendiente materialización — chip aparece en UI)
 *   - Puntos no decisorios              → /secretaria/reuniones/:meeting_id#punto-:order_number
 */
export function getAgendaResultRoute(result: AgendaSearchResult): string {
  if (result.kind === "DECISORIO" && result.agreement_id) {
    return `/secretaria/acuerdos/${result.agreement_id}`;
  }
  return `/secretaria/reuniones/${result.meeting_id}#punto-${result.order_number}`;
}

// Short badge label for inline chip (3-5 chars, uppercase).
export const AGENDA_KIND_BADGE_LABEL: Record<AgendaItemKind, string> = {
  DECISORIO: "DECIS",
  INFORMATIVO: "INFO",
  TOMA_DE_RAZON: "TOMA",
  DELIBERATIVO: "DELIB",
  ACEPTACION_INFORME: "INF",
  RUEGOS_PREGUNTAS: "R/P",
};

// Humanized label for sublabel / aria-label text.
export const AGENDA_KIND_HUMAN_LABEL: Record<AgendaItemKind, string> = {
  DECISORIO: "Punto decisorio",
  INFORMATIVO: "Punto informativo",
  TOMA_DE_RAZON: "Toma de razón",
  DELIBERATIVO: "Punto deliberativo",
  ACEPTACION_INFORME: "Aceptación de informe",
  RUEGOS_PREGUNTAS: "Ruegos y preguntas",
};

// Garrigues chip styling tokens (className) per kind. NO Tailwind native colors.
export const AGENDA_KIND_CHIP: Record<AgendaItemKind, string> = {
  DECISORIO: "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
  INFORMATIVO: "bg-[var(--status-info)] text-[var(--g-text-inverse)]",
  TOMA_DE_RAZON: "bg-[var(--g-sec-100)] text-[var(--g-brand-3308)]",
  DELIBERATIVO:
    "bg-[var(--g-surface-muted)] text-[var(--g-text-primary)] border border-[var(--g-border-subtle)]",
  ACEPTACION_INFORME: "bg-[var(--g-sec-100)] text-[var(--g-brand-3308)]",
  RUEGOS_PREGUNTAS:
    "bg-[var(--g-surface-muted)] text-[var(--g-text-secondary)] border border-[var(--g-border-subtle)]",
};
