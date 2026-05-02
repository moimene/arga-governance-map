import { calcularRulesetSnapshotId } from "./plantillas-engine";
import type { EvalSeverity, ExplainNode, RuleParamOverride } from "./types";

export type RuleLifecycleStatus =
  | "DRAFT"
  | "LEGAL_REVIEW"
  | "APPROVED"
  | "ACTIVE"
  | "DEPRECATED"
  | "RETIRED"
  | "UNKNOWN";

export interface RawRulePackRelation {
  id?: unknown;
  materia?: unknown;
  materia_clase?: unknown;
  clase?: unknown;
  organo_tipo?: unknown;
  descripcion?: unknown;
  nombre?: unknown;
}

export interface RawRulePackVersionRow {
  id?: unknown;
  pack_id?: unknown;
  rule_pack_id?: unknown;
  version?: unknown;
  version_tag?: unknown;
  version_number?: unknown;
  payload?: unknown;
  params?: unknown;
  is_active?: unknown;
  status?: unknown;
  estado?: unknown;
  materia?: unknown;
  materia_clase?: unknown;
  clase?: unknown;
  organo_tipo?: unknown;
  descripcion?: unknown;
  nombre?: unknown;
  effective_from?: unknown;
  effective_to?: unknown;
  created_at?: unknown;
  approved_at?: unknown;
  payload_hash?: unknown;
  rule_packs?: RawRulePackRelation | RawRulePackRelation[] | null;
}

export interface CanonicalRulePackVersion {
  versionId: string;
  packId: string;
  version: string;
  lifecycleStatus: RuleLifecycleStatus;
  isProductionUsable: boolean;
  materia: string | null;
  clase: string | null;
  organoTipo: string | null;
  nombre: string | null;
  descripcion: string | null;
  payload: unknown;
  persistedPayloadHash: string | null;
  payloadHash: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  createdAt: string | null;
  sourceShape: "LIFECYCLE_STATUS" | "LEGACY_IS_ACTIVE" | "UNKNOWN";
  warnings: string[];
}

export interface RuleResolutionInput {
  materia: string;
  versions: RawRulePackVersionRow[];
  overrides?: RuleParamOverride[];
  organoTipo?: string | null;
  clase?: string | null;
  now?: string | Date;
  allowApprovedInUat?: boolean;
}

export interface RuleResolution {
  ok: boolean;
  severity: EvalSeverity;
  rulePack: CanonicalRulePackVersion | null;
  applicableOverrides: RuleParamOverride[];
  rulesetSnapshotId: string | null;
  explain: ExplainNode[];
  blocking_issues: string[];
  warnings: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function relationFrom(row: RawRulePackVersionRow): RawRulePackRelation | null {
  if (Array.isArray(row.rule_packs)) return row.rule_packs[0] ?? null;
  return row.rule_packs ?? null;
}

function payloadRecord(payload: unknown): Record<string, unknown> {
  return isRecord(payload) ? payload : {};
}

function addMetadataConflictWarning(
  warnings: string[],
  field: string,
  relationValue: string | null,
  payloadValue: string | null
) {
  if (!relationValue || !payloadValue || relationValue === payloadValue) return;
  warnings.push(
    `Conflicto metadata rule_packs/payload en ${field}: catalogo=${relationValue}, payload=${payloadValue}; se usa payload versionado.`
  );
}

function normalizeStatusText(value: string): RuleLifecycleStatus | null {
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (["DRAFT", "BORRADOR"].includes(normalized)) return "DRAFT";
  if (["LEGAL_REVIEW", "IN_REVIEW", "REVIEW", "REVISADA", "REVISADO"].includes(normalized)) {
    return "LEGAL_REVIEW";
  }
  if (["APPROVED", "APROBADA", "APROBADO"].includes(normalized)) return "APPROVED";
  if (["ACTIVE", "ACTIVA", "ACTIVO"].includes(normalized)) return "ACTIVE";
  if (["DEPRECATED", "DEPRECADA", "DEPRECADO"].includes(normalized)) return "DEPRECATED";
  if (["RETIRED", "RETIRADA", "RETIRADO", "ARCHIVED", "ARCHIVADA", "ARCHIVADO"].includes(normalized)) {
    return "RETIRED";
  }
  return null;
}

export function normalizeRuleLifecycleStatus(row: RawRulePackVersionRow): RuleLifecycleStatus {
  const status = firstString(row.status, row.estado);
  const normalized = status ? normalizeStatusText(status) : null;
  if (normalized) return normalized;

  if (typeof row.is_active === "boolean") return row.is_active ? "ACTIVE" : "DEPRECATED";
  return "UNKNOWN";
}

export function normalizeRulePackVersion(row: RawRulePackVersionRow): CanonicalRulePackVersion {
  const relation = relationFrom(row);
  const payload = row.payload ?? row.params ?? null;
  const payloadObj = payloadRecord(payload);
  const lifecycleStatus = normalizeRuleLifecycleStatus(row);
  const sourceShape =
    firstString(row.status, row.estado) !== null
      ? "LIFECYCLE_STATUS"
      : typeof row.is_active === "boolean"
        ? "LEGACY_IS_ACTIVE"
        : "UNKNOWN";

  const packId = firstString(row.pack_id, row.rule_pack_id, relation?.id, row.id, payloadObj.id) ?? "UNKNOWN_PACK";
  const version = firstString(row.version, row.version_tag, row.version_number, payloadObj.version) ?? "UNKNOWN_VERSION";
  const warnings: string[] = [];
  const relationMateria = firstString(row.materia, row.materia_clase, relation?.materia, relation?.materia_clase);
  const payloadMateria = firstString(payloadObj.materia, payloadObj.id);
  const relationClase = firstString(row.clase, relation?.clase);
  const payloadClase = firstString(payloadObj.clase);
  const relationOrganoTipo = firstString(row.organo_tipo, relation?.organo_tipo);
  const payloadOrganoTipo = firstString(payloadObj.organoTipo, payloadObj.organo_tipo);
  const persistedPayloadHash = firstString(row.payload_hash);

  if (sourceShape === "LEGACY_IS_ACTIVE") {
    warnings.push("Versión normalizada desde is_active legacy; falta lifecycle jurídico completo.");
  }
  if (sourceShape === "UNKNOWN") {
    warnings.push("No se ha podido determinar lifecycle de la versión.");
  }
  if (!payload) {
    warnings.push("La versión no contiene payload/params de rule pack.");
  }
  addMetadataConflictWarning(warnings, "materia", relationMateria, payloadMateria);
  addMetadataConflictWarning(warnings, "clase", relationClase, payloadClase);
  addMetadataConflictWarning(warnings, "organo_tipo", relationOrganoTipo, payloadOrganoTipo);

  return {
    versionId: firstString(row.id) ?? `${packId}@${version}`,
    packId,
    version,
    lifecycleStatus,
    isProductionUsable: lifecycleStatus === "ACTIVE",
    materia: firstString(payloadMateria, relationMateria),
    clase: firstString(payloadClase, relationClase),
    organoTipo: firstString(payloadOrganoTipo, relationOrganoTipo),
    nombre: firstString(row.nombre, relation?.nombre, payloadObj.nombre),
    descripcion: firstString(row.descripcion, relation?.descripcion, payloadObj.descripcion),
    payload,
    persistedPayloadHash,
    payloadHash: persistedPayloadHash ?? calcularRulesetSnapshotId({ packId, version, payload }),
    effectiveFrom: firstString(row.effective_from),
    effectiveTo: firstString(row.effective_to),
    createdAt: firstString(row.created_at, row.approved_at),
    sourceShape,
    warnings,
  };
}

function semverParts(version: string): number[] {
  const parts = version.match(/\d+/g);
  return parts ? parts.map((part) => Number(part)) : [0];
}

function compareVersionDesc(a: CanonicalRulePackVersion, b: CanonicalRulePackVersion): number {
  const aParts = semverParts(a.version);
  const bParts = semverParts(b.version);
  const length = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < length; i += 1) {
    const diff = (bParts[i] ?? 0) - (aParts[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
}

function isWithinVigencia(version: CanonicalRulePackVersion, now: Date): boolean {
  if (version.effectiveFrom && new Date(version.effectiveFrom) > now) return false;
  if (version.effectiveTo && new Date(version.effectiveTo) < now) return false;
  return true;
}

function statusAllowed(version: CanonicalRulePackVersion, allowApprovedInUat: boolean): boolean {
  if (version.lifecycleStatus === "ACTIVE") return true;
  return allowApprovedInUat && version.lifecycleStatus === "APPROVED";
}

function makeExplain(regla: string, resultado: EvalSeverity, mensaje: string): ExplainNode {
  return {
    regla,
    fuente: "SISTEMA",
    resultado,
    mensaje,
  };
}

export function resolveRulePackForMatter(input: RuleResolutionInput): RuleResolution {
  const now = input.now instanceof Date ? input.now : new Date(input.now ?? Date.now());
  const normalized = input.versions.map(normalizeRulePackVersion);
  const explain: ExplainNode[] = [];
  const warnings: string[] = [];
  const blocking_issues: string[] = [];

  explain.push(makeExplain("RULE_PACK_LOOKUP", "OK", `Buscando rule pack para materia ${input.materia}.`));

  const matterMatches = normalized.filter((version) => {
    return version.materia === input.materia || version.packId === input.materia;
  });

  if (matterMatches.length === 0) {
    const message = `No existe rule pack para la materia ${input.materia}.`;
    blocking_issues.push(message);
    explain.push(makeExplain("RULE_PACK_LOOKUP", "BLOCKING", message));
    return {
      ok: false,
      severity: "BLOCKING",
      rulePack: null,
      applicableOverrides: [],
      rulesetSnapshotId: null,
      explain,
      blocking_issues,
      warnings,
    };
  }

  warnings.push(...matterMatches.flatMap((version) => version.warnings));

  const lifecycleMatches = matterMatches.filter((version) => statusAllowed(version, input.allowApprovedInUat ?? false));
  if (lifecycleMatches.length === 0) {
    const message = `La materia ${input.materia} no tiene versión ACTIVE${input.allowApprovedInUat ? " ni APPROVED" : ""}.`;
    blocking_issues.push(message);
    explain.push(makeExplain("RULE_PACK_LIFECYCLE", "BLOCKING", message));
    return {
      ok: false,
      severity: "BLOCKING",
      rulePack: null,
      applicableOverrides: [],
      rulesetSnapshotId: null,
      explain,
      blocking_issues,
      warnings,
    };
  }

  const vigenteMatches = lifecycleMatches.filter((version) => isWithinVigencia(version, now));
  if (vigenteMatches.length === 0) {
    const message = `La materia ${input.materia} tiene versiones activables, pero ninguna vigente en la fecha de evaluación.`;
    blocking_issues.push(message);
    explain.push(makeExplain("RULE_PACK_VIGENCIA", "BLOCKING", message));
    return {
      ok: false,
      severity: "BLOCKING",
      rulePack: null,
      applicableOverrides: [],
      rulesetSnapshotId: null,
      explain,
      blocking_issues,
      warnings,
    };
  }

  const scopedMatches = vigenteMatches.filter((version) => {
    const organoOk = !input.organoTipo || !version.organoTipo || version.organoTipo === input.organoTipo;
    const claseOk = !input.clase || !version.clase || version.clase === input.clase;
    return organoOk && claseOk;
  });

  const candidates = scopedMatches.length > 0 ? scopedMatches : vigenteMatches;
  if (scopedMatches.length === 0 && (input.organoTipo || input.clase)) {
    warnings.push("No hay match exacto de órgano/clase; se usa el mejor rule pack vigente de la materia.");
  }

  const sorted = [...candidates].sort(compareVersionDesc);
  const selected = sorted[0] ?? null;
  if (!selected) {
    const message = `No se pudo seleccionar una versión de rule pack para ${input.materia}.`;
    blocking_issues.push(message);
    explain.push(makeExplain("RULE_PACK_SELECTION", "BLOCKING", message));
    return {
      ok: false,
      severity: "BLOCKING",
      rulePack: null,
      applicableOverrides: [],
      rulesetSnapshotId: null,
      explain,
      blocking_issues,
      warnings,
    };
  }

  const exactActiveCount = vigenteMatches.filter((version) => {
    const sameOrgano = input.organoTipo ? version.organoTipo === input.organoTipo : true;
    const sameClase = input.clase ? version.clase === input.clase : true;
    return sameOrgano && sameClase;
  }).length;
  if (exactActiveCount > 1) {
    warnings.push(`Hay ${exactActiveCount} versiones vigentes para el mismo alcance; se selecciona la versión más reciente.`);
  }

  const applicableOverrides = (input.overrides ?? []).filter((override) => {
    return override.materia === input.materia || override.materia === selected.materia;
  });
  const rulesetSnapshotId = calcularRulesetSnapshotId(
    {
      packId: selected.packId,
      version: selected.version,
      lifecycleStatus: selected.lifecycleStatus,
      payload: selected.payload,
    },
    applicableOverrides
  );

  explain.push(
    makeExplain(
      "RULE_PACK_SELECTION",
      "OK",
      `Seleccionado ${selected.packId} v${selected.version} (${selected.lifecycleStatus}) con ${applicableOverrides.length} override(s).`
    )
  );

  return {
    ok: true,
    severity: warnings.length > 0 ? "WARNING" : "OK",
    rulePack: selected,
    applicableOverrides,
    rulesetSnapshotId,
    explain,
    blocking_issues,
    warnings,
  };
}
