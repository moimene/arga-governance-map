import { describe, expect, it } from "vitest";
import {
  assertRegistryRpcResult,
  canRegistryTransition,
  statusForQualification,
} from "../registry-lifecycle";

describe("registry lifecycle v2", () => {
  it("distingue los recorridos por documento de base", () => {
    expect(canRegistryTransition("PREPARADA", "ELEVADA", "ESCRITURA")).toBe(true);
    expect(canRegistryTransition("PREPARADA", "ELEVADA", "INSTANCIA")).toBe(false);
    expect(canRegistryTransition("PREPARADA", "PRESENTADA", "INSTANCIA")).toBe(true);
    expect(canRegistryTransition("PREPARADA", "PRESENTADA", "CERTIFICACION")).toBe(true);
  });

  it("permite ciclos de suspensión y subsanación sin convertirlos en denegación", () => {
    expect(statusForQualification("SUSPENSION_SUBSANABLE")).toBe("SUBSANACION");
    expect(statusForQualification("DENEGACION")).toBe("DENEGADA");
    expect(statusForQualification("POSITIVA")).toBe("PRESENTADA");
    expect(canRegistryTransition("SUBSANACION", "PRESENTADA", "INSTANCIA")).toBe(true);
  });

  it("rechaza el éxito aparente cuando la RPC no confirma exactamente una fila", () => {
    expect(() => assertRegistryRpcResult({ affected_count: 0 })).toThrow(/exactamente una fila/i);
    expect(() => assertRegistryRpcResult({ affected_count: 2 })).toThrow(/exactamente una fila/i);
    expect(() => assertRegistryRpcResult({ affected_count: 1, filing_id: "filing-1", status: "PRESENTADA" }))
      .not.toThrow();
  });
});
