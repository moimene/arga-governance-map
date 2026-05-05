import { describe, expect, it } from "vitest";
import {
  assertTransitionMeetingExpediente,
  canRollbackMeetingExpediente,
  canTransitionMeetingExpediente,
  canTransitionNoSessionExpediente,
  type MeetingExpedienteState,
  type NoSessionExpedienteState,
} from "../expediente-state-machine";

describe("expediente-state-machine — junta con sesión", () => {
  it("permite la cadena DRAFT → CONVOCADO → EN_SESION → ACTA_PENDIENTE → ACTA_APROBADA → CERTIFICADO → PROMOTED", () => {
    const chain: MeetingExpedienteState[] = [
      "DRAFT",
      "CONVOCADO",
      "EN_SESION",
      "ACTA_PENDIENTE",
      "ACTA_APROBADA",
      "CERTIFICADO",
      "PROMOTED",
    ];

    for (let index = 0; index < chain.length - 1; index += 1) {
      expect(canTransitionMeetingExpediente(chain[index], chain[index + 1]).ok).toBe(true);
    }
  });

  it("bloquea DRAFT → CERTIFICADO porque falta sesión y acta aprobada", () => {
    const result = canTransitionMeetingExpediente("DRAFT", "CERTIFICADO");

    expect(result.ok).toBe(false);
    expect(result.reason).toContain("CONVOCADO");
    expect(() => assertTransitionMeetingExpediente("DRAFT", "CERTIFICADO")).toThrow("Transicion invalida");
  });

  it("permite rollback ACTA_PENDIENTE → EN_SESION y bloquea rollback desde PROMOTED", () => {
    expect(canRollbackMeetingExpediente("ACTA_PENDIENTE", "EN_SESION").ok).toBe(true);

    const promoted = canRollbackMeetingExpediente("PROMOTED", "CERTIFICADO");
    expect(promoted.ok).toBe(false);
    expect(promoted.reason).toContain("no admite rollback");
  });
});

describe("expediente-state-machine — acuerdo sin sesión", () => {
  it("permite la cadena DRAFT → NOTIFICADO → RESPUESTAS_PARCIALES → CERRADO → CERTIFICADO → PROMOTED", () => {
    const chain: NoSessionExpedienteState[] = [
      "DRAFT",
      "NOTIFICADO",
      "RESPUESTAS_PARCIALES",
      "CERRADO",
      "CERTIFICADO",
      "PROMOTED",
    ];

    expect(canTransitionNoSessionExpediente(chain[0], chain[1]).ok).toBe(true);
    expect(canTransitionNoSessionExpediente(chain[1], chain[2]).ok).toBe(true);
    expect(canTransitionNoSessionExpediente(chain[2], chain[3], { expired: true }).ok).toBe(true);
    expect(canTransitionNoSessionExpediente(chain[3], chain[4]).ok).toBe(true);
    expect(canTransitionNoSessionExpediente(chain[4], chain[5]).ok).toBe(true);
  });

  it("exige cierre efectivo para RESPUESTAS_PARCIALES → CERRADO", () => {
    const result = canTransitionNoSessionExpediente("RESPUESTAS_PARCIALES", "CERRADO");

    expect(result.ok).toBe(false);
    expect(result.reason).toContain("fn_cerrar_votaciones_vencidas");
  });
});
