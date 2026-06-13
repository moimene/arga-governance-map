/**
 * W4 — máquina de estados de legalización de libros societarios (G6).
 *
 * Flujo: PENDIENTE → (se cierra el volumen) → PRESENTADO → LEGALIZADO | RECHAZADO.
 * Un libro RECHAZADO puede re-presentarse; LEGALIZADO es terminal. Función pura
 * usada por la UI (qué acciones ofrecer) y replicada por las RPC del servidor.
 */
export type LegalizacionStatus =
  | "PENDIENTE"
  | "PRESENTADO"
  | "LEGALIZADO"
  | "RECHAZADO";

export type LegalizacionAction = "PRESENTAR" | "LEGALIZAR" | "RECHAZAR";

export function nextLegalizacionStatus(
  current: LegalizacionStatus,
  action: LegalizacionAction,
): LegalizacionStatus | null {
  switch (action) {
    case "PRESENTAR":
      return current === "PENDIENTE" || current === "RECHAZADO" ? "PRESENTADO" : null;
    case "LEGALIZAR":
      return current === "PRESENTADO" ? "LEGALIZADO" : null;
    case "RECHAZAR":
      return current === "PRESENTADO" ? "RECHAZADO" : null;
    default:
      return null;
  }
}

/**
 * Acciones de legalización disponibles dado el estado y si el volumen está
 * cerrado. Presentar exige el volumen cerrado primero (no se legaliza un libro
 * con asientos abiertos).
 */
export function availableLegalizacionActions(
  current: LegalizacionStatus,
  volumeClosed: boolean,
): LegalizacionAction[] {
  if (current === "LEGALIZADO") return [];
  if (current === "PRESENTADO") return ["LEGALIZAR", "RECHAZAR"];
  // PENDIENTE o RECHAZADO: presentar solo si el volumen está cerrado.
  return volumeClosed ? ["PRESENTAR"] : [];
}
