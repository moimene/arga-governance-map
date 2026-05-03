export { MOTOR_PLANTILLAS_VERSION } from "./VERSION";
export {
  composeDocument,
  prepareDocumentComposition,
  templateTypesForDocumentType,
} from "./composer";
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
