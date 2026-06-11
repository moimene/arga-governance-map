import { afterAll as __afterAllRestore, mock as __bunMockRestore } from "bun:test";
import * as __realModule0 from "@/integrations/supabase/client";
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

// Captura eager de los módulos reales ANTES de registrar los mocks:
// mock.module de bun es global al proceso de test y se fuga a los archivos
// posteriores, así que cada mock se restaura al terminar este archivo.
const __realModulesForRestore: Array<[string, Record<string, unknown>]> = [
  ["@/integrations/supabase/client", { ...__realModule0 }],
];

__afterAllRestore(() => {
  for (const [__specifier, __exports] of __realModulesForRestore) {
    __bunMockRestore.module(__specifier, () => __exports);
  }
});

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

import { mergeVariables, normalizeFuente, resolveVariables } from "../variable-resolver";

describe("variable-resolver", () => {
  const mockDb = getMockDb();

  beforeEach(() => {
    mockDb.rows = {};
    mockDb.calls = [];
  });

  it("normaliza fuentes legacy singulares y fuentes juridicas a categorias canonicas", () => {
    expect(normalizeFuente("ENTIDAD")).toBe("ENTIDAD");
    expect(normalizeFuente("entities.name")).toBe("ENTIDAD");
    expect(normalizeFuente("agreement.adoption_mode")).toBe("EXPEDIENTE");
    expect(normalizeFuente("agreements.status")).toBe("EXPEDIENTE");
    expect(normalizeFuente("governing_bodies.presidente")).toBe("ORGANO");
    expect(normalizeFuente("meeting.status == 'APROBADA'")).toBe("REUNION");
    expect(normalizeFuente("mandate.role")).toBe("ORGANO");
    expect(normalizeFuente("persons.full_name")).toBe("ORGANO");
    expect(normalizeFuente("LEY")).toBe("MOTOR");
    expect(normalizeFuente("rule_pack.materia")).toBe("MOTOR");
    expect(normalizeFuente("QTSP.signature_reference")).toBe("SISTEMA");
  });

  it("resuelve fuente canónica entities.name y fallback legacy ENTIDAD sin fallar silenciosamente", async () => {
    mockDb.rows.entities = {
      common_name: "ARGA Seguros",
      legal_name: "ARGA Seguros, S.A.",
      tax_id: "A-00000000",
      registration_number: "M-000001",
      jurisdiction: "ES",
      legal_form: "SA",
      tipo_social: "SA",
    };

    const result = await resolveVariables(
      [
        { variable: "denominacion_social", fuente: "ENTIDAD", condicion: "SIEMPRE" },
        { variable: "nombre_corto", fuente: "entities.name", condicion: "SIEMPRE" },
        { variable: "tipo_social", fuente: "entities.tipo_social", condicion: "SIEMPRE" },
      ],
      { agreementId: "agr-1", tenantId: "tenant-1", entityId: "entity-1" },
    );

    expect(result.values).toMatchObject({
      denominacion_social: "ARGA Seguros, S.A.",
      nombre_corto: "ARGA Seguros",
      tipo_social: "SA",
    });
    expect(result.unresolved).toEqual([]);
    expect(mockDb.calls).toContain("entities");
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

  it("resuelve governing_bodies.presidente y governing_bodies.secretario desde fuentes canónicas del órgano", async () => {
    mockDb.rows.governing_bodies = {
      name: "Consejo de Administracion",
      established_date: "2020-01-01",
      legal_basis: "Estatutos sociales",
    };
    mockDb.rows.condiciones_persona = [
      { tipo_condicion: "Presidente", persons: { full_name: "Antonio Rios", tax_id: "00000001A" } },
      { tipo_condicion: "Secretario", persons: { full_name: "Lucia Paredes", tax_id: "00000002B" } },
    ];

    const result = await resolveVariables(
      [
        { variable: "presidente", fuente: "governing_bodies.presidente", condicion: "SIEMPRE" },
        { variable: "secretario", fuente: "governing_bodies.secretario", condicion: "SIEMPRE" },
      ],
      { agreementId: "agr-1", tenantId: "tenant-1", bodyId: "body-1" },
    );

    expect(result.values).toMatchObject({
      presidente: "Antonio Rios",
      secretario: "Lucia Paredes",
    });
    expect(result.unresolved).toEqual([]);
  });

  it("resuelve fuentes LEY/rule_pack/evaluar desde el snapshot del motor", async () => {
    const result = await resolveVariables(
      [
        { variable: "quorum_referencia_legal", fuente: "LEY", condicion: "SIEMPRE" },
        { variable: "quorum_pct", fuente: "evaluarConstitucion().quorum_pct", condicion: "SIEMPRE" },
        { variable: "snapshot_hash", fuente: "calcularRulesetSnapshotHash()", condicion: "SIEMPRE" },
        { variable: "normative_profile_hash", fuente: "MOTOR", condicion: "SIEMPRE" },
        { variable: "normative_framework_status", fuente: "MOTOR", condicion: "SIEMPRE" },
      ],
      {
        agreementId: "agr-1",
        tenantId: "tenant-1",
        complianceSnapshot: {
          quorumReferencia: "art. 193 LSC",
          quorumPresente: 75,
          gate_hash: "hash-demo",
          ok: true,
          normative_profile: {
            profile_hash: "nf-demo",
            framework_status: "COMPLETO",
          },
        },
      },
    );

    expect(result.values).toMatchObject({
      quorum_referencia_legal: "art. 193 LSC",
      quorum_pct: 75,
      snapshot_hash: "hash-demo",
      normative_profile_hash: "nf-demo",
      normative_framework_status: "COMPLETO",
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

  it.each([
    ["AUMENTO_CAPITAL", "ENTIDAD"],
    ["DISTRIBUCION_DIVIDENDOS", "ENTIDAD"],
    ["MODIFICACION_ESTATUTOS", "entities.name"],
    ["NOMBRAMIENTO_AUDITOR", "entities.legal_name"],
    ["REDUCCION_CAPITAL", "entities.entity_type_detail"],
  ])("normaliza fuente de entidad para %s", (_materia, fuente) => {
    expect(normalizeFuente(fuente)).toBe("ENTIDAD");
  });

  it.each([
    ["CESE_CONSEJERO Consejo", { consejero_nombre: "Auto C2", nif_consejero: "AUTO-NIF" }, { consejero_nombre: "Manual C3", nif_consejero: "MANUAL-NIF" }],
    ["CESE_CONSEJERO Junta", { consejero_nombre: "Auto C2", fecha_efectos: "2026-01-01" }, { consejero_nombre: "Manual C3", fecha_efectos: "2026-02-01" }],
    ["NOMBRAMIENTO_CONSEJERO Consejo", { consejero_nombre: "Auto C2", plazo_mandato: 4 }, { consejero_nombre: "Manual C3", plazo_mandato: 3 }],
    ["NOMBRAMIENTO_CONSEJERO Junta", { consejero_nombre: "Auto C2", nif_consejero: "AUTO-NIF" }, { consejero_nombre: "Manual C3", nif_consejero: "MANUAL-NIF" }],
  ])("Capa 3 prevalece sobre Capa 2 en duplicidad %s", (_label, capa2, capa3) => {
    expect(mergeVariables(capa2, capa3)).toMatchObject(capa3);
  });

  // ── Codex P1 — precedencia BD real sobre catalog default ─────────────────
  it("SL entity sin entity_settings override: tipo_social = 'SL' (no 'SA' del catalog default)", async () => {
    mockDb.rows.entities = {
      common_name: "ARGA SL",
      legal_name: "ARGA, S.L.",
      tax_id: "B-00000001",
      legal_form: "SL",
      tipo_social: "SL",
    };
    mockDb.rows.entity_settings = []; // sin overrides
    mockDb.rows.entity_settings_catalog = [
      { key: "tipo_social", default_value: "SA" }, // catalog dice SA por defecto
      { key: "es_cotizada", default_value: "NO" },
    ];

    const result = await resolveVariables(
      [
        { variable: "tipo_social", fuente: "ENTIDAD", condicion: "SIEMPRE" },
        { variable: "es_cotizada", fuente: "ENTIDAD", condicion: "SIEMPRE" },
      ],
      { agreementId: "agr-1", tenantId: "tenant-1", entityId: "entity-1" },
    );

    // BD real wins: tipo_social=SL, no el catalog default SA
    expect(result.values.tipo_social).toBe("SL");
    // Codex P2 round 15: es_cotizada canonical "SÍ"/"NO" string (v2 spec).
    // El alias boolean `is_cotizada` se expone via ENTIDAD nested namespace
    // (las plantillas que lo necesitan acceden con `{{ENTIDAD.is_cotizada}}`).
    expect(result.values.es_cotizada).toBe("NO");
    const entidad1 = result.values.ENTIDAD as Record<string, unknown> | undefined;
    expect(entidad1?.is_cotizada).toBe(false);
  });

  // ── Codex P1 — dotted refs en plantillas v2 ──────────────────────────────
  it("expone ENTIDAD nested object para plantillas v2 dotted ({{ENTIDAD.cargo_secretario_label}})", async () => {
    mockDb.rows.entities = {
      common_name: "ARGA Seguros",
      legal_name: "ARGA Seguros, S.A.",
      legal_form: "SA",
      tipo_social: "SA",
    };
    mockDb.rows.entity_settings = [
      { key: "cargo_secretario_label", value: "Secretario General" },
      { key: "es_cotizada", value: "SÍ" },
    ];
    mockDb.rows.entity_settings_catalog = [];

    const result = await resolveVariables(
      [
        { variable: "cargo_secretario_label", fuente: "ENTIDAD", condicion: "SIEMPRE" },
        { variable: "es_cotizada", fuente: "ENTIDAD", condicion: "SIEMPRE" },
      ],
      { agreementId: "agr-1", tenantId: "tenant-1", entityId: "entity-1" },
    );

    // Forma legacy plana sigue funcionando
    expect(result.values.cargo_secretario_label).toBe("Secretario General");
    // Codex P2 round 15: canonical "SÍ" string (v2 spec); alias boolean via
    // namespace nested ENTIDAD.is_cotizada
    expect(result.values.es_cotizada).toBe("SÍ");

    // Forma v2 dotted: ENTIDAD es objeto navegable por Handlebars
    const entidad = result.values.ENTIDAD as Record<string, unknown> | undefined;
    expect(entidad).toBeDefined();
    expect(entidad?.cargo_secretario_label).toBe("Secretario General");
    expect(entidad?.es_cotizada).toBe("SÍ");
    expect(entidad?.tipo_social).toBe("SA");
    expect(entidad?.is_cotizada).toBe(true); // alias boolean para `{{#if ENTIDAD.is_cotizada}}`
  });

  it("Handlebars renderiza {{ENTIDAD.x}} y {{#if (eq ENTIDAD.x \"SÍ\")}} desde el resolver", async () => {
    // Smoke end-to-end resolver → renderer para confirmar que ambas formas
    // (legacy plana + v2 dotted + condicional dotted) renderizan correctamente.
    const { renderTemplate } = await import("../template-renderer");

    mockDb.rows.entities = {
      common_name: "ARGA Seguros",
      legal_name: "ARGA Seguros, S.A.",
      legal_form: "SA",
      tipo_social: "SA",
    };
    mockDb.rows.entity_settings = [
      { key: "cargo_secretario_label", value: "Secretario General" },
      { key: "es_cotizada", value: "SÍ" },
    ];
    mockDb.rows.entity_settings_catalog = [];

    const result = await resolveVariables(
      [
        { variable: "cargo_secretario_label", fuente: "ENTIDAD", condicion: "SIEMPRE" },
        { variable: "es_cotizada", fuente: "ENTIDAD", condicion: "SIEMPRE" },
      ],
      { agreementId: "agr-1", tenantId: "tenant-1", entityId: "entity-1" },
    );

    // Codex P2 round 15: v2 canonical SÍ/NO string. Plantillas usan
    // `{{eq "SÍ"}}` para v2 spec compliance. Legacy `{{#if is_cotizada}}`
    // también verificado (alias boolean).
    const rendered = renderTemplate({
      template:
        "Cargo: {{ENTIDAD.cargo_secretario_label}}. " +
        "{{#if (eq ENTIDAD.es_cotizada \"SÍ\")}}Sociedad cotizada.{{else}}No cotizada.{{/if}}",
      variables: result.values,
    });

    expect(rendered.ok).toBe(true);
    expect(rendered.text).toContain("Cargo: Secretario General");
    expect(rendered.text).toContain("Sociedad cotizada.");
    expect(rendered.text).not.toContain("No cotizada.");

    // Verificar alias boolean via nested namespace para plantillas que
    // prefieren `{{#if}}` idiomático (forma migrada de legacy v1)
    const legacyRender = renderTemplate({
      template: "{{#if ENTIDAD.is_cotizada}}Listed.{{else}}NotListed.{{/if}}",
      variables: result.values,
    });
    expect(legacyRender.ok).toBe(true);
    expect(legacyRender.text).toContain("Listed.");
    expect(legacyRender.text).not.toContain("NotListed.");
  });
});
