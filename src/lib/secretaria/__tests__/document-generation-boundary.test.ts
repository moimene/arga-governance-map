import { describe, expect, it } from "vitest";
import {
  assertSecretariaDocumentGenerationRequestReady,
  buildSecretariaDocumentGenerationRequest,
  validateSecretariaDocumentGenerationRequest,
  type SecretariaDocumentGenerationRequest,
  type SecretariaValidationResult,
} from "../document-generation-boundary";

const DEMO_TENANT = "00000000-0000-0000-0000-000000000001";
const DEMO_ENTITY = "00000000-0000-0000-0000-000000000010";

function expectBlocking(
  result: SecretariaValidationResult,
  code?: string,
  fieldPath?: string,
): void {
  expect(result.ok).toBe(false);
  const blocking = result.issues.filter((i) => i.severity === "BLOCKING");
  expect(blocking.length).toBeGreaterThan(0);
  if (code) {
    const match = blocking.some(
      (i) => i.code === code && (fieldPath ? i.field_path === fieldPath : true),
    );
    expect(match).toBe(true);
  }
}

describe("document-generation-boundary — happy path", () => {
  it("builds a canonical demo/operativa request for ACTA via legacy camelCase input", async () => {
    const request = await buildSecretariaDocumentGenerationRequest({
      documentType: "ACTA",
      tenantId: DEMO_TENANT,
      entityId: DEMO_ENTITY,
      agreementIds: ["agreement-1", "agreement-1", null],
      meetingId: "meeting-1",
      minuteId: "minute-1",
      templateProfileId: "ACTA_JUNTA_V1",
      requestedAt: "2026-05-02T08:00:00.000Z",
    });

    expect(request).toMatchObject({
      schema_version: "1.0.0",
      source_module: "secretaria",
      document_type: "ACTA",
      tenant_id: DEMO_TENANT,
      entity_id: DEMO_ENTITY,
      agreement_ids: ["agreement-1"],
      evidence_status: "DEMO_OPERATIVA",
      generation_lane: "DOCUMENT_ASSEMBLY_PIPELINE",
    });
    expect(request.request_id).toBeTruthy();
    expect(request.request_hash_sha256).toMatch(/^[0-9a-f]{64}$/);

    const validation = await validateSecretariaDocumentGenerationRequest(request);
    expect(validation.ok).toBe(true);
    expect(validation.issues).toEqual([]);
  });

  it("builds via V1 snake_case input", async () => {
    const request = await buildSecretariaDocumentGenerationRequest({
      document_type: "ACTA",
      tenant_id: DEMO_TENANT,
      entity_id: DEMO_ENTITY,
      agreement_ids: ["agreement-1"],
      meeting_id: "meeting-1",
      minute_id: "minute-1",
      template_profile_id: "ACTA_V1",
    });
    expect(request.document_type).toBe("ACTA");
    expect((await validateSecretariaDocumentGenerationRequest(request)).ok).toBe(true);
  });

  it("normalizes CONSEJO_ADMIN alias to CONSEJO at build time", async () => {
    const request = await buildSecretariaDocumentGenerationRequest({
      documentType: "ACTA",
      tenantId: DEMO_TENANT,
      entityId: DEMO_ENTITY,
      agreementIds: ["agreement-1"],
      meetingId: "meeting-1",
      minuteId: "minute-1",
      templateProfileId: "ACTA_CONSEJO_V1",
      expectedOrganoTipo: "CONSEJO_ADMIN",
    });
    expect(request.expected_organo_tipo).toBe("CONSEJO");
  });
});

describe("document-generation-boundary — invariants", () => {
  it("rejects evidence_status != DEMO_OPERATIVA", async () => {
    const ok = await buildSecretariaDocumentGenerationRequest({
      documentType: "DOCUMENTO_REGISTRAL",
      tenantId: DEMO_TENANT,
      entityId: DEMO_ENTITY,
      agreementIds: ["agreement-1"],
      tramitadorId: "tram-1",
      templateProfileId: "REG_V1",
    });
    const tampered = { ...ok, evidence_status: "FINAL_PRODUCTIVA" } as unknown as SecretariaDocumentGenerationRequest;
    const result = await validateSecretariaDocumentGenerationRequest(tampered);
    expectBlocking(result, "EVIDENCE_STATUS_INVALID");
  });

  it("rejects request_hash_sha256 mismatch", async () => {
    const ok = await buildSecretariaDocumentGenerationRequest({
      documentType: "ACTA",
      tenantId: DEMO_TENANT,
      entityId: DEMO_ENTITY,
      agreementIds: ["agreement-1"],
      meetingId: "meeting-1",
      minuteId: "minute-1",
      templateProfileId: "ACTA_V1",
    });
    const tampered = { ...ok, request_hash_sha256: "deadbeef" };
    expectBlocking(await validateSecretariaDocumentGenerationRequest(tampered), "REQUEST_HASH_MISMATCH");
  });

  it("requires template_profile_id or template_id", async () => {
    const req = await buildSecretariaDocumentGenerationRequest({
      documentType: "ACTA",
      tenantId: DEMO_TENANT,
      entityId: DEMO_ENTITY,
      agreementIds: ["agreement-1"],
      meetingId: "meeting-1",
      minuteId: "minute-1",
    });
    expectBlocking(await validateSecretariaDocumentGenerationRequest(req), "TEMPLATE_SELECTOR_MISSING");
  });

  it("rejects empty tenant_id", async () => {
    const req = await buildSecretariaDocumentGenerationRequest({
      documentType: "CONVOCATORIA",
      tenantId: "",
      entityId: DEMO_ENTITY,
      convocatoriaId: "conv-1",
      templateProfileId: "CONV_V1",
    });
    expectBlocking(await validateSecretariaDocumentGenerationRequest(req), "TENANT_ID_MISSING");
  });
});

describe("document-generation-boundary — document_type rules (require)", () => {
  it("CONVOCATORIA requires convocatoria_id, allows empty agreement_ids", async () => {
    const ok = await buildSecretariaDocumentGenerationRequest({
      documentType: "CONVOCATORIA",
      tenantId: DEMO_TENANT,
      entityId: DEMO_ENTITY,
      convocatoriaId: "conv-1",
      templateProfileId: "CONV_V1",
    });
    expect((await validateSecretariaDocumentGenerationRequest(ok)).ok).toBe(true);

    const bad = await buildSecretariaDocumentGenerationRequest({
      documentType: "CONVOCATORIA",
      tenantId: DEMO_TENANT,
      entityId: DEMO_ENTITY,
      templateProfileId: "CONV_V1",
    });
    expectBlocking(
      await validateSecretariaDocumentGenerationRequest(bad),
      "MISSING_REQUIRED_REFERENCE",
      "convocatoria_id",
    );
  });

  it("INFORME_PRECEPTIVO requires convocatoria_id", async () => {
    const bad = await buildSecretariaDocumentGenerationRequest({
      documentType: "INFORME_PRECEPTIVO",
      tenantId: DEMO_TENANT,
      entityId: DEMO_ENTITY,
      templateProfileId: "INF_V1",
    });
    expectBlocking(
      await validateSecretariaDocumentGenerationRequest(bad),
      "MISSING_REQUIRED_REFERENCE",
      "convocatoria_id",
    );
  });

  it("INFORME_DOCUMENTAL_PRE requires entity_id", async () => {
    const bad = await buildSecretariaDocumentGenerationRequest({
      documentType: "INFORME_DOCUMENTAL_PRE",
      tenantId: DEMO_TENANT,
      entityId: null,
      templateProfileId: "INF_V1",
    });
    expectBlocking(
      await validateSecretariaDocumentGenerationRequest(bad),
      "ENTITY_ID_REQUIRED",
      "entity_id",
    );
  });

  it("ACTA requires meeting_id, minute_id, and >=1 agreement_id", async () => {
    const ok = await buildSecretariaDocumentGenerationRequest({
      documentType: "ACTA",
      tenantId: DEMO_TENANT,
      entityId: DEMO_ENTITY,
      agreementIds: ["agreement-1"],
      meetingId: "meeting-1",
      minuteId: "minute-1",
      templateProfileId: "ACTA_V1",
    });
    expect((await validateSecretariaDocumentGenerationRequest(ok)).ok).toBe(true);

    const noMeeting = await buildSecretariaDocumentGenerationRequest({
      documentType: "ACTA",
      tenantId: DEMO_TENANT,
      entityId: DEMO_ENTITY,
      agreementIds: ["agreement-1"],
      minuteId: "minute-1",
      templateProfileId: "ACTA_V1",
    });
    expectBlocking(
      await validateSecretariaDocumentGenerationRequest(noMeeting),
      "MISSING_REQUIRED_REFERENCE",
      "meeting_id",
    );

    const noAgreements = await buildSecretariaDocumentGenerationRequest({
      documentType: "ACTA",
      tenantId: DEMO_TENANT,
      entityId: DEMO_ENTITY,
      agreementIds: [],
      meetingId: "meeting-1",
      minuteId: "minute-1",
      templateProfileId: "ACTA_V1",
    });
    expectBlocking(
      await validateSecretariaDocumentGenerationRequest(noAgreements),
      "AGREEMENT_IDS_TOO_FEW",
    );
  });

  it("CERTIFICACION requires certification_id and >=1 agreement_id", async () => {
    const noAgreements = await buildSecretariaDocumentGenerationRequest({
      documentType: "CERTIFICACION",
      tenantId: DEMO_TENANT,
      entityId: DEMO_ENTITY,
      agreementIds: [],
      certificationId: "cert-1",
      templateProfileId: "CERT_V1",
    });
    expectBlocking(
      await validateSecretariaDocumentGenerationRequest(noAgreements),
      "AGREEMENT_IDS_TOO_FEW",
    );

    const noCertification = await buildSecretariaDocumentGenerationRequest({
      documentType: "CERTIFICACION",
      tenantId: DEMO_TENANT,
      entityId: DEMO_ENTITY,
      agreementIds: ["agreement-1"],
      templateProfileId: "CERT_V1",
    });
    expectBlocking(
      await validateSecretariaDocumentGenerationRequest(noCertification),
      "MISSING_REQUIRED_REFERENCE",
      "certification_id",
    );
  });

  it("DOCUMENTO_REGISTRAL requires tramitador_id", async () => {
    const bad = await buildSecretariaDocumentGenerationRequest({
      documentType: "DOCUMENTO_REGISTRAL",
      tenantId: DEMO_TENANT,
      entityId: DEMO_ENTITY,
      agreementIds: ["agreement-1"],
      templateProfileId: "REG_V1",
    });
    expectBlocking(
      await validateSecretariaDocumentGenerationRequest(bad),
      "MISSING_REQUIRED_REFERENCE",
      "tramitador_id",
    );
  });

  it("SUBSANACION_REGISTRAL requires tramitador_id", async () => {
    const bad = await buildSecretariaDocumentGenerationRequest({
      documentType: "SUBSANACION_REGISTRAL",
      tenantId: DEMO_TENANT,
      entityId: DEMO_ENTITY,
      agreementIds: ["agreement-1"],
      templateProfileId: "SUB_V1",
    });
    expectBlocking(
      await validateSecretariaDocumentGenerationRequest(bad),
      "MISSING_REQUIRED_REFERENCE",
      "tramitador_id",
    );
  });
});

describe("document-generation-boundary — document_type rules (forbid)", () => {
  it("ACUERDO_SIN_SESION forbids meeting_id and minute_id", async () => {
    const ok = await buildSecretariaDocumentGenerationRequest({
      documentType: "ACUERDO_SIN_SESION",
      tenantId: DEMO_TENANT,
      entityId: DEMO_ENTITY,
      agreementIds: ["agreement-1"],
      templateProfileId: "ASS_V1",
    });
    expect((await validateSecretariaDocumentGenerationRequest(ok)).ok).toBe(true);

    const withMeeting = await buildSecretariaDocumentGenerationRequest({
      documentType: "ACUERDO_SIN_SESION",
      tenantId: DEMO_TENANT,
      entityId: DEMO_ENTITY,
      agreementIds: ["agreement-1"],
      meetingId: "meeting-1",
      templateProfileId: "ASS_V1",
    });
    expectBlocking(
      await validateSecretariaDocumentGenerationRequest(withMeeting),
      "FORBIDDEN_REFERENCE",
      "meeting_id",
    );
  });

  it("DECISION_UNIPERSONAL allows minimal request and forbids meeting_id", async () => {
    const ok = await buildSecretariaDocumentGenerationRequest({
      documentType: "DECISION_UNIPERSONAL",
      tenantId: DEMO_TENANT,
      entityId: DEMO_ENTITY,
      agreementIds: ["agreement-1"],
      templateProfileId: "DEC_V1",
    });
    expect((await validateSecretariaDocumentGenerationRequest(ok)).ok).toBe(true);

    const withMeeting = await buildSecretariaDocumentGenerationRequest({
      documentType: "DECISION_UNIPERSONAL",
      tenantId: DEMO_TENANT,
      entityId: DEMO_ENTITY,
      agreementIds: ["agreement-1"],
      meetingId: "meeting-1",
      templateProfileId: "DEC_V1",
    });
    expectBlocking(
      await validateSecretariaDocumentGenerationRequest(withMeeting),
      "FORBIDDEN_REFERENCE",
      "meeting_id",
    );
  });

  it("INFORME_DOCUMENTAL_PRE forbids minute_id", async () => {
    const withMinute = await buildSecretariaDocumentGenerationRequest({
      documentType: "INFORME_DOCUMENTAL_PRE",
      tenantId: DEMO_TENANT,
      entityId: DEMO_ENTITY,
      minuteId: "minute-1",
      templateProfileId: "INF_V1",
    });
    expectBlocking(
      await validateSecretariaDocumentGenerationRequest(withMinute),
      "FORBIDDEN_REFERENCE",
      "minute_id",
    );
  });
});

describe("document-generation-boundary — ai_assist", () => {
  it("accepts ai_assist=null and ai_assist.enabled=false silently", async () => {
    const reqNull = await buildSecretariaDocumentGenerationRequest({
      documentType: "ACTA",
      tenantId: DEMO_TENANT,
      entityId: DEMO_ENTITY,
      agreementIds: ["agreement-1"],
      meetingId: "meeting-1",
      minuteId: "minute-1",
      templateProfileId: "ACTA_V1",
      aiAssist: null,
    });
    expect((await validateSecretariaDocumentGenerationRequest(reqNull)).ok).toBe(true);

    const reqDisabled = await buildSecretariaDocumentGenerationRequest({
      documentType: "ACTA",
      tenantId: DEMO_TENANT,
      entityId: DEMO_ENTITY,
      agreementIds: ["agreement-1"],
      meetingId: "meeting-1",
      minuteId: "minute-1",
      templateProfileId: "ACTA_V1",
      aiAssist: { enabled: false, allowed_fields: [] },
    });
    expect((await validateSecretariaDocumentGenerationRequest(reqDisabled)).ok).toBe(true);
  });

  it("ai_assist enabled requires exact whitelist (no extra fields)", async () => {
    const ok = await buildSecretariaDocumentGenerationRequest({
      documentType: "ACTA",
      tenantId: DEMO_TENANT,
      entityId: DEMO_ENTITY,
      agreementIds: ["agreement-1"],
      meetingId: "meeting-1",
      minuteId: "minute-1",
      templateProfileId: "ACTA_V1",
      aiAssist: {
        enabled: true,
        allowed_fields: [
          "narrativa.introduccion",
          "narrativa.deliberaciones",
          "narrativa.incidencias_no_criticas",
        ],
      },
    });
    expect((await validateSecretariaDocumentGenerationRequest(ok)).ok).toBe(true);

    const disallowed = await buildSecretariaDocumentGenerationRequest({
      documentType: "ACTA",
      tenantId: DEMO_TENANT,
      entityId: DEMO_ENTITY,
      agreementIds: ["agreement-1"],
      meetingId: "meeting-1",
      minuteId: "minute-1",
      templateProfileId: "ACTA_V1",
      aiAssist: {
        enabled: true,
        allowed_fields: [
          "narrativa.introduccion",
          "narrativa.deliberaciones",
          "narrativa.incidencias_no_criticas",
          "sociedad.denominacion_social",
        ],
      },
    });
    expectBlocking(
      await validateSecretariaDocumentGenerationRequest(disallowed),
      "AI_ASSIST_FIELD_NOT_ALLOWED",
    );
  });

  it("ai_assist enabled with missing whitelist field is blocked", async () => {
    const missing = await buildSecretariaDocumentGenerationRequest({
      documentType: "ACTA",
      tenantId: DEMO_TENANT,
      entityId: DEMO_ENTITY,
      agreementIds: ["agreement-1"],
      meetingId: "meeting-1",
      minuteId: "minute-1",
      templateProfileId: "ACTA_V1",
      aiAssist: {
        enabled: true,
        allowed_fields: ["narrativa.introduccion"],
      },
    });
    expectBlocking(
      await validateSecretariaDocumentGenerationRequest(missing),
      "AI_ASSIST_WHITELIST_MISSING",
    );
  });
});

describe("document-generation-boundary — idempotency", () => {
  it("two requests with identical content produce the same hash (excluding metadata)", async () => {
    const a = await buildSecretariaDocumentGenerationRequest({
      documentType: "ACTA",
      tenantId: DEMO_TENANT,
      entityId: DEMO_ENTITY,
      agreementIds: ["agreement-1"],
      meetingId: "meeting-1",
      minuteId: "minute-1",
      templateProfileId: "ACTA_V1",
      requestId: "req-a",
      requestedByUserId: "user-a",
      requestedAt: "2026-05-02T08:00:00.000Z",
    });
    const b = await buildSecretariaDocumentGenerationRequest({
      documentType: "ACTA",
      tenantId: DEMO_TENANT,
      entityId: DEMO_ENTITY,
      agreementIds: ["agreement-1"],
      meetingId: "meeting-1",
      minuteId: "minute-1",
      templateProfileId: "ACTA_V1",
      requestId: "req-b",
      requestedByUserId: "user-b",
      requestedAt: "2026-05-03T10:00:00.000Z",
    });
    expect(a.request_hash_sha256).toBe(b.request_hash_sha256);
    expect(a.request_id).not.toBe(b.request_id);
  });

  it("different content produces different hashes", async () => {
    const a = await buildSecretariaDocumentGenerationRequest({
      documentType: "ACTA",
      tenantId: DEMO_TENANT,
      entityId: DEMO_ENTITY,
      agreementIds: ["agreement-1"],
      meetingId: "meeting-1",
      minuteId: "minute-1",
      templateProfileId: "ACTA_V1",
    });
    const b = await buildSecretariaDocumentGenerationRequest({
      documentType: "ACTA",
      tenantId: DEMO_TENANT,
      entityId: DEMO_ENTITY,
      agreementIds: ["agreement-2"],
      meetingId: "meeting-1",
      minuteId: "minute-1",
      templateProfileId: "ACTA_V1",
    });
    expect(a.request_hash_sha256).not.toBe(b.request_hash_sha256);
  });
});

describe("document-generation-boundary — assertSecretariaDocumentGenerationRequestReady", () => {
  it("returns validation result when ready", async () => {
    const req = await buildSecretariaDocumentGenerationRequest({
      documentType: "CONVOCATORIA",
      tenantId: DEMO_TENANT,
      entityId: DEMO_ENTITY,
      convocatoriaId: "conv-1",
      templateProfileId: "CONV_V1",
    });
    const result = await assertSecretariaDocumentGenerationRequestReady(req);
    expect(result.ok).toBe(true);
  });

  it("throws when blocked", async () => {
    const req = await buildSecretariaDocumentGenerationRequest({
      documentType: "CERTIFICACION",
      tenantId: DEMO_TENANT,
      entityId: DEMO_ENTITY,
      agreementIds: [],
      certificationId: "cert-1",
      templateProfileId: "CERT_V1",
    });
    await expect(assertSecretariaDocumentGenerationRequestReady(req)).rejects.toThrow(
      /AGREEMENT_IDS_TOO_FEW/,
    );
  });
});

describe("document-generation-boundary — bilingual builder safety", () => {
  it("throws when input mixes camelCase and snake_case", async () => {
    await expect(
      buildSecretariaDocumentGenerationRequest({
        documentType: "ACTA",
        document_type: "ACTA",
      } as unknown as Parameters<typeof buildSecretariaDocumentGenerationRequest>[0]),
    ).rejects.toThrow(/mezcla camelCase y snake_case/);
  });
});
