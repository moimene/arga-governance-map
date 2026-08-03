import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/pages/secretaria/ActaDetalle.tsx"),
  "utf8",
);

describe("ActaDetalle · ciclo EAD explícito", () => {
  it("no archiva ni contacta servicios externos al generar candidatos autoritativos", () => {
    const archiveDisabled = source.match(/archive:\s*false/g) ?? [];
    expect(archiveDisabled).toHaveLength(2);
    expect(source).toContain("setActaCandidate(result.candidate)");
    expect(source).toContain("[c.id]: result.candidate");
  });

  it("monta controles separados para acta y certificación con hash de dominio", () => {
    expect(source).toContain('sourceDomain="MINUTE"');
    expect(source).toContain("domainContentHash={m.content_hash}");
    expect(source).toContain('sourceDomain="CERTIFICATION"');
    expect(source).toContain("domainContentHash={c.content_hash_sha256}");
  });

  it("bloquea EAD y fuerza aviso visible en toda exportación DEMO_SIMULATION", () => {
    expect(source).toContain('isDemoSimulation={legalGateStatus === "DEMO_SIMULATION"}');
    expect(source).toContain('isDemoSimulation={c.legal_gate_status === "DEMO_SIMULATION"}');
    expect(source.match(/mandatoryVisibleNotice:/g)).toHaveLength(2);
    expect(source).toContain("DEMO_SIMULATION_NO_LEGAL_EFFECT_NOTICE");
    expect(source).toContain("SIMULACION_DEMO_SIN_EFECTOS_JURIDICOS");
    expect(source).toContain('c.legal_gate_status !== "DEMO_SIMULATION"');
  });
});
