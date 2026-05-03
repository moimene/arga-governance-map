import { beforeEach, describe, expect, it, vi } from "vitest";

type MockDb = {
  rows: Record<string, unknown>;
  calls: string[];
};

function getMockDb(): MockDb {
  const holder = globalThis as typeof globalThis & { __variableResolverMockDb?: MockDb };
  holder.__variableResolverMockDb ??= { rows: {}, calls: [] };
  return holder.__variableResolverMockDb;
}

vi.mock("@/integrations/supabase/client", () => {
  function getStore(): MockDb {
    const holder = globalThis as typeof globalThis & { __variableResolverMockDb?: MockDb };
    holder.__variableResolverMockDb ??= { rows: {}, calls: [] };
    return holder.__variableResolverMockDb;
  }

  function queryFor(table: string) {
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      is: vi.fn(() => query),
      order: vi.fn(() => query),
      in: vi.fn(() => query),
      maybeSingle: vi.fn(async () => ({
        data: getStore().rows[table] ?? null,
        error: null,
      })),
      then: (
        onFulfilled?: (value: { data: unknown; error: null }) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) =>
        Promise.resolve({
          data: getStore().rows[table] ?? [],
          error: null,
        }).then(onFulfilled, onRejected),
    };

    return query;
  }

  return {
    supabase: {
      from: vi.fn((table: string) => {
        getStore().calls.push(table);
        return queryFor(table);
      }),
    },
  };
});

import { normalizeFuente, resolveVariables } from "../variable-resolver";

describe("variable-resolver", () => {
  const mockDb = getMockDb();

  beforeEach(() => {
    mockDb.rows = {};
    mockDb.calls = [];
  });

  it("normaliza fuentes legacy singulares y fuentes juridicas a categorias canonicas", () => {
    expect(normalizeFuente("agreement.adoption_mode")).toBe("EXPEDIENTE");
    expect(normalizeFuente("agreements.status")).toBe("EXPEDIENTE");
    expect(normalizeFuente("meeting.status == 'APROBADA'")).toBe("REUNION");
    expect(normalizeFuente("mandate.role")).toBe("ORGANO");
    expect(normalizeFuente("persons.full_name")).toBe("ORGANO");
    expect(normalizeFuente("LEY")).toBe("MOTOR");
    expect(normalizeFuente("rule_pack.materia")).toBe("MOTOR");
    expect(normalizeFuente("QTSP.signature_reference")).toBe("SISTEMA");
  });

  it("resuelve agreement.* aunque la variable de plantilla use un nombre distinto", async () => {
    mockDb.rows.agreements = {
      id: "agr-1",
      agreement_kind: "APROBACION_CUENTAS",
      matter_class: "ORDINARIA",
      adoption_mode: "MEETING",
      status: "ADOPTED",
      proposal_text: "Aprobar las cuentas anuales.",
      decision_text: null,
      decision_date: "2026-05-02",
      statutory_basis: "LSC",
    };

    const result = await resolveVariables(
      [
        { variable: "modo_adopcion", fuente: "agreement.adoption_mode", condicion: "SIEMPRE" },
        { variable: "organo_certificado", fuente: "agreement.adoption_mode", condicion: "SIEMPRE" },
        { variable: "texto_acuerdo_certificado", fuente: "agreement.proposal_text", condicion: "SIEMPRE" },
        { variable: "resultado_adopcion_texto", fuente: "agreement.status", condicion: "SIEMPRE" },
      ],
      { agreementId: "agr-1", tenantId: "tenant-1" },
    );

    expect(result.values).toMatchObject({
      modo_adopcion: "MEETING",
      organo_certificado: "MEETING",
      texto_acuerdo_certificado: "Aprobar las cuentas anuales.",
      resultado_adopcion_texto: "Adoptado",
    });
    expect(result.unresolved).toEqual([]);
  });

  it("resuelve mandate.* y persons.* desde el organo sin saltarse presidente/secretario", async () => {
    mockDb.rows.governing_bodies = {
      name: "Consejo de Administracion",
      established_date: "2020-01-01",
      legal_basis: "Estatutos sociales",
    };
    mockDb.rows.condiciones_persona = [
      { tipo_condicion: "Presidente", persons: { full_name: "Antonio Rios" } },
      { tipo_condicion: "Secretario", persons: { full_name: "Lucia Paredes" } },
    ];

    const result = await resolveVariables(
      [
        { variable: "presidente", fuente: "mandate.role", condicion: "SIEMPRE" },
        { variable: "secretario", fuente: "persons.full_name", condicion: "SIEMPRE" },
        { variable: "organo_nombre", fuente: "governing_body.name", condicion: "SIEMPRE" },
      ],
      { agreementId: "agr-1", tenantId: "tenant-1", bodyId: "body-1" },
    );

    expect(result.values).toMatchObject({
      presidente: "Antonio Rios",
      secretario: "Lucia Paredes",
      organo_nombre: "Consejo de Administracion",
    });
    expect(result.unresolved).toEqual([]);
  });

  it("resuelve fuentes LEY/rule_pack/evaluar desde el snapshot del motor", async () => {
    const result = await resolveVariables(
      [
        { variable: "quorum_referencia_legal", fuente: "LEY", condicion: "SIEMPRE" },
        { variable: "quorum_pct", fuente: "evaluarConstitucion().quorum_pct", condicion: "SIEMPRE" },
        { variable: "snapshot_hash", fuente: "calcularRulesetSnapshotHash()", condicion: "SIEMPRE" },
      ],
      {
        agreementId: "agr-1",
        tenantId: "tenant-1",
        complianceSnapshot: {
          quorumReferencia: "art. 193 LSC",
          quorumPresente: 75,
          gate_hash: "hash-demo",
          ok: true,
        },
      },
    );

    expect(result.values).toMatchObject({
      quorum_referencia_legal: "art. 193 LSC",
      quorum_pct: 75,
      snapshot_hash: "hash-demo",
    });
    expect(result.unresolved).toEqual([]);
  });

  it("resuelve expresiones simples meeting.campo == valor sin generar texto libre", async () => {
    mockDb.rows.meetings = {
      status: "APROBADA",
      date: "2026-05-02",
      start_time: "10:00",
      location: "Madrid",
      meeting_participants: [],
      meeting_agenda: [],
      meeting_resolutions: [],
    };

    const result = await resolveVariables(
      [
        { variable: "acta_aprobada", fuente: "meeting.status == 'APROBADA'", condicion: "SIEMPRE" },
        { variable: "fecha", fuente: "meeting.fecha", condicion: "SIEMPRE" },
        { variable: "lugar", fuente: "meeting.lugar", condicion: "SIEMPRE" },
      ],
      { agreementId: "agr-1", tenantId: "tenant-1", meetingId: "meeting-1" },
    );

    expect(result.values).toMatchObject({
      acta_aprobada: true,
      fecha: "2026-05-02",
      lugar: "Madrid",
    });
    expect(result.unresolved).toEqual([]);
  });

  it("usa reloj inyectado para variables SISTEMA/QTSP deterministas", async () => {
    const result = await resolveVariables(
      [
        { variable: "fecha_emision", fuente: "SISTEMA", condicion: "SIEMPRE" },
        { variable: "fecha_generacion", fuente: "SISTEMA", condicion: "SIEMPRE" },
        { variable: "tsq_token", fuente: "QTSP", condicion: "SIEMPRE" },
      ],
      {
        agreementId: "agr-1",
        tenantId: "tenant-1",
        now: "2026-05-02T10:30:45.123Z",
      },
    );

    expect(result.values).toMatchObject({
      fecha_emision: "2026-05-02",
      fecha_generacion: "2026-05-02T10:30:45.123Z",
      tsq_token: "TSQ-20260502103045123",
    });
    expect(result.unresolved).toEqual([]);
  });
});
