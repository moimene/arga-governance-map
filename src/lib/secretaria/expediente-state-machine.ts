export type MeetingExpedienteState =
  | "DRAFT"
  | "CONVOCADO"
  | "EN_SESION"
  | "ACTA_PENDIENTE"
  | "ACTA_APROBADA"
  | "CERTIFICADO"
  | "PROMOTED";

export type NoSessionExpedienteState =
  | "DRAFT"
  | "NOTIFICADO"
  | "RESPUESTAS_PARCIALES"
  | "CERRADO"
  | "CERTIFICADO"
  | "PROMOTED";

export interface TransitionResult {
  ok: boolean;
  reason?: string;
}

const MEETING_NEXT: Record<MeetingExpedienteState, MeetingExpedienteState | null> = {
  DRAFT: "CONVOCADO",
  CONVOCADO: "EN_SESION",
  EN_SESION: "ACTA_PENDIENTE",
  ACTA_PENDIENTE: "ACTA_APROBADA",
  ACTA_APROBADA: "CERTIFICADO",
  CERTIFICADO: "PROMOTED",
  PROMOTED: null,
};

const NO_SESSION_NEXT: Record<NoSessionExpedienteState, NoSessionExpedienteState | null> = {
  DRAFT: "NOTIFICADO",
  NOTIFICADO: "RESPUESTAS_PARCIALES",
  RESPUESTAS_PARCIALES: "CERRADO",
  CERRADO: "CERTIFICADO",
  CERTIFICADO: "PROMOTED",
  PROMOTED: null,
};

export function canTransitionMeetingExpediente(
  from: MeetingExpedienteState,
  to: MeetingExpedienteState,
  options: { gatesOk?: boolean } = {},
): TransitionResult {
  if (
    options.gatesOk === false &&
    ((from === "CONVOCADO" && to === "EN_SESION") ||
      (from === "ACTA_PENDIENTE" && to === "ACTA_APROBADA"))
  ) {
    return {
      ok: false,
      reason: "La transicion requiere gates de motor en PASS.",
    };
  }
  if (MEETING_NEXT[from] === to) return { ok: true };
  return {
    ok: false,
    reason: `Transicion invalida ${from} -> ${to}. Siguiente esperado: ${MEETING_NEXT[from] ?? "ninguno"}.`,
  };
}

export function assertTransitionMeetingExpediente(
  from: MeetingExpedienteState,
  to: MeetingExpedienteState,
): void {
  const result = canTransitionMeetingExpediente(from, to);
  if (!result.ok) throw new Error(result.reason);
}

export function canRollbackMeetingExpediente(
  from: MeetingExpedienteState,
  to: MeetingExpedienteState,
): TransitionResult {
  if (from === "ACTA_PENDIENTE" && to === "EN_SESION") return { ok: true };
  if (from === "PROMOTED") {
    return {
      ok: false,
      reason: "PROMOTED es estado final demo preparado para Registro; no admite rollback.",
    };
  }
  return {
    ok: false,
    reason: `Rollback no permitido ${from} -> ${to}.`,
  };
}

export function canTransitionNoSessionExpediente(
  from: NoSessionExpedienteState,
  to: NoSessionExpedienteState,
  options: { expired?: boolean } = {},
): TransitionResult {
  if (from === "RESPUESTAS_PARCIALES" && to === "CERRADO" && options.expired !== true) {
    return {
      ok: false,
      reason: "RESPUESTAS_PARCIALES -> CERRADO requiere cierre efectivo o fn_cerrar_votaciones_vencidas.",
    };
  }

  if (NO_SESSION_NEXT[from] === to) return { ok: true };
  return {
    ok: false,
    reason: `Transicion sin sesion invalida ${from} -> ${to}. Siguiente esperado: ${NO_SESSION_NEXT[from] ?? "ninguno"}.`,
  };
}
