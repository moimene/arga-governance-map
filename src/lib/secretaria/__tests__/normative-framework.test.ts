import { describe, expect, it } from "vitest";
import {
  buildAgreementNormativeSnapshot,
  buildEntityNormativeProfile,
  compactAgreementNormativeSnapshot,
  normalizeSocietyFormForNormative,
  normalizeSocietyFormForRuleSet,
} from "../normative-framework";

const entity = {
  id: "entity-arga",
  common_name: "ARGA Seguros S.A.",
  legal_name: "ARGA Seguros S.A.",
  jurisdiction: "ES",
  tipo_social: "SA",
  legal_form: "SA",
  forma_administracion: "CONSEJO",
  tipo_organo_admin: "CONSEJO_ADMIN",
  es_unipersonal: false,
  es_cotizada: true,
};

describe("secretaria normative framework", () => {
  it("normaliza formas sociales sin romper el matching de rule sets", () => {
    expect(normalizeSocietyFormForNormative("S.A.U.")).toBe("SAU");
    expect(normalizeSocietyFormForRuleSet("S.A.U.")).toBe("SA");
    expect(normalizeSocietyFormForNormative("S.L.U.")).toBe("SLU");
    expect(normalizeSocietyFormForRuleSet("S.L.U.")).toBe("SL");
    expect(normalizeSocietyFormForNormative("SA", { listed: true })).toBe("SA_COTIZADA");
    expect(normalizeSocietyFormForRuleSet("SA", { listed: true })).toBe("SA");
  });

  it("compone un perfil normativo con ley, estatutos, pacto y rule packs", () => {
    const profile = buildEntityNormativeProfile({
      tenantId: "tenant-1",
      entity,
      now: "2026-05-03T09:00:00.000Z",
      jurisdictionRuleSets: [
        {
          id: "jrs-es-sa",
          jurisdiction: "ES",
          company_form: "SA",
          typology_code: "SA",
          rule_set_version: "2026.05",
          legal_reference: "LSC",
          name: "Ley de Sociedades de Capital",
          is_active: true,
        },
      ],
      rulePacks: [
        {
          id: "rpv-1",
          rule_pack_id: "APROBACION_CUENTAS",
          version_tag: "1.0.0",
          status: "ACTIVE",
          materia: "APROBACION_CUENTAS",
        },
      ],
      overrides: [
        {
          id: "ov-1",
          fuente: "ESTATUTOS",
          materia: "FUSION",
          clave: "veto_reforzado",
          referencia: "art. 22 estatutos",
        },
      ],
      pactos: [
        {
          id: "pacto-1",
          titulo: "Pacto Fundación ARGA",
          tipo_clausula: "VETO",
          materias_aplicables: ["FUSION"],
          estado: "VIGENTE",
        },
      ],
    });

    expect(profile.status).toBe("COMPLETO");
    expect(profile.rule_trace.jurisdiction_rule_set_ids).toEqual(["jrs-es-sa"]);
    expect(profile.rule_trace.rule_pack_version_ids).toEqual(["rpv-1"]);
    expect(profile.rule_trace.pacto_ids).toEqual(["pacto-1"]);
    expect(profile.sources.map((source) => source.layer)).toEqual(
      expect.arrayContaining(["LEY", "ESTATUTOS", "PACTO_PARASOCIAL", "POLITICA", "SISTEMA"]),
    );
    expect(profile.warnings.join(" ")).toContain("Sociedad cotizada");
  });

  it("marca incompleto si falta la fuente legal activa", () => {
    const profile = buildEntityNormativeProfile({
      entity: {
        id: "entity-sl",
        common_name: "ARGA Servicios S.L.",
        jurisdiction: "ES",
        tipo_social: "SL",
      },
      jurisdictionRuleSets: [],
      rulePacks: [],
      overrides: [],
      pactos: [],
      now: "2026-05-03T09:00:00.000Z",
    });

    expect(profile.status).toBe("INCOMPLETO");
    expect(profile.sources.find((source) => source.layer === "LEY")?.status).toBe("MISSING");
  });

  it("congela snapshot de acuerdo con requisitos de formalizacion", () => {
    const profile = buildEntityNormativeProfile({
      tenantId: "tenant-1",
      entity,
      now: "2026-05-03T09:00:00.000Z",
      jurisdictionRuleSets: [
        {
          id: "jrs-es-sa",
          jurisdiction: "ES",
          company_form: "SA",
          rule_set_version: "2026.05",
          legal_reference: "LSC",
          is_active: true,
        },
      ],
      rulePacks: [],
      overrides: [],
      pactos: [],
    });

    const snapshot = buildAgreementNormativeSnapshot({
      profile,
      now: "2026-05-03T10:00:00.000Z",
      agreement: {
        id: "agreement-1",
        entity_id: entity.id,
        agreement_kind: "AUMENTO_CAPITAL",
        matter_class: "ESTRUCTURAL",
        adoption_mode: "MEETING",
        status: "ADOPTED",
        inscribable: true,
        compliance_snapshot: {
          rule_trace: {
            rule_pack_id: "AUMENTO_CAPITAL",
            rule_pack_version: "1.0.0",
            ruleset_snapshot_id: "ruleset-snapshot-1",
            payload_hash: "payload-hash-1",
          },
        },
      },
    });

    expect(snapshot.snapshot_id).toContain("agreement-1");
    expect(snapshot.formalization_requirements.map((item) => item.kind)).toEqual(
      expect.arrayContaining(["CERTIFICACION", "ESCRITURA_PUBLICA", "INSCRIPCION_REGISTRAL", "EVIDENCIA_QTSP"]),
    );
    expect(snapshot.rule_trace.meeting_ruleset_snapshot_id).toBe("ruleset-snapshot-1");
  });

  it("snapshot compacto conserva perfil normativo completo y no cambia si luego cambian overrides", () => {
    const baseProfile = buildEntityNormativeProfile({
      tenantId: "tenant-1",
      entity,
      now: "2026-05-04T09:00:00.000Z",
      jurisdictionRuleSets: [
        {
          id: "jrs-es-sa",
          jurisdiction: "ES",
          company_form: "SA",
          rule_set_version: "2026.05",
          legal_reference: "LSC",
          name: "Ley de Sociedades de Capital",
          is_active: true,
        },
      ],
      rulePacks: [
        {
          id: "rpv-capital",
          rule_pack_id: "AUMENTO_CAPITAL",
          version_tag: "1.0.0",
          status: "ACTIVE",
          materia: "AUMENTO_CAPITAL",
        },
      ],
      overrides: [
        {
          id: "ov-quorum-60",
          fuente: "ESTATUTOS",
          materia: "AUMENTO_CAPITAL",
          clave: "constitucion.quorum.SA_1a",
          referencia: "art. 18 estatutos ARGA",
        },
      ],
      pactos: [
        {
          id: "pacto-fundacion-arga",
          titulo: "Pacto Fundación ARGA",
          tipo_clausula: "VETO",
          materias_aplicables: ["AUMENTO_CAPITAL"],
          estado: "VIGENTE",
        },
      ],
    });

    const frozenSnapshot = buildAgreementNormativeSnapshot({
      profile: baseProfile,
      now: "2026-05-04T10:00:00.000Z",
      agreement: {
        id: "agreement-capital-1",
        entity_id: entity.id,
        agreement_kind: "AUMENTO_CAPITAL",
        matter_class: "ESTATUTARIA",
        adoption_mode: "MEETING",
        status: "ADOPTED",
        inscribable: true,
      },
    });

    const changedProfile = buildEntityNormativeProfile({
      tenantId: "tenant-1",
      entity,
      now: "2026-05-04T11:00:00.000Z",
      jurisdictionRuleSets: [
        {
          id: "jrs-es-sa",
          jurisdiction: "ES",
          company_form: "SA",
          rule_set_version: "2026.05",
          legal_reference: "LSC",
          name: "Ley de Sociedades de Capital",
          is_active: true,
        },
      ],
      rulePacks: [],
      overrides: [
        {
          id: "ov-quorum-70",
          fuente: "ESTATUTOS",
          materia: "AUMENTO_CAPITAL",
          clave: "constitucion.quorum.SA_1a",
          referencia: "art. 18 estatutos ARGA reformado",
        },
      ],
      pactos: [],
    });

    const compact = compactAgreementNormativeSnapshot(frozenSnapshot);

    expect(compact).toMatchObject({
      entity_id: entity.id,
      agreement_id: "agreement-capital-1",
      agreement_kind: "AUMENTO_CAPITAL",
      matter_class: "ESTATUTARIA",
      adoption_mode: "MEETING",
      framework_status: "COMPLETO",
    });
    expect(compact?.source_layers).toEqual(
      expect.arrayContaining(["LEY", "REGISTRO", "ESTATUTOS", "PACTO_PARASOCIAL", "POLITICA", "SISTEMA"]),
    );
    expect(frozenSnapshot.profile_hash).toBe(baseProfile.profile_hash);
    expect(frozenSnapshot.profile_hash).not.toBe(changedProfile.profile_hash);
    expect(frozenSnapshot.rule_trace.override_ids).toEqual(["ov-quorum-60"]);
    expect(frozenSnapshot.rule_trace.pacto_ids).toEqual(["pacto-fundacion-arga"]);
  });
});
