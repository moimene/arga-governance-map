import { describe, expect, it, vi } from "vitest";
import { createEmptySociedadDraft } from "../defaults";
import {
  buildInitialBodies,
  buildInitialCapTable,
  buildInitialCapitalStructure,
  buildRpcPayload,
  deriveCapitalPct,
} from "../builders";
import type { PersonaDraft, SociedadOnboardingDraft } from "../types";

vi.spyOn(Date, "now").mockReturnValue(1770000000000);

function pf(key: string, tax = key): PersonaDraft {
  return { key, tax_id: tax, full_name: `Persona ${key}`, person_type: "PF" };
}

function draftBase(): SociedadOnboardingDraft {
  const draft = createEmptySociedadDraft("2026-05-12");
  draft.identification = {
    ...draft.identification,
    legal_name: "ARGA Nueva, S.A.",
    common_name: "ARGA Nueva",
    tax_id: "A-D6",
    tipo_social: "SA",
    jurisdiction: "ES",
  };
  draft.registry = {
    ...draft.registry,
    address_street: "Paseo de la Castellana",
    address_number: "10",
    postal_code: "28046",
    city: "Madrid",
    country: "ES",
    cnae_primary: "6512",
    registry_location: "Madrid",
    registry_volume: "1000",
    registry_folio: "20",
    registry_sheet: "M-123456",
    registry_inscription: "1",
  };
  draft.capital = {
    ...draft.capital,
    capital_escriturado: "60000",
    capital_desembolsado: "60000",
    numero_titulos: "60000",
    valor_nominal: "1",
  };
  draft.shareClasses = [
    {
      key: "A",
      class_code: "A",
      name: "Clase A",
      numero_titulos: "60000",
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
      holder: pf("ACC1", "11111111A"),
      share_class_code: "A",
      numero_titulos: "60000",
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
  ];
  return draft;
}

describe("sociedad onboarding builders", () => {
  it("does not force an ORD share class", () => {
    const draft = draftBase();
    draft.shareClasses[0].class_code = "SERIE_A";

    const capital = buildInitialCapitalStructure(draft);

    expect(capital.share_classes).toHaveLength(1);
    expect(capital.share_classes[0].class_code).toBe("SERIE_A");
    expect(capital.share_classes.some((item) => item.class_code === "ORD")).toBe(false);
  });

  it("derives capital percentage from titles", () => {
    expect(deriveCapitalPct("30", "120")).toBe(25);
    expect(deriveCapitalPct("30", "0")).toBeNull();
  });

  it("maps cap table holders by local key and handles treasury separately", () => {
    const draft = draftBase();
    draft.capTable.push({
      key: "treasury",
      holder: null,
      share_class_code: "A",
      numero_titulos: "0",
      voting_rights: false,
      is_treasury: true,
    });

    const capTable = buildInitialCapTable(draft);

    expect(capTable.socios).toHaveLength(1);
    expect(capTable.capital_holdings[0].holder_key).toBe("ACC1");
    expect(capTable.capital_holdings[1].holder_key).toBe("__TREASURY__");
    expect(capTable.capital_holdings[1].voting_rights).toBe(false);
  });

  it("builds Junta and Consejo bodies with stable body keys", () => {
    const bodies = buildInitialBodies(draftBase(), "arga-nueva");

    expect(bodies.map((body) => body.body_key)).toEqual(["JUNTA", "CDA"]);
    expect(bodies[0].body_type).toBe("JUNTA");
    expect(bodies[1].body_type).toBe("CDA");
  });

  it("never sends OPERATIVA in TX1 payload", () => {
    const payload = buildRpcPayload(draftBase(), new Set());

    expect(payload.entity.onboarding_status).toBe("INCOMPLETA_CARGOS");
  });

  it("sends INCOMPLETA_DATOS when operational blockers remain", () => {
    const draft = draftBase();
    draft.registry.address_number = "";

    const payload = buildRpcPayload(draft, new Set());

    expect(payload.entity.onboarding_status).toBe("INCOMPLETA_DATOS");
  });

  it("keeps legal entity fields aligned with migration 000067", () => {
    const payload = buildRpcPayload(draftBase(), new Set(["quorum_primera_pct"]));

    expect(payload.entity).toMatchObject({
      registry_location: "Madrid",
      registry_volume: "1000",
      registry_folio: "20",
      registry_sheet: "M-123456",
      registry_inscription: "1",
      cnae_primary: "6512",
      address: "Paseo de la Castellana, 10, 28046, Madrid, ES",
    });
    expect(payload.entity_settings).toEqual([{ key: "quorum_primera_pct", value: 50 }]);
  });
});
