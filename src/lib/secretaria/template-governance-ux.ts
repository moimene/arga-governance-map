import type { PlantillaProtegidaRow } from "@/hooks/usePlantillasProtegidas";
import type {
  LegalTemplateReviewRow,
} from "@/lib/secretaria/legal-template-review";
import type {
  LegalTemplateCoverageRow,
  LegalTemplateCoverageState,
} from "@/lib/secretaria/legal-template-coverage";
import {
  buildFunctionalKey,
  serializeFunctionalKey,
} from "@/lib/secretaria/template-admin/functional-key";
import { gatePreIssueLabel } from "@/lib/secretaria/template-admin/gate-pre-issue-labels";
import type { GatePreIssue } from "@/lib/secretaria/template-admin/types";

export interface TemplateGovernanceGroupingOptions {
  /** IDs que superan los filtros visibles del catálogo. Si se omite, todos son visibles. */
  matchingTemplateIds?: ReadonlySet<string>;
  /** Un deep-link exacto siempre conserva visible la familia y la versión solicitadas. */
  targetTemplateId?: string | null;
}

export interface TemplateGovernanceFamily {
  functionalKey: string;
  tipo: string;
  canonicalMatter: string;
  jurisdiccion: string;
  organoTipo: string;
  adoptionMode: string;
  tipoSocial: string | null;
  /** ACTIVA de mayor versión cuando existe; en otro caso, la mayor versión de la serie. */
  head: PlantillaProtegidaRow;
  /** Serie completa, con head primero y el resto en orden de versión descendente. */
  versions: PlantillaProtegidaRow[];
  activeCount: number;
  hasCurrent: boolean;
  hasHistoricalOnly: boolean;
  hasMatchingVersion: boolean;
  matchingTemplateIds: string[];
  containsTarget: boolean;
  targetTemplateId: string | null;
}

export interface TemplateGovernanceMatterGroup {
  canonicalMatter: string;
  templateCount: number;
  familyCount: number;
  families: TemplateGovernanceFamily[];
}

export interface TemplateGovernanceTypeGroup {
  tipo: string;
  templateCount: number;
  familyCount: number;
  matters: TemplateGovernanceMatterGroup[];
}

export type TemplateGovernanceIncidentSeverity = "ERROR" | "WARNING" | "INFO";

export interface TemplateGovernanceIncident {
  id: string;
  concept: string;
  severity: TemplateGovernanceIncidentSeverity;
  title: string;
  affected: number;
  consequence: string;
  action: string;
  destination: string;
  technicalCodes: string[];
  firstTemplateId: string | null;
}

export interface TemplateGovernanceCoreGap {
  organo: string;
  materia: string;
}

export type TemplateGateIssuesByTemplate =
  | ReadonlyMap<string, readonly GatePreIssue[]>
  | Readonly<Record<string, readonly GatePreIssue[]>>;

export type TemplateGovernanceP0Input =
  | ReadonlySet<string>
  | readonly string[]
  | readonly { id: string }[];

export interface BuildTemplateGovernanceIncidentsInput {
  templates: readonly PlantillaProtegidaRow[];
  legalReviewRows: readonly LegalTemplateReviewRow[];
  extendedCoverage: readonly LegalTemplateCoverageRow[];
  coreGaps: readonly TemplateGovernanceCoreGap[];
  /** Permite conservar el total aunque el caller solo haya cargado una muestra de gaps. */
  coreGapCount?: number;
  orphanCount: number;
  gateIssuesByTemplate: TemplateGateIssuesByTemplate;
  p0TemplateIds: TemplateGovernanceP0Input;
}

type MutableFamily = {
  functionalKey: string;
  templates: PlantillaProtegidaRow[];
};

type MutableIncidentGroup = {
  templateIds: Set<string>;
  technicalCodes: Set<string>;
};

const INCIDENT_SEVERITY_ORDER: Record<TemplateGovernanceIncidentSeverity, number> = {
  ERROR: 0,
  WARNING: 1,
  INFO: 2,
};

const LEGAL_INCIDENTS: ReadonlyArray<{
  flag: keyof LegalTemplateReviewRow["flags"];
  concept: string;
  severity: TemplateGovernanceIncidentSeverity;
  title: string;
  consequence: string;
  action: string;
  technicalCode: string;
}> = [
  {
    flag: "missingOwner",
    concept: "legal-owner-missing",
    severity: "ERROR",
    title: "Falta órgano competente o forma de adopción",
    consequence: "La plantilla vigente no puede asignarse con seguridad al proceso societario correcto.",
    action: "Completar y revisar los metadatos jurídicos de aplicación.",
    technicalCode: "MISSING_OWNER",
  },
  {
    flag: "missingReference",
    concept: "legal-reference-missing",
    severity: "WARNING",
    title: "Referencia legal pendiente",
    consequence: "No queda trazada la base jurídica de la plantilla vigente.",
    action: "Añadir la referencia legal y someter el cambio a revisión.",
    technicalCode: "MISSING_REFERENCE",
  },
  {
    flag: "missingApproval",
    concept: "formal-approval-missing",
    severity: "WARNING",
    title: "Aprobación formal pendiente",
    consequence: "La vigencia operativa no está respaldada por responsable y fecha de aprobación completos.",
    action: "Formalizar la aprobación de las plantillas afectadas.",
    technicalCode: "MISSING_APPROVAL",
  },
  {
    flag: "draftVersion",
    concept: "provisional-version-active",
    severity: "WARNING",
    title: "Versión provisional en uso",
    consequence: "Una versión 0.x o no semántica permanece vigente para nuevos expedientes.",
    action: "Cerrar la revisión y publicar una versión estable.",
    technicalCode: "DRAFT_VERSION",
  },
  {
    flag: "notesRequireReview",
    concept: "legal-notes-review-pending",
    severity: "WARNING",
    title: "Notas jurídicas con revisión pendiente",
    consequence: "El propio contenido jurídico advierte de trabajo pendiente en una plantilla vigente.",
    action: "Resolver las notas y documentar el cierre de la revisión.",
    technicalCode: "NOTES_REQUIRE_REVIEW",
  },
] as const;

function normalizeCode(value?: string | null) {
  return value?.trim().toUpperCase() || "";
}

function parseSemver(value: string) {
  const match = value.trim().match(
    /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/,
  );
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4]?.split(".") ?? [],
  };
}

function comparePrerelease(left: string[], right: string[]) {
  if (left.length === 0 && right.length === 0) return 0;
  if (left.length === 0) return 1;
  if (right.length === 0) return -1;

  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = left[index];
    const rightPart = right[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    if (leftPart === rightPart) continue;
    const leftNumber = /^\d+$/.test(leftPart) ? Number(leftPart) : null;
    const rightNumber = /^\d+$/.test(rightPart) ? Number(rightPart) : null;
    if (leftNumber !== null && rightNumber !== null) return leftNumber - rightNumber;
    if (leftNumber !== null) return -1;
    if (rightNumber !== null) return 1;
    return leftPart.localeCompare(rightPart, "es");
  }
  return 0;
}

/** Positivo cuando `left` es una versión posterior a `right`. */
export function compareTemplateGovernanceVersions(left: string, right: string) {
  const leftSemver = parseSemver(left);
  const rightSemver = parseSemver(right);
  if (leftSemver && rightSemver) {
    for (const field of ["major", "minor", "patch"] as const) {
      if (leftSemver[field] !== rightSemver[field]) {
        return leftSemver[field] - rightSemver[field];
      }
    }
    return comparePrerelease(leftSemver.prerelease, rightSemver.prerelease);
  }
  if (leftSemver) return 1;
  if (rightSemver) return -1;
  return left.localeCompare(right, "es", { numeric: true, sensitivity: "base" });
}

function compareTemplatesByVersion(
  left: PlantillaProtegidaRow,
  right: PlantillaProtegidaRow,
) {
  const version = compareTemplateGovernanceVersions(right.version, left.version);
  if (version !== 0) return version;
  const createdAt = (right.created_at || "").localeCompare(left.created_at || "");
  if (createdAt !== 0) return createdAt;
  return left.id.localeCompare(right.id, "es");
}

function buildGovernanceFamily(
  mutable: MutableFamily,
  options: TemplateGovernanceGroupingOptions,
): TemplateGovernanceFamily {
  const sorted = [...mutable.templates].sort(compareTemplatesByVersion);
  const active = sorted.filter((template) => normalizeCode(template.estado) === "ACTIVA");
  const head = active[0] ?? sorted[0];
  const functionalKey = buildFunctionalKey(head, head.tenant_id);
  const versions = [head, ...sorted.filter((template) => template.id !== head.id)];
  const matchingTemplateIds = options.matchingTemplateIds
    ? versions
        .filter((template) => options.matchingTemplateIds?.has(template.id))
        .map((template) => template.id)
    : versions.map((template) => template.id);
  const targetTemplateId = options.targetTemplateId?.trim() || null;

  return {
    functionalKey: mutable.functionalKey,
    tipo: functionalKey.tipo,
    canonicalMatter: functionalKey.materia,
    jurisdiccion: functionalKey.jurisdiccion,
    organoTipo: functionalKey.organoTipo,
    adoptionMode: functionalKey.adoptionMode,
    tipoSocial: functionalKey.tipoSocial,
    head,
    versions,
    activeCount: active.length,
    hasCurrent: active.length > 0,
    hasHistoricalOnly: active.length === 0,
    hasMatchingVersion: matchingTemplateIds.length > 0,
    matchingTemplateIds,
    containsTarget: targetTemplateId
      ? versions.some((template) => template.id === targetTemplateId)
      : false,
    targetTemplateId,
  };
}

/**
 * Agrupa el catálogo sin fusionar variantes jurídicas: tipo → materia
 * canónica → identidad funcional completa → serie de versiones.
 */
export function groupTemplatesForGovernance(
  templates: readonly PlantillaProtegidaRow[],
  options: TemplateGovernanceGroupingOptions = {},
): TemplateGovernanceTypeGroup[] {
  const mutableFamilies = new Map<string, MutableFamily>();

  for (const template of templates) {
    const functionalKey = serializeFunctionalKey(
      buildFunctionalKey(template, template.tenant_id),
    );
    const family = mutableFamilies.get(functionalKey) ?? {
      functionalKey,
      templates: [],
    };
    family.templates.push(template);
    mutableFamilies.set(functionalKey, family);
  }

  const families = [...mutableFamilies.values()]
    .map((family) => buildGovernanceFamily(family, options))
    .filter(
      (family) =>
        options.matchingTemplateIds === undefined ||
        family.hasMatchingVersion ||
        family.containsTarget,
    )
    .sort((left, right) =>
      [left.tipo, left.canonicalMatter, left.organoTipo, left.adoptionMode, left.jurisdiccion, left.tipoSocial ?? "", left.functionalKey]
        .join("\u0000")
        .localeCompare(
          [right.tipo, right.canonicalMatter, right.organoTipo, right.adoptionMode, right.jurisdiccion, right.tipoSocial ?? "", right.functionalKey].join("\u0000"),
          "es",
        ),
    );

  const byType = new Map<string, Map<string, TemplateGovernanceFamily[]>>();
  for (const family of families) {
    const byMatter = byType.get(family.tipo) ?? new Map<string, TemplateGovernanceFamily[]>();
    const matterFamilies = byMatter.get(family.canonicalMatter) ?? [];
    matterFamilies.push(family);
    byMatter.set(family.canonicalMatter, matterFamilies);
    byType.set(family.tipo, byMatter);
  }

  return [...byType.entries()].map(([tipo, byMatter]) => {
    const matters = [...byMatter.entries()].map(([canonicalMatter, matterFamilies]) => ({
      canonicalMatter,
      templateCount: matterFamilies.reduce((total, family) => total + family.versions.length, 0),
      familyCount: matterFamilies.length,
      families: matterFamilies,
    }));
    return {
      tipo,
      templateCount: matters.reduce((total, matter) => total + matter.templateCount, 0),
      familyCount: matters.reduce((total, matter) => total + matter.familyCount, 0),
      matters,
    };
  });
}

function addIncidentGroup(
  groups: Map<string, MutableIncidentGroup>,
  key: string,
  templateId: string,
  technicalCode: string,
) {
  const group = groups.get(key) ?? {
    templateIds: new Set<string>(),
    technicalCodes: new Set<string>(),
  };
  group.templateIds.add(templateId);
  group.technicalCodes.add(technicalCode);
  groups.set(key, group);
}

function firstValue(values: Set<string>) {
  return [...values].sort((left, right) => left.localeCompare(right, "es"))[0] ?? null;
}

function sortedCodes(values: Iterable<string>) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, "es"));
}

function p0Ids(input: TemplateGovernanceP0Input) {
  if (Array.isArray(input)) {
    return new Set(input.map((item) => (typeof item === "string" ? item : item.id)));
  }
  return new Set(input as ReadonlySet<string>);
}

function gateEntries(input: TemplateGateIssuesByTemplate) {
  if (input instanceof Map) return [...input.entries()];
  return Object.entries(input);
}

function coverageIncidentConfig(state: LegalTemplateCoverageState) {
  if (state === "missing") {
    return {
      concept: "extended-coverage-missing",
      severity: "ERROR" as const,
      title: "Cobertura documental ausente",
      consequence: "Hay procesos societarios sin una plantilla disponible.",
      action: "Preparar y aprobar las plantillas que faltan.",
      technicalCode: "COVERAGE_MISSING",
    };
  }
  if (state === "fixture_pending_load") {
    return {
      concept: "extended-coverage-provisional",
      severity: "WARNING" as const,
      title: "Cobertura documental provisional",
      consequence: "La cobertura depende de plantillas provisionales locales y no de una plantilla gobernada en Cloud.",
      action: "Cargar, revisar y aprobar la cobertura provisional.",
      technicalCode: "COVERAGE_PROVISIONAL",
    };
  }
  if (state === "cloud_pending") {
    return {
      concept: "extended-coverage-pending",
      severity: "WARNING" as const,
      title: "Cobertura documental en preparación",
      consequence: "La plantilla existe, pero todavía no está vigente para nuevos expedientes.",
      action: "Completar el ciclo de revisión y activación.",
      technicalCode: "COVERAGE_PENDING",
    };
  }
  return null;
}

function gateSeverity(severity: GatePreIssue["severity"]): TemplateGovernanceIncidentSeverity {
  if (severity === "BLOCKING") return "ERROR";
  return severity;
}

function highestSeverity(
  left: TemplateGovernanceIncidentSeverity,
  right: TemplateGovernanceIncidentSeverity,
) {
  return INCIDENT_SEVERITY_ORDER[left] <= INCIDENT_SEVERITY_ORDER[right] ? left : right;
}

/**
 * Construye la cola de salud vigente. Las fuentes ya calculadas siguen siendo
 * canónicas: este helper agrega y presenta, pero no vuelve a detectar brechas.
 */
export function buildTemplateGovernanceIncidents(
  input: BuildTemplateGovernanceIncidentsInput,
): TemplateGovernanceIncident[] {
  const activeTemplates = input.templates.filter(
    (template) => normalizeCode(template.estado) === "ACTIVA",
  );
  const activeById = new Map(activeTemplates.map((template) => [template.id, template]));
  const incidents: TemplateGovernanceIncident[] = [];

  const reviewGroups = new Map<string, MutableIncidentGroup>();
  const duplicateGroups = new Map<string, MutableIncidentGroup>();
  for (const row of input.legalReviewRows) {
    if (!activeById.has(row.templateId) || row.flags.localFixture) continue;
    if (row.flags.duplicateMatter && row.duplicateKey) {
      addIncidentGroup(
        duplicateGroups,
        row.duplicateKey,
        row.templateId,
        "DUPLICATE_MATTER",
      );
    }
    for (const config of LEGAL_INCIDENTS) {
      if (row.flags[config.flag]) {
        addIncidentGroup(
          reviewGroups,
          config.concept,
          row.templateId,
          config.technicalCode,
        );
      }
    }
  }

  for (const [duplicateKey, group] of duplicateGroups) {
    incidents.push({
      id: `legal-duplicate:${duplicateKey}`,
      concept: "active-functional-duplicate",
      severity: "ERROR",
      title: "Duplicidad de plantilla vigente",
      affected: group.templateIds.size,
      consequence: "La selección automática no tiene una única versión vigente inequívoca.",
      action: "Revisar la familia y decidir qué versión debe permanecer vigente.",
      destination: "/secretaria/gestor-plantillas?tab=catalogo",
      technicalCodes: sortedCodes(group.technicalCodes),
      firstTemplateId: firstValue(group.templateIds),
    });
  }

  for (const config of LEGAL_INCIDENTS) {
    const group = reviewGroups.get(config.concept);
    if (!group) continue;
    incidents.push({
      id: `legal:${config.concept}`,
      concept: config.concept,
      severity: config.severity,
      title: config.title,
      affected: group.templateIds.size,
      consequence: config.consequence,
      action: config.action,
      destination: "/secretaria/gestor-plantillas?tab=catalogo",
      technicalCodes: sortedCodes(group.technicalCodes),
      firstTemplateId: firstValue(group.templateIds),
    });
  }

  const coverageGroups = new Map<
    LegalTemplateCoverageState,
    { rows: LegalTemplateCoverageRow[]; templateIds: Set<string> }
  >();
  for (const row of input.extendedCoverage) {
    const config = coverageIncidentConfig(row.state);
    if (!config) continue;
    const group = coverageGroups.get(row.state) ?? { rows: [], templateIds: new Set<string>() };
    group.rows.push(row);
    for (const templateId of row.cloudTemplateIds) group.templateIds.add(templateId);
    if (row.fixtureTemplateId) group.templateIds.add(row.fixtureTemplateId);
    coverageGroups.set(row.state, group);
  }

  for (const [state, group] of coverageGroups) {
    const config = coverageIncidentConfig(state);
    if (!config) continue;
    incidents.push({
      id: `coverage:${state}`,
      concept: config.concept,
      severity: config.severity,
      title: config.title,
      affected: group.rows.length,
      consequence: config.consequence,
      action: config.action,
      destination: "/secretaria/gestor-plantillas?tab=cobertura",
      technicalCodes: sortedCodes([
        config.technicalCode,
        ...group.rows.map((row) => `COVERAGE:${row.key}`),
      ]),
      firstTemplateId: firstValue(group.templateIds),
    });
  }

  const coreGapCount = Math.max(input.coreGapCount ?? input.coreGaps.length, input.coreGaps.length);
  if (coreGapCount > 0) {
    incidents.push({
      id: "coverage:core-v1",
      concept: "core-coverage-missing",
      severity: "ERROR",
      title: "Cobertura core v1.0 incompleta",
      affected: coreGapCount,
      consequence: "Faltan combinaciones esenciales de materia y órgano para el circuito societario.",
      action: "Completar y activar las combinaciones core pendientes.",
      destination: "/secretaria/gestor-plantillas?tab=cobertura",
      technicalCodes: sortedCodes(
        input.coreGaps.map((gap) => `CORE_GAP:${gap.organo}:${gap.materia}`),
      ),
      firstTemplateId: null,
    });
  }

  if (input.orphanCount > 0) {
    incidents.push({
      id: "audit:without-changelog",
      concept: "traceability-without-changelog",
      severity: "WARNING",
      title: "Trazabilidad formal pendiente",
      affected: input.orphanCount,
      consequence: "No puede presentarse el ciclo de cambios completo de todas las plantillas vivas.",
      action: "Revisar las plantillas sin historial de cambios y documentar el origen de su versión vigente.",
      destination: "/secretaria/gestor-plantillas?tab=auditoria&focus=sin-changelog",
      technicalCodes: ["WITHOUT_CHANGELOG"],
      firstTemplateId: null,
    });
  }

  const activeP0Ids = [...p0Ids(input.p0TemplateIds)].filter((id) => activeById.has(id));
  if (activeP0Ids.length > 0) {
    incidents.push({
      id: "legal:known-p0",
      concept: "known-p0-active",
      severity: "ERROR",
      title: "Bloqueo jurídico P0 conocido",
      affected: activeP0Ids.length,
      consequence: "Las plantillas afectadas mantienen una incidencia jurídica crítica conocida.",
      action: "Resolver el P0 y validar de nuevo antes de mantener la plantilla vigente.",
      destination: "/secretaria/gestor-plantillas?tab=catalogo",
      technicalCodes: ["KNOWN_P0"],
      firstTemplateId: [...activeP0Ids].sort((left, right) => left.localeCompare(right, "es"))[0],
    });
  }

  const gateGroups = new Map<
    string,
    MutableIncidentGroup & { severity: TemplateGovernanceIncidentSeverity }
  >();
  for (const [templateId, issues] of gateEntries(input.gateIssuesByTemplate)) {
    if (!activeById.has(templateId)) continue;
    for (const issue of issues) {
      // SEM_ACTIVA_CAMPOS_REQUERIDOS duplica huecos que la revisión legal ya
      // reporta (órgano/adopción/referencia) — sin excluirlo, la cola contaba
      // el mismo hueco dos veces con severidades contradictorias.
      if (
        issue.code.startsWith("META_") ||
        issue.code === "DUP_ACTIVE_FUNCTIONAL_KEY" ||
        issue.code === "SEM_ACTIVA_CAMPOS_REQUERIDOS"
      ) continue;
      const severity = gateSeverity(issue.severity);
      const group = gateGroups.get(issue.code) ?? {
        templateIds: new Set<string>(),
        technicalCodes: new Set<string>(),
        severity,
      };
      group.templateIds.add(templateId);
      group.technicalCodes.add(issue.code);
      group.severity = highestSeverity(group.severity, severity);
      gateGroups.set(issue.code, group);
    }
  }

  for (const [code, group] of gateGroups) {
    incidents.push({
      id: `gate:${code}`,
      concept: `document-check:${code}`,
      severity: group.severity,
      title: gatePreIssueLabel(code),
      affected: group.templateIds.size,
      consequence:
        group.severity === "ERROR"
          ? "El documento puede generarse incompleto o incumplir el contrato de capas."
          : "La calidad o mantenibilidad del documento requiere revisión.",
      action: "Abrir la primera plantilla afectada y corregir la comprobación documental.",
      destination: "/secretaria/gestor-plantillas?tab=catalogo",
      technicalCodes: sortedCodes(group.technicalCodes),
      firstTemplateId: firstValue(group.templateIds),
    });
  }

  return incidents.sort((left, right) => {
    const severity = INCIDENT_SEVERITY_ORDER[left.severity] - INCIDENT_SEVERITY_ORDER[right.severity];
    if (severity !== 0) return severity;
    const title = left.title.localeCompare(right.title, "es");
    return title !== 0 ? title : left.id.localeCompare(right.id, "es");
  });
}
