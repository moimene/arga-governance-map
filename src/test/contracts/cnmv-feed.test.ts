/**
 * F5.G11 — Contract test: CNMV hechos relevantes feed
 * Plan: docs/superpowers/plans/2026-05-16-tgms-gaps-coverage-plan-v1.md §7
 */

import { describe, it, expect } from "vitest";
import { z } from "zod";

const CNMVEventType = z.enum([
  "HECHO_RELEVANTE",
  "OTRA_INFORMACION_RELEVANTE",
  "CONVOCATORIA_JGA",
  "COMUNICACION_PARTICIPACIONES",
]);

const CNMVHechoRelevanteSchema = z.object({
  event_id: z.string(),
  isin: z.string().regex(/^[A-Z]{2}[A-Z0-9]{10}$/, "ISIN debe ser ISO 6166"),
  event_type: CNMVEventType,
  published_at: z.string().datetime(),
  title: z.string().min(1),
  content_url: z.string().url(),
  attachments: z
    .array(
      z.object({
        filename: z.string(),
        mime_type: z.string(),
        size_bytes: z.number().int().nonnegative(),
        url: z.string().url(),
      }),
    )
    .optional(),
});

type CNMVHechoRelevante = z.infer<typeof CNMVHechoRelevanteSchema>;

const validStubResponse: CNMVHechoRelevante = {
  event_id: "CNMV-2026-000001",
  isin: "ES0000000099",
  event_type: "HECHO_RELEVANTE",
  published_at: "2026-05-16T08:00:00.000Z",
  title: "Comunicación de operación corporativa",
  content_url: "https://stub.cnmv.example/hechos/000001.html",
};

describe("CNMV hechos relevantes feed contract", () => {
  it("valid stub response matches productive contract", () => {
    expect(() => CNMVHechoRelevanteSchema.parse(validStubResponse)).not.toThrow();
  });

  it("rejects malformed ISIN (must be ISO 6166)", () => {
    const bad = { ...validStubResponse, isin: "INVALID-ISIN" };
    expect(() => CNMVHechoRelevanteSchema.parse(bad)).toThrow();
  });

  it("rejects unknown event_type", () => {
    const bad = { ...validStubResponse, event_type: "OPA_HOSTIL" };
    expect(() => CNMVHechoRelevanteSchema.parse(bad)).toThrow();
  });

  it("accepts response with attachments array", () => {
    const withAttach: CNMVHechoRelevante = {
      ...validStubResponse,
      attachments: [
        {
          filename: "anexo-1.pdf",
          mime_type: "application/pdf",
          size_bytes: 102_400,
          url: "https://stub.cnmv.example/attach/anexo-1.pdf",
        },
      ],
    };
    expect(() => CNMVHechoRelevanteSchema.parse(withAttach)).not.toThrow();
  });

  it("rejects attachment with negative size_bytes", () => {
    const bad: CNMVHechoRelevante = {
      ...validStubResponse,
      attachments: [
        { filename: "x.pdf", mime_type: "application/pdf", size_bytes: -1, url: "https://x" },
      ],
    };
    expect(() => CNMVHechoRelevanteSchema.parse(bad)).toThrow();
  });
});

// Feed productivo esperado:
//   GET https://www.cnmv.es/portal/HR/CamposHRELE.aspx?nif=<TenantNIF>
//   Formato RSS/XML (no JSON). Adapter requerido para serializar a este schema.
