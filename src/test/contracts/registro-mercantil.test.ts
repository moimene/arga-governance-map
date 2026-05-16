/**
 * F5.G11 — Contract test: Registro Mercantil filing wire protocol
 * Plan: docs/superpowers/plans/2026-05-16-tgms-gaps-coverage-plan-v1.md §7
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";

const FilingStatus = z.enum([
  "DRAFT",
  "SUBMITTED",
  "ACCEPTED",
  "REJECTED",
  "DEFICIENCY_NOTIFIED",
  "REGISTERED",
]);

const RMFilingResponseSchema = z.object({
  filing_id: z.string(),
  status: FilingStatus,
  registry: z.enum(["SIGER", "PSM", "SIBS", "SIGER_MX"]),
  submitted_at: z.string().datetime().optional(),
  registered_at: z.string().datetime().optional(),
  deeds_required: z.array(z.string()).optional(),
  deficiencies: z
    .array(
      z.object({
        code: z.string(),
        message: z.string(),
        severity: z.enum(["BLOCKING", "WARNING"]),
      }),
    )
    .optional(),
});

type RMFilingResponse = z.infer<typeof RMFilingResponseSchema>;

const validStubResponse: RMFilingResponse = {
  filing_id: "RM-2026-ES-TRAM-000001",
  status: "DRAFT",
  registry: "SIGER",
};

describe("Registro Mercantil filing contract", () => {
  it("valid stub response matches productive contract shape", () => {
    expect(() => RMFilingResponseSchema.parse(validStubResponse)).not.toThrow();
  });

  it("rejects unknown registry value", () => {
    const bad = { ...validStubResponse, registry: "NOTARIO" };
    expect(() => RMFilingResponseSchema.parse(bad)).toThrow();
  });

  it("rejects unknown status value", () => {
    const bad = { ...validStubResponse, status: "PARKED" };
    expect(() => RMFilingResponseSchema.parse(bad)).toThrow();
  });

  it("accepts response with deficiencies array (subsanación path)", () => {
    const withDef: RMFilingResponse = {
      ...validStubResponse,
      status: "DEFICIENCY_NOTIFIED",
      deficiencies: [
        { code: "RM-201", message: "Falta certificación nombramiento", severity: "BLOCKING" },
      ],
    };
    expect(() => RMFilingResponseSchema.parse(withDef)).not.toThrow();
  });

  it("rejects deficiency with unknown severity", () => {
    const bad: RMFilingResponse = {
      ...validStubResponse,
      status: "DEFICIENCY_NOTIFIED",
      deficiencies: [
        { code: "RM-201", message: "test", severity: "FATAL" as never },
      ],
    };
    expect(() => RMFilingResponseSchema.parse(bad)).toThrow();
  });
});

// Endpoints productivos esperados (no implementados):
//   ES (SIGER 2.0): SOAP/XML — depende contrato cliente.
//   ES (PSM):      OAuth2 + JSON-RPC.
//   PT (SIBS):     REST + mTLS.
//   MX (SIGER MX): SOAP/XML.
