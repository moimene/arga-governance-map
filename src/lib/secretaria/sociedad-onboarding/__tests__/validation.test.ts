import { describe, expect, it } from "vitest";
import { createEmptySociedadDraft } from "../defaults";
import { validateSociedadOperability, validateStep } from "../validation";
import type { PersonaDraft, SociedadOnboardingDraft } from "../types";

function pf(key: string, tax = key): PersonaDraft {
  return { key, tax_id: tax, full_name: `Persona ${key}`, person_type: "PF" };
}

function pj(key: string, tax = key): PersonaDraft {
  return { key, tax_id: tax, full_name: `Sociedad ${key}`, denomination: `Sociedad ${key}`, person_type: "PJ" };
}

function completeDraft(): SociedadOnboardingDraft {
  const draft = createEmptySociedadDraft("2026-05-12");
  draft.identification = {
    ...draft.identification,
    legal_name: "ARGA Pruebas, S.L.",
    common_name: "ARGA Pruebas",
    tax_id: "B-TEST-D6",
    tipo_social: "SL",
    jurisdiction: "ES",
  };
  draft.registry = {
    ...draft.registry,
    address_street: "Calle Serrano",
    address_number: "1",
    postal_code: "28001",
    city: "Madrid",
    country: "ES",
    cnae_primary: "6512",
  };
  draft.capital = {
    ...draft.capital,
    capital_escriturado: "3000",
    capital_desembolsado: "3000",
    numero_titulos: "3000",
    valor_nominal: "1",
  };
  draft.shareClasses = [
    {
      key: "A",
      class_code: "A",
      name: "Clase A",
      numero_titulos: "3000",
      votes_per_title: "1",
      economic_rights_coeff: "1",
      voting_rights: true,
      veto_rights: false,
      restrictions: {},
    },
  ];
  draft.capTable = [
    {
      key: "h1",
      holder: pf("PF1", "11111111A"),
      share_class_code: "A",
      numero_titulos: "3000",
      voting_rights: true,
      is_treasury: false,
    },
  ];
  draft.cargos = [
    {
      key: "presidente",
      tipo_condicion: "PRESIDENTE",
      bodyKey: "CDA",
      persona: pf("PRES", "22222222B"),
      fecha_inicio: "2026-05-12",
      fuente_designacion: "ESCRITURA",
    },
    {
      key: "secretario",
      tipo_condicion: "SECRETARIO",
      bodyKey: "CDA",
      persona: pf("SEC", "33333333C"),
      fecha_inicio: "2026-05-12",
      fuente_designacion: "ESCRITURA",
    },
    // Tercer board member para satisfacer CA-004 con consejo_min=3 default.
    {
      key: "consejero1",
      tipo_condicion: "CONSEJERO",
      bodyKey: "CDA",
      persona: pf("CONS1", "44444444D"),
      fecha_inicio: "2026-05-12",
      fuente_designacion: "ESCRITURA",
    },
  ];
  return draft;
}

describe("sociedad onboarding validation", () => {
  it("accepts a complete operational draft without blocking issues", () => {
    const result = validateSociedadOperability(completeDraft());

    expect(result.blocking).toHaveLength(0);
    expect(result.blockingOperational).toHaveLength(0);
  });

  it("blocks SAU/SLU with more than one non-treasury holder", () => {
    const draft = completeDraft();
    draft.identification.tipo_social = "SLU";
    draft.profile.es_unipersonal = true;
    draft.capTable = [
      { ...draft.capTable[0], holder: pf("PF1", "11111111A"), numero_titulos: "1500" },
      { ...draft.capTable[0], key: "h2", holder: pf("PF2", "22222222B"), numero_titulos: "1500" },
    ];

    const result = validateSociedadOperability(draft);

    expect(result.blocking.some((item) => item.code === "CT-004")).toBe(true);
  });

  it("warns, but does not block, when an SA/SL has a single holder and is not marked unipersonal", () => {
    const result = validateSociedadOperability(completeDraft());

    expect(result.blocking.some((item) => item.code === "CT-005")).toBe(false);
    expect(result.warnings.some((item) => item.code === "CT-005")).toBe(true);
  });

  it("warns for PJ shareholder with voting rights and no junta proxy", () => {
    const draft = completeDraft();
    draft.capTable[0] = { ...draft.capTable[0], holder: pj("PJ1", "B11111111") };

    const result = validateSociedadOperability(draft);

    expect(result.warnings.some((item) => item.code === "P-001")).toBe(true);
    expect(result.blocking.some((item) => item.code === "P-001")).toBe(false);
  });

  it("blocks class over-allocation", () => {
    const draft = completeDraft();
    draft.shareClasses[0].numero_titulos = "1000";
    draft.capTable[0].numero_titulos = "3000";

    const result = validateSociedadOperability(draft);

    expect(result.blocking.some((item) => item.code === "CL-002")).toBe(true);
    expect(result.blocking.some((item) => item.code === "CT-003")).toBe(true);
  });

  it("blocks ADMIN_PJ without permanent PF representative", () => {
    const draft = completeDraft();
    draft.profile.tipo_organo_admin = "ADMIN_UNICO";
    draft.profile.forma_administracion = "ADMINISTRADOR_UNICO";
    draft.cargos = [
      {
        key: "admin-pj",
        tipo_condicion: "ADMIN_PJ",
        bodyKey: null,
        persona: pj("ADMINPJ", "B22222222"),
        fecha_inicio: "2026-05-12",
        fuente_designacion: "ESCRITURA",
      },
    ];

    const result = validateSociedadOperability(draft);

    expect(result.blocking.some((item) => item.code === "PJ-001")).toBe(true);
  });

  it("blocks reinforced majority below simple majority", () => {
    const draft = completeDraft();
    draft.rules.mayoria_simple_pct = "60";
    draft.rules.mayoria_reforzada_pct = "55";

    const result = validateSociedadOperability(draft);

    expect(result.blocking.some((item) => item.code === "R-001")).toBe(true);
  });

  it("treats incomplete address and missing CNAE as operational blockers", () => {
    const draft = completeDraft();
    draft.registry.address_number = "";
    draft.registry.cnae_primary = "";

    const result = validateSociedadOperability(draft);

    expect(result.blockingOperational.map((item) => item.code)).toEqual(expect.arrayContaining(["S-005", "S-006"]));
    expect(validateStep(draft, 1).ok).toBe(true);
  });
});
