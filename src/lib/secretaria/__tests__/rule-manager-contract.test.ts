import { describe, expect, it } from "vitest";
import {
  buildEffectiveAgreementRule,
  classifyPactoConsequence,
  type RuleManagerInput,
} from "../rule-manager-contract";
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
