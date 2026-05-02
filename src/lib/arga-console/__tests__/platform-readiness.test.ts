import { describe, expect, it } from "vitest";
import { consoleDataContracts, consoleJourneys } from "../contracts";
import {
  getPlatformReadinessLane,
  getPlatformReadinessSummary,
  platformReadinessLanes,
} from "../platform-readiness";

describe("platform-readiness", () => {
  it("declara los cinco carriles ejecutivos de plataforma", () => {
    expect(platformReadinessLanes.map((lane) => lane.id)).toEqual([
      "secretaria",
      "grc",
      "aims",
      "integration",
      "evidence",
    ]);
  });

  it("mantiene GRC y AIMS en lectura sin migracion requerida", () => {
    const grc = getPlatformReadinessLane("grc");
    const aims = getPlatformReadinessLane("aims");

    expect(grc?.status).toBe("read_only");
    expect(grc?.sourcePosture).toBe("legacy");
    expect(grc?.migrationRequired).toBe(false);
    expect(aims?.status).toBe("read_only");
    expect(aims?.sourcePosture).toBe("legacy");
    expect(aims?.migrationRequired).toBe(false);
  });

  it("referencia contratos conocidos sin habilitar writes cross-module", () => {
    const knownContractIds = new Set(consoleDataContracts.map((contract) => contract.id));

    for (const lane of platformReadinessLanes) {
      expect(lane.contractIds.length).toBeGreaterThan(0);
      for (const contractId of lane.contractIds) {
        expect(knownContractIds.has(contractId)).toBe(true);
      }
    }

    expect(getPlatformReadinessLane("grc")?.contractIds).toContain("cross-module-contracts");
    expect(getPlatformReadinessLane("aims")?.contractIds).toContain("cross-module-contracts");
    expect(getPlatformReadinessLane("integration")?.sourcePosture).toBe("none");
    expect(getPlatformReadinessLane("integration")?.migrationRequired).toBe(false);
  });

  it("mantiene el bloque probatorio en HOLD y sin evidencia final productiva", () => {
    const evidence = getPlatformReadinessLane("evidence");
    const evidenceContract = consoleDataContracts.find((contract) => contract.id === "evidence-spine");

    expect(evidence?.status).toBe("hold");
    expect(evidence?.summary).toContain("000049");
    expect(evidence?.migrationRequired).toBe(false);
    expect(evidence?.finalEvidence).toBe(false);
    expect(evidenceContract?.evidence).toBe("pending");
    expect(evidenceContract?.parityRisk).toContain("000049");
  });

  it("routes cross-module journeys through owner screens without enabling writes", () => {
    const grcToSecretaria = consoleJourneys.find((journey) => journey.id === "grc-incident-secretaria-agenda");
    const aimsToGrc = consoleJourneys.find((journey) => journey.id === "aims-finding-grc-control");
    const aimsToSecretaria = consoleJourneys.find((journey) => journey.id === "aims-incident-secretaria-escalation");
    const secretariaToAims = consoleJourneys.find((journey) => journey.id === "secretaria-certification-evidence");

    expect(grcToSecretaria?.targetRoute).toContain("/secretaria/reuniones/nueva");
    expect(grcToSecretaria?.mutationHandoff).toContain("Read-only route handoff");
    expect(aimsToGrc?.targetRoute).toContain("/grc/risk-360");
    expect(aimsToGrc?.mutationHandoff).toContain("Read-only route handoff");
    expect(aimsToSecretaria?.targetRoute).toContain("/secretaria/reuniones/nueva");
    expect(aimsToSecretaria?.mutationHandoff).toContain("Read-only route handoff");
    expect(secretariaToAims?.targetRoute).toContain("evidence=REFERENCE");
    expect(secretariaToAims?.evidencePosture).toBe("reference");
  });

  it("resume la plataforma sin abrir paquete schema", () => {
    const summary = getPlatformReadinessSummary();

    expect(summary.total).toBe(5);
    expect(summary.operational).toBe(1);
    expect(summary.read_only).toBe(2);
    expect(summary.pending).toBe(1);
    expect(summary.hold).toBe(1);
    expect(summary.migrationRequired).toBe(0);
    expect(summary.finalEvidence).toBe(0);
  });
});
