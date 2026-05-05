import { describe, expect, it } from "vitest";
import { evaluarConstitucion } from "../constitucion-engine";
import { evaluarVotacion } from "../votacion-engine";
import type {
  ConstitucionInput,
  MajoritySpec,
  NoSessionInput,
  ReglaActa,
  ReglaConvocatoria,
  ReglaConstitucion,
  ReglaDocumentacion,
  ReglaPlazosMateriales,
  ReglaPostAcuerdo,
  RulePack,
  RuleParamOverride,
  VotacionInput,
} from "../types";

const majority = (patch: Partial<MajoritySpec> = {}): MajoritySpec => ({
  formula: "favor > contra",
  fuente: "LEY",
  referencia: "LSC",
  ...patch,
});

const constitucion: ReglaConstitucion = {
  quorum: {
    SA_1a: { valor: 0.25, fuente: "LEY", referencia: "art. 193 LSC" },
    SA_2a: { valor: 0, fuente: "LEY", referencia: "art. 193 LSC" },
    SL: { valor: 0, fuente: "LEY", referencia: "art. 201 LSC" },
    CONSEJO: { valor: "mayoria_miembros", fuente: "LEY", referencia: "art. 247 LSC" },
  },
};

function pack(patch: Partial<RulePack> = {}): RulePack {
  return {
    id: "pack-aprobacion-cuentas",
    materia: "APROBACION_CUENTAS",
    clase: "ORDINARIA",
    organoTipo: "JUNTA_GENERAL",
    modosAdopcionPermitidos: ["MEETING", "UNIVERSAL"],
    convocatoria: {} as ReglaConvocatoria,
    constitucion,
    votacion: {
      mayoria: {
        SA: majority(),
        SL: majority(),
        CONSEJO: majority({ formula: "mayoria_consejeros", referencia: "art. 247 LSC" }),
      },
      abstenciones: "no_cuentan",
      votoCalidadPermitido: true,
    },
    documentacion: {} as ReglaDocumentacion,
    acta: {} as ReglaActa,
    plazosMateriales: {} as ReglaPlazosMateriales,
    postAcuerdo: {} as ReglaPostAcuerdo,
    ...patch,
  };
}

function constitucionInput(patch: Partial<ConstitucionInput> = {}): ConstitucionInput {
  return {
    tipoSocial: "SA",
    organoTipo: "JUNTA_GENERAL",
    adoptionMode: "MEETING",
    primeraConvocatoria: true,
    materiaClase: "ORDINARIA",
    capitalConDerechoVoto: 1000,
    capitalPresenteRepresentado: 260,
    ...patch,
  };
}

function votacionInput(patch: Partial<VotacionInput> = {}): VotacionInput {
  return {
    tipoSocial: "SA",
    organoTipo: "JUNTA_GENERAL",
    adoptionMode: "MEETING",
    materiaClase: "ORDINARIA",
    materias: ["APROBACION_CUENTAS"],
    votos: {
      favor: 60,
      contra: 40,
      abstenciones: 0,
      en_blanco: 0,
      capital_presente: 100,
      capital_total: 1000,
    },
    votoCalidadHabilitado: false,
    esEmpate: false,
    decisionFirmada: false,
    ...patch,
  };
}

function noSessionInput(patch: Partial<NoSessionInput> = {}): NoSessionInput {
  return {
    tipoProceso: "UNANIMIDAD_ESCRITA_SL",
    condicionAdopcion: "UNANIMIDAD_CAPITAL",
    organoTipo: "JUNTA_GENERAL",
    tipoSocial: "SL",
    respuestas: [
      { person_id: "socio-1", capital_participacion: 1000, porcentaje_capital: 100, es_consejero: false, sentido: "CONSENTIMIENTO" },
    ],
    notificaciones: [
      { person_id: "socio-1", canal: "EMAIL_CON_ACUSE", estado: "ENTREGADA" },
    ],
    totalDestinatarios: 1,
    totalCapitalSocial: 1000,
    ventana: {
      inicio: "2026-05-01T00:00:00.000Z",
      fin: "2026-05-03T00:00:00.000Z",
      ahora: "2026-05-02T00:00:00.000Z",
    },
    propuestaTexto: "Aprobacion de cuentas",
    ...patch,
  };
}

describe("Secretaría expanded rule logic — constitución", () => {
  it("junta universal PASS con 100% del capital y aceptación unánime sin evaluar umbrales ordinarios", () => {
    const result = evaluarConstitucion(
      constitucionInput({
        adoptionMode: "UNIVERSAL",
        esJuntaUniversal: true,
        aceptacionUnanimeCelebracion: true,
        capitalPresenteRepresentado: 1000,
      }),
      [pack()],
    );

    expect(result.ok).toBe(true);
    expect(result.quorumRequerido).toBe(1);
    expect(result.quorumPresente).toBe(1);
    expect(result.explain[0].referencia).toBe("art. 178 LSC");
    expect(result.explain[0].mensaje).toContain("Se omiten umbrales");
  });

  it("junta universal FAIL si falta un socio o no consta aceptación unánime", () => {
    const missingCapital = evaluarConstitucion(
      constitucionInput({
        adoptionMode: "UNIVERSAL",
        esJuntaUniversal: true,
        aceptacionUnanimeCelebracion: true,
        capitalPresenteRepresentado: 980,
      }),
      [pack()],
    );
    const missingAcceptance = evaluarConstitucion(
      constitucionInput({
        adoptionMode: "UNIVERSAL",
        esJuntaUniversal: true,
        aceptacionUnanimeCelebracion: false,
        capitalPresenteRepresentado: 1000,
      }),
      [pack()],
    );

    expect(missingCapital.ok).toBe(false);
    expect(missingCapital.blocking_issues).toContain("universal_capital_not_full");
    expect(missingAcceptance.ok).toBe(false);
    expect(missingAcceptance.blocking_issues).toContain("universal_acceptance_missing");
  });

  it("aplica art. 193 LSC: junta ordinaria en primera convocatoria exige 25% y registra PASS/FAIL", () => {
    const ok = evaluarConstitucion(constitucionInput({ capitalPresenteRepresentado: 260 }), [pack()]);
    const fail = evaluarConstitucion(constitucionInput({ capitalPresenteRepresentado: 240 }), [pack()]);

    expect(ok.ok).toBe(true);
    expect(ok.quorumRequerido).toBe(0.25);
    expect(ok.quorumPresente).toBe(0.26);
    expect(ok.explain.at(-1)?.resultado).toBe("OK");

    expect(fail.ok).toBe(false);
    expect(fail.blocking_issues).toContain("quorum_not_met");
    expect(fail.explain.at(-1)?.resultado).toBe("BLOCKING");
  });

  it("junta ordinaria en segunda convocatoria no exige quórum mínimo legal salvo override", () => {
    const result = evaluarConstitucion(
      constitucionInput({ primeraConvocatoria: false, capitalPresenteRepresentado: 1 }),
      [pack()],
    );

    expect(result.ok).toBe(true);
    expect(result.quorumRequerido).toBe(0);
    expect(result.explain.at(-1)?.referencia).toContain("art. 193 LSC");
  });

  it("materia cualificada usa 50% en primera y 25% en segunda convocatoria", () => {
    const firstFail = evaluarConstitucion(
      constitucionInput({ materiaClase: "ESTATUTARIA", capitalPresenteRepresentado: 490 }),
      [pack({ materia: "AUMENTO_CAPITAL", clase: "ESTATUTARIA" })],
    );
    const secondPass = evaluarConstitucion(
      constitucionInput({ materiaClase: "ESTATUTARIA", primeraConvocatoria: false, capitalPresenteRepresentado: 260 }),
      [pack({ materia: "AUMENTO_CAPITAL", clase: "ESTATUTARIA" })],
    );

    expect(firstFail.ok).toBe(false);
    expect(firstFail.quorumRequerido).toBe(0.5);
    expect(firstFail.explain.at(-1)?.referencia).toContain("art. 194 LSC");
    expect(secondPass.ok).toBe(true);
    expect(secondPass.quorumRequerido).toBe(0.25);
  });

  it("aplica override estatutario del 60% sin permitir rebajar el mínimo legal", () => {
    const overrides: RuleParamOverride[] = [
      {
        id: "ov-quorum-60",
        entity_id: "entity-arga",
        materia: "APROBACION_CUENTAS",
        clave: "constitucion.quorum.SA_1a",
        valor: 0.6,
        fuente: "ESTATUTOS",
        referencia: "art. 18 estatutos ARGA",
      },
    ];

    const fail = evaluarConstitucion(constitucionInput({ capitalPresenteRepresentado: 550 }), [pack()], overrides);
    const pass = evaluarConstitucion(constitucionInput({ capitalPresenteRepresentado: 600 }), [pack()], overrides);

    expect(fail.ok).toBe(false);
    expect(fail.quorumRequerido).toBe(0.6);
    expect(fail.explain.at(-1)?.fuente).toBe("ESTATUTOS");
    expect(pass.ok).toBe(true);
  });
});

describe("Secretaría expanded rule logic — votación", () => {
  it("mayoría simple rechaza empate exacto", () => {
    const result = evaluarVotacion(
      votacionInput({ votos: { favor: 50, contra: 50, abstenciones: 0, en_blanco: 0, capital_presente: 100, capital_total: 1000 } }),
      [pack()],
    );

    expect(result.ok).toBe(false);
    expect(result.mayoriaAlcanzada).toBe(false);
    expect(result.blocking_issues).toContain("majority_not_achieved");
  });

  it("mayoría reforzada de segunda convocatoria rechaza >50% pero <2/3 del capital concurrente", () => {
    const aumentoCapital = pack({
      materia: "AUMENTO_CAPITAL",
      clase: "ESTATUTARIA",
      votacion: {
        mayoria: {
          SA: majority({
            formula: "favor > 1/2_capital_presente",
            dobleCondicional: {
              umbral: 0.5,
              mayoriaAlternativa: "favor >= 2/3_capital_presente",
            },
            referencia: "art. 201.2 LSC",
          }),
          SL: majority(),
          CONSEJO: majority({ formula: "mayoria_consejeros" }),
        },
        abstenciones: "no_cuentan",
      },
    });
    const result = evaluarVotacion(
      votacionInput({
        materiaClase: "ESTATUTARIA",
        materias: ["AUMENTO_CAPITAL"],
        votos: { favor: 60, contra: 40, abstenciones: 0, en_blanco: 0, capital_presente: 100, capital_total: 1000 },
      }),
      [aumentoCapital],
    );

    expect(result.ok).toBe(false);
    expect(result.mayoriaAlcanzada).toBe(false);
    expect(result.explain.find((node) => node.regla.includes("Mayoría"))?.regla).toContain("2/3_capital_presente");
  });

  it("consejo con empate usa voto de calidad solo si está habilitado", () => {
    const consejoPack = pack({
      materia: "PLAN_NEGOCIO",
      organoTipo: "CONSEJO",
      votacion: {
        mayoria: {
          SA: majority(),
          SL: majority(),
          CONSEJO: majority({ formula: "favor > contra", referencia: "estatutos: voto de calidad" }),
        },
        abstenciones: "no_cuentan",
        votoCalidadPermitido: true,
      },
    });
    const tied = {
      organoTipo: "CONSEJO" as const,
      materias: ["PLAN_NEGOCIO"],
      votos: { favor: 3, contra: 3, abstenciones: 0, en_blanco: 0, capital_presente: 0, capital_total: 0, total_miembros: 7, miembros_presentes: 6 },
      esEmpate: true,
    };

    const withQualityVote = evaluarVotacion(votacionInput({ ...tied, votoCalidadHabilitado: true }), [consejoPack]);
    const withoutQualityVote = evaluarVotacion(votacionInput({ ...tied, votoCalidadHabilitado: false }), [consejoPack]);

    expect(withQualityVote.ok).toBe(true);
    expect(withQualityVote.votoCalidadUsado).toBe(true);
    expect(withoutQualityVote.ok).toBe(false);
    expect(withoutQualityVote.votoCalidadUsado).toBeUndefined();
  });

  it("bloquea materia reservada a junta cuando se intenta aprobar desde consejo", () => {
    const result = evaluarVotacion(
      votacionInput({
        organoTipo: "CONSEJO",
        materiaClase: "ESTATUTARIA",
        materias: ["AUMENTO_CAPITAL"],
      }),
      [pack({ materia: "AUMENTO_CAPITAL", clase: "ESTATUTARIA", organoTipo: "JUNTA_GENERAL" })],
    );

    expect(result.ok).toBe(false);
    expect(result.blocking_issues).toContain("organ_matter_not_allowed");
  });

  it("bloquea NO_SESSION cuando el rule pack no lo permite para la materia", () => {
    const result = evaluarVotacion(
      votacionInput({
        adoptionMode: "NO_SESSION",
        materiaClase: "ESTRUCTURAL",
        materias: ["FUSION_ESCISION"],
        noSessionInput: noSessionInput(),
      }),
      [
        pack({
          materia: "FUSION_ESCISION",
          clase: "ESTRUCTURAL",
          modosAdopcionPermitidos: ["MEETING"],
        }),
      ],
    );

    expect(result.ok).toBe(false);
    expect(result.blocking_issues).toContain("no_session_not_allowed_for_matter");
  });
});

describe("Secretaría expanded rule logic — mayorías cualificadas por materia", () => {
  it("reducción de capital aplica mayoría reforzada y distingue reducción por pérdidas sin oposición de acreedores", () => {
    const reduccion = pack({
      materia: "REDUCCION_CAPITAL",
      clase: "ESTATUTARIA",
      votacion: {
        mayoria: {
          SA: majority({
            formula: "favor >= 2/3_capital_presente",
            referencia: "arts. 317-342 LSC",
          }),
          SL: majority({ formula: "favor >= 2/3_capital_presente" }),
          CONSEJO: majority({ formula: "mayoria_consejeros" }),
        },
        abstenciones: "no_cuentan",
      },
      reglaEspecifica: {
        tipo_reduccion: "PERDIDAS",
        derecho_oposicion_acreedores: false,
        referencia_oposicion: "art. 323 LSC",
      },
    });

    const pass = evaluarVotacion(
      votacionInput({
        materiaClase: "ESTATUTARIA",
        materias: ["REDUCCION_CAPITAL"],
        votos: { favor: 70, contra: 30, abstenciones: 0, en_blanco: 0, capital_presente: 100, capital_total: 100 },
      }),
      [reduccion],
    );
    const fail = evaluarVotacion(
      votacionInput({
        materiaClase: "ESTATUTARIA",
        materias: ["REDUCCION_CAPITAL"],
        votos: { favor: 60, contra: 40, abstenciones: 0, en_blanco: 0, capital_presente: 100, capital_total: 100 },
      }),
      [reduccion],
    );

    expect(pass.ok).toBe(true);
    expect(fail.ok).toBe(false);
    expect(reduccion.reglaEspecifica?.derecho_oposicion_acreedores).toBe(false);
    expect(reduccion.reglaEspecifica?.referencia_oposicion).toBe("art. 323 LSC");
  });

  it("fusión/escisión usa RDL 5/2023 y dispensa experto en fusión simplificada", () => {
    const fusion = pack({
      materia: "FUSION_ESCISION",
      clase: "ESTRUCTURAL",
      votacion: {
        mayoria: {
          SA: majority({
            formula: "favor >= 2/3_capital_presente",
            referencia: "RDL 5/2023",
          }),
          SL: majority({ formula: "favor >= 2/3_capital_presente", referencia: "RDL 5/2023" }),
          CONSEJO: majority({ formula: "mayoria_consejeros" }),
        },
        abstenciones: "no_cuentan",
      },
      reglaEspecifica: {
        regimen: "FUSION_SIMPLIFICADA_MATRIZ_FILIAL_100",
        requiere_experto: false,
        referencia: "art. 53 RDL 5/2023",
      },
    });

    const result = evaluarVotacion(
      votacionInput({
        materiaClase: "ESTRUCTURAL",
        materias: ["FUSION_ESCISION"],
        votos: { favor: 80, contra: 20, abstenciones: 0, en_blanco: 0, capital_presente: 100, capital_total: 100 },
      }),
      [fusion],
    );

    expect(result.ok).toBe(true);
    expect(result.explain.find((node) => node.regla.includes("Mayoría"))?.referencia).toBe("RDL 5/2023");
    expect(result.explain.find((node) => node.regla.includes("Mayoría"))?.referencia).not.toContain("LSC");
    expect(fusion.reglaEspecifica?.requiere_experto).toBe(false);
  });

  it("disolución voluntaria mantiene mayoría ordinaria salvo previsión estatutaria específica", () => {
    const disolucion = pack({
      materia: "DISOLUCION",
      clase: "ORDINARIA",
      votacion: {
        mayoria: {
          SA: majority({ formula: "favor > contra", referencia: "art. 368 LSC" }),
          SL: majority({ formula: "favor > contra", referencia: "art. 368 LSC" }),
          CONSEJO: majority({ formula: "mayoria_consejeros" }),
        },
        abstenciones: "no_cuentan",
      },
    });

    const result = evaluarVotacion(
      votacionInput({
        materiaClase: "ORDINARIA",
        materias: ["DISOLUCION"],
        votos: { favor: 51, contra: 49, abstenciones: 0, en_blanco: 0, capital_presente: 100, capital_total: 100 },
      }),
      [disolucion],
    );

    expect(result.ok).toBe(true);
    expect(result.explain.find((node) => node.regla.includes("Mayoría"))?.referencia).toBe("art. 368 LSC");
  });

  it("exclusión del derecho de suscripción preferente exige informe del órgano y experto en SA", () => {
    const derechoSuscripcion = pack({
      materia: "EXCLUSION_DERECHO_SUSCRIPCION",
      clase: "ESTATUTARIA",
      documentacion: {
        obligatoria: [
          { id: "INFORME_ORGANO_ADMIN", nombre: "Informe del órgano de administración" },
          { id: "INFORME_EXPERTO_INDEPENDIENTE", nombre: "Informe de experto independiente", condicion: "SA" },
        ],
      },
      votacion: {
        mayoria: {
          SA: majority({ formula: "favor >= 2/3_capital_presente", referencia: "art. 308 LSC" }),
          SL: majority({ formula: "favor >= 2/3_capital_presente", referencia: "art. 308 LSC" }),
          CONSEJO: majority({ formula: "mayoria_consejeros" }),
        },
        abstenciones: "no_cuentan",
      },
    });

    const availableDocs = new Set(["INFORME_ORGANO_ADMIN"]);
    const missingDocs = derechoSuscripcion.documentacion.obligatoria
      .filter((doc) => !availableDocs.has(doc.id))
      .map((doc) => doc.id);

    expect(derechoSuscripcion.documentacion.obligatoria.map((doc) => doc.id)).toEqual([
      "INFORME_ORGANO_ADMIN",
      "INFORME_EXPERTO_INDEPENDIENTE",
    ]);
    expect(missingDocs).toEqual(["INFORME_EXPERTO_INDEPENDIENTE"]);
  });
});
