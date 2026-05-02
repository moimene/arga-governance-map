import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";
import {
  resolveLegalTemplateApprovalPlan,
  type LegalTemplateApprovalDecision,
  type LegalTemplateApprovalPlanItem,
} from "./legal-template-approval-plan";

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

const REVIEW_NOTE_RE = /STUB|PENDIENTE|REVISION|REVISI[OÓ]N|BORRADOR|DRAFT/i;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;

function normalizeCode(value?: string | null) {
  return value?.trim().toUpperCase() || "";
}

function hasValue(value?: string | null) {
  return !!value?.trim();
}

function isLocalFixture(template: PlantillaProtegidaRow) {
  const protections = template.protecciones as Record<string, unknown> | null;
  return template.tenant_id === "local-legal-fixture" || protections?.source === "legal-team-fixture";
}

function isDraftVersion(version?: string | null) {
  const value = version?.trim();
  if (!value) return true;
  if (value.startsWith("0.")) return true;
  return !SEMVER_RE.test(value);
}

function requiresReference(template: PlantillaProtegidaRow) {
  return normalizeCode(template.tipo) === "MODELO_ACUERDO";
}

function requiresOwnerMetadata(template: PlantillaProtegidaRow) {
  return normalizeCode(template.tipo) === "MODELO_ACUERDO";
}

function buildDuplicateKey(template: PlantillaProtegidaRow) {
  const tipo = normalizeCode(template.tipo);
  const matter = normalizeCode(template.materia_acuerdo ?? template.materia);
  if (!tipo || !matter) return null;
  return `${tipo}:${matter}`;
}

export function buildLegalTemplateReviewRows(templates: PlantillaProtegidaRow[]): LegalTemplateReviewRow[] {
  const duplicateCounts = new Map<string, number>();

  for (const template of templates) {
    if (isLocalFixture(template)) continue;
    const key = buildDuplicateKey(template);
    if (!key) continue;
    duplicateCounts.set(key, (duplicateCounts.get(key) ?? 0) + 1);
  }

  return templates.map((template) => {
    const localFixture = isLocalFixture(template);
    const isOperationalActive = normalizeCode(template.estado) === "ACTIVA";
    const missingApproval = !localFixture && (!hasValue(template.aprobada_por) || !hasValue(template.fecha_aprobacion));
    const draftVersion = !localFixture && isDraftVersion(template.version);
    const notesRequireReview = !localFixture && REVIEW_NOTE_RE.test(template.notas_legal ?? "");
    const missingReference = !localFixture && requiresReference(template) && !hasValue(template.referencia_legal);
    const missingOwner =
      !localFixture &&
      requiresOwnerMetadata(template) &&
      (!hasValue(template.adoption_mode) || !hasValue(template.organo_tipo));
    const duplicateKey = buildDuplicateKey(template);
    const duplicateMatter = !localFixture && !!duplicateKey && (duplicateCounts.get(duplicateKey) ?? 0) > 1;
    const approvalPlan = resolveLegalTemplateApprovalPlan(template);
    const legalReportApproved = approvalPlan?.decision === "APROBADA";
    const legalReportApprovedWithVariants = approvalPlan?.decision === "APROBADA_CON_VARIANTES";

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
    if (localFixture) reasons.push("Fixture local no persistido; no sustituye aprobacion legal Cloud.");
    if (missingApproval) reasons.push("Falta aprobada_por o fecha_aprobacion.");
    if (draftVersion) reasons.push("Version tecnica o no semver final.");
    if (notesRequireReview) reasons.push("Notas legales indican STUB, borrador o revision pendiente.");
    if (missingReference) reasons.push("Falta referencia legal explicita.");
    if (missingOwner) reasons.push("Falta organo competente o AdoptionMode.");
    if (duplicateMatter) reasons.push("Existe mas de una plantilla para la misma materia; Legal debe confirmar variante o consolidacion.");

    const canClaimLegalApproval = !localFixture && isOperationalActive && reasons.length === 0;
    const requiresLegalReview = !canClaimLegalApproval;

    let status: LegalTemplateReviewStatus;
    let label: string;
    if (localFixture) {
      status = "fixture_bridge";
      label = "Fixture local";
    } else if (canClaimLegalApproval) {
      status = "legally_approved";
      label = "Aprobada legal";
    } else if (notesRequireReview || draftVersion || missingReference || missingOwner || duplicateMatter) {
      status = "needs_review";
      label = "Revision legal";
    } else if (isOperationalActive && missingApproval) {
      status = "operational_unapproved";
      label = "Activa sin aprobacion";
    } else {
      status = "in_workflow";
      label = "En ciclo";
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
