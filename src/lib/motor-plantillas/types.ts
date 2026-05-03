import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";
import type {
  SecretariaDocumentGenerationRequest,
  SecretariaDocumentType,
  SecretariaValidationIssue,
  SecretariaValidationResult,
} from "@/lib/secretaria/document-generation-boundary";
import type { ResolverContext, ResolvedVariables } from "@/lib/doc-gen/variable-resolver";
import type { ArchiveMetadata, ArchiveResult } from "@/lib/doc-gen/storage-archiver";

export type MotorPlantillasIssue = SecretariaValidationIssue;

export type MotorPlantillasArchiveSkippedReason =
  | "archive_disabled"
  | "schema_not_supported"
  | "agreement_context_not_available"
  | "tenant_context_not_available"
  | "archive_failed";

export interface MotorPlantillasArchiveResult {
  attempted: boolean;
  archived: boolean;
  skippedReason?: MotorPlantillasArchiveSkippedReason;
  documentUrl?: string | null;
  evidenceBundleId?: string | null;
  hash512?: string | null;
  error?: string | null;
}

export interface ComposeDocumentArchiveParams {
  buffer: ArrayBuffer;
  agreementId: string;
  filename: string;
  tenantId: string;
  metadata: ArchiveMetadata;
}

export type ComposeDocumentArchiveAdapter = (
  params: ComposeDocumentArchiveParams,
) => Promise<ArchiveResult>;

export interface ComposeDocumentOptions {
  plantilla?: PlantillaProtegidaRow | null;
  plantillas?: PlantillaProtegidaRow[];
  baseVariables?: Record<string, unknown>;
  resolverContext?: ResolverContext;
  resolveCapa2?: boolean;
  archiveDraft?: boolean;
  archiveAdapter?: ComposeDocumentArchiveAdapter;
  now?: Date | string;
  generatedAt?: string;
  title?: string;
  subtitle?: string;
  entityName?: string | null;
  filenamePrefix?: string;
}

export interface PreparedDocumentComposition {
  request: SecretariaDocumentGenerationRequest;
  template: PlantillaProtegidaRow;
  templateTypes: string[];
  resolverContext: ResolverContext;
  capa2: ResolvedVariables;
  capa3Values: Record<string, string>;
  mergedVariables: Record<string, unknown>;
  renderedText: string;
  unresolvedVariables: string[];
  postRenderValidation: SecretariaValidationResult;
  title: string;
  filename: string;
}

export interface GeneratedDocumentArtifact {
  documentId: string;
  filename: string;
  mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  buffer: Uint8Array;
  renderedText: string;
  contentHash: string;
  templateId: string;
  templateTipo: string;
  templateVersion: string;
  evidenceStatus: "DEMO_OPERATIVA";
  generatedAt: string;
  status: "GENERATED";
}

export interface ComposeDocumentResult extends PreparedDocumentComposition {
  contentHash: string;
  docxBuffer: Uint8Array;
  document: GeneratedDocumentArtifact;
  archive: MotorPlantillasArchiveResult;
}

export interface ValidatePostRenderInput {
  documentType: SecretariaDocumentType;
  renderedText: string;
  capa1Template: string | null | undefined;
  agreementIds: string[];
  unresolvedVariables?: string[];
}

export type ReviewState =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "IN_REVIEW"
  | "APPROVED"
  | "PROMOTED"
  | "ARCHIVED"
  | "REJECTED"
  | "REGENERATION_NEEDED";

export interface ReviewStateTransitionInput {
  from: ReviewState;
  to: ReviewState;
  actorId?: string | null;
  reason?: string | null;
  at?: string | Date;
  metadata?: Record<string, unknown>;
}

export interface ReviewStateTransitionResult {
  ok: boolean;
  from: ReviewState;
  to: ReviewState;
  issue?: string;
  event?: {
    from: ReviewState;
    to: ReviewState;
    actor_id: string | null;
    reason: string | null;
    at: string;
    metadata: Record<string, unknown>;
  };
}
