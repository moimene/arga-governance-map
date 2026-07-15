import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";
import { isOperationalTemplate } from "@/lib/doc-gen/template-operability";
import { resolveMateriaAlias } from "@/lib/secretaria/agenda-materias";
import type { NormativeMaintenanceRole } from "@/lib/secretaria/mesa-control-societaria";
import { templateSelectionReason } from "@/lib/secretaria/normative-governance";
import {
  buildFunctionalKey,
  serializeFunctionalKey,
} from "@/lib/secretaria/template-admin/functional-key";
import { normalizeOrganoTipo } from "@/lib/secretaria/template-admin/organo-canonico";
import type { EstadoPlantilla } from "@/lib/secretaria/template-admin/types";

export type TemplateAvailabilityTone =
  | "current"
  | "preparation"
  | "historical"
  | "blocked";

export interface TemplateAvailabilityPresentation {
  label: string;
  description: string;
  tone: TemplateAvailabilityTone;
  canUse: boolean;
  isCurrent: boolean;
}

export interface NormalizedApprovalChecklistItem {
  check: string;
  passed: boolean;
}

export interface NormalizedTemplateVariable {
  name: string;
  source: string;
  condition: string;
  display: string;
}

export interface NormalizedTemplateEditableField {
  name: string;
  required: boolean;
  description: string;
  type: string;
  label: string;
}

export type TemplateLineDiffKind = "unchanged" | "added" | "removed";

export interface TemplateLineDiffEntry {
  kind: TemplateLineDiffKind;
  text: string;
  oldLine: number | null;
  newLine: number | null;
}

export type TemplateComparisonSectionKey =
  | "protectedText"
  | "legalReference"
  | "variables"
  | "editableFields"
  | "usageMetadata"
  | "approvalChecklist";

export interface TemplateComparisonSection {
  key: TemplateComparisonSectionKey;
  label: string;
  changed: boolean;
  before: string[];
  after: string[];
}

export interface TemplateVersionComparison {
  identical: boolean;
  summary: {
    changedSections: number;
    addedLines: number;
    removedLines: number;
    labels: string[];
  };
  lineDiff: TemplateLineDiffEntry[];
  sections: TemplateComparisonSection[];
}

export type CanonicalBindingTipoSocial = "SA" | "SL" | "SAU" | "SLU" | "ANY";

export interface EffectiveTemplateBindingLike {
  active?: boolean | null;
  materia?: string | null;
  organo_tipo?: string | null;
  tipo_social?: string | null;
  jurisdiccion?: string | null;
  adoption_mode?: string | null;
  doc_type?: string | null;
  template_id?: string | null;
}

export interface EffectiveTemplateBindingCriteria {
  template: PlantillaProtegidaRow;
  materia: string;
  jurisdiccion: string;
  tipoSocial?: string | null;
}

export interface TemplateMatterContextInput {
  requestedMatter?: string | null;
  templateMatter?: string | null;
  boundMatters: readonly string[];
  knownMatters: readonly string[];
}

export interface TemplateTransitionMutationInput {
  templateId: string;
  nextState: string;
  actor: string;
  motivo?: string;
  ackWarnings?: boolean;
  aprobadaPor?: string;
  fechaAprobacion?: string;
  operationId?: string;
  expectedFrom?: EstadoPlantilla;
  expectedPredecessorId?: string | null;
}

export interface TemplateBindingMutationInput {
  template: PlantillaProtegidaRow;
  bindings: readonly EffectiveTemplateBindingLike[];
  materia: string;
  entityTipoSocial?: string | null;
  jurisdiction?: string | null;
  userRole: NormativeMaintenanceRole;
}

function normalizeCode(value?: unknown) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function compareNormalizedRows<T>(
  left: T,
  right: T,
  key: (item: T) => string,
) {
  return key(left).localeCompare(key(right), "es");
}

function humanizeChecklistLabel(value: string) {
  const compact = value.trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
  if (!compact) return "";
  if (/^[A-ZÁÉÍÓÚÜÑ0-9 ]+$/u.test(compact)) {
    const lower = compact.toLocaleLowerCase("es");
    return lower.charAt(0).toLocaleUpperCase("es") + lower.slice(1);
  }
  return compact;
}

function requiredFromLegacyField(field: Record<string, unknown>) {
  if (typeof field.required === "boolean") return field.required;
  if (typeof field.requerido === "boolean") return field.requerido;
  const value = normalizeCode(field.obligatoriedad);
  return ["OBLIGATORIO", "OBLIGATORIA", "REQUIRED", "SI", "SÍ", "TRUE", "1"].includes(
    value,
  );
}

function arraysEqual(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function splitLiteralText(value?: string | null) {
  const normalized = (value ?? "").replace(/\r\n?/g, "\n");
  return normalized ? normalized.split("\n") : [];
}

function protectedText(template: PlantillaProtegidaRow) {
  return template.capa1_inmutable ?? template.contenido_template ?? "";
}

function buildLineDiff(before: string[], after: string[]): TemplateLineDiffEntry[] {
  const longestCommonSubsequence = Array.from({ length: before.length + 1 }, () =>
    Array<number>(after.length + 1).fill(0),
  );

  for (let oldIndex = before.length - 1; oldIndex >= 0; oldIndex -= 1) {
    for (let newIndex = after.length - 1; newIndex >= 0; newIndex -= 1) {
      longestCommonSubsequence[oldIndex][newIndex] =
        before[oldIndex] === after[newIndex]
          ? longestCommonSubsequence[oldIndex + 1][newIndex + 1] + 1
          : Math.max(
              longestCommonSubsequence[oldIndex + 1][newIndex],
              longestCommonSubsequence[oldIndex][newIndex + 1],
            );
    }
  }

  const result: TemplateLineDiffEntry[] = [];
  let oldIndex = 0;
  let newIndex = 0;
  while (oldIndex < before.length || newIndex < after.length) {
    if (
      oldIndex < before.length &&
      newIndex < after.length &&
      before[oldIndex] === after[newIndex]
    ) {
      result.push({
        kind: "unchanged",
        text: before[oldIndex],
        oldLine: oldIndex + 1,
        newLine: newIndex + 1,
      });
      oldIndex += 1;
      newIndex += 1;
      continue;
    }

    if (
      oldIndex < before.length &&
      (newIndex >= after.length ||
        longestCommonSubsequence[oldIndex + 1][newIndex] >=
          longestCommonSubsequence[oldIndex][newIndex + 1])
    ) {
      result.push({
        kind: "removed",
        text: before[oldIndex],
        oldLine: oldIndex + 1,
        newLine: null,
      });
      oldIndex += 1;
      continue;
    }

    result.push({
      kind: "added",
      text: after[newIndex],
      oldLine: null,
      newLine: newIndex + 1,
    });
    newIndex += 1;
  }

  return result;
}

function normalizedUsageMetadata(template: PlantillaProtegidaRow) {
  const functionalKey = buildFunctionalKey(template, template.tenant_id);
  return [
    `Tipo documental: ${functionalKey.tipo || "No indicado"}`,
    `Materia: ${functionalKey.materia || "No indicada"}`,
    `Jurisdicción: ${functionalKey.jurisdiccion || "No indicada"}`,
    `Órgano: ${functionalKey.organoTipo || "No indicado"}`,
    `Adopción: ${functionalKey.adoptionMode || "No aplica"}`,
    `Tipo social: ${functionalKey.tipoSocial || "Todos los tipos sociales"}`,
    `Snapshot normativo: ${template.snapshot_rule_pack_required ? "Requerido" : "No requerido"}`,
    `Contrato de variables: ${template.contrato_variables_version?.trim() || "No indicado"}`,
  ];
}

function section(
  key: TemplateComparisonSectionKey,
  label: string,
  before: string[],
  after: string[],
): TemplateComparisonSection {
  return { key, label, changed: !arraysEqual(before, after), before, after };
}

function validBindingTipoSocial(value?: unknown): CanonicalBindingTipoSocial | null {
  const normalized = normalizeCode(value);
  if (["SA", "SL", "SAU", "SLU", "ANY"].includes(normalized)) {
    return normalized as CanonicalBindingTipoSocial;
  }
  return null;
}

export function templateAvailabilityPresentation(
  template: PlantillaProtegidaRow,
): TemplateAvailabilityPresentation {
  const status = normalizeCode(template.estado);
  const canUse = isOperationalTemplate(template);

  if (status === "ARCHIVADA" || status === "DEPRECADA") {
    return {
      label: "Solo consulta histórica",
      description:
        "Se conserva por trazabilidad y no está disponible para nuevos expedientes.",
      tone: "historical",
      canUse: false,
      isCurrent: false,
    };
  }

  if (status === "ACTIVA" && canUse) {
    return {
      label: "Vigente para nuevos expedientes",
      description: "Es la versión vigente y está disponible para generar documentos.",
      tone: "current",
      canUse: true,
      isCurrent: true,
    };
  }

  if (status === "APROBADA" && canUse) {
    return {
      label: "Aprobada · utilizable en preparación",
      description:
        "Puede usarse por la política transitoria, pero todavía no es la versión vigente.",
      tone: "preparation",
      canUse: true,
      isCurrent: false,
    };
  }

  if ((status === "BORRADOR" || status === "REVISADA") && canUse) {
    return {
      label: "Versión de preparación con validación legal",
      description:
        "Puede usarse por la validación legal transitoria; debe completar el ciclo antes de ser vigente.",
      tone: "preparation",
      canUse: true,
      isCurrent: false,
    };
  }

  return {
    label: status === "ACTIVA" ? "Vigente sin contenido utilizable" : "Pendiente de completar el ciclo",
    description:
      status === "ACTIVA"
        ? "La versión está activa, pero no supera la política de disponibilidad documental."
        : "Debe completar contenido, revisión y aprobación antes de utilizarse.",
    tone: "blocked",
    canUse: false,
    isCurrent: false,
  };
}

export function normalizeApprovalChecklist(items: unknown): NormalizedApprovalChecklistItem[] {
  if (!Array.isArray(items)) return [];

  return items.flatMap((item) => {
    if (typeof item === "string") {
      const check = humanizeChecklistLabel(item);
      return check ? [{ check, passed: true }] : [];
    }

    const record = asRecord(item);
    const check = humanizeChecklistLabel(stringValue(record?.check));
    return record && check ? [{ check, passed: record.passed === true }] : [];
  });
}

export function normalizeTemplateVariables(items: unknown): NormalizedTemplateVariable[] {
  if (!Array.isArray(items)) return [];

  return items
    .flatMap((item) => {
      const record = asRecord(item);
      if (!record) return [];
      const normalized = {
        name: stringValue(record.variable) || stringValue(record.name),
        source: stringValue(record.fuente) || stringValue(record.source),
        condition: stringValue(record.condicion) || stringValue(record.condition),
        display: stringValue(record.display) || stringValue(record.label),
      };
      return normalized.name || normalized.source ? [normalized] : [];
    })
    .sort((left, right) =>
      compareNormalizedRows(left, right, (item) =>
        [item.name, item.source, item.condition, item.display].join("\u0000"),
      ),
    );
}

export function normalizeTemplateEditableFields(items: unknown): NormalizedTemplateEditableField[] {
  if (!Array.isArray(items)) return [];

  return items
    .flatMap((item) => {
      const record = asRecord(item);
      if (!record) return [];
      const name =
        stringValue(record.campo) || stringValue(record.name) || stringValue(record.field);
      if (!name) return [];
      return [
        {
          name,
          required: requiredFromLegacyField(record),
          description:
            stringValue(record.descripcion) ||
            stringValue(record.description) ||
            stringValue(record.hint),
          type: stringValue(record.tipo) || stringValue(record.type),
          label: stringValue(record.label) || name,
        },
      ];
    })
    .sort((left, right) =>
      compareNormalizedRows(left, right, (item) =>
        [item.name, item.required ? "1" : "0", item.type, item.label, item.description].join(
          "\u0000",
        ),
      ),
    );
}

export function findExactCurrentTemplate(
  historical: PlantillaProtegidaRow,
  templates: readonly PlantillaProtegidaRow[],
): PlantillaProtegidaRow | null {
  const historicalKey = serializeFunctionalKey(
    buildFunctionalKey(historical, historical.tenant_id),
  );
  const candidates = templates.filter(
    (template) =>
      template.id !== historical.id &&
      normalizeCode(template.estado) === "ACTIVA" &&
      serializeFunctionalKey(buildFunctionalKey(template, template.tenant_id)) === historicalKey,
  );
  return candidates.length === 1 ? candidates[0] : null;
}

export function buildTemplateVersionComparison(
  historical: PlantillaProtegidaRow,
  current: PlantillaProtegidaRow,
): TemplateVersionComparison {
  const beforeText = splitLiteralText(protectedText(historical));
  const afterText = splitLiteralText(protectedText(current));
  const historicalVariables = normalizeTemplateVariables(historical.capa2_variables);
  const currentVariables = normalizeTemplateVariables(current.capa2_variables);
  const historicalFields = normalizeTemplateEditableFields(historical.capa3_editables);
  const currentFields = normalizeTemplateEditableFields(current.capa3_editables);
  const historicalChecklist = normalizeApprovalChecklist(historical.approval_checklist);
  const currentChecklist = normalizeApprovalChecklist(current.approval_checklist);

  const sections = [
    section("protectedText", "Texto protegido", beforeText, afterText),
    section(
      "legalReference",
      "Referencia legal",
      historical.referencia_legal?.trim() ? [historical.referencia_legal.trim()] : [],
      current.referencia_legal?.trim() ? [current.referencia_legal.trim()] : [],
    ),
    section(
      "variables",
      "Variables automáticas",
      historicalVariables.map((item) =>
        [item.name, item.source, item.condition, item.display].filter(Boolean).join(" · "),
      ),
      currentVariables.map((item) =>
        [item.name, item.source, item.condition, item.display].filter(Boolean).join(" · "),
      ),
    ),
    section(
      "editableFields",
      "Campos editables",
      historicalFields.map((item) =>
        [item.name, item.required ? "Obligatorio" : "Opcional", item.type, item.description]
          .filter(Boolean)
          .join(" · "),
      ),
      currentFields.map((item) =>
        [item.name, item.required ? "Obligatorio" : "Opcional", item.type, item.description]
          .filter(Boolean)
          .join(" · "),
      ),
    ),
    section(
      "usageMetadata",
      "Configuración de uso",
      normalizedUsageMetadata(historical),
      normalizedUsageMetadata(current),
    ),
    section(
      "approvalChecklist",
      "Comprobación documental",
      historicalChecklist.map((item) => `${item.check} · ${item.passed ? "Completado" : "Pendiente"}`),
      currentChecklist.map((item) => `${item.check} · ${item.passed ? "Completado" : "Pendiente"}`),
    ),
  ];
  const lineDiff = buildLineDiff(beforeText, afterText);
  const changed = sections.filter((item) => item.changed);

  return {
    identical: changed.length === 0,
    summary: {
      changedSections: changed.length,
      addedLines: lineDiff.filter((item) => item.kind === "added").length,
      removedLines: lineDiff.filter((item) => item.kind === "removed").length,
      labels: changed.map((item) => item.label),
    },
    lineDiff,
    sections,
  };
}

export function canonicalBindingTipoSocial(value?: unknown): CanonicalBindingTipoSocial {
  return validBindingTipoSocial(value) ?? "ANY";
}

export function activeTemplateBindingMatters(
  bindings: readonly EffectiveTemplateBindingLike[],
  templateId?: string | null,
) {
  if (!templateId) return [];
  return [
    ...new Set(
      bindings
        .filter((binding) => binding.active === true && binding.template_id === templateId)
        .map((binding) => resolveMateriaAlias(binding.materia))
        .filter(Boolean),
    ),
  ];
}

/**
 * Conserva el contexto explícito de Materias cuando es una fila canónica real.
 * Si no lo hay, solo elige automáticamente una vinculación inequívoca o la
 * materia propia de la plantilla cuando también existe en el catálogo. Los
 * códigos compuestos legacy (p. ej. FUSION_ESCISION) nunca se inventan como
 * destino de escritura si no son una materia registrada.
 */
export function resolveTemplateMatterContext({
  requestedMatter,
  templateMatter,
  boundMatters,
  knownMatters,
}: TemplateMatterContextInput) {
  const known = new Set(knownMatters.map(resolveMateriaAlias).filter(Boolean));
  const canonicalBindings = [
    ...new Set(boundMatters.map(resolveMateriaAlias).filter((matter) => known.has(matter))),
  ];
  const requested = resolveMateriaAlias(requestedMatter);
  if (
    requested &&
    known.has(requested) &&
    (canonicalBindings.length === 0 || canonicalBindings.includes(requested))
  ) {
    return requested;
  }
  if (canonicalBindings.length === 1) return canonicalBindings[0];

  const ownMatter = resolveMateriaAlias(templateMatter);
  if (canonicalBindings.length === 0 && ownMatter && known.has(ownMatter)) return ownMatter;
  return "";
}

export function templateAppliesToSocialType(
  template: Pick<PlantillaProtegidaRow, "tipo_social">,
  entityTipoSocial?: string | null,
) {
  const templateSocialType = canonicalBindingTipoSocial(template.tipo_social);
  if (templateSocialType === "ANY") return true;
  const entitySocialType = canonicalBindingTipoSocial(entityTipoSocial);
  return entitySocialType !== "ANY" && templateSocialType === entitySocialType;
}

export function hasEffectiveTemplateBinding(
  bindings: readonly EffectiveTemplateBindingLike[],
  criteria: EffectiveTemplateBindingCriteria,
) {
  const requestedSocialType = canonicalBindingTipoSocial(criteria.tipoSocial);
  const requestedMatter = resolveMateriaAlias(criteria.materia);
  const requestedJurisdiction = normalizeCode(criteria.jurisdiccion);
  const requestedOrgano =
    normalizeOrganoTipo(criteria.template.organo_tipo) ?? normalizeCode(criteria.template.organo_tipo);
  const requestedAdoptionMode = normalizeCode(criteria.template.adoption_mode) || "ANY";
  const requestedDocType = normalizeCode(criteria.template.tipo);

  return bindings.some((binding) => {
    if (binding.active !== true || binding.template_id !== criteria.template.id) return false;
    if (resolveMateriaAlias(binding.materia) !== requestedMatter) return false;

    const bindingJurisdiction = normalizeCode(binding.jurisdiccion);
    if (![requestedJurisdiction, "ANY", "GLOBAL"].includes(bindingJurisdiction)) return false;

    const bindingSocialType = validBindingTipoSocial(binding.tipo_social);
    if (
      !bindingSocialType ||
      (bindingSocialType !== "ANY" && bindingSocialType !== requestedSocialType)
    ) {
      return false;
    }

    const bindingOrgano =
      normalizeOrganoTipo(binding.organo_tipo) ??
      (normalizeCode(binding.organo_tipo) || "ANY");
    if (bindingOrgano !== "ANY" && bindingOrgano !== requestedOrgano) return false;

    const bindingAdoptionMode = normalizeCode(binding.adoption_mode) || "ANY";
    if (bindingAdoptionMode !== "ANY" && bindingAdoptionMode !== requestedAdoptionMode) return false;

    const bindingDocType = normalizeCode(binding.doc_type);
    return bindingDocType === requestedDocType;
  });
}

export function buildTemplateTransitionMutationInput({
  templateId,
  nextState,
  actor,
  motivo,
  ackWarnings,
  aprobadaPor,
  fechaAprobacion,
  operationId,
  expectedFrom,
  expectedPredecessorId,
}: TemplateTransitionMutationInput) {
  return {
    id: templateId,
    nuevo_estado: nextState,
    motivo,
    ackWarnings,
    aprobadaPor,
    fechaAprobacion,
    actor,
    ...(operationId ? { operationId } : {}),
    ...(expectedFrom ? { expectedFrom } : {}),
    ...(expectedPredecessorId !== undefined ? { expectedPredecessorId } : {}),
  };
}

/** Devuelve null si la plantilla ya cubre efectivamente esa regla. */
export function buildTemplateBindingMutationInput({
  template,
  bindings,
  materia,
  entityTipoSocial,
  jurisdiction,
  userRole,
}: TemplateBindingMutationInput) {
  const canonicalMatter = resolveMateriaAlias(materia);
  if (!canonicalMatter) return null;

  const tipoSocial = canonicalBindingTipoSocial(entityTipoSocial);
  const effectiveJurisdiction = jurisdiction ?? template.jurisdiccion ?? "ES";
  if (
    hasEffectiveTemplateBinding(bindings, {
      template,
      materia: canonicalMatter,
      jurisdiccion: effectiveJurisdiction,
      tipoSocial,
    })
  ) {
    return null;
  }

  return {
    materia: canonicalMatter,
    organoTipo: template.organo_tipo ?? "ANY",
    tipoSocial,
    jurisdiccion: effectiveJurisdiction,
    adoptionMode: template.adoption_mode ?? "ANY",
    docType: template.tipo,
    templateId: template.id,
    priority: 100,
    selectionReason: templateSelectionReason({
      materia: canonicalMatter,
      docType: template.tipo,
      jurisdiction: effectiveJurisdiction,
      tipoSocial,
      organoTipo: template.organo_tipo,
      adoptionMode: template.adoption_mode,
    }),
    userRole,
  };
}
