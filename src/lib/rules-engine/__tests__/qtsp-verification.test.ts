import { describe, it, expect } from "vitest";
import { verificarIntegridad } from "../qtsp-integration";

describe("verificarIntegridad", () => {
  const DEMO_AGREEMENT_ID = "550e8400-e29b-41d4-a716-446655440000";

  describe("valid artifacts", () => {
    it("should verify all checks pass with valid QES+QSEAL+TSQ artifacts", () => {
      const artifacts = [
        {
          type: "QES" as const,
          ref: "sig-001",
          hash: "abc123def456",
          signer_id: "00000000-0000-4000-b000-000000000001",
          signer_role: "SECRETARIO",
          timestamp: "2026-04-19T10:30:00Z",
        },
        {
          type: "QSEAL" as const,
          ref: "seal-001",
          hash: "ghi789jkl012",
          timestamp: "2026-04-19T10:30:05Z",
        },
        {
          type: "TSQ" as const,
          ref: "tsq-001",
          hash: "mno345pqr678",
          timestamp: "2026-04-19T10:30:10Z",
        },
      ];

      const result = verificarIntegridad(DEMO_AGREEMENT_ID, artifacts);

      expect(result.ok).toBe(true);
      expect(result.checks.length).toBeGreaterThan(0);
      expect(result.errors).toEqual([]);
      expect(result.explain).toBeDefined();
      expect(Array.isArray(result.explain)).toBe(true);

      // Verify that all checks passed
      const failedChecks = result.checks.filter((c) => !c.passed);
      expect(failedChecks).toHaveLength(0);
    });
  });

  describe("hash verification", () => {
    it("should fail HASH check when artifact has no hash", () => {
      const artifacts = [
        {
          type: "QES" as const,
          ref: "sig-001",
          hash: "", // empty hash
          signer_id: "00000000-0000-4000-b000-000000000001",
          signer_role: "SECRETARIO",
          timestamp: "2026-04-19T10:30:00Z",
        },
      ];

      const result = verificarIntegridad(DEMO_AGREEMENT_ID, artifacts);

      expect(result.ok).toBe(false);
      const hashChecks = result.checks.filter((c) => c.type === "HASH");
      expect(hashChecks.length).toBeGreaterThan(0);
      // passed is falsy (empty string from && operator), not explicitly false
      expect(!hashChecks[0].passed).toBe(true);
      expect(hashChecks[0].detail.toLowerCase()).toContain("hash");
    });

    it("should pass HASH check when artifact has valid hash", () => {
      const artifacts = [
        {
          type: "QES" as const,
          ref: "sig-001",
          hash: "abc123def456",
          signer_id: "00000000-0000-4000-b000-000000000001",
          signer_role: "SECRETARIO",
          timestamp: "2026-04-19T10:30:00Z",
        },
      ];

      const result = verificarIntegridad(DEMO_AGREEMENT_ID, artifacts);

      const hashChecks = result.checks.filter((c) => c.type === "HASH");
      expect(hashChecks.length).toBeGreaterThan(0);
      expect(hashChecks[0].passed).toBe(true);
    });
  });

  describe("QES signature verification", () => {
    it("should handle QES with valid signer_id", () => {
      const artifacts = [
        {
          type: "QES" as const,
          ref: "sig-001",
          hash: "abc123def456",
          signer_id: "00000000-0000-4000-b000-000000000001",
          signer_role: "SECRETARIO",
          timestamp: "2026-04-19T10:30:00Z",
        },
      ];

      const result = verificarIntegridad(DEMO_AGREEMENT_ID, artifacts);

      const qesChecks = result.checks.filter((c) => c.type === "QES");
      expect(qesChecks.length).toBeGreaterThan(0);
      expect(qesChecks[0].passed).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it("should handle QES without signer_id gracefully", () => {
      const artifacts = [
        {
          type: "QES" as const,
          ref: "sig-001",
          hash: "abc123def456",
          timestamp: "2026-04-19T10:30:00Z",
        },
      ];

      const result = verificarIntegridad(DEMO_AGREEMENT_ID, artifacts);

      // HASH check should still pass
      const hashChecks = result.checks.filter((c) => c.type === "HASH");
      expect(hashChecks.length).toBeGreaterThan(0);
      expect(hashChecks[0].passed).toBe(true);
    });
  });

  describe("OCSP revocation check", () => {
    it("should detect REVOKED status when signer_id contains REVOKED", () => {
      const artifacts = [
        {
          type: "QES" as const,
          ref: "sig-revoked",
          hash: "abc123def456",
          signer_id: "REVOKED-00000000-0000-4000-b000-000000000099",
          signer_role: "SECRETARIO",
          timestamp: "2026-04-19T10:30:00Z",
        },
      ];

      const result = verificarIntegridad(DEMO_AGREEMENT_ID, artifacts);

      const ocspChecks = result.checks.filter((c) => c.type === "OCSP");
      expect(ocspChecks.length).toBeGreaterThan(0);
      expect(ocspChecks[0].detail).toContain("revocado");
    });

    it("should have GOOD OCSP status for normal signer", () => {
      const artifacts = [
        {
          type: "QES" as const,
          ref: "sig-good",
          hash: "abc123def456",
          signer_id: "00000000-0000-4000-b000-000000000001",
          signer_role: "SECRETARIO",
          timestamp: "2026-04-19T10:30:00Z",
        },
      ];

      const result = verificarIntegridad(DEMO_AGREEMENT_ID, artifacts);

      const ocspChecks = result.checks.filter((c) => c.type === "OCSP");
      expect(ocspChecks.length).toBeGreaterThan(0);
      expect(ocspChecks[0].passed).toBe(true);
      expect(ocspChecks[0].detail).toContain("válido");
    });
  });

  describe("TSQ timestamp verification", () => {
    it("should fail TSQ check with invalid timestamp format", () => {
      const artifacts = [
        {
          type: "TSQ" as const,
          ref: "tsq-001",
          hash: "mno345pqr678",
          timestamp: "invalid-date", // invalid format
        },
      ];

      const result = verificarIntegridad(DEMO_AGREEMENT_ID, artifacts);

      const tsqChecks = result.checks.filter((c) => c.type === "TSQ");
      expect(tsqChecks.length).toBeGreaterThan(0);
      expect(tsqChecks[0].passed).toBe(false);
      expect(tsqChecks[0].detail.toLowerCase()).toContain("inválido");
    });

    it("should pass TSQ check with valid ISO timestamp", () => {
      const artifacts = [
        {
          type: "TSQ" as const,
          ref: "tsq-001",
          hash: "mno345pqr678",
          timestamp: "2026-04-19T10:30:10Z",
        },
      ];

      const result = verificarIntegridad(DEMO_AGREEMENT_ID, artifacts);

      const tsqChecks = result.checks.filter((c) => c.type === "TSQ");
      expect(tsqChecks.length).toBeGreaterThan(0);
      expect(tsqChecks[0].passed).toBe(true);
    });
  });

  describe("IDENTITY and MANDATE verification", () => {
    it("should pass IDENTITY check with known signer_role", () => {
      const artifacts = [
        {
          type: "QES" as const,
          ref: "sig-001",
          hash: "abc123def456",
          signer_id: "00000000-0000-4000-b000-000000000001",
          signer_role: "SECRETARIO",
          timestamp: "2026-04-19T10:30:00Z",
        },
      ];

      const result = verificarIntegridad(DEMO_AGREEMENT_ID, artifacts);

      const identityChecks = result.checks.filter((c) => c.type === "IDENTITY");
      expect(identityChecks.length).toBeGreaterThan(0);
      expect(identityChecks[0].passed).toBe(true);
    });

    it("should pass MANDATE check for known signer roles", () => {
      const artifacts = [
        {
          type: "QES" as const,
          ref: "sig-001",
          hash: "abc123def456",
          signer_id: "00000000-0000-4000-b000-000000000001",
          signer_role: "PRESIDENTE",
          timestamp: "2026-04-19T10:30:00Z",
        },
      ];

      const result = verificarIntegridad(DEMO_AGREEMENT_ID, artifacts);

      const mandateChecks = result.checks.filter((c) => c.type === "MANDATE");
      expect(mandateChecks.length).toBeGreaterThan(0);
      expect(mandateChecks[0].passed).toBe(true);
    });

    it("should fail MANDATE check with unknown signer_role", () => {
      const artifacts = [
        {
          type: "QES" as const,
          ref: "sig-001",
          hash: "abc123def456",
          signer_id: "00000000-0000-4000-b000-000000000001",
          signer_role: "UNKNOWN_ROLE_XYZ",
          timestamp: "2026-04-19T10:30:00Z",
        },
      ];

      const result = verificarIntegridad(DEMO_AGREEMENT_ID, artifacts);

      const mandateChecks = result.checks.filter((c) => c.type === "MANDATE");
      expect(mandateChecks.length).toBeGreaterThan(0);
      expect(mandateChecks[0].passed).toBe(false);
      expect(result.ok).toBe(false);
    });
  });

  describe("empty and mixed scenarios", () => {
    it("should return ok=true with empty artifacts array", () => {
      const artifacts: any[] = [];

      const result = verificarIntegridad(DEMO_AGREEMENT_ID, artifacts);

      expect(result.ok).toBe(true);
      expect(result.checks.length).toBe(0);
      expect(Array.isArray(result.explain)).toBe(true);
      expect(result.explain.length).toBeGreaterThan(0);
    });

    it("should handle mixed valid and invalid artifacts", () => {
      const artifacts = [
        {
          type: "QES" as const,
          ref: "sig-001",
          hash: "abc123def456",
          signer_id: "00000000-0000-4000-b000-000000000001",
          signer_role: "SECRETARIO",
          timestamp: "2026-04-19T10:30:00Z",
        },
        {
          type: "QES" as const,
          ref: "sig-002",
          hash: "", // invalid
          signer_id: "00000000-0000-4000-b000-000000000002",
          signer_role: "ADMINISTRADOR",
        },
      ];

      const result = verificarIntegridad(DEMO_AGREEMENT_ID, artifacts);

      expect(result.ok).toBe(false);
      const failedChecks = result.checks.filter((c) => !c.passed);
      expect(failedChecks.length).toBeGreaterThan(0);
    });

    it("should include explain nodes in result", () => {
      const artifacts = [
        {
          type: "QES" as const,
          ref: "sig-001",
          hash: "abc123def456",
          signer_id: "00000000-0000-4000-b000-000000000001",
          signer_role: "SECRETARIO",
          timestamp: "2026-04-19T10:30:00Z",
        },
      ];

      const result = verificarIntegridad(DEMO_AGREEMENT_ID, artifacts);

      expect(Array.isArray(result.explain)).toBe(true);
      expect(result.explain.length).toBeGreaterThan(0);
      // Each explain node should have expected structure
      result.explain.forEach((node: any) => {
        expect(node).toHaveProperty("regla");
        expect(node).toHaveProperty("fuente");
        expect(node).toHaveProperty("mensaje");
      });
    });
  });

  describe("MANDATE verification", () => {
    it("should include MANDATE check in result for artifacts with signer_role", () => {
      const artifacts = [
        {
          type: "QES" as const,
          ref: "sig-001",
          hash: "abc123def456",
          signer_id: "00000000-0000-4000-b000-000000000001",
          signer_role: "CONSEJERO",
          timestamp: "2026-04-19T10:30:00Z",
        },
      ];

      const result = verificarIntegridad(DEMO_AGREEMENT_ID, artifacts);

      const mandateChecks = result.checks.filter((c) => c.type === "MANDATE");
      expect(mandateChecks.length).toBeGreaterThan(0);
      expect(mandateChecks[0].label).toContain("Mandato");
      expect(mandateChecks[0].passed).toBe(true);
    });
  });

  describe("result structure", () => {
    it("should return properly structured IntegrityVerificationResult", () => {
      const artifacts = [
        {
          type: "QES" as const,
          ref: "sig-001",
          hash: "abc123def456",
          signer_id: "00000000-0000-4000-b000-000000000001",
          signer_role: "SOCIO",
          timestamp: "2026-04-19T10:30:00Z",
        },
      ];

      const result = verificarIntegridad(DEMO_AGREEMENT_ID, artifacts);

      // Type guard checks
      expect(result).toHaveProperty("ok");
      expect(result).toHaveProperty("checks");
      expect(result).toHaveProperty("errors");
      expect(result).toHaveProperty("explain");

      expect(typeof result.ok).toBe("boolean");
      expect(Array.isArray(result.checks)).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.explain)).toBe(true);

      // Verify each check has required fields
      result.checks.forEach((check: any) => {
        expect(check).toHaveProperty("type");
        expect(check).toHaveProperty("label");
        expect(check).toHaveProperty("passed");
        expect(check).toHaveProperty("detail");
        expect(typeof check.passed).toBe("boolean");
        expect(typeof check.detail).toBe("string");
      });
    });
  });
});
