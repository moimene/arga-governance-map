import { describe, expect, it } from "vitest";
import {
  buildMeetingScheduleFromConvocatoria,
  meetingTypeFromConvocatoria,
  validateMeetingScheduleFromConvocatoria,
  type ConvocatoriaForMeetingSchedule,
} from "../meeting-scheduler";
import { extractMeetingSourceLinks } from "../meeting-links";

function convocatoria(overrides: Partial<ConvocatoriaForMeetingSchedule> = {}): ConvocatoriaForMeetingSchedule {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    tenant_id: "tenant-1",
    body_id: "body-1",
    body_name: "Junta General",
    body_type: "JUNTA_GENERAL",
    entity_id: "entity-1",
    entity_name: "ARGA Test, S.A.",
    estado: "EMITIDA",
    tipo_convocatoria: "ORDINARIA",
    fecha_1: "2026-06-30",
    fecha_2: null,
    lugar: "Madrid",
    modalidad: "PRESENCIAL",
    statutory_basis: "Convocatoria ordinaria conforme a LSC y estatutos.",
    agenda_items: [
      { titulo: "Aprobación de cuentas", materia: "APROBACION_CUENTAS", tipo: "ORDINARIA", inscribible: true },
      { titulo: "Aplicación del resultado", materia: "DISTRIBUCION_DIVIDENDOS", tipo: "ORDINARIA", inscribible: false },
    ],
    rule_trace: { ok: true },
    reminders_trace: { channels: [] },
    ...overrides,
  };
}

describe("meeting-scheduler", () => {
  it("valida body y fecha antes de programar reunion", () => {
    expect(validateMeetingScheduleFromConvocatoria(null)).toEqual({
      ok: false,
      reasons: ["convocatoria_missing"],
    });
    expect(validateMeetingScheduleFromConvocatoria(convocatoria({ body_id: null, fecha_1: null }))).toEqual({
      ok: false,
      reasons: ["body_id_missing", "fecha_1_missing"],
    });
  });

  it("detecta tipo de reunion desde organo convocado", () => {
    expect(meetingTypeFromConvocatoria(convocatoria({ body_type: "JUNTA" }))).toBe("JUNTA_GENERAL");
    expect(meetingTypeFromConvocatoria(convocatoria({ body_type: "CONSEJO_ADMIN", body_name: "Consejo de Administración" }))).toBe("CONSEJO_ADMINISTRACION");
    expect(meetingTypeFromConvocatoria(convocatoria({ body_type: "COMISION", body_name: "Comisión Delegada", tipo_convocatoria: "COMISION_DELEGADA" }))).toBe("COMISION_DELEGADA");
  });

  it("construye payload idempotente con source_links y agenda de convocatoria", () => {
    const payload = buildMeetingScheduleFromConvocatoria(convocatoria());

    expect(payload).toMatchObject({
      tenant_id: "tenant-1",
      body_id: "body-1",
      meeting_type: "JUNTA_GENERAL",
      scheduled_start: "2026-06-30T10:00:00.000Z",
      status: "CONVOCADA",
      location: "Madrid",
      confidentiality_level: "NORMAL",
    });
    expect(payload.slug).toContain("convocatoria-arga-test-s-a-2026-06-30");
    expect(extractMeetingSourceLinks(payload.quorum_data)).toMatchObject({
      convocatoria_id: "00000000-0000-4000-8000-000000000001",
      convocatoria_ids: ["00000000-0000-4000-8000-000000000001"],
      source: "explicit",
    });
    expect(payload.quorum_data.agenda_preview).toEqual([
      {
        index: 1,
        titulo: "Aprobación de cuentas",
        materia: "APROBACION_CUENTAS",
        tipo: "ORDINARIA",
        inscribible: true,
      },
      {
        index: 2,
        titulo: "Aplicación del resultado",
        materia: "DISTRIBUCION_DIVIDENDOS",
        tipo: "ORDINARIA",
        inscribible: false,
      },
    ]);
  });
});
