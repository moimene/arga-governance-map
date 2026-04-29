import { describe, expect, it } from "vitest";
import {
  argaDemoPackEntities,
  assertQTSPDemoGuard,
  buildDemoRunScenarioResponse,
  demoScenarioDefinitions,
  qtspApiContract,
  runAllDemoScenarios,
  runDemoScenario,
} from "../index";

describe("demo-operable scenario runner", () => {
  it("returns one deterministic sandbox run per ARGA sales scenario", () => {
    const runs = runAllDemoScenarios();

    expect(runs).toHaveLength(5);
    expect(runs.map((run) => run.scenario.id)).toEqual(demoScenarioDefinitions.map((scenario) => scenario.id));

    for (const run of runs) {
      expect(run.demoMode).toBe(true);
      expect(run.simulated).toBe(true);
      expect(run.sandbox).toBe(true);
      expect(run.readonly).toBe(true);
      expect(run.status).toBe("COMPLETED");
      expect(run.sourceOfTruth).toBe("none");
      expect(run.mutationAllowed).toBe(false);
      expect(run.externalDependenciesEnabled).toBe(false);
      expect(run.outcome).toBe(run.expectedOutcome);
      expect(run.evidence.sandbox).toBe(true);
      expect(run.evidence.finalEvidence).toBe(false);
      expect(run.evidence.filingPrevented).toBe(true);
      expect(run.evidence.productiveQtspPrevented).toBe(true);
      expect(run.evidence.signatureLevel).toBe("QES_SANDBOX");
      expect(run.evidence.timestampLevel).toBe("TSQ_SANDBOX");
      expect(run.trust.provider).toBe("EAD_TRUST_SANDBOX");
      expect(run.evidence.integrity).toBe(run.outcome === "ADOPTADO" ? "VALID" : "NOT_APPLICABLE");
      expect(run.evidence.authority).toBe(run.outcome === "ADOPTADO" ? "VALID" : "NOT_APPLICABLE");
      expect(run.evidence.posture).toBe(run.outcome === "ADOPTADO" ? "SANDBOX_VERIFIABLE" : "SANDBOX_STUB");
      expect(run.explain.why.length).toBeGreaterThan(0);
      expect(run.explain.legalBasis.length).toBeGreaterThan(0);
      expect(run.hashes.outputHash).toMatch(/^sandbox_[a-f0-9]{8}$/);
      expect(run.steps.map((step) => step.id)).toEqual([
        "CONVOCATORIA",
        "SESION",
        "GATE",
        "ACTA",
        "CERTIFICACION",
        "EVIDENCIA",
      ]);
    }
  });

  it("keeps expected legal outcomes stable for the commercial pack", () => {
    expect(runDemoScenario("JUNTA_UNIVERSAL_OK").outcome).toBe("ADOPTADO");
    expect(runDemoScenario("CONFLICTO_EXCLUSION_OK").outcome).toBe("ADOPTADO");
    expect(runDemoScenario("JUNTA_UNIVERSAL_FAIL_99").outcome).toBe("BLOQUEADO");
    expect(runDemoScenario("VETO_BLOCK").outcome).toBe("BLOQUEADO");
    expect(runDemoScenario("DOBLE_UMBRAL_FAIL").outcome).toBe("BLOQUEADO");
  });

  it("exposes blocking gate details for veto and double-threshold scenarios", () => {
    const veto = runDemoScenario("VETO_BLOCK");
    const doubleThreshold = runDemoScenario("DOBLE_UMBRAL_FAIL");

    expect(veto.gatePreview.estado).toBe("BLOCK");
    expect(veto.gatePreview.detalles.veto_ok).toBe(false);
    expect(veto.gatePreviewUi.vetoOk).toBe(false);
    expect(veto.explain.why.join(" ")).toContain("veto");
    expect(veto.evidence.integrity).toBe("NOT_APPLICABLE");
    expect(veto.evidence.posture).toBe("SANDBOX_STUB");

    expect(doubleThreshold.gatePreview.estado).toBe("BLOCK");
    expect(doubleThreshold.gatePreview.detalles.doble_umbral_ok).toBe(false);
    expect(doubleThreshold.gatePreviewUi.classThresholdOk).toBe(false);
    expect(doubleThreshold.explain.why.join(" ")).toContain("doble umbral");
    expect(doubleThreshold.evidence.integrity).toBe("NOT_APPLICABLE");
  });

  it("keeps conflict-exclusion scenario aligned with a collegial board body", () => {
    const response = buildDemoRunScenarioResponse({ scenario: "CONFLICTO_EXCLUSION_OK" });

    expect(response.entity_context.entity_name).toBe("ARGA Seguros S.A.");
    expect(response.entity_context.body_name).toBe("Consejo de Administracion");
  });

  it("is deterministic across repeated runs", () => {
    expect(runDemoScenario("JUNTA_UNIVERSAL_OK")).toEqual(runDemoScenario("JUNTA_UNIVERSAL_OK"));
  });

  it("changes deterministic hashes when scenario_run_id changes", () => {
    const first = runDemoScenario("JUNTA_UNIVERSAL_OK", { scenarioRunId: "run-a" });
    const second = runDemoScenario("JUNTA_UNIVERSAL_OK", { scenarioRunId: "run-b" });

    expect(first).toEqual(runDemoScenario("JUNTA_UNIVERSAL_OK", { scenarioRunId: "run-a" }));
    expect(first.hashes.outputHash).not.toBe(second.hashes.outputHash);
    expect(first.ids.evidenceBundleId).not.toBe(second.ids.evidenceBundleId);
  });

  it("exposes Sprint 2 API-compatible response with ARGA demo pack context", () => {
    const response = buildDemoRunScenarioResponse({ scenario: "JUNTA_UNIVERSAL_OK" });

    expect({
      agreement_result: response.agreement_result,
      demo_mode: response.demo_mode,
      demo_pack_version: response.demo_pack_version,
      entity_context: response.entity_context,
      evidence_posture: response.explain.evidence_posture,
      finalEvidence: response.evidence.finalEvidence,
      gate_estado: response.gate_preview.estado,
      owner: response.owner,
      scenario: response.scenario,
      source_of_truth: response.source_of_truth,
      trust_provider: response.trust.provider,
      trust_center_provider: response.trust_center.provider,
      trust_center_mode: response.trust_center.mode,
    }).toMatchInlineSnapshot(`
      {
        "agreement_result": "ADOPTADO",
        "demo_mode": true,
        "demo_pack_version": "ARGA_DEMO_PACK_V1",
        "entity_context": {
          "body_id": "demo-body-cda-arga-seguros",
          "body_name": "Consejo de Administracion",
          "entity_id": "demo-entity-arga-seguros-sa",
          "entity_kind": "SA_COTIZADA",
          "entity_name": "ARGA Seguros S.A.",
        },
        "evidence_posture": "SANDBOX_VERIFIABLE",
        "finalEvidence": false,
        "gate_estado": "OK",
        "owner": "Secretaría Societaria",
        "scenario": "JUNTA_UNIVERSAL_OK",
        "source_of_truth": "none",
        "trust_center_mode": "SANDBOX",
        "trust_center_provider": "EAD Trust",
        "trust_provider": "EAD_TRUST_SANDBOX",
      }
    `);
  });

  it("keeps gate preview aligned with final outcome", () => {
    for (const run of runAllDemoScenarios()) {
      expect(run.gatePreview.estado === "OK").toBe(run.outcome === "ADOPTADO");
    }
  });

  it("keeps Demo Pack ARGA scoped to SA, SL and SLU fixtures", () => {
    expect(argaDemoPackEntities.map((entity) => entity.kind).sort()).toEqual(["SA_COTIZADA", "SL", "SLU"]);
  });

  it("documents QTSP API contract while blocking productive calls in demo", () => {
    expect(qtspApiContract.secretHandling).toBe("never in browser");
    expect(qtspApiContract.requiredEnvKeys).toContain("OKTA_CLIENT_SECRET");
    expect(qtspApiContract.endpoints.map((endpoint) => endpoint.id)).toEqual([
      "create-signature-request",
      "add-document",
      "add-signatory",
      "activate-signature-request",
      "create-evidence",
      "get-evidence",
    ]);
    expect(() => assertQTSPDemoGuard(true, "productive")).toThrow("Demo mode blocks productive");
    expect(() => assertQTSPDemoGuard(true, "sandbox")).not.toThrow();
  });
});
