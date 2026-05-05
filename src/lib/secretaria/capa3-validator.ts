export type Capa3ValidationStatus = "PASS" | "WARNING" | "FAIL";
export type Capa3IssueSeverity = "WARNING" | "BLOCKING";

export interface Capa3ValidationIssue {
  code: string;
  severity: Capa3IssueSeverity;
  field_path: string;
  message: string;
  referencia_legal?: string;
}

export interface Capa3ValidationContext {
  tipoSocial?: "SA" | "SL" | "SLU" | "SAU" | string;
  esCotizada?: boolean;
  plazoMandatoEstatutos?: number;
  plazoSuscripcionPreferenteMinDias?: number;
}

export interface Capa3ValidationResult {
  status: Capa3ValidationStatus;
  ok: boolean;
  issues: Capa3ValidationIssue[];
  normalizedValues: Record<string, unknown>;
  derived: Record<string, unknown>;
}

type Values = Record<string, unknown>;

const EPSILON = 0.000001;

function normalizeCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function isBlank(value: unknown) {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function pick(values: Values, keys: string[]) {
  for (const key of keys) {
    if (key in values) return values[key];
  }
  return undefined;
}

function numeric(values: Values, keys: string[]) {
  const raw = pick(values, keys);
  if (raw === undefined || raw === null || raw === "") return { raw, value: null, present: false, valid: true };
  if (typeof raw === "number" && Number.isFinite(raw)) return { raw, value: raw, present: true, valid: true };
  if (typeof raw === "string" && raw.trim() && Number.isFinite(Number(raw))) {
    return { raw, value: Number(raw), present: true, valid: true };
  }
  return { raw, value: null, present: true, valid: false };
}

function bool(values: Values, keys: string[]) {
  const raw = pick(values, keys);
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "string") {
    const value = normalizeCode(raw);
    if (["SI", "S", "TRUE", "YES", "1"].includes(value)) return true;
    if (["NO", "N", "FALSE", "0"].includes(value)) return false;
  }
  return undefined;
}

function issue(
  code: string,
  field_path: string,
  message: string,
  referencia_legal?: string,
  severity: Capa3IssueSeverity = "BLOCKING",
): Capa3ValidationIssue {
  return { code, severity, field_path, message, referencia_legal };
}

function pushNumericIssue(issues: Capa3ValidationIssue[], result: ReturnType<typeof numeric>, field: string) {
  if (result.present && !result.valid) {
    issues.push(issue("CAPA3_NUMERIC_FIELD", `capa3.${field}`, "El campo debe ser numerico."));
  }
}

function hasAnyValue(values: Values, keys: string[]) {
  return keys.some((key) => !isBlank(values[key]));
}

function defaultComiteLegalRef(tipoComite: unknown) {
  const tipo = normalizeCode(tipoComite);
  if (tipo.includes("AUDITOR")) return "arts. 529 quaterdecies LSC";
  if (tipo.includes("NOMBR")) return "art. 529 quindecies LSC";
  if (tipo.includes("RETRIB")) return "art. 529 quindecies LSC";
  if (tipo.includes("RIESGO")) return "arts. 21-22 RD 84/2015";
  return "Reglamento interno del organo y normativa societaria aplicable";
}

function validateAuditor(values: Values, issues: Capa3ValidationIssue[]) {
  const years = numeric(values, ["duracion_anos", "duracion_auditor_anos"]);
  pushNumericIssue(issues, years, "duracion_anos");
  if (years.valid && years.value !== null && (years.value < 3 || years.value > 9)) {
    issues.push(issue(
      "AUDITOR_DURATION_RANGE",
      "capa3.duracion_anos",
      "La duracion del auditor debe estar entre 3 y 9 anos.",
      "art. 264.1 LSC",
    ));
  }
}

function validateConsejero(values: Values, context: Capa3ValidationContext, issues: Capa3ValidationIssue[]) {
  const plazo = numeric(values, ["plazo_mandato", "plazo_mandato_anos", "duracion_mandato"]);
  pushNumericIssue(issues, plazo, "plazo_mandato");

  const tipoSocial = normalizeCode(context.tipoSocial);
  const isSA = tipoSocial === "SA" || tipoSocial === "SAU";
  const isSL = tipoSocial === "SL" || tipoSocial === "SLU";
  const legalMax = context.esCotizada ? 4 : 6;
  const statutoryMax =
    typeof context.plazoMandatoEstatutos === "number" && context.plazoMandatoEstatutos > 0
      ? context.plazoMandatoEstatutos
      : legalMax;
  const max = Math.min(legalMax, statutoryMax);

  if (plazo.valid && plazo.value !== null && isSA && plazo.value > max) {
    issues.push(issue(
      "CONSEJERO_TERM_RANGE",
      "capa3.plazo_mandato",
      `El plazo de mandato excede el maximo aplicable (${max} anos).`,
      "art. 221.2 LSC",
    ));
  }

  const modo = normalizeCode(pick(values, ["modo_nombramiento", "tipo_nombramiento"]));
  const esCooptacion = bool(values, ["es_cooptacion", "cooptacion"]) === true || modo.includes("COOPTACION");
  if (esCooptacion && isSL) {
    issues.push(issue(
      "COOPTACION_ONLY_SA",
      "capa3.es_cooptacion",
      "La cooptacion solo aplica a sociedades anonimas.",
      "art. 244 LSC",
    ));
  }
}

function validateAumentoCapital(values: Values, context: Capa3ValidationContext, issues: Capa3ValidationIssue[]) {
  const anterior = numeric(values, ["capital_anterior"]);
  const aumento = numeric(values, ["importe_aumento", "aumento_importe"]);
  const nuevo = numeric(values, ["capital_nuevo"]);
  pushNumericIssue(issues, anterior, "capital_anterior");
  pushNumericIssue(issues, aumento, "importe_aumento");
  pushNumericIssue(issues, nuevo, "capital_nuevo");

  if (anterior.value !== null && aumento.value !== null && nuevo.value !== null) {
    const expected = anterior.value + aumento.value;
    if (Math.abs(expected - nuevo.value) > EPSILON) {
      issues.push(issue(
        "CAPITAL_INCREASE_ARITHMETIC",
        "capa3.capital_nuevo",
        "El capital nuevo debe coincidir con capital anterior mas importe del aumento.",
      ));
    }
  }

  const plazo = numeric(values, ["plazo_suscripcion_preferente_dias", "plazo_suscripcion_dias"]);
  pushNumericIssue(issues, plazo, "plazo_suscripcion_preferente_dias");
  const minDays = Math.max(15, context.plazoSuscripcionPreferenteMinDias ?? 15);
  if (plazo.valid && plazo.value !== null && plazo.value < minDays) {
    issues.push(issue(
      "PREFERENTIAL_SUBSCRIPTION_PERIOD",
      "capa3.plazo_suscripcion_preferente_dias",
      `El plazo de suscripcion preferente debe ser al menos ${minDays} dias.`,
      "art. 305 LSC",
    ));
  }
}

function validateReduccionCapital(values: Values, issues: Capa3ValidationIssue[], derived: Record<string, unknown>) {
  const tipo = normalizeCode(pick(values, ["tipo_reduccion", "finalidad_reduccion"]));
  const protectedReduction = ["POR_PERDIDAS", "PERDIDAS", "DOTAR_RESERVA_LEGAL", "RESERVA_LEGAL"].includes(tipo);
  const requiresOpposition = !!tipo && !protectedReduction;
  derived.requiresCreditorOpposition = requiresOpposition;
  if (requiresOpposition && bool(values, ["oposicion_acreedores_documentada", "plazo_oposicion_acreedores_cumplido"]) !== true) {
    issues.push(issue(
      "CREDITOR_OPPOSITION_GATE",
      "capa3.oposicion_acreedores_documentada",
      "La reduccion exige acreditar publicidad/plazo de oposicion o renuncia.",
      "art. 334 LSC",
    ));
  }
}

function validatePoliticaRemuneracion(values: Values, issues: Capa3ValidationIssue[]) {
  const total = numeric(values, ["retribucion_maxima_total", "importe_maximo_total"]);
  pushNumericIssue(issues, total, "retribucion_maxima_total");
  if (total.valid && total.value !== null && total.value <= 0) {
    issues.push(issue("REMUNERATION_POSITIVE_AMOUNT", "capa3.retribucion_maxima_total", "La retribucion maxima debe ser superior a cero."));
  }
}

function validateSegurosResponsabilidad(values: Values, issues: Capa3ValidationIssue[]) {
  for (const field of ["prima_total", "limite_cobertura", "franquicia"]) {
    pushNumericIssue(issues, numeric(values, [field]), field);
  }

  if (bool(values, ["aseguradora_del_grupo"]) === true) {
    const hasConflictTreatment =
      hasAnyValue(values, ["tratamiento_conflicto_intra_grupo", "soporte_mercado_ref"]) ||
      bool(values, ["soporte_mercado_independiente", "abstencion_consejero_afectado"]) === true;
    if (!hasConflictTreatment) {
      issues.push(issue(
        "GROUP_INSURER_CONFLICT_GATE",
        "capa3.aseguradora_del_grupo",
        "La poliza intra-grupo exige tratamiento de conflicto o soporte de mercado independiente.",
        "LOSSEAR art. 14",
      ));
    }
  }
}

function validateFusionEscision(values: Values, issues: Capa3ValidationIssue[]) {
  const ref = normalizeCode(pick(values, ["referencia_legal", "base_legal"]));
  if (!ref || (!ref.includes("RDL 5/2023") && !ref.includes("RDL5/2023"))) {
    issues.push(issue(
      "STRUCTURAL_OPERATION_LEGAL_REF",
      "capa3.referencia_legal",
      "Las modificaciones estructurales deben referenciar el RDL 5/2023, no una referencia LSC generica.",
      "RDL 5/2023",
    ));
  }

  const tipo = normalizeCode(pick(values, ["tipo_operacion", "modalidad_operacion"]));
  if (tipo.includes("FUSION_SIMPLIFICADA") && bool(values, ["requiere_experto"]) !== false) {
    issues.push(issue(
      "SIMPLIFIED_MERGER_EXPERT_REPORT",
      "capa3.requiere_experto",
      "En fusion simplificada matriz-filial 100%, requiere_experto debe ser false.",
      "art. 53 RDL 5/2023",
    ));
  }
}

function validateComitesInternos(values: Values, issues: Capa3ValidationIssue[], normalizedValues: Values) {
  const current = pick(values, ["articulos_lsc_comite"]);
  if (isBlank(current) && bool(values, ["requerido", "articulos_lsc_comite_requerido"]) === false) {
    normalizedValues.articulos_lsc_comite = defaultComiteLegalRef(pick(values, ["tipo_comite", "nombre_comite"]));
    issues.push(issue(
      "COMMITTEE_LEGAL_REF_DEFAULTED",
      "capa3.articulos_lsc_comite",
      "Se aplica referencia legal por defecto para evitar placeholder literal.",
      undefined,
      "WARNING",
    ));
  }
}

function validateDistribucionDividendos(values: Values, issues: Capa3ValidationIssue[]) {
  const importe = numeric(values, ["importe_dividendo", "dividendo_total"]);
  const resultado = numeric(values, ["resultado_neto", "beneficio_neto"]);
  const reserva = numeric(values, ["dotacion_reserva_legal", "reserva_legal"]);
  pushNumericIssue(issues, importe, "importe_dividendo");
  pushNumericIssue(issues, resultado, "resultado_neto");
  pushNumericIssue(issues, reserva, "dotacion_reserva_legal");

  if (importe.value !== null && resultado.value !== null && reserva.value !== null) {
    const distributable = resultado.value - reserva.value;
    if (importe.value - distributable > EPSILON) {
      issues.push(issue(
        "DIVIDEND_DISTRIBUTABLE_AMOUNT",
        "capa3.importe_dividendo",
        "El dividendo no puede exceder el beneficio distribuible tras reserva legal.",
        "art. 273 LSC",
      ));
    }
  }
}

function validateRatificacionActos(values: Values, issues: Capa3ValidationIssue[]) {
  const actos = pick(values, ["enumeracion_actos", "actos_ratificados", "anexo_actos_ref"]);
  if (isBlank(actos)) {
    issues.push(issue(
      "RATIFICATION_ACTS_REQUIRED",
      "capa3.enumeracion_actos",
      "La ratificacion exige identificar los actos ratificados o un anexo trazable.",
      "RRM arts. 108-109",
    ));
  }
}

function validateModificacionEstatutos(values: Values, issues: Capa3ValidationIssue[]) {
  const included =
    bool(values, ["texto_integro_disponible", "convocatoria_incluye_texto_integro", "texto_modificacion_disponible"]) === true;
  if (!included) {
    issues.push(issue(
      "BYLAWS_FULL_TEXT_GATE",
      "capa3.texto_integro_disponible",
      "La convocatoria debe incluir o poner a disposicion el texto integro de la modificacion.",
      "art. 287 LSC",
    ));
  }
}

export function validateCapa3ForMateria(
  materiaInput: string,
  values: Values = {},
  context: Capa3ValidationContext = {},
): Capa3ValidationResult {
  const materia = normalizeCode(materiaInput);
  const issues: Capa3ValidationIssue[] = [];
  const normalizedValues: Values = { ...values };
  const derived: Record<string, unknown> = {};

  switch (materia) {
    case "NOMBRAMIENTO_AUDITOR":
      validateAuditor(values, issues);
      break;
    case "NOMBRAMIENTO_CONSEJERO":
    case "NOMBRAMIENTO_ADMINISTRADOR_JUNTA":
    case "COOPTACION_CONSEJO":
      validateConsejero(values, context, issues);
      break;
    case "AUMENTO_CAPITAL":
      validateAumentoCapital(values, context, issues);
      break;
    case "REDUCCION_CAPITAL":
      validateReduccionCapital(values, issues, derived);
      break;
    case "POLITICA_REMUNERACION":
      validatePoliticaRemuneracion(values, issues);
      break;
    case "SEGUROS_RESPONSABILIDAD":
      validateSegurosResponsabilidad(values, issues);
      break;
    case "FUSION_ESCISION":
      validateFusionEscision(values, issues);
      break;
    case "COMITES_INTERNOS":
      validateComitesInternos(values, issues, normalizedValues);
      break;
    case "DISTRIBUCION_DIVIDENDOS":
      validateDistribucionDividendos(values, issues);
      break;
    case "RATIFICACION_ACTOS":
      validateRatificacionActos(values, issues);
      break;
    case "MODIFICACION_ESTATUTOS":
      validateModificacionEstatutos(values, issues);
      break;
    default:
      break;
  }

  const hasBlocking = issues.some((validationIssue) => validationIssue.severity === "BLOCKING");
  const status: Capa3ValidationStatus = hasBlocking ? "FAIL" : issues.length > 0 ? "WARNING" : "PASS";
  return {
    status,
    ok: !hasBlocking,
    issues,
    normalizedValues,
    derived,
  };
}
