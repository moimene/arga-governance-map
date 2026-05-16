import {
  validateRenderedActaAgainstLegalStructure,
  type ActaLegalStructureViewModel,
} from "@/lib/secretaria/acta-legal-structure";

export type ActaDraftPolishMode = "LOCAL_DEMO" | "MODEL_ADAPTER";

export type ActaDraftPolishTarget =
  | "narrativa.introduccion"
  | "narrativa.deliberaciones"
  | "narrativa.incidencias_no_criticas";

export interface ActaDraftPolishProposal {
  target: ActaDraftPolishTarget;
  currentText: string;
  proposedText: string;
  reason: string;
  confidence: number;
  requiresHumanReview: true;
}

export interface ActaDraftPolishProviderInput {
  text: string;
  actaLegalStructure: ActaLegalStructureViewModel;
  allowedTargets: ActaDraftPolishTarget[];
  maxProposals?: number;
}

export interface ActaDraftPolishProviderOutput {
  proposals: ActaDraftPolishProposal[];
  summary?: string;
  modelName?: string;
  promptVersion?: string;
}

export type ActaDraftPolishProvider = (
  input: ActaDraftPolishProviderInput,
) => Promise<ActaDraftPolishProviderOutput>;

export interface SuggestActaDraftPolishInput {
  text: string;
  actaLegalStructure: ActaLegalStructureViewModel;
  allowedTargets?: ActaDraftPolishTarget[];
  maxProposals?: number;
  provider?: ActaDraftPolishProvider;
}

export interface ActaDraftPolishValidationIssue {
  code: string;
  severity: "BLOCKING" | "WARNING";
  message: string;
  field_path: string;
}

export interface ActaDraftPolishResult {
  mode: ActaDraftPolishMode;
  modelName: string;
  promptVersion: string;
  originalText: string;
  proposedText: string;
  proposals: ActaDraftPolishProposal[];
  appliedProposals: ActaDraftPolishProposal[];
  skippedProposals: Array<{ proposal: ActaDraftPolishProposal; reason: string }>;
  validation: {
    ok: boolean;
    issues: ActaDraftPolishValidationIssue[];
  };
  summary: string;
  disclaimer: string;
}

const LOCAL_MODEL_NAME = "capa3-document-copilot-local@0.1.0";
export const ACTA_DRAFT_POLISH_PROMPT_VERSION = "capa3-document-copilot.v1";
export const ACTA_DRAFT_POLISH_ALLOWED_TARGETS: ActaDraftPolishTarget[] = [
  "narrativa.introduccion",
  "narrativa.deliberaciones",
  "narrativa.incidencias_no_criticas",
];

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function cleanProposalText(value: unknown, max = 6000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function clampConfidence(value: unknown) {
  const number = typeof value === "number" && Number.isFinite(value) ? value : 0.5;
  return Math.max(0, Math.min(1, number));
}

function isAllowedTarget(value: unknown, allowedTargets: ActaDraftPolishTarget[]): value is ActaDraftPolishTarget {
  return typeof value === "string" && allowedTargets.includes(value as ActaDraftPolishTarget);
}

function normalizeProposal(
  raw: ActaDraftPolishProposal,
  allowedTargets: ActaDraftPolishTarget[],
): ActaDraftPolishProposal | null {
  if (!isAllowedTarget(raw.target, allowedTargets)) return null;
  const currentText = cleanProposalText(raw.currentText);
  const proposedText = cleanProposalText(raw.proposedText);
  if (!currentText || !proposedText || currentText === proposedText) return null;
  return {
    target: raw.target,
    currentText,
    proposedText,
    reason: cleanProposalText(raw.reason, 600) || "Pulido narrativo propuesto por el copiloto de redacción.",
    confidence: clampConfidence(raw.confidence),
    requiresHumanReview: true,
  };
}

function protectedFragments(model: ActaLegalStructureViewModel) {
  return [
    model.sections.heading,
    model.sections.constitution,
    model.sections.agenda,
    model.sections.agreementsAndVotes,
    model.sections.approval,
    model.sections.signatures,
    model.canonical_minutes_hash,
    ...model.agenda_items.map((point) => `${point.order_number}. ${point.title}`),
    ...model.agenda_items
      .filter((point) => point.kind === "DECISORIO")
      .flatMap((point) => [
        point.decisorio?.adoptedText,
        point.decisorio?.majorityApplied,
        point.decisorio?.proclamation,
      ]),
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}

function validateProtectedFragments(
  text: string,
  model: ActaLegalStructureViewModel,
): ActaDraftPolishValidationIssue[] {
  const issues: ActaDraftPolishValidationIssue[] = [];
  const normalized = normalizeText(text);
  for (const fragment of protectedFragments(model)) {
    if (!normalized.includes(normalizeText(fragment))) {
      issues.push({
        code: "AI_POLISH_PROTECTED_FRAGMENT_CHANGED",
        severity: "BLOCKING",
        field_path: "acta_legal_structure",
        message: "El copiloto no puede alterar hechos jurídicos, orden del día, acuerdos, votaciones, firmas ni hash del acta.",
      });
      break;
    }
  }
  return issues;
}

export function validateActaDraftPolishResult(
  text: string,
  model: ActaLegalStructureViewModel,
): ActaDraftPolishValidationIssue[] {
  const issues = validateProtectedFragments(text, model);
  for (const issue of validateRenderedActaAgainstLegalStructure(text, model)) {
    issues.push({
      code: `AI_POLISH_${issue.code}`,
      severity: issue.severity,
      field_path: "acta_legal_structure",
      message: issue.message,
    });
  }
  return issues;
}

export function applyActaDraftPolishProposals(params: {
  text: string;
  proposals: ActaDraftPolishProposal[];
  actaLegalStructure: ActaLegalStructureViewModel;
}) {
  let proposedText = params.text;
  const appliedProposals: ActaDraftPolishProposal[] = [];
  const skippedProposals: Array<{ proposal: ActaDraftPolishProposal; reason: string }> = [];

  for (const proposal of params.proposals) {
    if (!proposedText.includes(proposal.currentText)) {
      skippedProposals.push({ proposal, reason: "El fragmento original ya no coincide con el borrador actual." });
      continue;
    }

    const candidate = proposedText.replace(proposal.currentText, proposal.proposedText);
    const issues = validateActaDraftPolishResult(candidate, params.actaLegalStructure);
    if (issues.some((issue) => issue.severity === "BLOCKING")) {
      skippedProposals.push({ proposal, reason: "La propuesta altera contenido protegido del acta." });
      continue;
    }

    proposedText = candidate;
    appliedProposals.push(proposal);
  }

  const issues = validateActaDraftPolishResult(proposedText, params.actaLegalStructure);
  return {
    proposedText,
    appliedProposals,
    skippedProposals,
    validation: {
      ok: issues.every((issue) => issue.severity !== "BLOCKING"),
      issues,
    },
  };
}

function localNormalizeWhitespace(text: string): ActaDraftPolishProposal[] {
  const normalized = text
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (normalized === text.trim()) return [];
  return [{
    target: "narrativa.incidencias_no_criticas",
    currentText: text,
    proposedText: normalized,
    reason: "Normalización de espacios y saltos de línea sin alterar el contenido jurídico.",
    confidence: 0.55,
    requiresHumanReview: true,
  }];
}

export async function suggestActaDraftPolish(
  input: SuggestActaDraftPolishInput,
): Promise<ActaDraftPolishResult> {
  const allowedTargets = input.allowedTargets ?? ACTA_DRAFT_POLISH_ALLOWED_TARGETS;
  const maxProposals = Math.max(1, Math.min(input.maxProposals ?? 6, 10));
  const providerOutput = input.provider
    ? await input.provider({
        text: input.text,
        actaLegalStructure: input.actaLegalStructure,
        allowedTargets,
        maxProposals,
      })
    : {
        proposals: localNormalizeWhitespace(input.text),
        modelName: LOCAL_MODEL_NAME,
        promptVersion: ACTA_DRAFT_POLISH_PROMPT_VERSION,
        summary: "Normalización local determinista del borrador.",
      };

  const proposals = (providerOutput.proposals ?? [])
    .map((proposal) => normalizeProposal(proposal, allowedTargets))
    .filter((proposal): proposal is ActaDraftPolishProposal => !!proposal)
    .slice(0, maxProposals);
  const applied = applyActaDraftPolishProposals({
    text: input.text,
    proposals,
    actaLegalStructure: input.actaLegalStructure,
  });

  return {
    mode: input.provider ? "MODEL_ADAPTER" : "LOCAL_DEMO",
    modelName: providerOutput.modelName ?? (input.provider ? "configured-openai-model" : LOCAL_MODEL_NAME),
    promptVersion: providerOutput.promptVersion ?? ACTA_DRAFT_POLISH_PROMPT_VERSION,
    originalText: input.text,
    proposedText: applied.proposedText,
    proposals,
    appliedProposals: applied.appliedProposals,
    skippedProposals: applied.skippedProposals,
    validation: applied.validation,
    summary:
      providerOutput.summary ??
      (applied.appliedProposals.length > 0
        ? `${applied.appliedProposals.length} propuesta(s) aplicadas al borrador.`
        : "No se han identificado mejoras narrativas aplicables sin tocar contenido protegido."),
    disclaimer: "Copiloto Capa 3: sugerencias no vinculantes, con revisión humana obligatoria y validación legal posterior.",
  };
}
