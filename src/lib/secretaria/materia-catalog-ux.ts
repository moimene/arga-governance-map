import type { MateriaCatalogRow } from "@/hooks/useMateriaConfig";
import type { RulePackVersionRow, RuleParamOverrideRow } from "@/hooks/useRulePacks";
import type { MateriaGlobalStatus } from "./mesa-control-societaria";
import {
  documentRequirements,
  isInformativeMatter,
  overrideApplicaAMateria,
  pactoApplicaAMateria,
} from "./mesa-control-societaria";
import {
  MATERIA_CANONICAL_ALIAS,
  labelMateria,
  resolveMateriaAlias,
} from "./agenda-materias";
import { MATERIA_PACK_ALIASES } from "@/lib/rules-engine/rule-resolution";
import {
  adoptionModeLabel,
  organoLabel,
  tipoSocialLabel,
  tipoLabel,
} from "./template-admin/labels";
import { normalizeOrganoTipo } from "./template-admin/organo-canonico";

export type MatterFormalizationKind =
  | "ESCRITURA"
  | "REGISTRO"
  | "PUBLICACION"
  | "ARCHIVO_INTERNO"
  | "CONSTANCIA";

export type MatterCatalogPresentation = "tarjetas" | "tabla";

export interface RulePackDocumentEvidence {
  id: string;
  name: string;
  condition: string | null;
  phase: "convocatoria" | "expediente";
}

export interface RulePackLegalBranch {
  id: string;
  label: string;
  majority: string;
  majorityReference: string | null;
  quorum: string;
  quorumReference: string | null;
  quorums: Array<{
    id: string;
    label: string;
    value: string;
    reference: string | null;
  }>;
}

export interface FormalizationEvidence {
  kind: MatterFormalizationKind;
  path: string;
  detail: string;
  reference: string | null;
}

export interface EffectiveFormalization {
  source: "rule_pack" | "catalog";
  kinds: MatterFormalizationKind[];
  notaryRequired: boolean;
  registryRequired: boolean;
  publicationRequired: boolean;
  catalogKinds: MatterFormalizationKind[];
  discrepancy: boolean;
  evidence: FormalizationEvidence[];
  discrepancies: string[];
}

export interface ActiveRulePackGroup {
  organoCode: string;
  organoLabel: string;
  current: RulePackVersionRow;
  historicalActiveRows: RulePackVersionRow[];
  equivalentActiveRows: RulePackVersionRow[];
  warnings: string[];
}

export interface MatterRuleVariant {
  id: string;
  packId: string;
  versionId: string;
  version: string;
  organoCode: string;
  organoLabel: string;
  adoptionModes: Array<{ code: string; label: string }>;
  branches: RulePackLegalBranch[];
  documents: RulePackDocumentEvidence[];
  formalization: EffectiveFormalization;
  activeEquivalentVersions: Array<{
    packId: string;
    versionId: string;
    version: string;
    materia: string;
  }>;
  socialTypeRestrictions: string[];
  socialTypeApplicability: "applies" | "not_applicable" | "unresolved";
  socialTypeApplicabilityReason: string;
  warnings: string[];
}

export interface MatterCatalogFilterCandidate {
  materia: MateriaCatalogRow;
  status: MateriaGlobalStatus;
  documents?: RulePackDocumentEvidence[];
  templateTypes?: string[];
  variants?: MatterRuleVariant[];
  formalizationKinds?: MatterFormalizationKind[];
}

export interface MatterCatalogFilters {
  search?: string | null;
  majority?: string | null;
  formalization?: MatterFormalizationKind | "ALL" | null;
  status?: MateriaGlobalStatus | "ALL" | null;
}

export interface RuleExplanationEntry {
  id: string;
  label: string;
  value: string;
  reference: string | null;
  provenance: string;
}

export interface RuleApplicabilityExplanation {
  determinants: RuleExplanationEntry[];
  reviewed: RuleExplanationEntry[];
  warnings: string[];
}

export interface MateriaUsageNote {
  title: string;
  useWhen: string;
  avoidWhen: string;
  related: Array<{ materia: string; label: string }>;
}

export const MAJORITY_FILTER_OPTIONS = [
  { value: "ALL", label: "Todas las mayorías" },
  { value: "SIMPLE", label: "Mayoría simple" },
  { value: "REFORZADA_1_2", label: "Reforzada: más de la mitad" },
  { value: "REFORZADA_2_3", label: "Reforzada: dos tercios" },
  { value: "UNANIMIDAD", label: "Unanimidad" },
  { value: "NO_APLICA", label: "No requiere votación" },
] as const;

export const FORMALIZATION_FILTER_OPTIONS = [
  { value: "ALL", label: "Toda formalización" },
  { value: "ESCRITURA", label: "Escritura pública" },
  { value: "REGISTRO", label: "Inscripción registral" },
  { value: "PUBLICACION", label: "Publicación" },
  { value: "ARCHIVO_INTERNO", label: "Archivo interno" },
  { value: "CONSTANCIA", label: "Constancia en acta" },
] as const;

export const MATERIA_USAGE_NOTES: Record<string, MateriaUsageNote> = {
  MODIFICACION_ESTATUTOS: {
    title: "Modificación estatutaria general o cambio específico",
    useWhen: "Usa la materia general cuando el cambio no dispone de una materia específica en el catálogo.",
    avoidWhen: "No la uses para objeto, domicilio, denominación o prórroga si la materia específica describe el acto.",
    related: [
      ["AMPLIACION_OBJETO_SOCIAL", "Ampliación del objeto social"],
      ["CAMBIO_DOMICILIO_SOCIAL", "Cambio de domicilio social"],
      ["CAMBIO_DENOMINACION_SOCIAL", "Cambio de denominación social"],
      ["PRORROGA_SOCIEDAD", "Prórroga de la sociedad"],
    ].map(([materia, label]) => ({ materia, label })),
  },
  AMPLIACION_OBJETO_SOCIAL: relatedToGenericStatutes("ampliar o sustituir el objeto social"),
  CAMBIO_DOMICILIO_SOCIAL: relatedToGenericStatutes("cambiar el domicilio social"),
  TRASLADO_DOMICILIO_NACIONAL: relatedToGenericStatutes("trasladar el domicilio dentro de España"),
  CAMBIO_DENOMINACION_SOCIAL: relatedToGenericStatutes("cambiar la denominación social"),
  PRORROGA_SOCIEDAD: relatedToGenericStatutes("prorrogar la duración de la sociedad"),
  DISTRIBUCION_DIVIDENDOS: {
    title: "Dividendo ordinario o dividendo a cuenta",
    useWhen: "Usa esta materia para aplicar resultado ya aprobado y acordar el dividendo ordinario.",
    avoidWhen: "No la uses para anticipos antes de aprobar las cuentas; requieren estado contable de liquidez.",
    related: [{ materia: "DIVIDENDO_A_CUENTA", label: "Dividendo a cuenta" }],
  },
  DIVIDENDO_A_CUENTA: {
    title: "Dividendo a cuenta",
    useWhen: "Usa esta materia para distribuir cantidades a cuenta antes de la aprobación anual del resultado.",
    avoidWhen: "No la uses para el dividendo ordinario acordado sobre cuentas y aplicación del resultado ya aprobadas.",
    related: [{ materia: "DISTRIBUCION_DIVIDENDOS", label: "Distribución de dividendos" }],
  },
  EMISION_OBLIGACIONES: {
    title: "Obligaciones simples o convertibles",
    useWhen: "Usa esta materia para deuda sin derecho de conversión en capital.",
    avoidWhen: "No la uses si los valores pueden convertirse en acciones o participaciones.",
    related: [{ materia: "EMISION_DEUDA_CONVERTIBLE", label: "Emisión de deuda convertible" }],
  },
  EMISION_DEUDA_CONVERTIBLE: {
    title: "Deuda convertible",
    useWhen: "Usa esta materia cuando la emisión incorpora conversión en capital y sus informes específicos.",
    avoidWhen: "No la uses para obligaciones simples sin conversión.",
    related: [{ materia: "EMISION_OBLIGACIONES", label: "Emisión de obligaciones" }],
  },
  INFORME_GESTION: accountsUsageNote("preparar y formular el informe de gestión", "FORMULACION_CUENTAS", "Formulación de cuentas"),
  FORMULACION_CUENTAS: accountsUsageNote("formular las cuentas por el órgano de administración", "APROBACION_CUENTAS", "Aprobación de cuentas"),
  APROBACION_CUENTAS: accountsUsageNote("someter las cuentas formuladas a la Junta", "INFORME_GESTION", "Informe de gestión"),
  OPERACION_VINCULADA: {
    title: "Operación vinculada o contrato específico",
    useWhen: "Usa esta materia cuando la relación con la parte vinculada y el deber de abstención son el criterio principal.",
    avoidWhen: "No la uses si el acto es específicamente un contrato socio único-sociedad o una contratación relevante sin vínculo.",
    related: [
      { materia: "CONTRATOS_SOCIO_UNICO_SOCIEDAD", label: "Contratos socio único-sociedad" },
      { materia: "CONTRATACION_RELEVANTE", label: "Contratación relevante" },
    ],
  },
  CONTRATOS_SOCIO_UNICO_SOCIEDAD: {
    title: "Contrato de socio único con la sociedad",
    useWhen: "Usa esta materia para el régimen documental específico de contratos con el socio único.",
    avoidWhen: "No la uses como categoría general de cualquier operación vinculada.",
    related: [{ materia: "OPERACION_VINCULADA", label: "Operación vinculada" }],
  },
  CONTRATACION_RELEVANTE: {
    title: "Contratación relevante",
    useWhen: "Usa esta materia cuando el importe o relevancia del contrato activa la competencia del órgano.",
    avoidWhen: "No la uses solo por existir una parte vinculada; en ese caso revisa la materia específica.",
    related: [{ materia: "OPERACION_VINCULADA", label: "Operación vinculada" }],
  },
  APROBACION_REGLAMENTO_CONSEJO: {
    title: "Reglamento del Consejo o estatutos",
    useWhen: "Usa esta materia para aprobar o modificar las reglas internas de funcionamiento del Consejo.",
    avoidWhen: "No la uses si el texto que cambia forma parte de los estatutos sociales.",
    related: [{ materia: "MODIFICACION_ESTATUTOS", label: "Modificación de estatutos" }],
  },
};

function relatedToGenericStatutes(specificUse: string): MateriaUsageNote {
  return {
    title: "Cambio estatutario específico",
    useWhen: `Usa esta materia para ${specificUse}.`,
    avoidWhen: "No la sustituyas por la modificación estatutaria general si este acto específico describe el expediente.",
    related: [{ materia: "MODIFICACION_ESTATUTOS", label: "Modificación de estatutos" }],
  };
}

function accountsUsageNote(useWhen: string, materia: string, label: string): MateriaUsageNote {
  return {
    title: "Cuentas anuales e informe de gestión",
    useWhen: `Usa esta materia para ${useWhen}.`,
    avoidWhen: "No agrupes formulación, informe y aprobación: tienen órgano, momento y documentación distintos.",
    related: [{ materia, label }],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

export function normalizeCatalogSearchText(value?: string | null) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_/.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeMateriaEquivalenceCode(value?: string | null) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[.\s/-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Alias de presentación y alias de resolución del motor forman una única
 * relación de equivalencia para esta pantalla. Mantenerlos separados hacía
 * que una grafía se encontrase en el buscador pero no seleccionase su regla
 * versionada (o al revés).
 */
const MATERIA_EQUIVALENCE_EDGES = [
  ...Object.entries(MATERIA_CANONICAL_ALIAS),
  ...Object.entries(MATERIA_PACK_ALIASES),
].map(([left, right]) => [
  normalizeMateriaEquivalenceCode(left),
  normalizeMateriaEquivalenceCode(right),
] as const);

const PREFERRED_CATALOG_CODES = new Set([
  ...Object.values(MATERIA_CANONICAL_ALIAS).map(normalizeMateriaEquivalenceCode),
  ...Object.keys(MATERIA_PACK_ALIASES).map((code) => resolveMateriaAlias(code)),
]);

export function materiaEquivalentCodes(materia?: string | null): string[] {
  const start = normalizeMateriaEquivalenceCode(materia);
  if (!start) return [];
  const pending = [start];
  const result = new Set<string>();
  while (pending.length > 0) {
    const current = pending.shift()!;
    if (result.has(current)) continue;
    result.add(current);
    for (const [left, right] of MATERIA_EQUIVALENCE_EDGES) {
      if (left === current && !result.has(right)) pending.push(right);
      if (right === current && !result.has(left)) pending.push(left);
    }
  }
  return Array.from(result);
}

export function materiaCodesAreEquivalent(
  left?: string | null,
  right?: string | null,
) {
  const rightCode = normalizeMateriaEquivalenceCode(right);
  return Boolean(rightCode) && materiaEquivalentCodes(left).includes(rightCode);
}

/**
 * Devuelve la grafía que existe en el catálogo facilitado. Sin catálogo
 * explícito, prefiere la identidad canónica de presentación frente al id
 * técnico de la regla versionada.
 */
export function resolveMateriaCodeAgainstCatalog(
  materia?: string | null,
  catalogCodes?: Iterable<string>,
): string {
  const equivalents = materiaEquivalentCodes(materia);
  if (equivalents.length === 0) return "";
  if (catalogCodes) {
    const catalogByNormalized = new Map(
      Array.from(catalogCodes, (code) => [normalizeMateriaEquivalenceCode(code), code] as const),
    );
    const direct = catalogByNormalized.get(resolveMateriaAlias(materia));
    if (direct) return direct;
    for (const equivalent of equivalents) {
      const match = catalogByNormalized.get(equivalent);
      if (match) return match;
    }
  }
  return (
    equivalents.find((code) => PREFERRED_CATALOG_CODES.has(code))
    ?? resolveMateriaAlias(materia)
    ?? equivalents[0]
  );
}

export function materiaAliasesForSearch(materia: string): string[] {
  return materiaEquivalentCodes(materia);
}

function documentRows(value: unknown, phase: RulePackDocumentEvidence["phase"]) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index): RulePackDocumentEvidence[] => {
    if (typeof item === "string") {
      return [{ id: item, name: item, condition: null, phase }];
    }
    if (!isRecord(item)) return [];
    const id = firstString(item.id, item.codigo, item.code, `documento-${index}`) ?? `documento-${index}`;
    const name = firstString(item.nombre, item.name, item.label, item.id);
    if (!name) return [];
    return [{
      id,
      name,
      condition: firstString(item.condicion, item.condition),
      phase,
    }];
  });
}

export function extractRulePackDocuments(params: unknown): RulePackDocumentEvidence[] {
  if (!isRecord(params)) return [];
  const convocatoria = isRecord(params.convocatoria) ? params.convocatoria : {};
  const documentacion = isRecord(params.documentacion) ? params.documentacion : {};
  const rows = [
    ...documentRows(convocatoria.documentosObligatorios, "convocatoria"),
    ...documentRows(documentacion.obligatoria, "expediente"),
  ];
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = normalizeCatalogSearchText(row.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function selectActiveRulePacksForMateria(
  packs: RulePackVersionRow[],
  materia: string,
): RulePackVersionRow[] {
  return packs
    .filter((pack) => pack.status === "ACTIVE" && materiaCodesAreEquivalent(pack.materia, materia))
    .sort((a, b) => {
      const dateOrder = String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""));
      return dateOrder || String(b.id).localeCompare(String(a.id));
    });
}

function payloadOrgano(pack: RulePackVersionRow) {
  const params = isRecord(pack.params) ? pack.params : {};
  return firstString(params.organoTipo, params.organo_tipo);
}

function normalizedOrganoCode(value?: string | null) {
  if (!value) return null;
  const normalized = normalizeMateriaEquivalenceCode(value);
  const legacyEquivalents: Record<string, string> = {
    JUNTA: "JUNTA_GENERAL",
    ASAMBLEA: "JUNTA_GENERAL",
    CDA: "CONSEJO_ADMIN",
    ADMINISTRADOR_UNICO: "ADMIN_UNICO",
    ADMIN_MANCOMUNADO: "ADMIN_CONJUNTA_O_COAPROBADORES",
    ADMINISTRADORES_MANCOMUNADOS: "ADMIN_CONJUNTA_O_COAPROBADORES",
    ADMINISTRADORES_SOLIDARIOS: "ADMIN_SOLIDARIOS",
    COMISION: "COMISION_DELEGADA",
  };
  return normalizeOrganoTipo(normalized) ?? legacyEquivalents[normalized] ?? normalized;
}

function resolvePackOrgano(pack: RulePackVersionRow) {
  const metadataRaw = firstString(pack.organo_tipo);
  const payloadRaw = payloadOrgano(pack);
  const metadataCode = normalizedOrganoCode(metadataRaw);
  const payloadCode = normalizedOrganoCode(payloadRaw);
  const organoCode = metadataCode ?? payloadCode ?? "DERIVADO_DEL_ACTO";
  const warnings: string[] = [];
  if (metadataCode && payloadCode && metadataCode !== payloadCode) {
    warnings.push(
      `Conflicto de órgano: la metadata canónica indica ${organoLabel(metadataCode)} y el contenido de la regla versionada indica ${organoLabel(payloadCode)}. Se aplica la metadata canónica.`,
    );
  }
  return { organoCode, warnings };
}

export function groupActiveRulePacksByOrgano(
  packs: RulePackVersionRow[],
  materia: string,
): ActiveRulePackGroup[] {
  const groups = new Map<string, Array<{ pack: RulePackVersionRow; warnings: string[] }>>();
  for (const pack of selectActiveRulePacksForMateria(packs, materia)) {
    const { organoCode, warnings } = resolvePackOrgano(pack);
    groups.set(organoCode, [...(groups.get(organoCode) ?? []), { pack, warnings }]);
  }
  return Array.from(groups.entries()).map(([organoCode, rows]) => ({
    organoCode,
    organoLabel: organoLabel(organoCode),
    current: rows[0].pack,
    historicalActiveRows: rows.slice(1).map((row) => row.pack),
    equivalentActiveRows: rows.map((row) => row.pack),
    warnings: [
      ...rows.flatMap((row) => row.warnings),
      ...(rows.length > 1
        ? [
            `${organoLabel(organoCode)}: existen ${rows.length} filas activas equivalentes de reglas versionadas (${rows.map((row) => `${row.pack.materia ?? row.pack.rule_pack_id} v${String(row.pack.version_tag ?? "").replace(/^v/i, "")}`).join(", ")}). Se usa la activación más reciente como determinante y se conservan las demás para revisión.`,
          ]
        : []),
    ],
  }));
}

function unwrapRuleValue(value: unknown): string | null {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (!isRecord(value)) return null;
  return firstString(value.formula, value.valor, value.value, value.regla, value.rule);
}

function ruleReference(value: unknown): string | null {
  if (!isRecord(value)) return null;
  const reference = firstString(value.referencia, value.reference);
  if (reference) return reference;
  const declaredSource = firstString(value.fuente, value.source);
  return declaredSource
    ? `Fuente declarada en la regla versionada: ${declaredSource}; referencia pendiente`
    : null;
}

function humanizeRule(value: string | null, fallback: string) {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  const exact: Record<string, string> = {
    "favor > contra": "Más votos a favor que en contra",
    "favor > total_miembros / 2": "Mayoría absoluta de miembros",
    "favor > presentes_mitad": "Más de la mitad de presentes",
    "favor >= 2/3_emitidos": "Dos tercios de los votos emitidos",
    "favor >= 2/3_capital_con_voto": "Dos tercios del capital con derecho de voto",
    "favor > mitad_capital_con_voto": "Más de la mitad del capital con derecho de voto",
    "mayoria_miembros": "Mayoría de miembros",
  };
  return exact[normalized] ?? value.replace(/_/g, " ");
}

function numericRuleValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^-?\d+(?:[.,]\d+)?$/.test(value.trim())) {
    const parsed = Number(value.trim().replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (!isRecord(value)) return null;
  return numericRuleValue(value.valor ?? value.value ?? value.umbral ?? value.threshold);
}

function formatCompactNumber(value: number) {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "").replace(".", ",");
}

function formatQuorumValue(
  value: unknown,
  branch: "SA" | "SL" | "CONSEJO",
) {
  const numeric = numericRuleValue(value);
  if (numeric === null) return humanizeRule(unwrapRuleValue(value), "Según ley y estatutos");
  const unitRaw = isRecord(value)
    ? firstString(value.unidad, value.unit, value.tipoUnidad, value.unitType)
    : null;
  const unit = normalizeCatalogSearchText(unitRaw).replace(/\s/g, "_");
  const isMemberUnit = ["miembro", "miembros", "persona", "personas"].includes(unit);
  if (isMemberUnit) {
    return `${formatCompactNumber(numeric)} ${numeric === 1 ? "miembro" : "miembros"}`;
  }
  const percentage = numeric >= 0 && numeric <= 1 ? numeric * 100 : numeric;
  const explicitUnit = unitRaw && !["%", "porcentaje", "percent", "capital", "capital_con_voto"].includes(unit)
    ? ` ${String(unitRaw).trim()}`
    : branch === "CONSEJO"
      ? " % de miembros"
      : " % del capital con derecho de voto";
  return `${formatCompactNumber(percentage)}${explicitUnit}`;
}

function quorumEntries(
  quorums: Record<string, unknown>,
  branch: "SA" | "SL" | "CONSEJO",
): RulePackLegalBranch["quorums"] {
  const specs = branch === "SA"
    ? [
        { id: "SA_1a", label: "Primera convocatoria", value: quorums.SA_1a ?? quorums.SA_1conv },
        { id: "SA_2a", label: "Segunda convocatoria", value: quorums.SA_2a ?? quorums.SA_2conv },
      ]
    : branch === "SL"
      ? [{ id: "SL", label: "Quórum", value: quorums.SL ?? quorums.quorumSL }]
      : [{ id: "CONSEJO", label: "Quórum", value: quorums.CONSEJO ?? quorums.quorumConsejo }];
  const present = specs.filter((spec) => spec.value !== undefined && spec.value !== null);
  if (present.length === 0) {
    return [{
      id: branch,
      label: "Quórum",
      value: "Según ley y estatutos",
      reference: null,
    }];
  }
  return present.map((spec) => ({
    id: spec.id,
    label: spec.label,
    value: formatQuorumValue(spec.value, branch),
    reference: ruleReference(spec.value),
  }));
}

function branchFromPayload(
  params: Record<string, unknown>,
  branch: "SA" | "SL" | "CONSEJO",
  label: string,
): RulePackLegalBranch {
  const votacion = isRecord(params.votacion) ? params.votacion : {};
  const mayorias = isRecord(votacion.mayoria) ? votacion.mayoria : {};
  const constitucion = isRecord(params.constitucion) ? params.constitucion : {};
  const quorums = isRecord(constitucion.quorum) ? constitucion.quorum : {};
  const majorityRaw = mayorias[branch];
  const resolvedQuorums = quorumEntries(quorums, branch);
  const hasMultipleQuorums = resolvedQuorums.length > 1;
  return {
    id: branch,
    label,
    majority: humanizeRule(unwrapRuleValue(majorityRaw), "Según ley y estatutos"),
    majorityReference: ruleReference(majorityRaw),
    quorum: resolvedQuorums
      .map((quorum) => hasMultipleQuorums ? `${quorum.label}: ${quorum.value}` : quorum.value)
      .join(" · "),
    quorumReference: resolvedQuorums
      .filter((quorum) => quorum.reference)
      .map((quorum) => hasMultipleQuorums ? `${quorum.label}: ${quorum.reference}` : quorum.reference)
      .join(" · ") || null,
    quorums: resolvedQuorums,
  };
}

export function resolveRulePackLegalBranches(
  pack: RulePackVersionRow,
  tipoSocial?: string | null,
): RulePackLegalBranch[] {
  const params = isRecord(pack.params) ? pack.params : {};
  const organo = resolvePackOrgano(pack).organoCode;
  if (organo === "SOCIO_UNICO") {
    return [{
      id: "SOCIO_UNICO",
      label: "Socio único",
      majority: "Decisión del socio único",
      majorityReference: null,
      quorum: "No aplica",
      quorumReference: null,
      quorums: [{
        id: "SOCIO_UNICO",
        label: "Quórum",
        value: "No aplica",
        reference: null,
      }],
    }];
  }
  if (organo === "CONSEJO_ADMIN" || organo === "ORGANO_ADMIN" || organo === "COMISION_DELEGADA") {
    return [branchFromPayload(params, "CONSEJO", organoLabel(organo))];
  }
  const social = String(tipoSocial ?? "").toUpperCase();
  if (social === "SA" || social === "SAU") return [branchFromPayload(params, "SA", "S.A. / S.A.U.")];
  if (social === "SL" || social === "SLU" || social === "SRL") return [branchFromPayload(params, "SL", "S.L. / S.L.U.")];
  return [
    branchFromPayload(params, "SA", "S.A. / S.A.U."),
    branchFromPayload(params, "SL", "S.L. / S.L.U."),
  ];
}

export function extractRulePackAdoptionModes(params: unknown) {
  if (!isRecord(params) || !Array.isArray(params.modosAdopcionPermitidos)) return [];
  return Array.from(
    new Set(params.modosAdopcionPermitidos.filter((value): value is string => typeof value === "string")),
  ).map((code) => ({ code, label: adoptionModeLabel(code) }));
}

function socialRestrictionField(params: Record<string, unknown>) {
  return firstPostField(params, [
    "restriccionTipoSocial",
    "restriccion_tipo_social",
    "restriccionesTipoSocial",
    "restricciones_tipo_social",
  ]);
}

function socialRestrictionTokens(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => typeof item === "string" ? [item] : []);
  }
  if (typeof value !== "string" || !value.trim()) return [];
  const trimmed = value.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.flatMap((item) => typeof item === "string" ? [item] : []);
      }
    } catch {
      // Continúa con el parser tolerante de separadores.
    }
  }
  return trimmed
    .replace(/\s+(?:y|o)\s+/gi, ",")
    .split(/[;,|/]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeSocialTypeRestriction(value?: string | null): string | null {
  const compact = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (!compact || ["ANY", "TODOS", "TODAS", "CUALQUIERA"].includes(compact)) return null;
  if ([
    "SA",
    "SAU",
    "SOCIEDADANONIMA",
    "SOCIEDADANONIMAUNIPERSONAL",
    "SOCIEDADANONIMACOTIZADA",
  ].includes(compact)) return "SA";
  if ([
    "SL",
    "SLU",
    "SRL",
    "SOCIEDADLIMITADA",
    "SOCIEDADLIMITADAUNIPERSONAL",
    "SOCIEDADDERESPONSABILIDADLIMITADA",
  ].includes(compact)) return "SL";
  return normalizeMateriaEquivalenceCode(value);
}

export function extractRulePackSocialTypeRestrictions(params: unknown): string[] {
  if (!isRecord(params)) return [];
  const field = socialRestrictionField(params);
  if (!field) return [];
  return Array.from(
    new Set(
      socialRestrictionTokens(field.value)
        .map(normalizeSocialTypeRestriction)
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

function socialTypeFamilyLabel(family: string) {
  if (family === "SA") return "S.A. / S.A.U.";
  if (family === "SL") return "S.L. / S.L.U. / S.R.L.";
  return tipoSocialLabel(family);
}

export function resolveRulePackSocialTypeApplicability(
  params: unknown,
  tipoSocial?: string | null,
  unresolvedReason?: string | null,
): Pick<
  MatterRuleVariant,
  "socialTypeRestrictions" | "socialTypeApplicability" | "socialTypeApplicabilityReason"
> {
  const payload = isRecord(params) ? params : {};
  const restrictionField = socialRestrictionField(payload);
  const socialTypeRestrictions = extractRulePackSocialTypeRestrictions(payload);
  const note = firstString(
    payload.notaRestriccionTipoSocial,
    payload.restriccionTipoSocialNota,
    payload.referenciaRestriccionTipoSocial,
    restrictionField ? payload.nota : null,
  );
  const noteSuffix = note ? ` — ${note.replace(/\s*\.\s*$/, "")}` : "";
  const declaredRestriction = socialTypeRestrictions.length > 0
    ? socialTypeRestrictions.map(socialTypeFamilyLabel).join(", ")
    : "ningún tipo social concreto";
  const restrictionStatement = socialTypeRestrictions.length > 0
    ? `limita la materia a ${declaredRestriction}`
    : "no limita la materia a un tipo social concreto";
  if (restrictionField && !Array.isArray(restrictionField.value) && typeof restrictionField.value !== "string") {
    return {
      socialTypeRestrictions,
      socialTypeApplicability: "unresolved",
      socialTypeApplicabilityReason: `No se puede determinar la aplicabilidad porque la restricción por tipo social tiene un formato no reconocido${noteSuffix}.`,
    };
  }
  if (socialTypeRestrictions.length === 0) {
    return {
      socialTypeRestrictions,
      socialTypeApplicability: "applies",
      socialTypeApplicabilityReason: tipoSocial
        ? `Aplica a ${tipoSocialLabel(tipoSocial)}: la regla versionada no limita la materia a un tipo social concreto${noteSuffix}.`
        : `La regla versionada no limita la materia a un tipo social concreto${noteSuffix}.`,
    };
  }
  if (!String(tipoSocial ?? "").trim()) {
    return {
      socialTypeRestrictions,
      socialTypeApplicability: "unresolved",
      socialTypeApplicabilityReason: unresolvedReason
        ? `No se puede determinar la aplicabilidad. ${unresolvedReason} La regla versionada ${restrictionStatement}${noteSuffix}.`
        : `No se puede determinar la aplicabilidad porque la sociedad no tiene tipo social informado. La regla versionada ${restrictionStatement}${noteSuffix}.`,
    };
  }
  const normalizedSocialType = normalizeSocialTypeRestriction(tipoSocial);
  if (normalizedSocialType !== "SA" && normalizedSocialType !== "SL") {
    return {
      socialTypeRestrictions,
      socialTypeApplicability: "unresolved",
      socialTypeApplicabilityReason: `No se puede determinar la aplicabilidad: el tipo social ${tipoSocialLabel(tipoSocial)} no está reconocido como S.A./S.A.U. o S.L./S.L.U./S.R.L.${noteSuffix}.`,
    };
  }
  if (socialTypeRestrictions.includes(normalizedSocialType)) {
    return {
      socialTypeRestrictions,
      socialTypeApplicability: "applies",
      socialTypeApplicabilityReason: `Aplica a ${tipoSocialLabel(tipoSocial)}: la restricción comprende ${declaredRestriction}${noteSuffix}.`,
    };
  }
  const unknownRestrictions = socialTypeRestrictions.filter((value) => value !== "SA" && value !== "SL");
  if (unknownRestrictions.length > 0) {
    return {
      socialTypeRestrictions,
      socialTypeApplicability: "unresolved",
      socialTypeApplicabilityReason: `No se puede determinar la aplicabilidad porque la restricción contiene tipos sociales no reconocidos (${unknownRestrictions.join(", ")})${noteSuffix}.`,
    };
  }
  return {
    socialTypeRestrictions,
    socialTypeApplicability: "not_applicable",
    socialTypeApplicabilityReason: `No aplica a ${tipoSocialLabel(tipoSocial)}: la regla versionada limita esta materia a ${declaredRestriction}${noteSuffix}.`,
  };
}

export function catalogFormalizationKinds(materia: MateriaCatalogRow): MatterFormalizationKind[] {
  if (isInformativeMatter(materia.materia)) return ["CONSTANCIA"];
  const kinds: MatterFormalizationKind[] = [];
  if (materia.requires_notary) kinds.push("ESCRITURA");
  if (materia.requires_registry || materia.inscribable) kinds.push("REGISTRO");
  if (materia.publication_required) kinds.push("PUBLICACION");
  if (kinds.length === 0) kinds.push("ARCHIVO_INTERNO");
  return kinds;
}

function sameSet(left: string[], right: string[]) {
  return left.length === right.length && left.every((item) => right.includes(item));
}

function catalogFormalizationEvidence(
  materia: MateriaCatalogRow,
  kinds: MatterFormalizationKind[],
): FormalizationEvidence[] {
  return kinds.map((kind) => {
    const path = kind === "ESCRITURA"
      ? "materia_catalog.requires_notary"
      : kind === "REGISTRO"
        ? materia.requires_registry ? "materia_catalog.requires_registry" : "materia_catalog.inscribable"
        : kind === "PUBLICACION"
          ? "materia_catalog.publication_required"
          : kind === "CONSTANCIA"
            ? "catálogo funcional: materia informativa"
            : "catálogo: sin formalización externa marcada";
    return {
      kind,
      path,
      detail: "Mínimo registrado en el catálogo de materias",
      reference: materia.referencia_legal,
    };
  });
}

function obligationEnabled(value: unknown) {
  if (value === true) return true;
  if (value === false || value === null || value === undefined) return false;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") {
    return !["", "NO", "FALSE", "NINGUNO", "NO_APLICA", "N/A"].includes(value.trim().toUpperCase());
  }
  if (!isRecord(value)) return false;
  const explicit = value.obligatorio ?? value.required ?? value.aplica ?? value.enabled;
  return explicit === undefined ? Object.keys(value).length > 0 : obligationEnabled(explicit);
}

function findDepositRequirement(post: Record<string, unknown>) {
  const depositKeys = new Set([
    "depositocuentas",
    "depositocuenta",
    "depositoregistral",
    "depositorm",
    "deposito",
  ]);
  for (const [key, value] of Object.entries(post)) {
    const normalizedKey = normalizeCatalogSearchText(key).replace(/\s/g, "");
    if (depositKeys.has(normalizedKey) && obligationEnabled(value)) {
      return { key, value };
    }
  }
  return null;
}

function firstPostField(post: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (post[key] !== undefined && post[key] !== null) return { key, value: post[key] };
  }
  return null;
}

function formalizationKindLabel(kind: MatterFormalizationKind) {
  const labels: Record<MatterFormalizationKind, string> = {
    ESCRITURA: "Escritura pública",
    REGISTRO: "Registro o depósito registral",
    PUBLICACION: "Publicación",
    ARCHIVO_INTERNO: "Archivo interno",
    CONSTANCIA: "Constancia en acta",
  };
  return labels[kind];
}

export function resolveEffectiveFormalization(
  pack: RulePackVersionRow | null | undefined,
  materia: MateriaCatalogRow,
): EffectiveFormalization {
  const catalogKinds = catalogFormalizationKinds(materia);
  const params = pack && isRecord(pack.params) ? pack.params : null;
  const post = params && isRecord(params.postAcuerdo) ? params.postAcuerdo : null;
  if (!post) {
    return {
      source: "catalog",
      kinds: catalogKinds,
      notaryRequired: materia.requires_notary,
      registryRequired: materia.requires_registry || materia.inscribable,
      publicationRequired: materia.publication_required,
      catalogKinds,
      discrepancy: false,
      evidence: catalogFormalizationEvidence(materia, catalogKinds),
      discrepancies: [],
    };
  }
  const instrumentField = firstPostField(post, [
    "instrumentoRequerido",
    "instrumento_requerido",
    "instrumentoPublico",
    "instrumento_publico",
  ]);
  const instrument = firstString(instrumentField?.value);
  const normalizedInstrument = instrument?.toUpperCase() ?? null;
  const notaryRequired = normalizedInstrument === "ESCRITURA" || normalizedInstrument === "SIEMPRE";
  const deposit = findDepositRequirement(post);
  const registryRequired = post.inscribible === true || deposit !== null;
  const publicationRequired = post.publicacionRequerida === true || post.publicacionBORME === true;
  const kinds: MatterFormalizationKind[] = [];
  const evidence: FormalizationEvidence[] = [];
  if (notaryRequired) kinds.push("ESCRITURA");
  if (registryRequired) kinds.push("REGISTRO");
  if (publicationRequired) kinds.push("PUBLICACION");
  if (kinds.length === 0) kinds.push("ARCHIVO_INTERNO");
  if (notaryRequired) {
    evidence.push({
      kind: "ESCRITURA",
      path: `postAcuerdo.${instrumentField?.key ?? "instrumentoRequerido"}`,
      detail: `Instrumento requerido: ${instrument}`,
      reference: firstString(post.instrumentoReferencia, post.referencia),
    });
  }
  if (post.inscribible === true) {
    evidence.push({
      kind: "REGISTRO",
      path: "postAcuerdo.inscribible",
      detail: "Inscripción registral marcada como obligatoria",
      reference: firstString(post.referencia),
    });
  }
  if (deposit) {
    evidence.push({
      kind: "REGISTRO",
      path: `postAcuerdo.${deposit.key}`,
      detail: "Depósito registral marcado como obligatorio",
      reference: isRecord(deposit.value)
        ? firstString(deposit.value.referencia, deposit.value.reference)
        : firstString(post.referencia),
    });
  }
  if (publicationRequired) {
    evidence.push({
      kind: "PUBLICACION",
      path: post.publicacionRequerida === true ? "postAcuerdo.publicacionRequerida" : "postAcuerdo.publicacionBORME",
      detail: "Publicación posterior marcada como obligatoria",
      reference: firstString(post.referencia),
    });
  }
  if (kinds.includes("ARCHIVO_INTERNO")) {
    evidence.push({
      kind: "ARCHIVO_INTERNO",
      path: "postAcuerdo",
      detail: "La regla versionada no marca escritura, registro, depósito ni publicación",
      reference: firstString(post.referencia),
    });
  }
  const discrepancy = !sameSet(kinds, catalogKinds);
  const discrepancies = discrepancy
    ? [
        `La regla versionada exige ${kinds.map(formalizationKindLabel).join(", ")}; el catálogo registra ${catalogKinds.map(formalizationKindLabel).join(", ")}.`,
      ]
    : [];
  return {
    source: "rule_pack",
    kinds,
    notaryRequired,
    registryRequired,
    publicationRequired,
    catalogKinds,
    discrepancy,
    evidence,
    discrepancies,
  };
}

export function buildMatterRuleVariants(input: {
  packs: RulePackVersionRow[];
  materia: MateriaCatalogRow;
  tipoSocial?: string | null;
  socialTypeIssue?: string | null;
}): MatterRuleVariant[] {
  return groupActiveRulePacksByOrgano(input.packs, input.materia.materia).map((group) => {
    const socialType = resolveRulePackSocialTypeApplicability(
      group.current.params,
      input.tipoSocial,
      input.socialTypeIssue,
    );
    return {
      id: `${resolveMateriaCodeAgainstCatalog(input.materia.materia)}:${group.organoCode}`,
      packId: group.current.rule_pack_id,
      versionId: group.current.id,
      version: String(group.current.version_tag ?? "").replace(/^v/i, ""),
      organoCode: group.organoCode,
      organoLabel: group.organoLabel,
      adoptionModes: extractRulePackAdoptionModes(group.current.params),
      branches: resolveRulePackLegalBranches(group.current, input.tipoSocial),
      documents: extractRulePackDocuments(group.current.params),
      formalization: resolveEffectiveFormalization(group.current, input.materia),
      activeEquivalentVersions: group.equivalentActiveRows.map((row) => ({
        packId: row.rule_pack_id,
        versionId: row.id,
        version: String(row.version_tag ?? "").replace(/^v/i, ""),
        materia: row.materia ?? row.rule_pack_id,
      })),
      ...socialType,
      warnings: [
        ...group.warnings,
        ...(socialType.socialTypeApplicability === "applies"
          ? []
          : [socialType.socialTypeApplicabilityReason]),
      ],
    };
  });
}

export function matchesMateriaCatalogSearch(
  candidate: MatterCatalogFilterCandidate,
  search?: string | null,
) {
  const needle = normalizeCatalogSearchText(search);
  if (!needle) return true;
  const values = [
    candidate.materia.materia_label_es,
    candidate.materia.referencia_legal,
    ...materiaAliasesForSearch(candidate.materia.materia),
    ...documentRequirements(candidate.materia),
    ...(candidate.documents ?? []).flatMap((document) => [document.id, document.name, document.condition]),
    ...(candidate.templateTypes ?? []).flatMap((tipo) => [tipo, tipoLabel(tipo)]),
    ...(candidate.variants ?? []).flatMap((variant) => [
      variant.organoCode,
      variant.organoLabel,
      ...variant.adoptionModes.flatMap((mode) => [mode.code, mode.label]),
    ]),
  ];
  return values.some((value) => normalizeCatalogSearchText(value).includes(needle));
}

export function filterMateriaCatalogItems<T extends MatterCatalogFilterCandidate>(
  candidates: T[],
  filters: MatterCatalogFilters,
): T[] {
  return candidates.filter((candidate) => {
    if (!matchesMateriaCatalogSearch(candidate, filters.search)) return false;
    if (filters.majority && filters.majority !== "ALL" && candidate.materia.min_majority_code !== filters.majority) return false;
    if (filters.formalization && filters.formalization !== "ALL") {
      const kinds = candidate.formalizationKinds ?? catalogFormalizationKinds(candidate.materia);
      if (!kinds.includes(filters.formalization)) return false;
    }
    if (filters.status && filters.status !== "ALL" && candidate.status !== filters.status) return false;
    return true;
  });
}

export function buildRuleApplicabilityExplanation(input: {
  materia: MateriaCatalogRow;
  variants: MatterRuleVariant[];
  overrides?: RuleParamOverrideRow[];
  pactos?: Array<{
    materias_aplicables?: string[] | null;
    titulo?: string | null;
    tipo_clausula?: string | null;
    referencia?: string | null;
    source_ref?: string | null;
  }>;
}): RuleApplicabilityExplanation {
  const determinants: RuleExplanationEntry[] = [];
  const warnings: string[] = [];
  for (const variant of input.variants) {
    warnings.push(...variant.warnings);
    for (const branch of variant.branches) {
      determinants.push({
        id: `${variant.id}:${branch.id}:mayoria`,
        label: `${variant.organoLabel} · mayoría`,
        value: branch.majority,
        reference: branch.majorityReference,
        provenance: `Regla versionada activa v${variant.version} · ${branch.label}`,
      });
      for (const quorum of branch.quorums) {
        determinants.push({
          id: `${variant.id}:${branch.id}:quorum:${quorum.id}`,
          label: `${variant.organoLabel} · quórum${branch.quorums.length > 1 ? ` · ${quorum.label}` : ""}`,
          value: quorum.value,
          reference: quorum.reference,
          provenance: `Regla versionada activa v${variant.version} · ${branch.label}`,
        });
      }
    }
    for (const document of variant.documents) {
      determinants.push({
        id: `${variant.id}:document:${document.phase}:${document.id}`,
        label: `${variant.organoLabel} · documento ${document.phase === "convocatoria" ? "para convocatoria" : "del expediente"}`,
        value: `${document.name}${document.condition ? ` · ${document.condition.replace(/_/g, " ")}` : ""}`,
        reference: null,
        provenance: `Regla versionada activa v${variant.version} · documentación obligatoria`,
      });
    }
    const formalizationReferences = Array.from(
      new Set(variant.formalization.evidence.map((item) => item.reference).filter((value): value is string => Boolean(value))),
    );
    determinants.push({
      id: `${variant.id}:formalization`,
      label: `${variant.organoLabel} · formalización`,
      value: variant.formalization.kinds.map(formalizationKindLabel).join(", "),
      reference: formalizationReferences.join(" · ") || null,
      provenance: `Regla versionada activa v${variant.version} · ${variant.formalization.evidence.map((item) => item.path).join(", ")}`,
    });
    warnings.push(
      ...variant.formalization.discrepancies.map((message) => `${variant.organoLabel}: ${message}`),
    );
  }
  if (determinants.length === 0) {
    determinants.push({
      id: `${input.materia.materia}:catalog`,
      label: "Mínimo de catálogo",
      value: labelMateria(input.materia.materia, input.materia.materia_label_es),
      reference: input.materia.referencia_legal,
      provenance: "Sin regla versionada activa; requiere revisión antes de considerarlo regla aplicable",
    });
    warnings.push("No existe una regla versionada activa para esta materia.");
  }
  const reviewed: RuleExplanationEntry[] = [{
    id: `${input.materia.materia}:legal-reference`,
    label: "Referencia de catálogo",
    value: input.materia.materia_label_es,
    reference: input.materia.referencia_legal,
    provenance: "Mínimo legal revisado",
  }];
  for (const override of (input.overrides ?? []).filter((row) => overrideApplicaAMateria(row, input.materia.materia))) {
    reviewed.push({
      id: `override:${override.id}`,
      label: override.fuente === "ESTATUTOS" ? "Estatutos" : override.fuente === "REGLAMENTO" ? "Reglamento" : "Ajuste documentado",
      value: override.clave,
      reference: override.referencia,
      provenance: "Fuente específica de la sociedad",
    });
  }
  for (const [index, pacto] of (input.pactos ?? []).filter((row) => pactoApplicaAMateria(row, input.materia.materia)).entries()) {
    reviewed.push({
      id: `pacto:${index}:${pacto.titulo ?? "vigente"}`,
      label: "Pacto parasocial",
      value: pacto.titulo ?? pacto.tipo_clausula ?? "Pacto vigente",
      reference: pacto.referencia ?? pacto.source_ref ?? null,
      provenance: "Obligación contractual revisada; no sustituye la regla societaria",
    });
  }
  return { determinants, reviewed, warnings: Array.from(new Set(warnings)) };
}

export function usageNotesForMateria(materia?: string | null): MateriaUsageNote | null {
  for (const code of materiaEquivalentCodes(materia)) {
    if (MATERIA_USAGE_NOTES[code]) return MATERIA_USAGE_NOTES[code];
  }
  return null;
}
