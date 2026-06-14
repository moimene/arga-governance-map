/**
 * W9 — máquina de estados del borrador de punto de agenda (automatización
 * cross-módulo, G7). Un evento de GRC/AIMS/Compliance propone un punto; el
 * Secretario lo aprueba, pospone o rechaza (principio I-2: secretario como
 * garante — nada se convoca sin su aprobación). Función pura usada por la UI y
 * replicada por la RPC del servidor.
 */
export type AgendaDraftEstado =
  | "PENDIENTE"
  | "APROBADO"
  | "POSPUESTO"
  | "RECHAZADO"
  | "CONVOCADO";

export type AgendaDraftAction = "APROBAR" | "POSPONER" | "RECHAZAR" | "CONVOCAR";

export function nextAgendaDraftEstado(
  current: AgendaDraftEstado,
  action: AgendaDraftAction,
): AgendaDraftEstado | null {
  switch (action) {
    case "APROBAR":
      return current === "PENDIENTE" || current === "POSPUESTO" ? "APROBADO" : null;
    case "POSPONER":
      return current === "PENDIENTE" ? "POSPUESTO" : null;
    case "RECHAZAR":
      return current === "PENDIENTE" || current === "POSPUESTO" ? "RECHAZADO" : null;
    case "CONVOCAR":
      return current === "APROBADO" ? "CONVOCADO" : null;
    default:
      return null;
  }
}

export function availableAgendaDraftActions(
  current: AgendaDraftEstado,
): AgendaDraftAction[] {
  switch (current) {
    case "PENDIENTE":
      return ["APROBAR", "POSPONER", "RECHAZAR"];
    case "POSPUESTO":
      return ["APROBAR", "RECHAZAR"];
    case "APROBADO":
      return ["CONVOCAR"];
    default:
      return [];
  }
}
