import { describe, expect, it } from "vitest";
import type { EntityNormativeProfile } from "@/lib/secretaria/normative-framework";
import type { NormalizedCapa3Field } from "@/lib/secretaria/capa3-fields";
import type { RulePack } from "@/lib/rules-engine";
import {
  buildMatterExecutionProfile,
  computePrerequisiteGaps,
  computeRefreshableCapa3Fields,
  derivePostAgreementWorkflow,
  evaluateFormalGate,
} from "../matter-execution-profile";

const normativeProfile: EntityNormativeProfile = {
  schema_version: "entity-normative-profile.v1",
  profile_id: "profile-1",
  profile_hash: "hash-1",
  profile_version: "1",
  tenant_id: "tenant-1",
  entity_id: "entity-1",
  entity_name: "ARGA Seguros S.A.",
  jurisdiction: "ES",
  company_form: "SA",
  rule_set_company_form: "SA",
  is_listed: true,
  is_unipersonal: false,
  status: "COMPLETO",
  sources: [],
  warnings: [],
  blockers: [],
  rule_trace: {
    jurisdiction_rule_set_ids: [],
    rule_pack_version_ids: ["rpv-1"],
    override_ids: [],
    pacto_ids: [],
  },
  effective_at: "2026-05-17T00:00:00.000Z",
};

function rulePack(overrides: Partial<RulePack> & Record<string, unknown> = {}): Partial<RulePack> & Record<string, unknown> {
  return {
    id: "rp-base",
    materia: "APROBACION_CUENTAS",
    convocatoria: {
      antelacionDias: {
        SA: { valor: 30, fuente: "LEY", referencia: "Art. 176 LSC" },
        SL: { valor: 15, fuente: "LEY", referencia: "Art. 176 LSC" },
        SAU: { valor: 30, fuente: "LEY", referencia: "Art. 176 LSC" },
        SLU: { valor: 15, fuente: "LEY", referencia: "Art. 176 LSC" },
      },
      canales: {
        SA: ["BORME", "WEB"],
        SL: ["NOTIFICACION_INDIVIDUAL"],
        SAU: ["BORME", "WEB"],
        SLU: ["NOTIFICACION_INDIVIDUAL"],
      },
      contenidoMinimo: ["orden_dia"],
      documentosObligatorios: [{ id: "cuentas_formuladas", nombre: "Cuentas formuladas" }],
    },
    constitucion: {
      quorum: {
        SA_1a: { valor: 0.25, fuente: "LEY", referencia: "Art. 193 LSC" },
        SA_2a: { valor: 0, fuente: "LEY", referencia: "Art. 193 LSC" },
        SL: { valor: 0, fuente: "LEY", referencia: "Art. 198 LSC" },
        CONSEJO: { valor: "mayoria_miembros", fuente: "LEY", referencia: "Art. 247 LSC" },
      },
    },
    votacion: {
      mayoria: {
        SA: { formula: "favor > contra", fuente: "LEY", referencia: "Art. 201 LSC" },
        SL: { formula: "favor >= 1/3 capital", fuente: "LEY", referencia: "Art. 198 LSC" },
        CONSEJO: { formula: "mayoria_consejeros", fuente: "LEY", referencia: "Art. 248 LSC" },
      },
      abstenciones: "no_cuentan",
    },
    documentacion: {
      obligatoria: [{ id: "cuentas_formuladas", nombre: "Cuentas formuladas" }],
    },
    postAcuerdo: {
      inscribible: false,
      instrumentoRequerido: "NINGUNO",
      publicacionRequerida: false,
    },
    version: "1.1.0",
    rule_pack_version_id: "rpv-1",
    ...overrides,
  };
}

function profileInput(overrides: Record<string, unknown> = {}) {
  return {
    materia: "APROBACION_CUENTAS",
    organo_tipo: "JUNTA_GENERAL",
    tipo_social: "SA",
    adoption_mode: "MEETING",
    rulePackPayload: rulePack(),
    normativeProfile,
    paramOverrides: [],
    ...overrides,
  };
}

describe("MatterExecutionProfile", () => {
  it("trata la junta universal como via alternativa, sin risk_flag ni consecuencia", () => {
    const profile = buildMatterExecutionProfile(profileInput({ adoption_mode: "MEETING" }));
    const result = evaluateFormalGate(profile, {
      gate: "CONVOCATORIA",
      now: "2026-05-17T10:00:00.000Z",
      convocatoria: { juntaUniversal: true },
    });

    expect(result.status).toBe("PASSED");
    expect(result.override).toMatchObject({
      override_tipo: "VIA_ALTERNATIVA",
      fundamento: "Art. 178 LSC junta universal / consentimiento unanime",
    });
    expect(result.override?.risk_flag).toBeUndefined();
    expect(result.override?.consecuencia).toBeUndefined();
  });

  it("marca convocatoria defectuosa como desviacion con riesgo de impugnabilidad", () => {
    const profile = buildMatterExecutionProfile(profileInput());
    const result = evaluateFormalGate(profile, {
      gate: "CONVOCATORIA",
      now: "2026-05-17T10:00:00.000Z",
      convocatoria: { noticeDays: 10 },
    });

    expect(result.status).toBe("OVERRIDE_REQUIRED");
    expect(result.override).toMatchObject({
      override_tipo: "DESVIACION_CON_RIESGO",
      risk_flag: "IMPUGNABILIDAD",
    });
    expect(result.override?.consecuencia).toContain("riesgo formal");
    expect(result.gaps[0]).toMatchObject({ code: "NOTICE_PERIOD_SHORT", overridable: true });
  });

  it("modela APROBACION_CUENTAS -> FORMULACION_CUENTAS como prerequisito blocking", () => {
    const profile = buildMatterExecutionProfile(profileInput());
    const gaps = computePrerequisiteGaps(profile, { prerequisitos: [] });

    expect(profile.prerequisitos).toEqual([
      expect.objectContaining({
        materia_requerida: "FORMULACION_CUENTAS",
        estado_minimo: "APROBADO",
        severity: "BLOCKING",
        fuente: "Art. 253 LSC",
      }),
    ]);
    expect(gaps).toEqual([
      expect.objectContaining({
        gate: "PREREQUISITO",
        severity: "BLOCKING",
        override_tipo: "DESVIACION_CON_RIESGO",
        overridable: true,
      }),
    ]);
  });

  it("modela DISTRIBUCION_DIVIDENDOS con cadena de prerequisitos de cuentas", () => {
    const profile = buildMatterExecutionProfile(profileInput({
      materia: "DISTRIBUCION_DIVIDENDOS",
      rulePackPayload: rulePack({ id: "rp-dividendos", materia: "DISTRIBUCION_DIVIDENDOS" }),
    }));
    const gaps = computePrerequisiteGaps(profile, {
      prerequisitos: [{ materia: "APROBACION_CUENTAS", organo_tipo: "JUNTA_GENERAL", estado: "APROBADO" }],
    });

    expect(profile.prerequisitos.map((item) => item.materia_requerida)).toEqual([
      "APROBACION_CUENTAS",
      "FORMULACION_CUENTAS",
    ]);
    expect(gaps).toEqual([
      expect.objectContaining({
        message: "FORMULACION_CUENTAS debe constar como APROBADO.",
        severity: "WARNING",
      }),
    ]);
  });

  it("exige acta aprobada para CERTIFICACION_ACUERDOS", () => {
    const profile = buildMatterExecutionProfile(profileInput({
      materia: "CERTIFICACION_ACUERDOS",
      rulePackPayload: rulePack({ id: "rp-cert", materia: "CERTIFICACION_ACUERDOS" }),
    }));
    const gaps = computePrerequisiteGaps(profile, { prerequisitos: [] });

    expect(profile.prerequisitos[0]).toMatchObject({
      materia_requerida: "ACTA_APROBADA",
      estado_minimo: "APROBADO",
      severity: "BLOCKING",
      fuente: "RRM arts. 108-109",
    });
    expect(gaps[0].override_tipo).toBe("DESVIACION_CON_RIESGO");
  });

  it("bifurca CESE_CONSEJERO entre Consejo y Junta por quorum y mayoria", () => {
    const consejo = buildMatterExecutionProfile(profileInput({
      materia: "CESE_CONSEJERO",
      organo_tipo: "CONSEJO_ADMIN",
      rulePackPayload: rulePack({ id: "rp-cese-consejo", materia: "CESE_CONSEJERO" }),
    }));
    const junta = buildMatterExecutionProfile(profileInput({
      materia: "CESE_CONSEJERO",
      organo_tipo: "JUNTA_GENERAL",
      rulePackPayload: rulePack({ id: "rp-cese-junta", materia: "CESE_CONSEJERO" }),
    }));

    expect(consejo.constitucion.quorum_rule).toBe("mayoria_miembros");
    expect(consejo.votacion.majority_rule).toBe("mayoria_consejeros");
    expect(junta.constitucion.quorum_threshold).toBe(0.25);
    expect(junta.votacion.majority_rule).toBe("favor > contra");
  });

  it("advierte si NOMBRAMIENTO_CONSEJERO por cooptacion se intenta en SL", () => {
    const profile = buildMatterExecutionProfile(profileInput({
      materia: "NOMBRAMIENTO_CONSEJERO",
      organo_tipo: "CONSEJO_ADMIN",
      tipo_social: "SL",
      subtipo_materia: "COOPTACION",
      rulePackPayload: rulePack({ id: "rp-cooptacion", materia: "NOMBRAMIENTO_CONSEJERO" }),
    }));

    expect(profile.gaps).toEqual([
      expect.objectContaining({
        code: "COOPTACION_SOLO_SA",
        severity: "WARNING",
        overridable: true,
      }),
    ]);
  });

  it("modela FUSION/ESCISION con proyecto comun, RDL 5/2023 e inscripcion", () => {
    const profile = buildMatterExecutionProfile(profileInput({
      materia: "FUSION",
      subtipo_materia: "FUSION_ABSORCION",
      rulePackPayload: rulePack({
        id: "rp-fusion",
        materia: "FUSION",
        postAcuerdo: {
          inscribible: true,
          instrumentoRequerido: "ESCRITURA",
          publicacionRequerida: true,
        },
      }),
    }));

    expect(profile.prerequisitos[0]).toMatchObject({
      materia_requerida: "PROYECTO_COMUN_MODIFICACION_ESTRUCTURAL",
      fuente: "Arts. 11-25 RDL 5/2023",
    });
    expect(profile.documentacion.informes_preceptivos).toContain("Proyecto comun de modificacion estructural");
    expect(profile.post_acuerdo).toMatchObject({
      es_inscribible: true,
      escritura_publica: true,
      publicacion_borme: true,
    });
    expect(derivePostAgreementWorkflow(profile)).toEqual([
      "LIBRO_ACTAS",
      "CERTIFICACION",
      "ESCRITURA_PUBLICA",
      "INSCRIPCION_REGISTRAL",
      "PUBLICACION_BORME",
    ]);
  });

  it("marca NOMBRAMIENTO_AUDITOR fuera de 3-9 anos como gap bloqueante y overridable", () => {
    const profile = buildMatterExecutionProfile(profileInput({
      materia: "NOMBRAMIENTO_AUDITOR",
      rulePackPayload: rulePack({ id: "rp-auditor", materia: "NOMBRAMIENTO_AUDITOR" }),
    }));
    const result = evaluateFormalGate(profile, {
      gate: "DOCUMENTACION",
      values: { duracion_anos: 10 },
    });

    expect(result.status).toBe("OVERRIDE_REQUIRED");
    expect(result.gaps[0]).toMatchObject({
      code: "AUDITOR_DURATION_OUT_OF_RANGE",
      severity: "BLOCKING",
      overridable: true,
      risk_flag: "CALIFICACION_REGISTRAL",
    });
  });

  it("calcula campos_a_actualizar cruzando la materia con capa3Schema", () => {
    const capa3Schema: NormalizedCapa3Field[] = [
      { campo: "ejercicio", obligatoriedad: "OBLIGATORIO", descripcion: "Ejercicio" },
      { campo: "organo_formulador", obligatoriedad: "OPCIONAL", descripcion: "Organo" },
      { campo: "propuesta_aplicacion_resultado", obligatoriedad: "OBLIGATORIO", descripcion: "Propuesta" },
    ];
    const profile = buildMatterExecutionProfile(profileInput({ capa3Schema }));

    expect(profile.eficiencia.campos_a_actualizar).toEqual([
      "ejercicio",
      "propuesta_aplicacion_resultado",
    ]);
    expect(computeRefreshableCapa3Fields(profile, capa3Schema)).toEqual(profile.eficiencia.campos_a_actualizar);
  });

  it("mantiene todos los gaps como overridable para preservar control del secretario", () => {
    const profile = buildMatterExecutionProfile(profileInput({
      materia: "NOMBRAMIENTO_CONSEJERO",
      organo_tipo: "CONSEJO_ADMIN",
      tipo_social: "SL",
      subtipo_materia: "COOPTACION",
      rulePackPayload: rulePack({ id: "rp-cooptacion", materia: "NOMBRAMIENTO_CONSEJERO" }),
    }));
    const prereqGaps = computePrerequisiteGaps(
      buildMatterExecutionProfile(profileInput()),
      { prerequisitos: [] },
    );
    const gateResult = evaluateFormalGate(buildMatterExecutionProfile(profileInput()), {
      gate: "CONVOCATORIA",
      convocatoria: { noticeDays: 1 },
    });
    const allGaps = [...profile.gaps, ...prereqGaps, ...gateResult.gaps];

    expect(allGaps.length).toBeGreaterThan(0);
    expect(allGaps.every((gap) => gap.overridable === true)).toBe(true);
    expect(gateResult.status).toBe("OVERRIDE_REQUIRED");
  });
});
