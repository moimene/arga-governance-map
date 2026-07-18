import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";
import {
  resolveLegalTemplateApprovalPlan,
  type LegalTemplateApprovalDecision,
  type LegalTemplateApprovalPlanItem,
} from "./legal-template-approval-plan";
import { buildFunctionalKey, serializeFunctionalKey } from "./template-admin/functional-key";
import {
  hasSpecificTemplateMetadata,
  requiresLegalReference,
  templateMetadataPolicy,
} from "./template-admin/labels";

export type LegalTemplateReviewStatus =
  | "legally_approved"
  | "operational_unapproved"
  | "needs_review"
  | "fixture_bridge"
  | "in_workflow";

export type LegalTemplateReviewFilter =
  | "ALL"
  | "LEGAL_APPROVED"
  | "REVISION_LEGAL"
  | "LEGAL_REPORT_APPROVED"
  | "LEGAL_REPORT_APPROVED_VARIANTS"
  | "MISSING_APPROVAL"
  | "DRAFT_VERSION"
  | "MISSING_REFERENCE"
  | "MISSING_OWNER"
  | "DUPLICATE_MATTER"
  | "LOCAL_FIXTURE";

export interface LegalTemplateReviewFlags {
  missingApproval: boolean;
  draftVersion: boolean;
  notesRequireReview: boolean;
  missingReference: boolean;
  missingOwner: boolean;
  duplicateMatter: boolean;
  localFixture: boolean;
  legalReportApproved: boolean;
  legalReportApprovedWithVariants: boolean;
}

export interface LegalTemplateReviewRow {
  templateId: string;
  status: LegalTemplateReviewStatus;
  label: string;
  requiresLegalReview: boolean;
  canClaimLegalApproval: boolean;
  isOperationalActive: boolean;
  reasons: string[];
  flags: LegalTemplateReviewFlags;
  duplicateKey: string | null;
  approvalPlan: LegalTemplateApprovalPlanItem | null;
  approvalDecision: LegalTemplateApprovalDecision | null;
  proposedVersion: string | null;
}

export interface LegalTemplateReviewSummary {
  total: number;
  legallyApproved: number;
  operationalUnapproved: number;
  needsReview: number;
  fixtureBridge: number;
  missingApproval: number;
  draftVersion: number;
  missingReference: number;
  missingOwner: number;
  duplicateMatter: number;
  legalReportApproved: number;
  legalReportApprovedWithVariants: number;
}

const REVIEW_NOTE_RE =
  /(?:^|[^\p{L}\p{N}_])(?:STUB|PENDIENTE|REVISI[OÓ]N|BORRADOR|DRAFT)(?=$|[^\p{L}\p{N}_])/iu;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;

function normalizeCode(value?: string | null) {
  return value?.trim().toUpperCase() || "";
}

function hasValue(value?: string | null) {
  return !!value?.trim();
}

export function isLocalFixture(template: PlantillaProtegidaRow) {
  const protections = template.protecciones as Record<string, unknown> | null;
  return template.tenant_id === "local-legal-fixture" || protections?.source === "legal-team-fixture";
}

export function isDraftVersion(version?: string | null) {
  const value = version?.trim();
  if (!value) return true;
  if (value.startsWith("0.")) return true;
  return !SEMVER_RE.test(value);
}

function requiresReference(template: PlantillaProtegidaRow) {
  // Lote 2 coherencia: mismo predicado que el Gate PRE (META_REF_LEGAL_FORMAT).
  return requiresLegalReference(template);
}

function buildActiveEquivalentKey(template: PlantillaProtegidaRow) {
  const tipo = normalizeCode(template.tipo);
  const matter = normalizeCode(template.materia_acuerdo ?? template.materia);
  if (!tipo || !matter) return null;
  return serializeFunctionalKey(
    buildFunctionalKey(template, template.tenant_id),
  );
}

export function buildLegalTemplateReviewRows(templates: PlantillaProtegidaRow[]): LegalTemplateReviewRow[] {
  const duplicateCounts = new Map<string, number>();

  for (const template of templates) {
    if (isLocalFixture(template) || normalizeCode(template.estado) !== "ACTIVA") continue;
    const key = buildActiveEquivalentKey(template);
    if (!key) continue;
    duplicateCounts.set(key, (duplicateCounts.get(key) ?? 0) + 1);
  }

  return templates.map((template) => {
    const localFixture = isLocalFixture(template);
    const isOperationalActive = normalizeCode(template.estado) === "ACTIVA";
    const draftVersion = !localFixture && isDraftVersion(template.version);
    const notesRequireReview = !localFixture && REVIEW_NOTE_RE.test(template.notas_legal ?? "");
    const missingReference = !localFixture && requiresReference(template) && !hasValue(template.referencia_legal);
    const metadataPolicy = templateMetadataPolicy(template.tipo);
    const missingOrgano =
      metadataPolicy.organoRequired && !hasSpecificTemplateMetadata(template.organo_tipo);
    const missingAdoption =
      metadataPolicy.adoptionModeRequired &&
      !hasSpecificTemplateMetadata(template.adoption_mode);
    const missingOwner = !localFixture && (missingOrgano || missingAdoption);
    const duplicateKey = buildActiveEquivalentKey(template);
    const duplicateMatter =
      !localFixture &&
      isOperationalActive &&
      !!duplicateKey &&
      (duplicateCounts.get(duplicateKey) ?? 0) > 1;
    const approvalPlan = resolveLegalTemplateApprovalPlan(template);
    const legalReportApproved = approvalPlan?.decision === "APROBADA";
    const legalReportApprovedWithVariants = approvalPlan?.decision === "APROBADA_CON_VARIANTES";
    const committeeApproved = legalReportApproved || legalReportApprovedWithVariants;
    const missingApproval =
      !localFixture &&
      !committeeApproved &&
      (!hasValue(template.aprobada_por) || !hasValue(template.fecha_aprobacion));

    const flags: LegalTemplateReviewFlags = {
      missingApproval,
      draftVersion,
      notesRequireReview,
      missingReference,
      missingOwner,
      duplicateMatter,
      localFixture,
      legalReportApproved,
      legalReportApprovedWithVariants,
    };

    const reasons: string[] = [];
    if (localFixture) reasons.push("Cobertura provisional no persistida; no sustituye una aprobación legal.");
    if (missingApproval) reasons.push("Falta aprobación formal.");
    if (committeeApproved && (!hasValue(template.aprobada_por) || !hasValue(template.fecha_aprobacion))) {
      reasons.push("Aprobada por informe del Comité Legal; falta reflejar la aprobación en los metadatos.");
    }
    if (draftVersion) reasons.push("Versión provisional.");
    if (notesRequireReview) reasons.push("Las notas jurídicas señalan contenido en borrador o revisión pendiente.");
    if (missingReference) reasons.push("Falta referencia legal.");
    if (missingOwner) {
      reasons.push(
        missingAdoption
          ? "Falta órgano competente o forma de adopción aplicable."
          : "Falta órgano competente.",
      );
    }
    if (duplicateMatter) {
      reasons.push(
        "Duplicidad de plantilla vigente: existe otra plantilla vigente con la misma identidad documental.",
      );
    }

    const canClaimLegalApproval =
      !duplicateMatter &&
      (committeeApproved || (!localFixture && isOperationalActive && reasons.length === 0));
    const requiresLegalReview = !canClaimLegalApproval;

    let status: LegalTemplateReviewStatus;
    let label: string;
    if (localFixture) {
      status = "fixture_bridge";
      label = "Cobertura provisional";
    } else if (canClaimLegalApproval) {
      status = "legally_approved";
      label = "Aprobada legalmente";
    } else if (notesRequireReview || draftVersion || missingReference || missingOwner || duplicateMatter) {
      status = "needs_review";
      label = "Revisión legal";
    } else if (isOperationalActive && missingApproval) {
      status = "operational_unapproved";
      label = "Vigente sin aprobación";
    } else {
      status = "in_workflow";
      label = "En preparación";
    }

    return {
      templateId: template.id,
      status,
      label,
      requiresLegalReview,
      canClaimLegalApproval,
      isOperationalActive,
      reasons,
      flags,
      duplicateKey,
      approvalPlan,
      approvalDecision: approvalPlan?.decision ?? null,
      proposedVersion: approvalPlan?.proposedVersion ?? null,
    };
  });
}

export function summarizeLegalTemplateReview(rows: LegalTemplateReviewRow[]): LegalTemplateReviewSummary {
  return rows.reduce<LegalTemplateReviewSummary>(
    (acc, row) => {
      acc.total += 1;
      if (row.status === "legally_approved") acc.legallyApproved += 1;
      if (row.status === "operational_unapproved") acc.operationalUnapproved += 1;
      if (row.requiresLegalReview) acc.needsReview += 1;
      if (row.status === "fixture_bridge") acc.fixtureBridge += 1;
      if (row.flags.missingApproval) acc.missingApproval += 1;
      if (row.flags.draftVersion) acc.draftVersion += 1;
      if (row.flags.missingReference) acc.missingReference += 1;
      if (row.flags.missingOwner) acc.missingOwner += 1;
      if (row.flags.duplicateMatter) acc.duplicateMatter += 1;
      if (row.flags.legalReportApproved) acc.legalReportApproved += 1;
      if (row.flags.legalReportApprovedWithVariants) acc.legalReportApprovedWithVariants += 1;
      return acc;
    },
    {
      total: 0,
      legallyApproved: 0,
      operationalUnapproved: 0,
      needsReview: 0,
      fixtureBridge: 0,
      missingApproval: 0,
      draftVersion: 0,
      missingReference: 0,
      missingOwner: 0,
      duplicateMatter: 0,
      legalReportApproved: 0,
      legalReportApprovedWithVariants: 0,
    },
  );
}

export function matchesLegalTemplateReviewFilter(
  row: LegalTemplateReviewRow | undefined,
  filter: LegalTemplateReviewFilter,
) {
  if (filter === "ALL") return true;
  if (!row) return false;
  if (filter === "LEGAL_APPROVED") return row.status === "legally_approved";
  if (filter === "REVISION_LEGAL") return row.requiresLegalReview;
  if (filter === "LEGAL_REPORT_APPROVED") return row.flags.legalReportApproved;
  if (filter === "LEGAL_REPORT_APPROVED_VARIANTS") return row.flags.legalReportApprovedWithVariants;
  if (filter === "MISSING_APPROVAL") return row.flags.missingApproval;
  if (filter === "DRAFT_VERSION") return row.flags.draftVersion;
  if (filter === "MISSING_REFERENCE") return row.flags.missingReference;
  if (filter === "MISSING_OWNER") return row.flags.missingOwner;
  if (filter === "DUPLICATE_MATTER") return row.flags.duplicateMatter;
  if (filter === "LOCAL_FIXTURE") return row.flags.localFixture;
  return true;
}
