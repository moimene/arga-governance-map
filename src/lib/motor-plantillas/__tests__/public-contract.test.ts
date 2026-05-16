import { describe, expect, it } from "vitest";
import {
  MOTOR_PLANTILLAS_VERSION,
  allowedReviewStateTransitions,
  buildEditableDocumentDraftPayload,
  buildCapa3AiAllowedFields,
  computeEditableDocumentDraftKey,
  composeDocument,
  DOCUMENT_DRAFTS_TABLE,
  ACTA_DRAFT_POLISH_PROMPT_VERSION,
  applyActaDraftPolishProposals,
  finalizeEditableDocumentDraft,
  finalizeProcessDocumentDraftWithMotor,
  formatEditableDraftDiffSummary,
  generateProcessDocxWithMotor,
  invokeAnthropicCapa3DraftProvider,
  invokeOpenAiActaComposerProvider,
  invokeOpenAiActaDraftPolishProvider,
  invokeOpenAiCapa3DraftProvider,
  loadLatestEditableDocumentDraft,
  prepareDocumentComposition,
  prepareProcessDocumentDraftWithMotor,
  probeDocumentDraftSchema,
  probeReviewStateSchema,
  saveEditableDocumentDraft,
  staticDocumentDraftSchemaGate,
  sanitizeCapa3ProviderInput,
  staticReviewStateSchemaGate,
  transitionReviewState,
  validatePostRenderDocument,
  validateActaDraftPolishResult,
  suggestCapa3Draft,
  suggestCapa3DraftWithOpenAIFallback,
  suggestActaDraftPolish,
  suggestActaDraftPolishWithCapa3CopilotFallback,
  suggestActaDraftPolishWithOpenAIFallback,
  suggestCapa3DraftWithAnthropicFallback,
  summarizeEditableDraftDiff,
} from "../index";

describe("motor-plantillas public contract", () => {
  it("expone una fachada publica estable", () => {
    expect(MOTOR_PLANTILLAS_VERSION).toBe("motor-plantillas@1.0.0-beta");
    expect(DOCUMENT_DRAFTS_TABLE).toBe("secretaria_document_drafts");
    expect(ACTA_DRAFT_POLISH_PROMPT_VERSION).toBe("capa3-document-copilot.v1");
    expect(typeof composeDocument).toBe("function");
    expect(typeof finalizeEditableDocumentDraft).toBe("function");
    expect(typeof prepareProcessDocumentDraftWithMotor).toBe("function");
    expect(typeof finalizeProcessDocumentDraftWithMotor).toBe("function");
    expect(typeof buildEditableDocumentDraftPayload).toBe("function");
    expect(typeof computeEditableDocumentDraftKey).toBe("function");
    expect(typeof loadLatestEditableDocumentDraft).toBe("function");
    expect(typeof probeDocumentDraftSchema).toBe("function");
    expect(typeof saveEditableDocumentDraft).toBe("function");
    expect(typeof staticDocumentDraftSchemaGate).toBe("function");
    expect(typeof generateProcessDocxWithMotor).toBe("function");
    expect(typeof suggestCapa3Draft).toBe("function");
    expect(typeof suggestCapa3DraftWithAnthropicFallback).toBe("function");
    expect(typeof suggestCapa3DraftWithOpenAIFallback).toBe("function");
    expect(typeof invokeAnthropicCapa3DraftProvider).toBe("function");
    expect(typeof invokeOpenAiCapa3DraftProvider).toBe("function");
    expect(typeof suggestActaDraftPolish).toBe("function");
    expect(typeof suggestActaDraftPolishWithCapa3CopilotFallback).toBe("function");
    expect(typeof suggestActaDraftPolishWithOpenAIFallback).toBe("function");
    expect(typeof invokeOpenAiActaComposerProvider).toBe("function");
    expect(typeof invokeOpenAiActaDraftPolishProvider).toBe("function");
    expect(typeof applyActaDraftPolishProposals).toBe("function");
    expect(typeof validateActaDraftPolishResult).toBe("function");
    expect(typeof sanitizeCapa3ProviderInput).toBe("function");
    expect(typeof buildCapa3AiAllowedFields).toBe("function");
    expect(typeof prepareDocumentComposition).toBe("function");
    expect(typeof validatePostRenderDocument).toBe("function");
    expect(typeof summarizeEditableDraftDiff).toBe("function");
    expect(typeof formatEditableDraftDiffSummary).toBe("function");
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
