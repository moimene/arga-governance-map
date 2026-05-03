import { describe, expect, it } from "vitest";
import {
  MOTOR_PLANTILLAS_VERSION,
  allowedReviewStateTransitions,
  buildEditableDocumentDraftPayload,
  buildCapa3AiAllowedFields,
  computeEditableDocumentDraftKey,
  composeDocument,
  DOCUMENT_DRAFTS_TABLE,
  finalizeEditableDocumentDraft,
  generateProcessDocxWithMotor,
  invokeAnthropicCapa3DraftProvider,
  loadLatestEditableDocumentDraft,
  prepareDocumentComposition,
  probeDocumentDraftSchema,
  probeReviewStateSchema,
  saveEditableDocumentDraft,
  staticDocumentDraftSchemaGate,
  sanitizeCapa3ProviderInput,
  staticReviewStateSchemaGate,
  transitionReviewState,
  validatePostRenderDocument,
  suggestCapa3Draft,
  suggestCapa3DraftWithAnthropicFallback,
} from "../index";

describe("motor-plantillas public contract", () => {
  it("expone una fachada publica estable", () => {
    expect(MOTOR_PLANTILLAS_VERSION).toBe("motor-plantillas@1.0.0-beta");
    expect(DOCUMENT_DRAFTS_TABLE).toBe("secretaria_document_drafts");
    expect(typeof composeDocument).toBe("function");
    expect(typeof finalizeEditableDocumentDraft).toBe("function");
    expect(typeof buildEditableDocumentDraftPayload).toBe("function");
    expect(typeof computeEditableDocumentDraftKey).toBe("function");
    expect(typeof loadLatestEditableDocumentDraft).toBe("function");
    expect(typeof probeDocumentDraftSchema).toBe("function");
    expect(typeof saveEditableDocumentDraft).toBe("function");
    expect(typeof staticDocumentDraftSchemaGate).toBe("function");
    expect(typeof generateProcessDocxWithMotor).toBe("function");
    expect(typeof suggestCapa3Draft).toBe("function");
    expect(typeof suggestCapa3DraftWithAnthropicFallback).toBe("function");
    expect(typeof invokeAnthropicCapa3DraftProvider).toBe("function");
    expect(typeof sanitizeCapa3ProviderInput).toBe("function");
    expect(typeof buildCapa3AiAllowedFields).toBe("function");
    expect(typeof prepareDocumentComposition).toBe("function");
    expect(typeof validatePostRenderDocument).toBe("function");
    expect(typeof transitionReviewState).toBe("function");
    expect(typeof allowedReviewStateTransitions).toBe("function");
    expect(typeof staticReviewStateSchemaGate).toBe("function");
    expect(typeof probeReviewStateSchema).toBe("function");
  });

  it("declara review_state como feature gated si el schema no existe", () => {
    const gate = staticReviewStateSchemaGate();

    expect(gate.supported).toBe(false);
    expect(gate.table).toBe("evidence_bundle_review_events");
    expect(gate.view).toBe("evidence_bundle_review_state_current");
    expect(gate.missing).toContain("evidence_bundle_review_events.review_state");
  });
});
