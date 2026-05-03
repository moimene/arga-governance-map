export { MOTOR_PLANTILLAS_VERSION } from "./VERSION";
export {
  composeDocument,
  finalizeEditableDocumentDraft,
  prepareDocumentComposition,
  templateTypesForDocumentType,
} from "./composer";
export {
  buildCapa3AiAllowedFields,
  suggestCapa3Draft,
} from "./capa3-draft-assistant";
export {
  buildEditableDocumentDraftPayload,
  computeEditableDocumentDraftKey,
  DOCUMENT_DRAFTS_TABLE,
  loadLatestEditableDocumentDraft,
  probeDocumentDraftSchema,
  saveEditableDocumentDraft,
  staticDocumentDraftSchemaGate,
} from "./document-draft-persistence";
export {
  invokeAnthropicCapa3DraftProvider,
  sanitizeCapa3ProviderInput,
  suggestCapa3DraftWithAnthropicFallback,
} from "./anthropic-capa3-provider";
export { generateProcessDocxWithMotor } from "./process-generator";
export { validatePostRenderDocument } from "./post-render-validation";
export {
  allowedReviewStateTransitions,
  transitionReviewState,
} from "./review-state-machine";
export {
  REVIEW_EVENTS_TABLE,
  REVIEW_STATE_VIEW,
  probeReviewStateSchema,
  staticReviewStateSchemaGate,
} from "./schema-gate";
export type {
  ComposeDocumentArchiveAdapter,
  ComposeDocumentArchiveParams,
  ComposeDocumentOptions,
  ComposeDocumentResult,
  GeneratedDocumentArtifact,
  MotorPlantillasArchiveResult,
  MotorPlantillasIssue,
  PreparedDocumentComposition,
  ReviewState,
  ReviewStateTransitionInput,
  ReviewStateTransitionResult,
  ValidatePostRenderInput,
} from "./types";
export type {
  DocumentDraftSchemaGate,
  EditableDocumentDraftRow,
  EditableDocumentDraftState,
  LoadEditableDocumentDraftInput,
  LoadEditableDocumentDraftResult,
  SaveEditableDocumentDraftInput,
  SaveEditableDocumentDraftResult,
} from "./document-draft-persistence";
export type {
  Capa3DraftAssistantMode,
  Capa3DraftAssistantProvider,
  Capa3DraftAssistantProviderInput,
  Capa3DraftAssistantProviderOutput,
  Capa3DraftSuggestion,
  SuggestCapa3DraftInput,
  SuggestCapa3DraftResult,
} from "./capa3-draft-assistant";
export type {
  AgreementNormativeSnapshot,
  EntityNormativeProfile,
  FormalizationRequirement,
  NormativeFrameworkStatus,
  NormativeSource,
} from "../secretaria/normative-framework";
