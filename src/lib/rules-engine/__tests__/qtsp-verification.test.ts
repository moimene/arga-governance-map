import { describe, expect, it } from "vitest";
import {
  verificarIntegridad,
  verificarOCSP,
  type IntegrityCheckDetail,
  type VerifiableArtifact,
} from "../qtsp-integration";
import type { ExplainNode } from "../types";

describe("verificarIntegridad · política EAD sin firma personal", () => {
  const AGREEMENT_ID = "550e8400-e29b-41d4-a716-446655440000";
  const SHA512 =
    "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e";

  describe("artefactos no personales", () => {
    it("acepta integridad, sello de entidad y sello de tiempo válidos", () => {
      const artifacts: VerifiableArtifact[] = [
        {
          type: "HASH",
          ref: "documento-custodiado",
          hash: SHA512,
          timestamp: "2026-04-19T10:30:00Z",
        },
        {
          type: "QSEAL",
          ref: "sello-entidad",
          hash: "ghi789jkl012",
          timestamp: "2026-04-19T10:30:05Z",
        },
        {
          type: "TSQ",
          ref: "sello-tiempo",
          hash: "mno345pqr678",
          timestamp: "2026-04-19T10:30:10Z",
        },
      ];

      const result = verificarIntegridad(AGREEMENT_ID, artifacts);

      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.checks.every((check) => check.passed)).toBe(true);
      expect(result.checks.some((check) => check.type === "QES")).toBe(false);
      expect(result.checks.some((check) => check.type === "QSEAL")).toBe(true);
      expect(result.checks.some((check) => check.type === "TSQ")).toBe(true);
    });
  });

  describe("integridad del hash", () => {
    it("falla si falta el hash", () => {
      const result = verificarIntegridad(AGREEMENT_ID, [
        { type: "HASH", ref: "sin-hash", hash: "" },
      ]);

      expect(result.ok).toBe(false);
      expect(result.checks.find((check) => check.type === "HASH")?.passed).toBe(false);
      expect(result.errors).toContain("Hash inválido o faltante para artefacto sin-hash");
    });

    it("rechaza URI sentinela y fragmentos demasiado cortos", () => {
      const uri = verificarIntegridad(AGREEMENT_ID, [
        {
          type: "HASH",
          ref: "uri",
          hash: "evidence-bundle://tenant/doc.docx",
        },
      ]);
      const short = verificarIntegridad(AGREEMENT_ID, [
        { type: "HASH", ref: "short", hash: "abc" },
      ]);

      expect(uri.ok).toBe(false);
      expect(uri.checks[0].detail.toLowerCase()).toContain("formato inválido");
      expect(short.ok).toBe(false);
      expect(short.checks[0].passed).toBe(false);
    });

    it("acepta un SHA-512 real", () => {
      const result = verificarIntegridad(AGREEMENT_ID, [
        { type: "HASH", ref: "sha512", hash: SHA512 },
      ]);

      expect(result.ok).toBe(true);
      expect(result.checks[0].passed).toBe(true);
    });
  });

  describe("referencias QES históricas", () => {
    it("nunca eleva una fila QES a evidencia canónica", () => {
      const result = verificarIntegridad(AGREEMENT_ID, [
        {
          type: "QES",
          ref: "legacy-qes",
          hash: "abc123def456",
          signer_id: "00000000-0000-4000-b000-000000000001",
          signer_role: "SECRETARIO",
          timestamp: "2026-04-19T10:30:00Z",
        },
      ]);

      expect(result.ok).toBe(false);
      expect(result.checks.find((check) => check.type === "HASH")?.passed).toBe(true);
      expect(result.checks.find((check) => check.type === "QES")?.passed).toBe(false);
      expect(result.errors).toContain("Referencia QES legacy no canónica: legacy-qes");
    });

    it("no fabrica OCSP, identidad ni mandato desde metadatos legacy", () => {
      const result = verificarIntegridad(AGREEMENT_ID, [
        {
          type: "QES",
          ref: "legacy-persona",
          hash: "abc123def456",
          signer_id: "REVOKED-DEMO",
          signer_role: "PRESIDENTE",
        },
      ]);

      expect(result.checks.some((check) => check.type === "OCSP")).toBe(false);
      expect(result.checks.some((check) => check.type === "IDENTITY")).toBe(false);
      expect(result.checks.some((check) => check.type === "MANDATE")).toBe(false);
    });
  });

  describe("OCSP retirado", () => {
    it("no infiere GOOD ni REVOKED a partir del identificador", () => {
      expect(verificarOCSP("PERSONA-NORMAL").status).toBe("UNKNOWN");
      expect(verificarOCSP("REVOKED-DEMO").status).toBe("UNKNOWN");
      expect(verificarOCSP("PERSONA-NORMAL").detail).toContain("no se infiere validez");
    });
  });

  describe("sello de tiempo", () => {
    it("rechaza un timestamp inválido", () => {
      const result = verificarIntegridad(AGREEMENT_ID, [
        {
          type: "TSQ",
          ref: "tsq-invalido",
          hash: "mno345pqr678",
          timestamp: "invalid-date",
        },
      ]);

      expect(result.ok).toBe(false);
      expect(result.checks.find((check) => check.type === "TSQ")?.passed).toBe(false);
    });

    it("acepta un timestamp ISO válido", () => {
      const result = verificarIntegridad(AGREEMENT_ID, [
        {
          type: "TSQ",
          ref: "tsq-valido",
          hash: "mno345pqr678",
          timestamp: "2026-04-19T10:30:10Z",
        },
      ]);

      expect(result.ok).toBe(true);
      expect(result.checks.find((check) => check.type === "TSQ")?.passed).toBe(true);
    });
  });

  describe("metadatos personales sobre artefactos no-QES", () => {
    it("falla cerrado en vez de inferir identidad o mandato", () => {
      const result = verificarIntegridad(AGREEMENT_ID, [
        {
          type: "HASH",
          ref: "hash-con-persona",
          hash: SHA512,
          signer_id: "00000000-0000-4000-b000-000000000001",
          signer_role: "SECRETARIO",
        },
      ]);

      expect(result.ok).toBe(false);
      expect(result.checks.find((check) => check.type === "IDENTITY")?.passed).toBe(false);
      expect(result.checks.find((check) => check.type === "MANDATE")?.passed).toBe(false);
      expect(result.errors).toContain(
        "Metadatos personales no verificables en artefacto hash-con-persona",
      );
    });
  });

  describe("estructura y escenarios vacíos", () => {
    it("devuelve OK cuando no hay artefactos que verificar", () => {
      const result = verificarIntegridad(AGREEMENT_ID, []);

      expect(result.ok).toBe(true);
      expect(result.checks).toEqual([]);
      expect(result.explain.length).toBeGreaterThan(0);
    });

    it("incluye nodos explicativos y checks tipados", () => {
      const result = verificarIntegridad(AGREEMENT_ID, [
        { type: "HASH", ref: "doc", hash: SHA512 },
      ]);

      result.explain.forEach((node: ExplainNode) => {
        expect(node).toHaveProperty("regla");
        expect(node).toHaveProperty("fuente");
        expect(node).toHaveProperty("mensaje");
      });
      result.checks.forEach((check: IntegrityCheckDetail) => {
        expect(typeof check.passed).toBe("boolean");
        expect(typeof check.detail).toBe("string");
      });
    });
  });
});
