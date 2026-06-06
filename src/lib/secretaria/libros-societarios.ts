export type SocietaryBookGroup = "LIBRO_MERCANTIL" | "REGISTRO_AUXILIAR";

export type LegalizationRequirement = "OBLIGATORIA" | "RECOMENDADA" | "NO_APLICA";

export type BookDeadlineState = "legalized" | "overdue" | "due_soon" | "in_time" | "unknown";

export interface BookDefinition {
  code: string;
  legacyCodes?: string[];
  label: string;
  shortLabel: string;
  group: SocietaryBookGroup;
  legalBasis: string;
  documentedOrgan: string;
  custodian: string;
  legalizationRequirement: LegalizationRequirement;
  legalizationMode: string;
  maintenanceModel: string;
  contentRoute: string;
  supervisionTags: string[];
}

export interface BookBodyLike {
  id?: string | null;
  name?: string | null;
  body_type?: string | null;
  config?: Record<string, unknown> | null;
  entity_id?: string | null;
}

export interface PersistedMandatoryBookLike {
  id: string;
  tenant_id: string;
  entity_id: string | null;
  book_kind: string;
  volume_number: number;
  period: number;
  status: string;
  opened_at: string | null;
  closed_at: string | null;
  legalization_deadline: string | null;
  legalization_status: string;
  legalization_evidence_url: string | null;
  entity_name?: string | null;
  entity_legal_name?: string | null;
  jurisdiction?: string | null;
  legal_form?: string | null;
  tipo_social?: string | null;
  es_cotizada?: boolean | null;
  regulated_sector?: string | null;
}

export interface SocietaryBookView extends PersistedMandatoryBookLike {
  book_code: string;
  display_label: string;
  short_label: string;
  group: SocietaryBookGroup;
  legal_basis: string;
  documented_organ: string;
  custodian_role: string;
  legalization_requirement: LegalizationRequirement;
  legalization_mode: string;
  maintenance_model: string;
  content_route: string;
  supervision_tags: string[];
  body_id: string | null;
  body_name: string | null;
  deadline_state: BookDeadlineState;
  entries_count: number | null;
  last_entry_at: string | null;
  is_virtual: boolean;
  source_book_id: string | null;
}

export interface BookPortfolioEntityLike {
  id: string;
  tenant_id?: string | null;
  common_name?: string | null;
  legal_name?: string | null;
  jurisdiction?: string | null;
  legal_form?: string | null;
  tipo_social?: string | null;
  es_cotizada?: boolean | null;
  regulated_sector?: string | null;
}

export interface BuildBookPortfolioInput {
  books: PersistedMandatoryBookLike[];
  bodies: BookBodyLike[];
  entities: BookPortfolioEntityLike[];
  now?: Date;
}

const LEGACY_KIND_ALIAS: Record<string, string> = {
  ACTAS: "LIBRO_ACTAS",
  SOCIOS: "LIBRO_REGISTRO_SOCIOS",
  ACCIONES: "LIBRO_ACCIONES_NOMINATIVAS",
  SOCIO_UNICO: "LIBRO_CONTRATOS_SOCIO_UNICO",
};

export const BOOK_DEFINITIONS: Record<string, BookDefinition> = {
  LIBRO_ACTAS: {
    code: "LIBRO_ACTAS",
    legacyCodes: ["ACTAS"],
    label: "Libro de actas",
    shortLabel: "Actas",
    group: "LIBRO_MERCANTIL",
    legalBasis: "arts. 202 y 250 LSC; arts. 97-107 y 109 RRM",
    documentedOrgan: "Junta, consejo u organo societario segun acta",
    custodian: "Secretario societario",
    legalizationRequirement: "OBLIGATORIA",
    legalizationMode: "Telematica ante Registro Mercantil",
    maintenanceModel: "Contenedor legacy; se secciona por organo desde meetings/minutes.",
    contentRoute: "/secretaria/actas",
    supervisionTags: ["LSC", "RRM"],
  },
  LIBRO_ACTAS_JUNTA_GENERAL: {
    code: "LIBRO_ACTAS_JUNTA_GENERAL",
    label: "Libro de actas de la Junta General",
    shortLabel: "Actas Junta",
    group: "LIBRO_MERCANTIL",
    legalBasis: "arts. 202-203 LSC; arts. 97-107 RRM",
    documentedOrgan: "Junta General",
    custodian: "Secretario del Consejo de Administracion",
    legalizationRequirement: "OBLIGATORIA",
    legalizationMode: "Legalizacion telematica anual",
    maintenanceModel: "Asientos desde minutes vinculadas a organos tipo Junta.",
    contentRoute: "/secretaria/actas",
    supervisionTags: ["LSC", "RRM", "CNMV"],
  },
  LIBRO_ACTAS_CONSEJO_ADMINISTRACION: {
    code: "LIBRO_ACTAS_CONSEJO_ADMINISTRACION",
    label: "Libro de actas del Consejo de Administracion",
    shortLabel: "Actas Consejo",
    group: "LIBRO_MERCANTIL",
    legalBasis: "art. 250 LSC; art. 109 RRM",
    documentedOrgan: "Consejo de Administracion",
    custodian: "Secretario del Consejo de Administracion",
    legalizationRequirement: "OBLIGATORIA",
    legalizationMode: "Legalizacion telematica anual",
    maintenanceModel: "Asientos desde actas generadas en ReunionStepper.",
    contentRoute: "/secretaria/actas",
    supervisionTags: ["LSC", "RRM", "CNMV"],
  },
  LIBRO_ACTAS_COMISION_AUDITORIA: {
    code: "LIBRO_ACTAS_COMISION_AUDITORIA",
    label: "Libro de actas de la Comision de Auditoria",
    shortLabel: "Actas Auditoria",
    group: "LIBRO_MERCANTIL",
    legalBasis: "art. 529 quaterdecies LSC; Ley 22/2015",
    documentedOrgan: "Comision de Auditoria",
    custodian: "Secretario de la comision",
    legalizationRequirement: "RECOMENDADA",
    legalizationMode: "Libro separado o seccion del libro del Consejo segun criterio RM",
    maintenanceModel: "Asientos separados por comision y elevacion al Consejo cuando proceda.",
    contentRoute: "/secretaria/actas",
    supervisionTags: ["LSC", "CNMV"],
  },
  LIBRO_ACTAS_COMISION_NOMBRAMIENTOS_RETRIBUCIONES: {
    code: "LIBRO_ACTAS_COMISION_NOMBRAMIENTOS_RETRIBUCIONES",
    label: "Libro de actas de Nombramientos y Retribuciones",
    shortLabel: "Actas NyR",
    group: "LIBRO_MERCANTIL",
    legalBasis: "art. 529 quindecies LSC",
    documentedOrgan: "Comision de Nombramientos y Retribuciones",
    custodian: "Secretario de la comision",
    legalizationRequirement: "RECOMENDADA",
    legalizationMode: "Libro separado o seccion del libro del Consejo segun criterio RM",
    maintenanceModel: "Asientos de propuestas, informes y supervisiones de la comision.",
    contentRoute: "/secretaria/actas",
    supervisionTags: ["LSC", "CNMV"],
  },
  LIBRO_ACTAS_COMISION_RIESGOS: {
    code: "LIBRO_ACTAS_COMISION_RIESGOS",
    label: "Libro de actas del Comite de Riesgos",
    shortLabel: "Actas Riesgos",
    group: "LIBRO_MERCANTIL",
    legalBasis: "arts. 65-66 Ley 20/2015; arts. 44-46 RD 1060/2015; reglamento del Consejo",
    documentedOrgan: "Comite de Riesgos",
    custodian: "Secretario del comite",
    legalizationRequirement: "RECOMENDADA",
    legalizationMode: "Libro separado por exigencia de trazabilidad supervisora",
    maintenanceModel: "Asientos con composicion, mayoria independiente y presidente no ejecutivo.",
    contentRoute: "/secretaria/actas",
    supervisionTags: ["LSC", "DGSFP", "Solvencia II"],
  },
  LIBRO_ACTAS_COMISION_EJECUTIVA: {
    code: "LIBRO_ACTAS_COMISION_EJECUTIVA",
    label: "Libro de actas de la Comision Ejecutiva",
    shortLabel: "Actas Ejecutiva",
    group: "LIBRO_MERCANTIL",
    legalBasis: "art. 249 LSC; art. 249 bis LSC",
    documentedOrgan: "Comision Ejecutiva",
    custodian: "Secretario de la comision",
    legalizationRequirement: "RECOMENDADA",
    legalizationMode: "Libro separado o seccion del libro del Consejo segun criterio RM",
    maintenanceModel: "Asientos de facultades delegadas, limites e indelegables.",
    contentRoute: "/secretaria/actas",
    supervisionTags: ["LSC", "RRM"],
  },
  LIBRO_ACTAS_COMISION_DELEGADA: {
    code: "LIBRO_ACTAS_COMISION_DELEGADA",
    label: "Libro de actas de comision delegada",
    shortLabel: "Actas comision",
    group: "LIBRO_MERCANTIL",
    legalBasis: "art. 250 LSC por analogia; reglamento del Consejo",
    documentedOrgan: "Comision delegada",
    custodian: "Secretario de la comision",
    legalizationRequirement: "RECOMENDADA",
    legalizationMode: "Confirmar criterio del Registro Mercantil competente",
    maintenanceModel: "Asientos separados por comision cuando no exista subtipo especifico.",
    contentRoute: "/secretaria/actas",
    supervisionTags: ["LSC", "CNMV"],
  },
  LIBRO_REGISTRO_SOCIOS: {
    code: "LIBRO_REGISTRO_SOCIOS",
    legacyCodes: ["SOCIOS"],
    label: "Libro registro de socios",
    shortLabel: "Socios",
    group: "LIBRO_MERCANTIL",
    legalBasis: "art. 104 LSC",
    documentedOrgan: "Registro de titularidad de participaciones",
    custodian: "Organo de administracion",
    legalizationRequirement: "OBLIGATORIA",
    legalizationMode: "Legalizacion telematica anual",
    maintenanceModel: "Asientos WORM desde capital_movements y capital_holdings vigentes.",
    contentRoute: "/secretaria/libro-socios",
    supervisionTags: ["LSC"],
  },
  LIBRO_ACCIONES_NOMINATIVAS: {
    code: "LIBRO_ACCIONES_NOMINATIVAS",
    legacyCodes: ["ACCIONES"],
    label: "Libro registro de acciones nominativas",
    shortLabel: "Acciones",
    group: "LIBRO_MERCANTIL",
    legalBasis: "art. 116 LSC; normativa de anotaciones en cuenta para cotizadas",
    documentedOrgan: "Registro de titularidad de acciones",
    custodian: "Organo de administracion",
    legalizationRequirement: "OBLIGATORIA",
    legalizationMode: "Legalizacion telematica anual; conciliacion con Iberclear en cotizadas",
    maintenanceModel: "Asientos desde capital_movements y cap table vigente.",
    contentRoute: "/secretaria/libro-socios",
    supervisionTags: ["LSC", "CNMV"],
  },
  LIBRO_CONTRATOS_SOCIO_UNICO: {
    code: "LIBRO_CONTRATOS_SOCIO_UNICO",
    legacyCodes: ["SOCIO_UNICO"],
    label: "Libro registro de contratos del socio unico",
    shortLabel: "Socio unico",
    group: "LIBRO_MERCANTIL",
    legalBasis: "art. 16 LSC",
    documentedOrgan: "Contratos entre socio unico y sociedad",
    custodian: "Organo de administracion",
    legalizationRequirement: "OBLIGATORIA",
    legalizationMode: "Legalizacion telematica anual",
    maintenanceModel: "Asientos desde decisiones unipersonales y contratos socio unico.",
    contentRoute: "/secretaria/decisiones-unipersonales",
    supervisionTags: ["LSC"],
  },
  LIBRO_DIARIO: {
    code: "LIBRO_DIARIO",
    label: "Libro Diario",
    shortLabel: "Diario",
    group: "LIBRO_MERCANTIL",
    legalBasis: "arts. 25 y ss. CCom",
    documentedOrgan: "Contabilidad",
    custodian: "Direccion financiera",
    legalizationRequirement: "OBLIGATORIA",
    legalizationMode: "Legalizacion telematica anual",
    maintenanceModel: "Registro contable fuera del flujo societario; visible para gobierno documental.",
    contentRoute: "/secretaria/libros",
    supervisionTags: ["CCom"],
  },
  LIBRO_INVENTARIOS_CUENTAS_ANUALES: {
    code: "LIBRO_INVENTARIOS_CUENTAS_ANUALES",
    label: "Libro de Inventarios y Cuentas Anuales",
    shortLabel: "Inventarios y CCAA",
    group: "LIBRO_MERCANTIL",
    legalBasis: "arts. 25 y ss. CCom; arts. 253 y 279 LSC",
    documentedOrgan: "Cuentas anuales e inventarios",
    custodian: "Direccion financiera",
    legalizationRequirement: "OBLIGATORIA",
    legalizationMode: "Legalizacion telematica anual",
    maintenanceModel: "Coordinado con formulacion de cuentas, aprobacion por Junta y deposito.",
    contentRoute: "/secretaria/libros",
    supervisionTags: ["CCom", "LSC"],
  },
  REGISTRO_PERSONAS_CARGOS: {
    code: "REGISTRO_PERSONAS_CARGOS",
    label: "Registro de personas y cargos",
    shortLabel: "Personas y cargos",
    group: "REGISTRO_AUXILIAR",
    legalBasis: "arts. 109 y 124 RRM; arts. 214 y 529 sexies LSC",
    documentedOrgan: "Todos los organos",
    custodian: "Secretaria societaria",
    legalizationRequirement: "NO_APLICA",
    legalizationMode: "No legalizable; registro auxiliar estructurado",
    maintenanceModel: "SSOT de condiciones_persona, autoridad certificante e inscripcion RM.",
    contentRoute: "/secretaria/personas",
    supervisionTags: ["RRM", "LSC"],
  },
  REGISTRO_CONFLICTOS_OPERACIONES_VINCULADAS: {
    code: "REGISTRO_CONFLICTOS_OPERACIONES_VINCULADAS",
    label: "Registro de conflictos y operaciones vinculadas",
    shortLabel: "Conflictos y vinculadas",
    group: "REGISTRO_AUXILIAR",
    legalBasis: "arts. 228-230 y 529 ter LSC",
    documentedOrgan: "Consejo y comisiones",
    custodian: "Secretaria societaria / Cumplimiento",
    legalizationRequirement: "NO_APLICA",
    legalizationMode: "No legalizable; evidencia de compliance",
    maintenanceModel: "Snapshot de conflictos por punto y abstenciones verificables.",
    contentRoute: "/secretaria/reglas-aplicables",
    supervisionTags: ["LSC", "CNMV", "D&O"],
  },
  REGISTRO_DELEGACIONES_FACULTADES: {
    code: "REGISTRO_DELEGACIONES_FACULTADES",
    label: "Registro de delegaciones de facultades",
    shortLabel: "Delegaciones",
    group: "REGISTRO_AUXILIAR",
    legalBasis: "arts. 249 y 249 bis LSC",
    documentedOrgan: "Consejo de Administracion",
    custodian: "Secretaria societaria",
    legalizationRequirement: "NO_APLICA",
    legalizationMode: "No legalizable; la delegacion puede ser inscribible",
    maintenanceModel: "Control de alcance, limites, escritura e inscripcion.",
    contentRoute: "/delegaciones",
    supervisionTags: ["LSC", "RRM"],
  },
  REGISTRO_PODERES_REPRESENTACIONES: {
    code: "REGISTRO_PODERES_REPRESENTACIONES",
    label: "Registro de poderes y representaciones",
    shortLabel: "Poderes",
    group: "REGISTRO_AUXILIAR",
    legalBasis: "arts. 184 y 212 bis LSC; practica registral",
    documentedOrgan: "Transversal",
    custodian: "Secretaria societaria",
    legalizationRequirement: "NO_APLICA",
    legalizationMode: "No legalizable; soporte notarial/registral",
    maintenanceModel: "Poderes generales, especiales, pleitos y representantes permanentes.",
    contentRoute: "/secretaria/personas",
    supervisionTags: ["LSC", "RRM"],
  },
  REGISTRO_PACTOS_PARASOCIALES: {
    code: "REGISTRO_PACTOS_PARASOCIALES",
    label: "Registro de pactos parasociales",
    shortLabel: "Pactos",
    group: "REGISTRO_AUXILIAR",
    legalBasis: "practica de buen gobierno; arts. 530-535 LSC para cotizadas",
    documentedOrgan: "Transversal",
    custodian: "Secretaria societaria",
    legalizationRequirement: "NO_APLICA",
    legalizationMode: "No legalizable; fuente contractual de warnings",
    maintenanceModel: "Vetos, compromisos de voto y alertas no invalidantes.",
    contentRoute: "/secretaria/reglas-aplicables",
    supervisionTags: ["LSC", "Pacto parasocial"],
  },
  REGISTRO_COMUNICACIONES_REGULATORIAS: {
    code: "REGISTRO_COMUNICACIONES_REGULATORIAS",
    label: "Registro de comunicaciones regulatorias",
    shortLabel: "Comunicaciones",
    group: "REGISTRO_AUXILIAR",
    legalBasis: "LOSSEAR, Solvencia II, LMV y RD 1060/2015",
    documentedOrgan: "Transversal",
    custodian: "Secretaria societaria / Cumplimiento",
    legalizationRequirement: "NO_APLICA",
    legalizationMode: "No legalizable; trazabilidad supervisora",
    maintenanceModel: "Comunicaciones DGSFP/CNMV y estado de respuesta.",
    contentRoute: "/secretaria/comunicaciones",
    supervisionTags: ["DGSFP", "CNMV", "Solvencia II"],
  },
  REGISTRO_IDONEIDAD_FIT_PROPER: {
    code: "REGISTRO_IDONEIDAD_FIT_PROPER",
    label: "Registro de idoneidad fit & proper",
    shortLabel: "Fit & proper",
    group: "REGISTRO_AUXILIAR",
    legalBasis: "art. 38 Ley 20/2015; RD 1060/2015",
    documentedOrgan: "Consejo, comites y funciones clave",
    custodian: "Secretaria societaria / Cumplimiento",
    legalizationRequirement: "NO_APLICA",
    legalizationMode: "No legalizable; expediente supervisor",
    maintenanceModel: "Idoneidad, honorabilidad, comunicaciones y renovaciones.",
    contentRoute: "/secretaria/personas",
    supervisionTags: ["DGSFP", "Solvencia II"],
  },
  REGISTRO_SOLVENCIA_II_SUPERVISION: {
    code: "REGISTRO_SOLVENCIA_II_SUPERVISION",
    label: "Registro de supervision Solvencia II",
    shortLabel: "Solvencia II",
    group: "REGISTRO_AUXILIAR",
    legalBasis: "Ley 20/2015; Reglamento Delegado UE 2015/35",
    documentedOrgan: "Transversal",
    custodian: "Cumplimiento / Riesgos / Secretaria",
    legalizationRequirement: "NO_APLICA",
    legalizationMode: "No legalizable; soporte de Pilar 3",
    maintenanceModel: "SFCR, RSR, evidencias de supervision y requerimientos.",
    contentRoute: "/sii",
    supervisionTags: ["DGSFP", "Solvencia II"],
  },
};

const BASE_AUXILIARY_CODES = [
  "REGISTRO_PERSONAS_CARGOS",
  "REGISTRO_CONFLICTOS_OPERACIONES_VINCULADAS",
  "REGISTRO_DELEGACIONES_FACULTADES",
  "REGISTRO_PODERES_REPRESENTACIONES",
  "REGISTRO_PACTOS_PARASOCIALES",
  "REGISTRO_COMUNICACIONES_REGULATORIAS",
] as const;

const INSURANCE_AUXILIARY_CODES = [
  "REGISTRO_IDONEIDAD_FIT_PROPER",
  "REGISTRO_SOLVENCIA_II_SUPERVISION",
] as const;

export function normalizeTextForBook(value?: string | null): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

export function normalizeMandatoryBookKind(kind?: string | null): string {
  const normalized = normalizeTextForBook(kind).replace(/[\s-]+/g, "_");
  return LEGACY_KIND_ALIAS[normalized] ?? normalized;
}

export function bookDefinitionForKind(kind?: string | null): BookDefinition {
  const normalized = normalizeMandatoryBookKind(kind);
  return BOOK_DEFINITIONS[normalized] ?? {
    code: normalized || "LIBRO_DESCONOCIDO",
    label: normalized ? normalized.replace(/_/g, " ") : "Libro sin clasificar",
    shortLabel: normalized ? normalized.replace(/_/g, " ") : "Libro",
    group: "LIBRO_MERCANTIL",
    legalBasis: "Pendiente de clasificacion por Secretaria",
    documentedOrgan: "No clasificado",
    custodian: "Secretaria societaria",
    legalizationRequirement: "NO_APLICA",
    legalizationMode: "Pendiente de clasificacion",
    maintenanceModel: "Fallback operativo para no bloquear la navegacion.",
    contentRoute: "/secretaria/libros",
    supervisionTags: [],
  };
}

export function actaBookKindForBody(body?: BookBodyLike | null): string {
  const type = normalizeTextForBook(body?.body_type);
  const name = normalizeTextForBook(body?.name);
  if (type === "JUNTA" || name.includes("JUNTA")) return "LIBRO_ACTAS_JUNTA_GENERAL";
  if (type === "CDA" || name.includes("CONSEJO")) return "LIBRO_ACTAS_CONSEJO_ADMINISTRACION";
  if (name.includes("AUDITOR")) return "LIBRO_ACTAS_COMISION_AUDITORIA";
  if (name.includes("NOMBRAM") || name.includes("RETRIB")) return "LIBRO_ACTAS_COMISION_NOMBRAMIENTOS_RETRIBUCIONES";
  if (name.includes("RIESG")) return "LIBRO_ACTAS_COMISION_RIESGOS";
  if (name.includes("EJECUT")) return "LIBRO_ACTAS_COMISION_EJECUTIVA";
  if (type === "COMISION" || type === "COMITE") return "LIBRO_ACTAS_COMISION_DELEGADA";
  return "LIBRO_ACTAS";
}

export function isInsuranceListedEntity(entity?: { es_cotizada?: boolean | null; regulated_sector?: string | null } | null): boolean {
  return Boolean(entity?.es_cotizada) && normalizeTextForBook(entity?.regulated_sector).includes("SEGURO");
}

export function expectedBookCodesForEntity(entity?: { tipo_social?: string | null; legal_form?: string | null; es_cotizada?: boolean | null; regulated_sector?: string | null } | null): string[] {
  const tipo = normalizeTextForBook(entity?.tipo_social || entity?.legal_form);
  const isSa = tipo === "SA" || tipo === "SAU";
  const isSl = tipo === "SL" || tipo === "SLU";
  const isUnipersonal = tipo === "SAU" || tipo === "SLU";
  const codes = [
    ...(isSl ? ["LIBRO_REGISTRO_SOCIOS"] : []),
    ...(isSa ? ["LIBRO_ACCIONES_NOMINATIVAS"] : []),
    ...(isUnipersonal ? ["LIBRO_CONTRATOS_SOCIO_UNICO"] : []),
    "LIBRO_DIARIO",
    "LIBRO_INVENTARIOS_CUENTAS_ANUALES",
    ...BASE_AUXILIARY_CODES,
    ...(isInsuranceListedEntity(entity) ? INSURANCE_AUXILIARY_CODES : []),
  ];
  return Array.from(new Set(codes));
}

export function classifyBookDeadline(
  legalizationDeadline: string | null | undefined,
  legalizationStatus: string | null | undefined,
  now = new Date(),
): BookDeadlineState {
  if (normalizeTextForBook(legalizationStatus) === "LEGALIZADO") return "legalized";
  if (!legalizationDeadline) return "unknown";
  const deadline = new Date(`${String(legalizationDeadline).slice(0, 10)}T23:59:59.999Z`);
  const today = new Date(now);
  const diff = deadline.getTime() - today.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return "overdue";
  if (days <= 30) return "due_soon";
  return "in_time";
}

function defaultBookForEntity(
  entity: BookPortfolioEntityLike,
  code: string,
  period: number,
  source?: PersistedMandatoryBookLike | null,
): PersistedMandatoryBookLike {
  return {
    id: `virtual:${entity.id}:${code}:${period}`,
    tenant_id: source?.tenant_id ?? entity.tenant_id ?? "",
    entity_id: entity.id,
    book_kind: code,
    volume_number: source?.volume_number ?? 1,
    period: source?.period ?? period,
    status: source?.status ?? "OPEN",
    opened_at: source?.opened_at ?? null,
    closed_at: source?.closed_at ?? null,
    legalization_deadline: source?.legalization_deadline ?? null,
    legalization_status: source?.legalization_status ?? "PENDIENTE",
    legalization_evidence_url: source?.legalization_evidence_url ?? null,
    entity_name: entity.common_name ?? entity.legal_name ?? null,
    entity_legal_name: entity.legal_name ?? null,
    jurisdiction: entity.jurisdiction ?? null,
    legal_form: entity.legal_form ?? null,
    tipo_social: entity.tipo_social ?? null,
    es_cotizada: entity.es_cotizada ?? null,
    regulated_sector: entity.regulated_sector ?? null,
  };
}

function toViewRow(params: {
  book: PersistedMandatoryBookLike;
  code: string;
  definition: BookDefinition;
  body?: BookBodyLike | null;
  sourceBookId?: string | null;
  isVirtual: boolean;
  now?: Date;
}): SocietaryBookView {
  return {
    ...params.book,
    book_kind: params.book.book_kind,
    book_code: params.code,
    display_label: params.definition.label,
    short_label: params.definition.shortLabel,
    group: params.definition.group,
    legal_basis: params.definition.legalBasis,
    documented_organ: params.body?.name ?? params.definition.documentedOrgan,
    custodian_role: params.definition.custodian,
    legalization_requirement: params.definition.legalizationRequirement,
    legalization_mode: params.definition.legalizationMode,
    maintenance_model: params.definition.maintenanceModel,
    content_route: params.definition.contentRoute,
    supervision_tags: params.definition.supervisionTags,
    body_id: params.body?.id ?? null,
    body_name: params.body?.name ?? null,
    deadline_state: classifyBookDeadline(params.book.legalization_deadline, params.book.legalization_status, params.now),
    entries_count: null,
    last_entry_at: null,
    is_virtual: params.isVirtual,
    source_book_id: params.sourceBookId ?? null,
  };
}

export function buildSocietaryBookPortfolio(input: BuildBookPortfolioInput): SocietaryBookView[] {
  const now = input.now ?? new Date();
  const period = now.getFullYear();
  const entitiesById = new Map(input.entities.map((entity) => [entity.id, entity]));
  const booksByEntity = new Map<string, PersistedMandatoryBookLike[]>();
  const bodiesByEntity = new Map<string, BookBodyLike[]>();

  for (const book of input.books) {
    if (!book.entity_id) continue;
    const current = booksByEntity.get(book.entity_id) ?? [];
    current.push(book);
    booksByEntity.set(book.entity_id, current);
  }
  for (const body of input.bodies) {
    if (!body.entity_id) continue;
    const current = bodiesByEntity.get(body.entity_id) ?? [];
    current.push(body);
    bodiesByEntity.set(body.entity_id, current);
    if (!entitiesById.has(body.entity_id)) {
      entitiesById.set(body.entity_id, { id: body.entity_id });
    }
  }
  for (const book of input.books) {
    if (book.entity_id && !entitiesById.has(book.entity_id)) {
      entitiesById.set(book.entity_id, {
        id: book.entity_id,
        tenant_id: book.tenant_id,
        common_name: book.entity_name ?? null,
        legal_name: book.entity_legal_name ?? null,
        jurisdiction: book.jurisdiction ?? null,
        legal_form: book.legal_form ?? null,
        tipo_social: book.tipo_social ?? null,
        es_cotizada: book.es_cotizada ?? null,
        regulated_sector: book.regulated_sector ?? null,
      });
    }
  }

  const rows: SocietaryBookView[] = [];
  const usedPersistedIds = new Set<string>();

  for (const entity of entitiesById.values()) {
    const entityBooks = booksByEntity.get(entity.id) ?? [];
    const entityBodies = bodiesByEntity.get(entity.id) ?? [];
    const genericActas = entityBooks.find((book) => normalizeMandatoryBookKind(book.book_kind) === "LIBRO_ACTAS");

    if (entityBodies.length > 0) {
      for (const body of entityBodies) {
        const code = actaBookKindForBody(body);
        const existing = entityBooks.find((book) => normalizeMandatoryBookKind(book.book_kind) === code);
        const source = existing ?? genericActas ?? null;
        if (source?.id) usedPersistedIds.add(source.id);
        rows.push(toViewRow({
          book: source ?? defaultBookForEntity(entity, code, period, genericActas),
          code,
          definition: bookDefinitionForKind(code),
          body,
          sourceBookId: source?.id ?? genericActas?.id ?? null,
          isVirtual: !existing,
          now,
        }));
      }
    }

    for (const code of expectedBookCodesForEntity(entity)) {
      const existing = entityBooks.find((book) => normalizeMandatoryBookKind(book.book_kind) === code);
      if (existing?.id) usedPersistedIds.add(existing.id);
      rows.push(toViewRow({
        book: existing ?? defaultBookForEntity(entity, code, period),
        code,
        definition: bookDefinitionForKind(code),
        isVirtual: !existing,
        now,
      }));
    }

    if (entityBodies.length === 0 && genericActas && !usedPersistedIds.has(genericActas.id)) {
      usedPersistedIds.add(genericActas.id);
      rows.push(toViewRow({
        book: genericActas,
        code: "LIBRO_ACTAS",
        definition: bookDefinitionForKind("LIBRO_ACTAS"),
        isVirtual: false,
        now,
      }));
    }
  }

  for (const book of input.books) {
    if (usedPersistedIds.has(book.id)) continue;
    const code = normalizeMandatoryBookKind(book.book_kind);
    rows.push(toViewRow({
      book,
      code,
      definition: bookDefinitionForKind(code),
      isVirtual: false,
      now,
    }));
  }

  return rows.sort((a, b) => {
    const entity = (a.entity_name ?? "").localeCompare(b.entity_name ?? "", "es");
    if (entity !== 0) return entity;
    const group = a.group.localeCompare(b.group);
    if (group !== 0) return group;
    return a.display_label.localeCompare(b.display_label, "es");
  });
}

export function summarizeBookPortfolio(books: SocietaryBookView[]) {
  return {
    total: books.length,
    mandatory: books.filter((book) => book.group === "LIBRO_MERCANTIL").length,
    auxiliary: books.filter((book) => book.group === "REGISTRO_AUXILIAR").length,
    legalized: books.filter((book) => normalizeTextForBook(book.legalization_status) === "LEGALIZADO").length,
    nonLegalized: books.filter(
      (book) =>
        book.legalization_requirement !== "NO_APLICA" &&
        normalizeTextForBook(book.legalization_status) !== "LEGALIZADO",
    ).length,
    alerts: books.filter((book) => book.deadline_state === "overdue" || book.deadline_state === "due_soon").length,
    rejected: books.filter((book) => normalizeTextForBook(book.legalization_status) === "RECHAZADO").length,
  };
}

export function bookDestinationForBody(body?: BookBodyLike | null): BookDefinition {
  return bookDefinitionForKind(actaBookKindForBody(body));
}
