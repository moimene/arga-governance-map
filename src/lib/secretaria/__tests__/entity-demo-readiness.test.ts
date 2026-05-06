import { describe, expect, it } from "vitest";
import {
  classifyEntityDemoReadiness,
  demoReadinessMessage,
  inferAgreementScopePatch,
} from "../entity-demo-readiness";

describe("classifyEntityDemoReadiness", () => {
  it("classifies complete when the entity has the minimum operational contract", () => {
    const result = classifyEntityDemoReadiness({
      capitalHoldings: [{ porcentaje_capital: 60, effective_to: null }, { porcentaje_capital: 40, effective_to: null }],
      governingBodies: [{ id: "body-1" }],
      activePositions: [{ id: "cargo-1" }],
      authorityEvidence: [{ id: "auth-1" }],
      compatibleTemplates: [{ id: "tpl-1" }],
      meetings: [{ id: "meeting-1" }],
      censusSnapshots: [{ id: "censo-1" }],
    });

    expect(result).toEqual({ status: "complete", reasons: [] });
  });

  it("classifies partial when only non-blocking demo gaps remain", () => {
    const result = classifyEntityDemoReadiness({
      capitalHoldings: [{ porcentaje_capital: 100, effective_to: null }],
      governingBodies: [{ id: "body-1" }],
      activePositions: [{ id: "cargo-1" }],
      authorityEvidence: [{ id: "auth-1" }],
      compatibleTemplates: [],
      meetings: [{ id: "meeting-1" }],
      censusSnapshots: [],
    });

    expect(result.status).toBe("partial");
    expect(result.reasons).toEqual(["no_compatible_templates", "no_census"]);
  });

  it("classifies reference_only when hard operational sources are missing", () => {
    const result = classifyEntityDemoReadiness({
      capitalHoldings: [],
      governingBodies: [],
      activePositions: [],
      authorityEvidence: [],
      compatibleTemplates: [],
    });

    expect(result.status).toBe("reference_only");
    expect(demoReadinessMessage(result)).toContain("Esta sociedad aún no tiene censo/órgano/cargos suficientes");
  });
});

describe("inferAgreementScopePatch", () => {
  const bodies = [
    { id: "junta-a", entity_id: "entity-a", body_type: "JUNTA", name: "Junta General" },
    { id: "cda-a", entity_id: "entity-a", body_type: "CDA", name: "Consejo de Administración" },
    { id: "junta-b", entity_id: "entity-b", body_type: "JUNTA", name: "Junta General" },
  ];

  it("infers entity_id/body_id from parent meeting when unique", () => {
    const result = inferAgreementScopePatch({
      agreement: { id: "agr-1", parent_meeting_id: "meeting-1" },
      bodies,
      meetings: [{ id: "meeting-1", body_id: "cda-a" }],
      targetEntityId: "entity-a",
    });

    expect(result).toEqual({
      ok: true,
      patch: { entity_id: "entity-a", body_id: "cda-a" },
      source: "parent_meeting_id",
    });
  });

  it("refuses a cross-entity inference", () => {
    const result = inferAgreementScopePatch({
      agreement: { id: "agr-1", parent_meeting_id: "meeting-1" },
      bodies,
      meetings: [{ id: "meeting-1", body_id: "junta-b" }],
      targetEntityId: "entity-a",
    });

    expect(result).toMatchObject({ ok: false, reason: "conflict" });
  });

  it("does not infer when compatible bodies are ambiguous", () => {
    const result = inferAgreementScopePatch({
      agreement: { id: "agr-1", entity_id: "entity-a", adoption_mode: "NO_SESSION", agreement_kind: "APROBACION_CUENTAS" },
      bodies: [
        ...bodies,
        { id: "junta-a-2", entity_id: "entity-a", body_type: "JUNTA", name: "Junta General de Accionistas" },
      ],
      targetEntityId: "entity-a",
    });

    expect(result).toMatchObject({ ok: false, reason: "ambiguous" });
  });
});
