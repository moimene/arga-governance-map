import { describe, expect, it } from "vitest";
import {
  buildUniversalMeetingDedupHash,
  buildUniversalMeetingQuorumData,
  isUniversalMeetingQuorumData,
  patchUniversalAgendaAcceptance,
  patchUniversalCapitalSummary,
  UNIVERSAL_MEETING_INITIAL_STATUS,
  universalMeetingLabel,
  universalMeetingNamespace,
} from "../junta-universal";

const baseInput = {
  tenantId: "tenant-arga",
  entityId: "arga-sa",
  entityName: "ARGA Seguros, S.A.",
  bodyId: "junta-general",
  bodyName: "Junta General",
  fecha: "2026-06-15",
  horaInicio: "10:00",
  lugar: "Domicilio social, Calle Demo 1, Madrid",
  modalidad: "PRESENCIAL" as const,
  normativeSnapshot: { snapshot_id: "snap-arga-2026" },
};

describe("junta-universal helpers", () => {
  it("uses the canonical meetings.status value accepted by the database", () => {
    expect(UNIVERSAL_MEETING_INITIAL_STATUS).toBe("DRAFT");
  });

  it("builds a stable dedup hash for the same universal meeting input", () => {
    expect(buildUniversalMeetingDedupHash(baseInput)).toBe(buildUniversalMeetingDedupHash({ ...baseInput }));
  });

  it("creates quorum_data without convocatoria fields", () => {
    const quorumData = buildUniversalMeetingQuorumData(baseInput);

    expect(isUniversalMeetingQuorumData(quorumData)).toBe(true);
    expect(quorumData.agreements.convocatoria).toBeNull();
    expect(quorumData.meetings.junta.es_universal).toBe("SÍ");
    expect(quorumData.meetings.junta.canal_convocatoria).toBeNull();
    expect(quorumData.meetings.junta.publicacion_ref).toBeNull();
    expect(quorumData.normative_snapshot_id).toBe("snap-arga-2026");
  });

  it("supports universal sessions for non-junta governing bodies", () => {
    const quorumData = buildUniversalMeetingQuorumData({
      ...baseInput,
      bodyId: "consejo-admin",
      bodyName: "Consejo de Administración",
      organoTipo: "CONSEJO",
    });
    const withAgenda = patchUniversalAgendaAcceptance(
      quorumData,
      [{ numero: 1, titulo: "Formulación de cuentas", materia: "FORMULACION_CUENTAS" }],
      100,
      "2026-06-15T10:05:00.000Z",
    );

    expect(universalMeetingNamespace("CONSEJO")).toBe("consejo");
    expect(universalMeetingLabel("CONSEJO")).toBe("Sesión universal");
    expect(isUniversalMeetingQuorumData(quorumData)).toBe(true);
    expect(quorumData.junta_universal).toBe(false);
    expect(quorumData.organo_universal).toBe(true);
    expect(quorumData.meetings.consejo.es_universal).toBe("SÍ");
    expect(quorumData.meetings.junta).toBeUndefined();
    expect(withAgenda.meetings.consejo.orden_del_dia_resumen).toBe("1. Formulación de cuentas");
    expect(withAgenda.aceptacion_unanime_orden_dia.texto_legal).toContain("órgano social");
  });

  it("patches capital summary and unanimous agenda acceptance using protected namespaces", () => {
    const quorumData = buildUniversalMeetingQuorumData(baseInput);
    const withCapital = patchUniversalCapitalSummary(quorumData, {
      capitalConcurrentePorcentaje: 100,
      capitalConcurrenteImporte: 8500000,
      calculoCapitalRef: "calc-2026-06-15",
    });
    const withAgenda = patchUniversalAgendaAcceptance(
      withCapital,
      [{ numero: 1, titulo: "Aprobación de cuentas", materia: "APROBACION_CUENTAS" }],
      100,
      "2026-06-15T10:05:00.000Z",
    );

    expect(withAgenda.rule_pack.junta.capital_concurrente_porcentaje).toBe(100);
    expect(withAgenda.rule_pack.junta.calculo_capital_ref).toBe("calc-2026-06-15");
    expect(withAgenda.meetings.junta.orden_del_dia_resumen).toBe("1. Aprobación de cuentas");
    expect(withAgenda.meetings.junta.puntos[0].titulo).toBe("Aprobación de cuentas");
    expect(withAgenda.aceptacion_unanime_orden_dia.confirmada).toBe(true);
  });
});
