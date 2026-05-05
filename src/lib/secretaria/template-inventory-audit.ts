export type TemplateClosureBlock =
  | "CRITICAS"
  | "METADATOS_NULL"
  | "MATERIA_SUBSTANTIVA"
  | "CIERRE_RUTINARIO"
  | "FUERA_BLOQUE";

export type TemplateInventoryIssueSeverity = "WARNING" | "BLOCKING";

export interface TemplateInventoryRow {
  id: string;
  tipo: string;
  estado?: string | null;
  materia?: string | null;
  materia_acuerdo?: string | null;
  version?: string | null;
  aprobada_por?: string | null;
  fecha_aprobacion?: string | null;
  organo_tipo?: string | null;
  adoption_mode?: string | null;
  referencia_legal?: string | null;
  capa1_inmutable?: string | null;
  capa2_variables?: unknown;
  capa3_editables?: unknown;
}

export interface TemplateInventoryIssue {
  code: string;
  severity: TemplateInventoryIssueSeverity;
  templateId: string;
  materia: string;
  field_path: string;
  message: string;
  priority: "P0" | "P1" | "P2";
}

export interface TemplateInventoryAuditSummary {
  total: number;
  active: number;
  blocking: number;
  warning: number;
  legacyPending: number;
  byBlock: Record<TemplateClosureBlock, number>;
}

export interface TemplateInventoryAuditResult {
  issues: TemplateInventoryIssue[];
  summary: TemplateInventoryAuditSummary;
}

const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const SUPPORT_TYPES = new Set(["CERTIFICACION", "INFORME_DOCUMENTAL_PRE", "INFORME_PRECEPTIVO", "INFORME_GESTION"]);

export const PHASE4_LEGACY_TEMPLATE_BLOCKS: Record<string, TemplateClosureBlock> = {
  APROBACION_PLAN_NEGOCIO: "CIERRE_RUTINARIO",
  AUMENTO_CAPITAL: "MATERIA_SUBSTANTIVA",
  CESE_CONSEJERO: "CIERRE_RUTINARIO",
  COMITES_INTERNOS: "METADATOS_NULL",
  DISTRIBUCION_CARGOS: "METADATOS_NULL",
  DISTRIBUCION_DIVIDENDOS: "CIERRE_RUTINARIO",
  FUSION_ESCISION: "CRITICAS",
  MODIFICACION_ESTATUTOS: "MATERIA_SUBSTANTIVA",
  NOMBRAMIENTO_AUDITOR: "MATERIA_SUBSTANTIVA",
  NOMBRAMIENTO_CONSEJERO: "CIERRE_RUTINARIO",
  POLITICA_REMUNERACION: "METADATOS_NULL",
  POLITICAS_CORPORATIVAS: "METADATOS_NULL",
  RATIFICACION_ACTOS: "CRITICAS",
  REDUCCION_CAPITAL: "MATERIA_SUBSTANTIVA",
  SEGUROS_RESPONSABILIDAD: "CRITICAS",
};

const CRITICAL_MATERIAS = new Set(["FUSION_ESCISION", "RATIFICACION_ACTOS", "SEGUROS_RESPONSABILIDAD"]);

function normalizeCode(value?: string | null) {
  return value?.trim().toUpperCase() || "";
}

function hasValue(value?: string | null) {
  return !!value?.trim();
}

function materiaOf(row: TemplateInventoryRow) {
  return normalizeCode(row.materia_acuerdo ?? row.materia);
}

function isActive(row: TemplateInventoryRow) {
  return normalizeCode(row.estado) === "ACTIVA";
}

function isSupportTemplate(row: TemplateInventoryRow) {
  return SUPPORT_TYPES.has(normalizeCode(row.tipo));
}

function pushIssue(
  issues: TemplateInventoryIssue[],
  row: TemplateInventoryRow,
  code: string,
  field_path: string,
  message: string,
  priority: TemplateInventoryIssue["priority"],
  severity: TemplateInventoryIssueSeverity = "BLOCKING",
) {
  issues.push({
    code,
    severity,
    templateId: row.id,
    materia: materiaOf(row),
    field_path,
    message,
    priority,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function fieldValue(item: unknown, keys: string[]) {
  if (typeof item === "string") return item;
  if (!isRecord(item)) return "";
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string") return value;
  }
  return "";
}

export function classifyTemplateClosureBlock(row: TemplateInventoryRow): TemplateClosureBlock {
  return PHASE4_LEGACY_TEMPLATE_BLOCKS[materiaOf(row)] ?? "FUERA_BLOQUE";
}

export function extractCapa2VariableNames(capa2: unknown): string[] {
  return asArray(capa2)
    .map((item) => fieldValue(item, ["variable", "name", "campo"]).trim())
    .filter(Boolean);
}

export function extractCapa2Sources(capa2: unknown): string[] {
  return asArray(capa2)
    .map((item) => fieldValue(item, ["fuente", "source"]).trim())
    .filter(Boolean);
}

export function extractCapa3FieldNames(capa3: unknown): string[] {
  return asArray(capa3)
    .map((item) => fieldValue(item, ["campo", "variable", "name"]).trim())
    .filter(Boolean);
}

export function findCapa2Capa3Duplicates(row: TemplateInventoryRow): string[] {
  const capa2 = new Set(extractCapa2VariableNames(row.capa2_variables).map(normalizeCode));
  return extractCapa3FieldNames(row.capa3_editables)
    .filter((field) => capa2.has(normalizeCode(field)))
    .sort();
}

function templateHasCapa3Field(row: TemplateInventoryRow, candidates: string[]) {
  const fields = new Set(extractCapa3FieldNames(row.capa3_editables).map(normalizeCode));
  return candidates.some((candidate) => fields.has(normalizeCode(candidate)));
}

function contentIncludes(row: TemplateInventoryRow, candidates: string[]) {
  const content = normalizeCode(row.capa1_inmutable);
  const ref = normalizeCode(row.referencia_legal);
  return candidates.some((candidate) => content.includes(normalizeCode(candidate)) || ref.includes(normalizeCode(candidate)));
}

function auditCriticalContent(row: TemplateInventoryRow, issues: TemplateInventoryIssue[]) {
  const materia = materiaOf(row);
  if (!CRITICAL_MATERIAS.has(materia)) return;

  if (materia === "FUSION_ESCISION") {
    if (!contentIncludes(row, ["RDL 5/2023"])) {
      pushIssue(
        issues,
        row,
        "FUSION_ESCISION_RDL_5_2023_REQUIRED",
        "referencia_legal",
        "Fusion/escision debe usar RDL 5/2023 y no una referencia LSC generica.",
        "P0",
      );
    }
    if (!contentIncludes(row, ["requiere_experto"])) {
      pushIssue(
        issues,
        row,
        "FUSION_ESCISION_EXPERT_CONDITIONAL_REQUIRED",
        "capa1_inmutable",
        "La plantilla debe condicionar el informe de experto para fusiones simplificadas.",
        "P0",
      );
    }
  }

  if (materia === "RATIFICACION_ACTOS") {
    if (!templateHasCapa3Field(row, ["enumeracion_actos", "actos_ratificados", "anexo_actos_ref"])) {
      pushIssue(
        issues,
        row,
        "RATIFICACION_ACTOS_LIST_REQUIRED",
        "capa3_editables",
        "La ratificacion exige campo obligatorio o anexo para identificar los actos ratificados.",
        "P0",
      );
    }
  }

  if (materia === "SEGUROS_RESPONSABILIDAD") {
    if (!templateHasCapa3Field(row, ["aseguradora_del_grupo"])) {
      pushIssue(
        issues,
        row,
        "SEGUROS_GROUP_INSURER_FLAG_REQUIRED",
        "capa3_editables",
        "Seguros de responsabilidad exige flag de aseguradora intra-grupo.",
        "P0",
      );
    }
    if (!contentIncludes(row, ["aseguradora_del_grupo", "conflicto intra-grupo", "conflicto intragrupo"])) {
      pushIssue(
        issues,
        row,
        "SEGUROS_GROUP_CONFLICT_BLOCK_REQUIRED",
        "capa1_inmutable",
        "La Capa 1 debe renderizar un bloque de conflicto intra-grupo cuando aplique.",
        "P0",
      );
    }
  }
}

export function auditTemplateInventory(rows: TemplateInventoryRow[]): TemplateInventoryAuditResult {
  const issues: TemplateInventoryIssue[] = [];
  const byBlock = {
    CRITICAS: 0,
    METADATOS_NULL: 0,
    MATERIA_SUBSTANTIVA: 0,
    CIERRE_RUTINARIO: 0,
    FUERA_BLOQUE: 0,
  } satisfies Record<TemplateClosureBlock, number>;

  for (const row of rows) {
    const active = isActive(row);
    const block = classifyTemplateClosureBlock(row);
    byBlock[block] += 1;

    if (!active) continue;
    if (!isSupportTemplate(row) && (!hasValue(row.aprobada_por) || !hasValue(row.fecha_aprobacion))) {
      pushIssue(
        issues,
        row,
        "ACTIVE_TEMPLATE_MISSING_FORMAL_SIGNATURE",
        "aprobada_por",
        "Una plantilla ACTIVA no puede quedar sin aprobada_por y fecha_aprobacion tras el cierre.",
        "P0",
      );
    }
    if (!isSupportTemplate(row) && (!hasValue(row.organo_tipo) || !hasValue(row.adoption_mode))) {
      pushIssue(
        issues,
        row,
        "ACTIVE_TEMPLATE_MISSING_OWNER_METADATA",
        "organo_tipo",
        "Faltan organo_tipo o adoption_mode para seleccionar la plantilla con seguridad.",
        block === "METADATOS_NULL" || block === "CRITICAS" ? "P0" : "P1",
      );
    }
    if (normalizeCode(row.tipo) === "MODELO_ACUERDO" && !hasValue(row.referencia_legal)) {
      pushIssue(
        issues,
        row,
        "ACTIVE_MODEL_MISSING_LEGAL_REFERENCE",
        "referencia_legal",
        "El modelo de acuerdo activo debe declarar referencia legal explicita.",
        block === "CRITICAS" ? "P0" : "P1",
      );
    }
    if (!SEMVER_RE.test(row.version?.trim() ?? "")) {
      pushIssue(
        issues,
        row,
        "TEMPLATE_VERSION_NOT_SEMVER",
        "version",
        "La version debe estar en formato semver antes de firma legal.",
        "P1",
      );
    }

    auditCriticalContent(row, issues);
  }

  const summary: TemplateInventoryAuditSummary = {
    total: rows.length,
    active: rows.filter(isActive).length,
    blocking: issues.filter((templateIssue) => templateIssue.severity === "BLOCKING").length,
    warning: issues.filter((templateIssue) => templateIssue.severity === "WARNING").length,
    legacyPending: rows.filter((row) => classifyTemplateClosureBlock(row) !== "FUERA_BLOQUE").length,
    byBlock,
  };

  return { issues, summary };
}
