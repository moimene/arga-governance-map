// Agenda search routing helpers — extracted out of GlobalSearch.tsx so the
// component file only exports the React component (avoids react-refresh warning).
// Used to compute the navigation target for an agenda_item search hit based on
// the agenda_item.kind v1.3 matrix (DECISORIO+agreement → /acuerdos/:id, else
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
 * Routing matrix (agenda_item.kind v1.3):
 *   - DECISORIO + agreement_id present  → /secretaria/acuerdos/:agreement_id
 *   - DECISORIO without agreement_id    → /secretaria/reuniones/:meeting_id#punto-:order_number
 *                                         (pendiente materialización — chip aparece en UI)
 *   - DELIBERATIVO / INFORMATIVO        → /secretaria/reuniones/:meeting_id#punto-:order_number
 */
export function getAgendaResultRoute(result: AgendaSearchResult): string {
  if (result.kind === "DECISORIO" && result.agreement_id) {
    return `/secretaria/acuerdos/${result.agreement_id}`;
  }
  return `/secretaria/reuniones/${result.meeting_id}#punto-${result.order_number}`;
}

// Short badge label for inline chip (3-5 chars, uppercase).
export const AGENDA_KIND_BADGE_LABEL: Record<AgendaItemKind, string> = {
  INFORMATIVO: "INFO",
  DELIBERATIVO: "DELIB",
  DECISORIO: "DECIS",
};

// Humanized label for sublabel / aria-label text.
export const AGENDA_KIND_HUMAN_LABEL: Record<AgendaItemKind, string> = {
  INFORMATIVO: "Punto informativo",
  DELIBERATIVO: "Punto deliberativo",
  DECISORIO: "Punto decisorio",
};

// Garrigues chip styling tokens (className) per kind. NO Tailwind native colors.
export const AGENDA_KIND_CHIP: Record<AgendaItemKind, string> = {
  INFORMATIVO: "bg-[var(--status-info)] text-[var(--g-text-inverse)]",
  DELIBERATIVO:
    "bg-[var(--g-surface-muted)] text-[var(--g-text-primary)] border border-[var(--g-border-subtle)]",
  DECISORIO: "bg-[var(--status-success)] text-[var(--g-text-inverse)]",
};
