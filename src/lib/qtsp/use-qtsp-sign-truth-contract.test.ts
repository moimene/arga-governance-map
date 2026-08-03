import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/hooks/useQTSPSign.ts"),
  "utf8",
);

describe("useQTSPSign truth boundary", () => {
  it("retira el iniciador genérico de firma y no llama a ningún adaptador externo", () => {
    expect(source).toContain("La firma electrónica genérica está retirada");
    expect(source).toContain("throw new Error(RETIRED_SIGN_MESSAGE)");
    expect(source).not.toContain("executeEADSignFlow(");
    expect(source).not.toContain("invokeQTSPProxySign(");
    expect(source).not.toContain("persistSignatureRequest(");
  });

  it("limita el contrato residual al modo INTERPOSITION sin afirmar firma", () => {
    expect(source).toContain('providerSignatureType?: "INTERPOSITION"');
    expect(source).toContain("signatureProduced?: false");
    expect(source).toContain("signed_at: null");
    expect(source).not.toMatch(/providerSignatureType\?:\s*["'](?:QES|ADVANCED|SIMPLE)["']/);
  });

  it("retira también la mensajería genérica en favor del flujo source-bound", () => {
    expect(source).toContain("La mensajería genérica está retirada");
    expect(source).toContain("throw new Error(CONTROLLED_MESSAGE)");
    expect(source).toContain("deliveryRef: null");
    expect(source).toContain("deliveredAt: null");
    expect(source).toContain("deliveryProven: false");
  });
});
