import { describe, expect, it } from "vitest";
import {
  buildEffectiveAgreementRule,
  classifyFrozenSnapshot,
  classifyPactoConsequence,
  type RuleManagerInput,
} from "../rule-manager-contract";
import type {
  AgreementNormativeSnapshot,
  NormativeSource,
} from "../normative-framework";
import type { PactoParasocial } from "@/lib/rules-engine/pactos-engine";

const ENTITY = {
  id: "entity-arga",
  common_name: "ARGA Seguros S.A.",
  legal_name: "ARGA Seguros, Sociedad Anonima",
  jurisdiction: "ES",
  tipo_social: "SA",
  legal_form: "SA",
  forma_administracion: "CONSEJO_ADMINISTRACION",
  tipo_organo_admin: "CONSEJO",
  es_unipersonal: false,
  es_cotizada: true,
} as const;

const RULE_SETS = [
  {
    id: "ruleset-es-sa",
    jurisdiction: "ES",
    company_form: "SA",
    rule_set_version: "2026-01",
    legal_reference: "LSC 2010 + reformas",
    is_active: true,
  },
];

const RULE_PACKS = [
  {
    id: "rule-pack-modificacion-estatutos",
    rule_pack_id: "MODIFICACION_ESTATUTOS",
    materia: "MODIFICACION_ESTATUTOS",
    is_active: true,
    version_number: 3,
  },
];

function input(overrides: Partial<RuleManagerInput> = {}): RuleManagerInput {
  return {
    entity: { ...ENTITY },
    jurisdictionRuleSets: RULE_SETS,
    rulePacks: RULE_PACKS,
    overrides: [],
    pactos: [],
    agreement: {
      matter: "MODIFICACION_ESTATUTOS",
      matter_class: "ESTATUTARIA",
      body_type: "JUNTA",
      adoption_mode: "MEETING",
      inscribable: true,
    },
    pactosEval: {},
    options: {},
    now: new Date("2026-05-07T12:00:00Z"),
    ...overrides,
  };
}

const VETO_PACTO: PactoParasocial = {
  id: "pacto-veto-fundacion",
  titulo: "Pacto Fundacion ARGA — derecho de veto operaciones estructurales",
  tipo_clausula: "VETO",
  firmantes: [
    { nombre: "Fundacion ARGA", tipo: "PJ", capital_pct: 69.69 },
  ],
  materias_aplicables: ["FUSION", "ESCISION", "DISOLUCION", "MODIFICACION_ESTATUTOS"],
  titular_veto: "Fundacion ARGA",
  condicion_detallada: "Veto formal en operaciones estructurales sobre activos > 15% PN.",
  estado: "VIGENTE",
};

const MAYORIA_REFORZADA_PACTO: PactoParasocial = {
  id: "pacto-mayoria-75",
  titulo: "Pacto mayoria reforzada 75% en materias vinculadas",
  tipo_clausula: "MAYORIA_REFORZADA_PACTADA",
  firmantes: [
    { nombre: "Cartera ARGA SLU", tipo: "PJ", capital_pct: 69.69 },
  ],
  materias_aplicables: ["MODIFICACION_ESTATUTOS"],
  umbral_activacion: 0.75,
  estado: "VIGENTE",
};

const CONSENTIMIENTO_PACTO: PactoParasocial = {
  id: "pacto-consentimiento-inversor",
  titulo: "Pacto consentimiento previo en aumentos de capital",
  tipo_clausula: "CONSENTIMIENTO_INVERSOR",
  firmantes: [
    { nombre: "Inversor X", tipo: "PJ", capital_pct: 15 },
  ],
  materias_aplicables: ["AUMENTO_CAPITAL"],
  capital_minimo_pct: 15,
  titular_veto: "Inversor X",
  estado: "VIGENTE",
};

describe("buildEffectiveAgreementRule", () => {
  it("CASO 1 — Ley sin override, sin pactos: sociedad cotizada genera WARNING informativo y queda PROCLAMABLE_AND_EXECUTABLE", () => {
    const result = buildEffectiveAgreementRule(input());
    // Cotizada: el motor advierte LMV/CNMV pero no bloquea, así que la
    // categoría operativa sigue siendo "limpio". WARNING es informativo.
    expect(result.status).toBe("PROCLAMABLE_AND_EXECUTABLE");
    expect(result.societary_valid).toBe(true);
    expect(result.contractual_compliant).toBe(true);
    expect(result.operational_clear).toBe(true);
    // Solo el WARNING de cotizada en consequences.
    expect(result.consequences).toHaveLength(1);
    expect(result.consequences[0].consequence).toBe("WARNING");
    expect(result.requirements.registry?.required).toBe(true);
    expect(result.requirements.publication?.required).toBe(true);
  });

  it("CASO 2 — Override estatutario que eleva requisito: aparece como fuente activa ESTATUTOS", () => {
    const result = buildEffectiveAgreementRule(
      input({
        overrides: [
          {
            id: "override-mayoria-67",
            entity_id: ENTITY.id,
            materia: "MODIFICACION_ESTATUTOS",
            clave: "majority_threshold",
            valor: 0.67,
            fuente: "ESTATUTOS",
            referencia: "Estatutos sociales art. 22",
          },
        ],
      }),
    );
    const estatutos = result.sources.find((s) => s.layer === "ESTATUTOS");
    expect(estatutos).toBeDefined();
    expect(estatutos?.status).toBe("ACTIVE");
    expect(estatutos?.notes.join(" ")).toContain("estatutaria");
  });

  it("CASO 3 — Sin override estatutario: la fuente ESTATUTOS aparece como WARNING (deuda informacional)", () => {
    const result = buildEffectiveAgreementRule(input());
    const estatutos = result.sources.find((s) => s.layer === "ESTATUTOS");
    expect(estatutos).toBeDefined();
    expect(estatutos?.status).toBe("WARNING");
  });

  it("CASO 4 — Pacto con VETO aplicable y sin waiver: OPERATIONAL_HOLD remediable, no VALIDITY_BLOCK", () => {
    const result = buildEffectiveAgreementRule(
      input({
        pactos: [VETO_PACTO],
      }),
    );
    expect(result.status).toBe("PROCLAMABLE_HELD");
    expect(result.societary_valid).toBe(true);
    expect(result.operational_clear).toBe(false);

    const hold = result.consequences.find((c) => c.consequence === "OPERATIONAL_HOLD");
    expect(hold).toBeDefined();
    expect(hold?.source_layer).toBe("PACTO_PARASOCIAL");
    expect(hold?.source_plane).toBe("CONTRACTUAL");
    expect(hold?.remediable).toBe(true);
    expect(hold?.remediation_hint).toContain("waiver");

    expect(result.requirements.veto?.applies).toBe(true);
    expect(result.requirements.veto?.titulares.length).toBeGreaterThan(0);
  });

  it("CASO 5 — Pacto con VETO renunciado: NO_EFFECT, no aparece en consequences", () => {
    const result = buildEffectiveAgreementRule(
      input({
        pactos: [VETO_PACTO],
        pactosEval: {
          vetoRenunciado: [VETO_PACTO.id],
        },
      }),
    );
    expect(result.status).toBe("PROCLAMABLE_AND_EXECUTABLE");
    expect(result.operational_clear).toBe(true);
    const hold = result.consequences.find((c) => c.consequence === "OPERATIONAL_HOLD");
    expect(hold).toBeUndefined();
  });

  it("CASO 6 — Veto estatutarizado (statutoryEnshrinedPactoIds): VALIDITY_BLOCK, status BLOCKED", () => {
    const result = buildEffectiveAgreementRule(
      input({
        pactos: [VETO_PACTO],
        options: {
          statutoryEnshrinedPactoIds: [VETO_PACTO.id],
        },
      }),
    );
    expect(result.status).toBe("BLOCKED");
    expect(result.societary_valid).toBe(false);

    const block = result.consequences.find((c) => c.consequence === "VALIDITY_BLOCK");
    expect(block).toBeDefined();
    expect(block?.source_layer).toBe("ESTATUTOS");
    expect(block?.source_plane).toBe("SOCIETARIO");
    expect(block?.remediable).toBe(true);
    expect(block?.remediation_hint).toContain("estatutos");
  });

  it("CASO 7 — Materia no afectada por pacto: NO_EFFECT, no aparece en consequences", () => {
    const noVetoMatterPacto: PactoParasocial = {
      ...VETO_PACTO,
      materias_aplicables: ["FUSION"], // no incluye MODIFICACION_ESTATUTOS
    };
    const result = buildEffectiveAgreementRule(
      input({
        pactos: [noVetoMatterPacto],
      }),
    );
    expect(result.status).toBe("PROCLAMABLE_AND_EXECUTABLE");
    const pactoConsequence = result.consequences.find(
      (c) => c.source_id === noVetoMatterPacto.id,
    );
    expect(pactoConsequence).toBeUndefined();
  });

  it("CASO 8 — Pacto MAYORIA_REFORZADA_PACTADA no alcanzada: CONTRACTUAL_BREACH", () => {
    const result = buildEffectiveAgreementRule(
      input({
        pactos: [MAYORIA_REFORZADA_PACTO],
        pactosEval: {
          capitalPresente: 100,
          votosFavor: 60,
          votosContra: 40,
        },
      }),
    );
    expect(result.status).toBe("PROCLAMABLE_HELD");
    expect(result.contractual_compliant).toBe(false);

    const breach = result.consequences.find((c) => c.consequence === "CONTRACTUAL_BREACH");
    expect(breach).toBeDefined();
    expect(breach?.source_layer).toBe("PACTO_PARASOCIAL");
    expect(breach?.remediable).toBe(true);
  });

  it("CASO 9 — Consentimiento inversor sin obtener: OPERATIONAL_HOLD por consent gate", () => {
    const result = buildEffectiveAgreementRule(
      input({
        agreement: {
          matter: "AUMENTO_CAPITAL",
          matter_class: "ESTRUCTURAL",
          body_type: "JUNTA",
          adoption_mode: "MEETING",
          inscribable: true,
        },
        pactos: [CONSENTIMIENTO_PACTO],
      }),
    );
    expect(result.status).toBe("PROCLAMABLE_HELD");
    expect(result.operational_clear).toBe(false);

    const hold = result.consequences.find((c) => c.consequence === "OPERATIONAL_HOLD");
    expect(hold).toBeDefined();
    expect(hold?.remediation_hint).toContain("consentimiento previo");

    expect(result.requirements.consent?.required).toBe(true);
    expect(result.requirements.consent?.from.length).toBeGreaterThan(0);
  });

  it("CASO 10 — Snapshot trazable: profile_hash y pacto_ids quedan en trace", () => {
    const result = buildEffectiveAgreementRule(
      input({
        pactos: [VETO_PACTO, MAYORIA_REFORZADA_PACTO],
      }),
    );
    expect(result.trace.profile_hash).toMatch(/^nf_[0-9a-f]{8}$/);
    expect(result.trace.pacto_ids).toContain(VETO_PACTO.id);
    expect(result.trace.pacto_ids).toContain(MAYORIA_REFORZADA_PACTO.id);
  });

  it("CASO 11 — Adoption_mode NO_SESSION exige unanimidad y no convocatoria formal", () => {
    const result = buildEffectiveAgreementRule(
      input({
        agreement: {
          matter: "MODIFICACION_ESTATUTOS",
          matter_class: "ESTATUTARIA",
          body_type: "JUNTA",
          adoption_mode: "NO_SESSION",
          inscribable: true,
        },
      }),
    );
    expect(result.requirements.unanimity?.required).toBe(true);
    expect(result.requirements.convocatoria?.required).toBe(false);
    expect(result.requirements.quorum?.required).toBe(false);
  });
});

// ─── Fixes adversariales — coverage adicional ───────────────────────────────

const ENTITY_SL_NO_LISTED = {
  id: "entity-cartera-arga",
  common_name: "Cartera ARGA S.L.U.",
  legal_name: "Cartera ARGA, S.L.U.",
  jurisdiction: "ES",
  tipo_social: "SLU",
  legal_form: "SL",
  forma_administracion: "ADMIN_UNICO",
  tipo_organo_admin: "ADMIN_UNICO",
  es_unipersonal: true,
  es_cotizada: false,
} as const;

describe("buildEffectiveAgreementRule — coverage adicional (post-adversarial)", () => {
  it("CASO 12 — Sociedad SL no cotizada: NO emite WARNING de cotizada", () => {
    const result = buildEffectiveAgreementRule(
      input({
        entity: { ...ENTITY_SL_NO_LISTED },
        rulePacks: [],
        agreement: {
          matter: "MODIFICACION_ESTATUTOS",
          matter_class: "ESTATUTARIA",
          body_type: "JUNTA",
          adoption_mode: "MEETING",
          inscribable: true,
        },
      }),
    );
    expect(result.status).toBe("PROCLAMABLE_AND_EXECUTABLE");
    const cotizadaWarning = result.consequences.find(
      (c) => c.consequence === "WARNING" && c.source_label.includes("LMV"),
    );
    expect(cotizadaWarning).toBeUndefined();
    expect(result.requirements.publication?.required).toBe(false);
  });

  it("CASO 13 — Entidad sin jurisdicción: profile reporta blockers; status sigue legible", () => {
    const result = buildEffectiveAgreementRule(
      input({
        entity: {
          ...ENTITY,
          jurisdiction: null,
        },
      }),
    );
    expect(result.profile.blockers.length).toBeGreaterThan(0);
    // El profile bloquea por datos faltantes, pero el contrato no inventa un VALIDITY_BLOCK
    // automático: deja que la UI muestre los blockers a Legal.
    expect(result.consequences.find((c) => c.consequence === "VALIDITY_BLOCK")).toBeUndefined();
  });

  it("CASO 14 — Multi-pacto: VETO + MAYORIA_REFORZADA simultáneos producen 2 consequences distintas", () => {
    const result = buildEffectiveAgreementRule(
      input({
        pactos: [VETO_PACTO, MAYORIA_REFORZADA_PACTO],
        pactosEval: {
          capitalPresente: 100,
          votosFavor: 60, // < 75% pactado
        },
      }),
    );
    expect(result.status).toBe("PROCLAMABLE_HELD");
    const hold = result.consequences.find((c) => c.consequence === "OPERATIONAL_HOLD");
    const breach = result.consequences.find((c) => c.consequence === "CONTRACTUAL_BREACH");
    expect(hold?.source_id).toBe(VETO_PACTO.id);
    expect(breach?.source_id).toBe(MAYORIA_REFORZADA_PACTO.id);
    expect(result.consequences.length).toBeGreaterThanOrEqual(3); // 2 pactos + WARNING cotizada
  });

  it("CASO 15 — Adoption_mode CO_APROBACION: convocatoria sí, quorum no, unanimidad no", () => {
    const result = buildEffectiveAgreementRule(
      input({
        agreement: {
          matter: "DELEGACION_FACULTADES",
          matter_class: "ORDINARIA",
          body_type: "ADMIN_CONJUNTA",
          adoption_mode: "CO_APROBACION",
          inscribable: false,
        },
      }),
    );
    expect(result.requirements.convocatoria?.required).toBe(true);
    expect(result.requirements.convocatoria?.notes.join(" ")).toContain("Co-aprobación");
    expect(result.requirements.quorum?.required).toBe(false);
    expect(result.requirements.unanimity?.required).toBe(false);
  });

  it("CASO 16 — Adoption_mode SOLIDARIO: ni convocatoria ni quorum ni unanimidad", () => {
    const result = buildEffectiveAgreementRule(
      input({
        agreement: {
          matter: "GESTION_ORDINARIA",
          matter_class: "ORDINARIA",
          body_type: "ADMIN_SOLIDARIOS",
          adoption_mode: "SOLIDARIO",
          inscribable: false,
        },
      }),
    );
    expect(result.requirements.convocatoria?.required).toBe(false);
    expect(result.requirements.convocatoria?.notes.join(" ")).toContain("solidario");
    expect(result.requirements.quorum?.required).toBe(false);
    expect(result.requirements.unanimity?.required).toBe(false);
  });

  it("CASO 17 — legal_majority suministrado por el caller: se usa threshold real, no heurística", () => {
    const result = buildEffectiveAgreementRule(
      input({
        agreement: {
          matter: "MODIFICACION_ESTATUTOS",
          matter_class: "ESTATUTARIA",
          body_type: "JUNTA",
          adoption_mode: "MEETING",
          inscribable: true,
          legal_majority: {
            code: "REFORZADA_2_3",
            threshold: 2 / 3,
            description: "Mayoría reforzada de 2/3 según LSC art. 201.2",
          },
        },
      }),
    );
    expect(result.requirements.majority?.code).toBe("REFORZADA_2_3");
    expect(result.requirements.majority?.legal_threshold).toBeCloseTo(2 / 3, 3);
    expect(result.requirements.majority?.effective_threshold).toBeCloseTo(2 / 3, 3);
    expect(result.requirements.majority?.effective_source).toBe("LEY");
    expect(result.requirements.majority?.description).toContain("LSC art. 201.2");
  });

  it("CASO 18 — Pacto MAYORIA_REFORZADA(0.75) eleva el threshold sobre legal(0.667): effective_source=PACTO", () => {
    const result = buildEffectiveAgreementRule(
      input({
        agreement: {
          matter: "MODIFICACION_ESTATUTOS",
          matter_class: "ESTATUTARIA",
          body_type: "JUNTA",
          adoption_mode: "MEETING",
          inscribable: true,
          legal_majority: { code: "REFORZADA_2_3", threshold: 2 / 3 },
        },
        pactos: [MAYORIA_REFORZADA_PACTO],
      }),
    );
    expect(result.requirements.majority?.legal_threshold).toBeCloseTo(2 / 3, 3);
    expect(result.requirements.majority?.pacto_threshold).toBe(0.75);
    expect(result.requirements.majority?.effective_threshold).toBe(0.75);
    expect(result.requirements.majority?.effective_source).toBe("PACTO");
    expect(result.requirements.majority?.code).toBe("PACTO_MAYORIA_REFORZADA");
  });

  it("CASO 19 — Titular del veto: usa titular_veto cuando existe", () => {
    const result = buildEffectiveAgreementRule(
      input({
        pactos: [VETO_PACTO], // titular_veto = "Fundacion ARGA"
      }),
    );
    expect(result.requirements.veto?.applies).toBe(true);
    expect(result.requirements.veto?.titulares).toContain("Fundacion ARGA");
  });

  it("CASO 20 — Titular del veto: cae a firmantes cuando no hay titular_veto", () => {
    const vetoSinTitular: PactoParasocial = {
      ...VETO_PACTO,
      id: "pacto-veto-sin-titular",
      titular_veto: undefined,
      firmantes: [
        { nombre: "Inversor A", tipo: "PJ", capital_pct: 30 },
        { nombre: "Inversor B", tipo: "PJ", capital_pct: 25 },
      ],
    };
    const result = buildEffectiveAgreementRule(
      input({
        pactos: [vetoSinTitular],
      }),
    );
    expect(result.requirements.veto?.titulares).toContain("Inversor A");
    expect(result.requirements.veto?.titulares).toContain("Inversor B");
  });

  it("CASO 22 — Modo pre-vote (skipVoteDependentEvaluations): MAYORIA_REFORZADA aplicable se reporta como WARNING, no breach falso", () => {
    const result = buildEffectiveAgreementRule(
      input({
        pactos: [MAYORIA_REFORZADA_PACTO],
        pactosEval: {
          // sin votosFavor, sin capitalPresente — modo simulación pre-votación
          skipVoteDependentEvaluations: true,
        },
      }),
    );
    // El pacto está aplicable a la materia pero no se evalúa con votos=0;
    // se reporta como WARNING pendiente.
    expect(result.contractual_compliant).toBe(true);
    expect(result.status).toBe("PROCLAMABLE_AND_EXECUTABLE");
    const warning = result.consequences.find(
      (c) => c.consequence === "WARNING" && c.source_id === MAYORIA_REFORZADA_PACTO.id,
    );
    expect(warning).toBeDefined();
    expect(warning?.reason).toContain("Pendiente de evaluar");
  });

  it("CASO 23 — Modo pre-vote: VETO sigue siendo OPERATIONAL_HOLD (no depende de cifras)", () => {
    const result = buildEffectiveAgreementRule(
      input({
        pactos: [VETO_PACTO],
        pactosEval: {
          skipVoteDependentEvaluations: true,
        },
      }),
    );
    // VETO no depende de votos: sigue marcando hold.
    expect(result.status).toBe("PROCLAMABLE_HELD");
    const hold = result.consequences.find((c) => c.consequence === "OPERATIONAL_HOLD");
    expect(hold).toBeDefined();
  });

  it("CASO 21 — Titular del consentimiento: lee de titular_veto del pacto, no del título genérico", () => {
    const result = buildEffectiveAgreementRule(
      input({
        agreement: {
          matter: "AUMENTO_CAPITAL",
          matter_class: "ESTRUCTURAL",
          body_type: "JUNTA",
          adoption_mode: "MEETING",
          inscribable: true,
        },
        pactos: [CONSENTIMIENTO_PACTO], // titular_veto = "Inversor X"
      }),
    );
    expect(result.requirements.consent?.required).toBe(true);
    expect(result.requirements.consent?.from).toContain("Inversor X");
  });
});

// ─── classifyFrozenSnapshot tests ────────────────────────────────────────────

function buildSnapshot(
  overrides: Partial<AgreementNormativeSnapshot> = {},
): AgreementNormativeSnapshot {
  const sources: NormativeSource[] = overrides.sources ?? [
    {
      id: "src-ley",
      layer: "LEY",
      plane: "SOCIETARIO",
      label: "LSC",
      reference: "Real Decreto Legislativo 1/2010",
      version: "2026-01",
      status: "ACTIVE",
      priority: 10,
      source_id: "ruleset-es-sa",
      materia: "GENERAL",
      notes: [],
    },
  ];
  return {
    schema_version: "agreement-normative-snapshot.v1",
    snapshot_id: "snapshot-test",
    profile_id: "profile-test",
    profile_hash: "nf_abcd1234",
    profile_version: "1",
    entity_id: "entity-arga",
    agreement_id: "agreement-test",
    agreement_kind: "MODIFICACION_ESTATUTOS",
    matter_class: "ESTATUTARIA",
    adoption_mode: "MEETING",
    agreement_status: "ADOPTED",
    framework_status: "COMPLETO",
    evaluated_at: "2026-05-08T10:00:00Z",
    sources,
    formalization_requirements: [],
    warnings: [],
    blockers: [],
    rule_trace: {
      jurisdiction_rule_set_ids: ["ruleset-es-sa"],
      rule_pack_version_ids: ["pack-v1"],
      override_ids: [],
      pacto_ids: [],
    },
    ...overrides,
  };
}

describe("classifyFrozenSnapshot", () => {
  it("CASO 24 — Snapshot null/undefined → null (no throw)", () => {
    expect(classifyFrozenSnapshot(null)).toBeNull();
    expect(classifyFrozenSnapshot(undefined)).toBeNull();
  });

  it("CASO 25 — Snapshot COMPLETO sin warnings → PROFILE_OK", () => {
    const result = classifyFrozenSnapshot(buildSnapshot());
    expect(result?.health).toBe("PROFILE_OK");
    expect(result?.profile_blockers_count).toBe(0);
    expect(result?.framework_status).toBe("COMPLETO");
  });

  it("CASO 26 — Snapshot CONFLICTO con blockers → PROFILE_CONFLICT y detail con conteo", () => {
    const result = classifyFrozenSnapshot(
      buildSnapshot({
        framework_status: "CONFLICTO",
        blockers: ["Sociedad sin jurisdicción", "Forma jurídica no normalizada"],
      }),
    );
    expect(result?.health).toBe("PROFILE_CONFLICT");
    expect(result?.profile_blockers_count).toBe(2);
    expect(result?.health_detail).toContain("2 bloqueo");
  });

  it("CASO 27 — Snapshot INCOMPLETO sin blockers → PROFILE_INCOMPLETE con disclaimer explícito", () => {
    const result = classifyFrozenSnapshot(
      buildSnapshot({
        framework_status: "INCOMPLETO",
        warnings: ["Estatutos no estructurados"],
      }),
    );
    expect(result?.health).toBe("PROFILE_INCOMPLETE");
    expect(result?.profile_blockers_count).toBe(0);
    expect(result?.profile_warnings_count).toBe(1);
    // El detail explícitamente aclara que no equivale a invalidez societaria.
    expect(result?.health_detail).toContain("NO equivale a invalidez societaria");
  });

  it("CASO 28 — Capa PACTO_PARASOCIAL ACTIVE en sources → has_pacto_layer=true (no string-matching)", () => {
    const result = classifyFrozenSnapshot(
      buildSnapshot({
        sources: [
          {
            id: "src-ley",
            layer: "LEY",
            plane: "SOCIETARIO",
            label: "LSC",
            reference: null,
            version: null,
            status: "ACTIVE",
            priority: 10,
            source_id: null,
            materia: null,
            notes: [],
          },
          {
            id: "src-pacto",
            layer: "PACTO_PARASOCIAL",
            plane: "CONTRACTUAL",
            label: "Pacto Fundación ARGA",
            reference: null,
            version: null,
            status: "ACTIVE",
            priority: 40,
            source_id: "pacto-1",
            materia: null,
            notes: [],
          },
        ],
      }),
    );
    expect(result?.has_pacto_layer).toBe(true);
    expect(result?.has_estatutos_layer).toBe(false);
    expect(result?.source_layers).toContain("PACTO_PARASOCIAL");
  });

  it("CASO 29 — Capa PACTO_PARASOCIAL con status MISSING NO cuenta como presente", () => {
    const result = classifyFrozenSnapshot(
      buildSnapshot({
        sources: [
          {
            id: "src-pacto",
            layer: "PACTO_PARASOCIAL",
            plane: "CONTRACTUAL",
            label: "Pactos parasociales",
            reference: null,
            version: null,
            status: "MISSING",
            priority: 40,
            source_id: null,
            materia: null,
            notes: [],
          },
        ],
      }),
    );
    expect(result?.has_pacto_layer).toBe(false);
  });

  it("CASO 30 — Formalización: cuenta REQUIRED y CONDITIONAL por separado", () => {
    const result = classifyFrozenSnapshot(
      buildSnapshot({
        formalization_requirements: [
          { kind: "CERTIFICACION", status: "REQUIRED", label: "x", reason: "x", source_layers: ["LEY"] },
          { kind: "LIBRO_ACTAS", status: "REQUIRED", label: "x", reason: "x", source_layers: ["LEY"] },
          { kind: "ESCRITURA_PUBLICA", status: "REQUIRED", label: "x", reason: "x", source_layers: ["LEY"] },
          { kind: "PUBLICACION_SUPERVISOR", status: "CONDITIONAL", label: "x", reason: "x", source_layers: ["LEY"] },
        ],
      }),
    );
    expect(result?.formalization_required_count).toBe(3);
    expect(result?.formalization_conditional_count).toBe(1);
  });

  it("CASO 31 — Snapshot con arrays undefined es resiliente (no NPE)", () => {
    // Acuerdo legacy con shape parcial — guards defensivos deben evitar crash.
    const partial = buildSnapshot();
    const broken = {
      ...partial,
      sources: undefined as unknown as NormativeSource[],
      warnings: undefined as unknown as string[],
      blockers: undefined as unknown as string[],
      formalization_requirements: undefined as unknown as never[],
      rule_trace: undefined as unknown as AgreementNormativeSnapshot["rule_trace"],
    };
    expect(() => classifyFrozenSnapshot(broken as AgreementNormativeSnapshot)).not.toThrow();
    const result = classifyFrozenSnapshot(broken as AgreementNormativeSnapshot);
    expect(result?.profile_blockers_count).toBe(0);
    expect(result?.source_layers).toEqual([]);
    expect(result?.formalization_required_count).toBe(0);
  });
});

describe("classifyPactoConsequence", () => {
  it("pacto que no aplica → NO_EFFECT", () => {
    const out = classifyPactoConsequence({
      pacto_id: "p1",
      pacto_titulo: "x",
      tipo: "VETO",
      aplica: false,
      cumple: true,
      severity: "OK",
      explain: { regla: "x", fuente: "PACTO_PARASOCIAL", resultado: "OK", mensaje: "x" },
    });
    expect(out.consequence).toBe("NO_EFFECT");
    expect(out.remediable).toBe(false);
  });

  it("VETO incumplido en pacto solo → OPERATIONAL_HOLD remediable", () => {
    const out = classifyPactoConsequence({
      pacto_id: "p1",
      pacto_titulo: "x",
      tipo: "VETO",
      aplica: true,
      cumple: false,
      severity: "BLOCKING",
      explain: { regla: "x", fuente: "PACTO_PARASOCIAL", resultado: "BLOCKING", mensaje: "x" },
    });
    expect(out.consequence).toBe("OPERATIONAL_HOLD");
    expect(out.remediable).toBe(true);
  });

  it("VETO incumplido y estatutarizado → VALIDITY_BLOCK", () => {
    const out = classifyPactoConsequence(
      {
        pacto_id: "p1",
        pacto_titulo: "x",
        tipo: "VETO",
        aplica: true,
        cumple: false,
        severity: "BLOCKING",
        explain: { regla: "x", fuente: "PACTO_PARASOCIAL", resultado: "BLOCKING", mensaje: "x" },
      },
      { isStatutoryEnshrined: true },
    );
    expect(out.consequence).toBe("VALIDITY_BLOCK");
    expect(out.remediable).toBe(true);
  });

  it("MAYORIA_REFORZADA_PACTADA incumplida → CONTRACTUAL_BREACH", () => {
    const out = classifyPactoConsequence({
      pacto_id: "p1",
      pacto_titulo: "x",
      tipo: "MAYORIA_REFORZADA_PACTADA",
      aplica: true,
      cumple: false,
      severity: "BLOCKING",
      explain: { regla: "x", fuente: "PACTO_PARASOCIAL", resultado: "BLOCKING", mensaje: "x" },
    });
    expect(out.consequence).toBe("CONTRACTUAL_BREACH");
    expect(out.remediable).toBe(true);
  });

  it("CONSENTIMIENTO_INVERSOR no obtenido → OPERATIONAL_HOLD", () => {
    const out = classifyPactoConsequence({
      pacto_id: "p1",
      pacto_titulo: "x",
      tipo: "CONSENTIMIENTO_INVERSOR",
      aplica: true,
      cumple: false,
      severity: "BLOCKING",
      explain: { regla: "x", fuente: "PACTO_PARASOCIAL", resultado: "BLOCKING", mensaje: "x" },
    });
    expect(out.consequence).toBe("OPERATIONAL_HOLD");
    expect(out.remediable).toBe(true);
  });
});
