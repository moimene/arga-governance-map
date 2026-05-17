/**
 * F5.G11 — Contract test: EAD Trust QES wire protocol
 * Plan: docs/superpowers/plans/2026-05-16-tgms-gaps-coverage-plan-v1.md §7
 *
 * Valida la SHAPE del wire protocol esperado del proveedor EAD Trust QTSP.
 * Hoy hay un stub local; cuando se firme el contrato productivo, este
 * mismo test valida que la respuesta del endpoint real cumple la spec.
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";

const QESStatus = z.enum(["SIGNED", "PENDING", "REJECTED", "FAILED"]);

const QESResponseSchema = z.object({
  signature_request_id: z.string().uuid(),
  status: QESStatus,
  signed_document_url: z.string().url().optional(),
  timestamp_iso: z.string().datetime(),
  signatory_ids: z.array(z.string()).min(1),
  evidence_bundle_uri: z.string().optional(),
});

type QESResponse = z.infer<typeof QESResponseSchema>;

// Fixture que representa una respuesta válida del stub.
const validStubResponse: QESResponse = {
  signature_request_id: "00000000-0000-4000-8000-000000000001",
  status: "SIGNED",
  signed_document_url: "https://stub.ead-trust.example/signed/00000000.pdf",
  timestamp_iso: "2026-05-16T12:00:00.000Z",
  signatory_ids: ["did:trust:stub:signer-1"],
  evidence_bundle_uri: "evidence-bundle://stub/00000000",
};

describe("EAD Trust QES contract", () => {
  it("valid stub response matches the productive contract shape", () => {
    expect(() => QESResponseSchema.parse(validStubResponse)).not.toThrow();
  });

  it("rejects response missing signature_request_id", () => {
    const bad = { ...validStubResponse } as Partial<QESResponse>;
    delete bad.signature_request_id;
    expect(() => QESResponseSchema.parse(bad)).toThrow();
  });

  it("rejects malformed timestamp (not ISO 8601)", () => {
    const bad = { ...validStubResponse, timestamp_iso: "yesterday at 3pm" };
    expect(() => QESResponseSchema.parse(bad)).toThrow();
  });

  it("rejects empty signatory_ids array", () => {
    const bad = { ...validStubResponse, signatory_ids: [] };
    expect(() => QESResponseSchema.parse(bad)).toThrow();
  });

  it("accepts PENDING status without signed_document_url (still in queue)", () => {
    const pending: QESResponse = {
      signature_request_id: "00000000-0000-4000-8000-000000000002",
      status: "PENDING",
      timestamp_iso: "2026-05-16T12:00:01.000Z",
      signatory_ids: ["did:trust:stub:signer-1"],
    };
    expect(() => QESResponseSchema.parse(pending)).not.toThrow();
  });

  it("rejects unknown status value (forward-compat: provider can't introduce silently)", () => {
    const bad = { ...validStubResponse, status: "MAYBE_SIGNED" };
    expect(() => QESResponseSchema.parse(bad)).toThrow();
  });
});

// Endpoint productivo esperado (documentación, no test):
//   POST https://api.ead-trust.eu/v1/signature-requests/{id}/sign
//   Authorization: Bearer <client-credentials JWT>
//   X-Idempotency-Key: <uuid> (required for retries)
//
// El día que se conecte el endpoint real, sustituir validStubResponse por
// una invocación a la SDK real y mantener los mismos schema asserts.
