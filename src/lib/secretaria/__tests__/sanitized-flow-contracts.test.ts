import { describe, expect, it } from "vitest";
import {
  getSecretariaSanitizedFlowContract,
  SECRETARIA_SANITIZED_FLOW_CONTRACTS,
  summarizeSecretariaSanitizedFlows,
} from "../sanitized-flow-contracts";

describe("sanitized-flow-contracts", () => {
  it("declara los ocho flujos exigidos por sanitizacion Secretaria", () => {
    expect(SECRETARIA_SANITIZED_FLOW_CONTRACTS.map((flow) => flow.id)).toEqual([
      "agreement-360",
      "convocatorias",
      "reuniones",
      "actas",
      "certificaciones",
      "gestor-documental",
      "plantillas-pre",
      "board-pack",
    ]);
  });

  it("no requiere migraciones, tipos ni RLS/RPC/storage para ningun flujo", () => {
    for (const flow of SECRETARIA_SANITIZED_FLOW_CONTRACTS) {
      expect(flow.sourceOfTruth).toBe("Cloud");
      expect(flow.migrationRequired).toBe(false);
      expect(flow.typesAffected).toBe(false);
      expect(flow.rlsRpcStorageAffected).toBe(false);
      expect(flow.ownerTables).not.toContain("grc_evidence_legal_hold");
      expect(flow.sharedTables).not.toContain("grc_evidence_legal_hold");
    }
  });

  it("mantiene Board Pack como lectura compuesta sin ownership GRC/AIMS", () => {
    const boardPack = getSecretariaSanitizedFlowContract("board-pack");

    expect(boardPack?.ownerTables).toEqual([]);
    expect(boardPack?.sharedTables).toContain("incidents");
    expect(boardPack?.sharedTables).toContain("ai_systems");
    expect(boardPack?.parityRisk).toBe("high");
    expect(boardPack?.notes).toContain("lectura compuesta");
  });

  it("resume el estado de demo sin marcar bloqueos de schema", () => {
    const summary = summarizeSecretariaSanitizedFlows();

    expect(summary.total).toBe(8);
    expect(summary.ready).toBeGreaterThanOrEqual(4);
    expect(summary.blocked).toBe(0);
    expect(summary.highRisk).toBe(1);
  });
});
