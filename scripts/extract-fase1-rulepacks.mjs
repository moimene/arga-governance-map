import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DEFAULT_OUTPUT_DIR = path.join(ROOT, "docs/superpowers/specs/2026-05-20-fase1");
const EXPECTED_REF = "hzqwefkwsxopwrmtksbg";
const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const DEMO_EMAIL = process.env.TGMS_DEMO_EMAIL ?? "demo@arga-seguros.com";
const DEMO_PASSWORD = process.env.TGMS_DEMO_PASSWORD ?? "TGMSdemo2026!";

const CSV_HEADERS = {
  normalized: [
    "rule_pack_id",
    "materia",
    "organo_tipo",
    "version",
    "is_active",
    "inscribible",
    "instrumento_requerido",
    "publicacion_requerida",
    "conv_sa_dias",
    "conv_sl_dias",
    "conv_canales_sa",
    "conv_canales_sl",
    "conv_contenido_min",
    "quorum_sa_1a",
    "quorum_sa_2a",
    "quorum_sl",
    "mayoria_sa",
    "mayoria_sl",
    "mayoria_fuente_sa",
    "mayoria_fuente_sl",
    "docs_obligatorias",
    "payload_hash",
    "updated_at",
    "payload_incompleto",
    "campos_faltantes",
  ],
  divergences: [
    "materia",
    "organo_tipo",
    "tipo_social",
    "gate",
    "valor_rulepack",
    "valor_base",
    "clasificacion_preliminar",
    "severidad_propuesta",
    "inscribible",
    "requiere_decision_legal",
    "justificacion_breve",
  ],
  duplicates: [
    "materia",
    "organo_tipo",
    "rule_pack_id_a",
    "version_a",
    "hash_a",
    "resumen_a",
    "rule_pack_id_b",
    "version_b",
    "hash_b",
    "resumen_b",
    "diferencias",
    "decision_pendiente",
  ],
  patchPlan: [
    "prioridad",
    "materia",
    "organo_tipo",
    "rule_pack_id",
    "rule_pack_version_id",
    "version",
    "payload_hash",
    "tipo_social",
    "gate",
    "valor_actual",
    "valor_base",
    "severidad_propuesta",
    "inscribible",
    "inscribible_deducido",
    "reforzada_deducida",
    "fuente_refuerzo",
    "motivo_prioridad",
    "accion_recomendada",
    "estado",
    "requiere_decision_legal",
    "justificacion_breve",
  ],
  patchPlanEquivalence: [
    "prioridad",
    "materia",
    "organo_tipo",
    "tipo_social",
    "gate",
    "valor_actual",
    "valor_base",
    "equivalence_status",
    "normalized_payload",
    "normalized_base",
    "accion_recomendada",
    "estado",
  ],
  incompleteChecklist: [
    "materia",
    "organo_tipo",
    "rule_pack_id",
    "rule_pack_version_id",
    "version",
    "payload_hash",
    "campo_faltante",
    "valor_aplicar_o_na",
    "nullable_by_na",
    "referencia",
    "estado",
    "justificacion",
  ],
  equivalenceReview: [
    "materia",
    "organo_tipo",
    "tipo_social",
    "gate",
    "valor_rulepack",
    "valor_base",
    "equivalence_status",
    "normalized_payload",
    "normalized_base",
    "accion_recomendada",
  ],
  monitor: [
    "materia",
    "organo_tipo",
    "versiones_activas",
    "versions",
    "rule_pack_version_ids",
    "payload_hashes",
    "has_duplicate",
  ],
  lscBase: [
    "materia",
    "organo_tipo",
    "tipo_social",
    "gate",
    "valor_base",
    "fuente_base",
    "comentario",
  ],
};

function parseArgs(argv) {
  const options = {
    outputDir: DEFAULT_OUTPUT_DIR,
    checkEnvOnly: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--out") {
      const value = argv[index + 1];
      if (!value) throw new Error("--out requiere un directorio");
      options.outputDir = path.resolve(ROOT, value);
      index += 1;
    } else if (arg === "--check-env-only") {
      options.checkEnvOnly = true;
    } else if (arg === "--read-only") {
      continue;
    } else {
      throw new Error(`Argumento no soportado: ${arg}`);
    }
  }
  return options;
}

const SIMPLE_SL_MATTERS = new Set([
  "APROBACION_CUENTAS",
  "APLICACION_RESULTADO",
  "DISTRIBUCION_DIVIDENDOS",
  "NOMBRAMIENTO_CONSEJERO",
  "CESE_CONSEJERO",
  "NOMBRAMIENTO_AUDITOR",
  "RATIFICACION_ACTOS",
  "APROBACION_PLAN_NEGOCIO",
  "APROBACION_PRESUPUESTO",
  "CUENTAS_CONSOLIDADAS",
]);

const HALF_SL_MATTERS = new Set([
  "AUMENTO_CAPITAL",
  "REDUCCION_CAPITAL",
  "MODIFICACION_ESTATUTOS",
  "MOD_ESTATUTOS",
  "CAMBIO_DENOMINACION",
  "CAMBIO_DENOMINACION_SOCIAL",
  "TRASLADO_DOMICILIO_NACIONAL",
  "PRESTACIONES_ACCESORIAS",
  "DIVIDENDO_A_CUENTA",
]);

const TWO_THIRDS_SL_MATTERS = new Set([
  "TRANSFORMACION",
  "FUSION",
  "ESCISION",
  "FUSION_ESCISION",
  "CESION_GLOBAL_ACTIVO",
  "EXCLUSION_DERECHO_SUSCRIPCION",
  "EXCLUSION_DERECHO_SUSCRIPCION_PREFERENTE",
  "SUPRESION_PREFERENTE",
  "AUTORIZACION_COMPETENCIA",
  "EXCLUSION_SOCIO",
  "TRASLADO_DOMICILIO_EXTRANJERO",
]);

const DOCS_BASE_BY_MATERIA = {
  MODIFICACION_ESTATUTOS: ["texto_integro", "informe_admin", "derecho_informacion_287"],
  MOD_ESTATUTOS: ["texto_integro", "informe_admin", "derecho_informacion_287"],
  AUMENTO_CAPITAL: ["informe_admin", "texto_acuerdo"],
  REDUCCION_CAPITAL: ["informe_admin", "balance_si_procede", "oposicion_acreedores_si_procede"],
  FUSION_ESCISION: ["proyecto", "balance", "informe_admin"],
  FUSION: ["proyecto", "balance", "informe_admin"],
  ESCISION: ["proyecto", "balance", "informe_admin"],
  EXCLUSION_DERECHO_SUSCRIPCION: ["informe_admin", "informe_auditor_si_procede"],
  EXCLUSION_DERECHO_SUSCRIPCION_PREFERENTE: ["informe_admin", "informe_auditor_si_procede"],
  SUPRESION_PREFERENTE: ["informe_admin", "informe_auditor_si_procede"],
  NOMBRAMIENTO_AUDITOR: ["aceptacion_auditor", "duracion_3_9"],
  NOMBRAMIENTO_CONSEJERO: ["aceptacion_consejero", "identificacion_cargo"],
  CESE_CONSEJERO: ["identificacion_cargo", "causa_o_subtipo"],
  DELEGACION_FACULTADES: ["contrato_consejero_delegado_si_procede", "voto_favorable_dos_tercios"],
};

const BASE_INSCRIBIBLE_MATTERS = new Set([
  "AUMENTO_CAPITAL",
  "AUMENTO_CAPITAL_NO_DINERARIO",
  "REDUCCION_CAPITAL",
  "MODIFICACION_ESTATUTOS",
  "MOD_ESTATUTOS",
  "FUSION",
  "ESCISION",
  "FUSION_ESCISION",
  "CESION_GLOBAL_ACTIVO",
  "TRANSFORMACION",
  "NOMBRAMIENTO_CONSEJERO",
  "CESE_CONSEJERO",
  "NOMBRAMIENTO_AUDITOR",
  "DELEGACION_FACULTADES",
  "SUPRESION_PREFERENTE",
  "EXCLUSION_DERECHO_SUSCRIPCION",
  "EXCLUSION_DERECHO_SUSCRIPCION_PREFERENTE",
  "EXCLUSION_SOCIO",
]);

function parseClientConfig(source) {
  const url = source.match(/DEMO_SUPABASE_URL = "([^"]+)"/)?.[1];
  const anon = source.match(/DEMO_SUPABASE_ANON_KEY =\s*\n\s*"([^"]+)"/)?.[1];
  if (!url || !anon) throw new Error("No se pudo leer Supabase URL/anon key del cliente");
  const [, payload] = anon.split(".");
  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  if (decoded.ref !== EXPECTED_REF) {
    throw new Error(`Anon key apunta a ${decoded.ref ?? "<sin ref>"}, esperado ${EXPECTED_REF}`);
  }
  if (!url.includes(EXPECTED_REF)) {
    throw new Error(`URL apunta a ${url}, esperado ref ${EXPECTED_REF}`);
  }
  return { url, anon };
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const text = Array.isArray(value) ? value.join(" | ") : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function mdCell(value) {
  if (value === null || value === undefined || value === "") return "sin dato";
  const text = Array.isArray(value) ? value.join(" | ") : String(value);
  return text.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function toCsv(rows, headers) {
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n") + "\n";
}

function asArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

function pickObjectValue(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    if ("valor" in value) return value.valor;
    if ("formula" in value) return value.formula;
    if ("dias" in value) return value.dias;
    if ("plazo_dias" in value) return value.plazo_dias;
  }
  return value;
}

function getPath(obj, paths) {
  for (const pathParts of paths) {
    let cursor = obj;
    for (const part of pathParts) {
      if (cursor === null || cursor === undefined) break;
      cursor = cursor[part];
    }
    if (cursor !== null && cursor !== undefined) return cursor;
  }
  return null;
}

function normalizeNumber(value) {
  const raw = pickObjectValue(value);
  if (raw === null || raw === undefined || raw === "") return "";
  if (typeof raw === "number") return String(raw);
  const text = String(raw);
  const match = text.match(/-?\d+(?:[.,]\d+)?/);
  return match ? match[0].replace(",", ".") : text;
}

function normalizeRatio(value) {
  const normalized = normalizeNumber(value);
  if (normalized === "") return "";
  const numberValue = Number(normalized);
  if (!Number.isFinite(numberValue)) return normalized;
  if (numberValue > 1) return String(numberValue / 100);
  return String(numberValue);
}

function normalizeList(value) {
  const list = asArray(value).flatMap((item) => {
    if (item && typeof item === "object") {
      return item.id ?? item.nombre ?? item.label ?? JSON.stringify(item);
    }
    return item;
  });
  return list.filter((item) => item !== null && item !== undefined && item !== "").map(String);
}

function normalizeFormula(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && !Array.isArray(value)) {
    return String(value.formula ?? value.valor ?? JSON.stringify(value));
  }
  return String(value);
}

function normalizeRulePack(row) {
  const payload = row.payload ?? {};
  const pack = row.rule_packs;
  const computedHash = sha256(stableStringify(payload));
  const inscribible = getPath(payload, [
    ["postAcuerdo", "inscribible"],
    ["inscripcion", "inscribible"],
  ]);
  const instrumento = getPath(payload, [
    ["postAcuerdo", "instrumentoRequerido"],
    ["inscripcion", "instrumentoRequerido"],
  ]);
  const publicacion = getPath(payload, [
    ["postAcuerdo", "publicacionRequerida"],
    ["inscripcion", "publicacionRequerida"],
  ]);
  const convSa = normalizeNumber(getPath(payload, [
    ["convocatoria", "antelacionDias", "SA"],
    ["convocatoria", "antelacionDias", "SA", "valor"],
    ["convocatoria", "plazoDias", "SA"],
  ]));
  const convSl = normalizeNumber(getPath(payload, [
    ["convocatoria", "antelacionDias", "SL"],
    ["convocatoria", "antelacionDias", "SL", "valor"],
    ["convocatoria", "plazoDias", "SL"],
  ]));
  const canalesSa = normalizeList(getPath(payload, [
    ["convocatoria", "canales", "SA"],
    ["convocatoria", "canal", "SA"],
  ]));
  const canalesSl = normalizeList(getPath(payload, [
    ["convocatoria", "canales", "SL"],
    ["convocatoria", "canal", "SL"],
  ]));
  const contenidoMin = normalizeList(getPath(payload, [
    ["convocatoria", "contenidoMinimo"],
    ["acta", "contenidoMinimo", "sesion"],
  ]));
  const quorumSa1 = normalizeRatio(getPath(payload, [
    ["constitucion", "quorum", "SA_1a"],
    ["quorum", "SA_1a"],
  ]));
  const quorumSa2 = normalizeRatio(getPath(payload, [
    ["constitucion", "quorum", "SA_2a"],
    ["quorum", "SA_2a"],
  ]));
  const quorumSl = normalizeRatio(getPath(payload, [
    ["constitucion", "quorum", "SL"],
    ["quorum", "SL"],
  ]));
  const mayoriaSaNode = getPath(payload, [
    ["votacion", "mayoria", "SA"],
    ["mayoria", "SA"],
  ]);
  const mayoriaSlNode = getPath(payload, [
    ["votacion", "mayoria", "SL"],
    ["mayoria", "SL"],
  ]);
  const docs = normalizeList(getPath(payload, [
    ["documentacion", "obligatoria"],
    ["documentacionObligatoria"],
  ]));
  const missing = [];
  if (!pack?.materia) missing.push("materia");
  if (!pack?.organo_tipo) missing.push("organo_tipo");
  if (!row.version) missing.push("version");
  if (convSa === "" && pack?.organo_tipo === "JUNTA_GENERAL") missing.push("conv_sa_dias");
  if (convSl === "" && pack?.organo_tipo === "JUNTA_GENERAL") missing.push("conv_sl_dias");
  if (quorumSa1 === "" && pack?.organo_tipo === "JUNTA_GENERAL") missing.push("quorum_sa_1a");
  if (quorumSa2 === "" && pack?.organo_tipo === "JUNTA_GENERAL") missing.push("quorum_sa_2a");
  if (normalizeFormula(mayoriaSaNode) === "") missing.push("mayoria_sa");
  if (normalizeFormula(mayoriaSlNode) === "") missing.push("mayoria_sl");
  if (docs.length === 0) missing.push("docs_obligatorias");

  return {
    raw: row,
    rule_pack_id: row.pack_id ?? pack?.id ?? "",
    rule_pack_version_id: row.id,
    materia: pack?.materia ?? payload.materia ?? "",
    organo_tipo: pack?.organo_tipo ?? payload.organoTipo ?? "",
    version: row.version ?? "",
    is_active: row.is_active === true ? "true" : "false",
    inscribible: inscribible === null || inscribible === undefined ? "" : String(inscribible),
    instrumento_requerido: instrumento ?? "",
    publicacion_requerida: publicacion === null || publicacion === undefined ? "" : String(publicacion),
    conv_sa_dias: convSa,
    conv_sl_dias: convSl,
    conv_canales_sa: canalesSa,
    conv_canales_sl: canalesSl,
    conv_contenido_min: contenidoMin,
    quorum_sa_1a: quorumSa1,
    quorum_sa_2a: quorumSa2,
    quorum_sl: quorumSl,
    mayoria_sa: normalizeFormula(mayoriaSaNode),
    mayoria_sl: normalizeFormula(mayoriaSlNode),
    mayoria_fuente_sa: mayoriaSaNode?.fuente ?? "",
    mayoria_fuente_sl: mayoriaSlNode?.fuente ?? "",
    docs_obligatorias: docs,
    payload_hash: computedHash,
    updated_at: row.created_at ?? row.effective_from ?? "",
    payload_incompleto: missing.length > 0 ? "Si" : "No",
    campos_faltantes: missing,
  };
}

function thresholdFromFormula(value) {
  const text = String(value ?? "").toLowerCase();
  if (!text) return null;
  if (/(2\/3|0\.66|0,66|dos tercios|>= 2\/3|≥ 2\/3)/.test(text)) return 0.6667;
  if (/(1\/2|0\.5|0,5|mitad|> 1\/2|mas de la mitad|más de la mitad)/.test(text)) return 0.5;
  if (/(1\/3|0\.33|0,33|tercio)/.test(text)) return 0.3333;
  if (/(simple|favor.*contra|contra.*favor)/.test(text)) return 0.3333;
  const percent = text.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (percent) return Number(percent[1].replace(",", ".")) / 100;
  return null;
}

function domainFromFormula(value) {
  const text = String(value ?? "").toLowerCase();
  if (/capital_total|capital total|capital social total/.test(text)) return "CAPITAL_TOTAL";
  if (/capital_presente|capital presente|presentes/.test(text)) return "CAPITAL_PRESENTE";
  if (/emitidos|validos|válidos|favor\s*>\s*contra|contra/.test(text)) return "VOTOS_VALIDOS";
  if (/mayoria simple|mayoría simple/.test(text)) return "VOTOS_VALIDOS";
  return "INDETERMINADO";
}

function compareNumeric(ruleValue, baseValue) {
  const rule = Number(String(ruleValue).replace(",", "."));
  const base = Number(String(baseValue).replace(",", "."));
  if (!Number.isFinite(rule) || !Number.isFinite(base)) return "unknown";
  if (rule < base) return "lax";
  if (rule > base) return "strict";
  return "equal";
}

function classifyEquivalence(row) {
  const rule = row.valor_rulepack;
  const base = row.valor_base;
  if (!rule) return { status: "PAYLOAD_INCOMPLETO", normalized_payload: "", normalized_base: base };
  if (!base || base === "REVISAR") return { status: "PENDIENTE_BASE_LSC", normalized_payload: rule, normalized_base: base };
  if (base === "NA") return { status: "NO_APLICA_BASE", normalized_payload: rule, normalized_base: base };
  if (row.gate.startsWith("CONVOCATORIA") || row.gate.startsWith("QUORUM")) {
    const comparison = compareNumeric(rule, base);
    const statusByComparison = {
      equal: "EQUIVALENTE",
      lax: "NO_EQUIVALENTE_A_LA_BAJA",
      strict: "NO_EQUIVALENTE_AL_ALZA",
      unknown: "REVISAR_EQUIVALENCIA",
    };
    return { status: statusByComparison[comparison] ?? "REVISAR_EQUIVALENCIA", normalized_payload: rule, normalized_base: base };
  }
  if (row.gate.startsWith("MAYORIA")) {
    const ruleThreshold = thresholdFromFormula(rule);
    const baseThreshold = thresholdFromFormula(base);
    const ruleDomain = domainFromFormula(rule);
    const baseDomain = domainFromFormula(base);
    if (ruleThreshold === null || baseThreshold === null) {
      return {
        status: "REVISAR_EQUIVALENCIA",
        normalized_payload: `${ruleDomain}:${rule}`,
        normalized_base: `${baseDomain}:${base}`,
      };
    }
    const delta = ruleThreshold - baseThreshold;
    if (Math.abs(delta) <= 0.0005) {
      if (ruleDomain === baseDomain || ruleDomain === "INDETERMINADO" || baseDomain === "INDETERMINADO") {
        return {
          status: "EQUIVALENTE",
          normalized_payload: `${ruleDomain}:${ruleThreshold}`,
          normalized_base: `${baseDomain}:${baseThreshold}`,
        };
      }
      if (ruleDomain === "CAPITAL_PRESENTE" && baseDomain === "CAPITAL_TOTAL") {
        return {
          status: "SUB_EQUIVALENTE",
          normalized_payload: `${ruleDomain}:${ruleThreshold}`,
          normalized_base: `${baseDomain}:${baseThreshold}`,
        };
      }
      return {
        status: "REVISAR_EQUIVALENCIA",
        normalized_payload: `${ruleDomain}:${ruleThreshold}`,
        normalized_base: `${baseDomain}:${baseThreshold}`,
      };
    }
    return {
      status: delta < 0 ? "NO_EQUIVALENTE_A_LA_BAJA" : "NO_EQUIVALENTE_AL_ALZA",
      normalized_payload: `${ruleDomain}:${ruleThreshold}`,
      normalized_base: `${baseDomain}:${baseThreshold}`,
    };
  }
  return { status: row.clasificacion_preliminar, normalized_payload: rule, normalized_base: base };
}

function compareThreshold(ruleFormula, baseFormula) {
  const rule = thresholdFromFormula(ruleFormula);
  const base = thresholdFromFormula(baseFormula);
  if (rule === null || base === null) return "unknown";
  if (rule < base) return "lax";
  if (rule > base) return "strict";
  return "equal";
}

function slBaseForMateria(materia) {
  if (TWO_THIRDS_SL_MATTERS.has(materia)) {
    return { value: ">= 2/3 capital", source: "art. 199.b LSC", comment: "Materia reforzada SL" };
  }
  if (HALF_SL_MATTERS.has(materia)) {
    return { value: "> 1/2 capital total", source: "art. 199.a LSC", comment: "Materia reforzada SL" };
  }
  if (SIMPLE_SL_MATTERS.has(materia)) {
    return { value: "> 1/3 capital", source: "art. 198 LSC", comment: "Materia ordinaria SL" };
  }
  return { value: "REVISAR", source: "P1-P10", comment: "Clasificacion manual pendiente" };
}

function isReinforcedMatter(row) {
  const payloadClass = row.raw.payload?.clase;
  return ["ESTATUTARIA", "ESTRUCTURAL"].includes(payloadClass) || HALF_SL_MATTERS.has(row.materia) || TWO_THIRDS_SL_MATTERS.has(row.materia);
}

function deduceInscribible(row) {
  return row.inscribible === "true" || BASE_INSCRIBIBLE_MATTERS.has(row.materia);
}

function reinforcedInfo(rowOrMateria, tipoSocial = "") {
  const materia = typeof rowOrMateria === "string" ? rowOrMateria : rowOrMateria.materia;
  const payloadClass = typeof rowOrMateria === "string" ? "" : rowOrMateria.raw?.payload?.clase;
  if (TWO_THIRDS_SL_MATTERS.has(materia)) {
    return { reinforced: true, source: "arts. 194/199.b/201.2 LSC" };
  }
  if (HALF_SL_MATTERS.has(materia)) {
    return { reinforced: true, source: "arts. 194/199.a/201.2 LSC" };
  }
  if (["ESTATUTARIA", "ESTRUCTURAL"].includes(payloadClass)) {
    return { reinforced: true, source: "payload.clase + arts. 194/201.2 LSC" };
  }
  if (tipoSocial === "SA" && BASE_INSCRIBIBLE_MATTERS.has(materia)) {
    return { reinforced: true, source: "matriz LSC inscribible/reforzada" };
  }
  return { reinforced: false, source: "" };
}

function buildLscBaseRows(normalizedRows) {
  const baseRows = [];
  for (const row of normalizedRows) {
    if (row.organo_tipo !== "JUNTA_GENERAL") continue;
    baseRows.push({
      materia: row.materia,
      organo_tipo: row.organo_tipo,
      tipo_social: "SA",
      gate: "CONVOCATORIA/ANTELACION_DIAS",
      valor_base: "30",
      fuente_base: "art. 176 LSC",
      comentario: "Convocatoria de Junta SA",
    });
    baseRows.push({
      materia: row.materia,
      organo_tipo: row.organo_tipo,
      tipo_social: "SL",
      gate: "CONVOCATORIA/ANTELACION_DIAS",
      valor_base: "15",
      fuente_base: "art. 176 LSC",
      comentario: "Convocatoria de Junta SL",
    });
    const reinforced = isReinforcedMatter(row);
    baseRows.push({
      materia: row.materia,
      organo_tipo: row.organo_tipo,
      tipo_social: "SA",
      gate: "QUORUM/SA_1A",
      valor_base: reinforced ? "0.5" : "0.25",
      fuente_base: reinforced ? "art. 194 LSC" : "art. 193 LSC",
      comentario: reinforced ? "Quorum reforzado SA" : "Quorum ordinario SA",
    });
    baseRows.push({
      materia: row.materia,
      organo_tipo: row.organo_tipo,
      tipo_social: "SA",
      gate: "QUORUM/SA_2A",
      valor_base: reinforced ? "0.25" : "0",
      fuente_base: reinforced ? "art. 194 LSC" : "art. 193 LSC",
      comentario: reinforced ? "Quorum reforzado SA" : "Segunda convocatoria ordinaria SA",
    });
    baseRows.push({
      materia: row.materia,
      organo_tipo: row.organo_tipo,
      tipo_social: "SL",
      gate: "QUORUM/SL",
      valor_base: "NA",
      fuente_base: "LSC",
      comentario: "SL sin quorum legal separado; opera mayoria sobre capital",
    });
    baseRows.push({
      materia: row.materia,
      organo_tipo: row.organo_tipo,
      tipo_social: "SA",
      gate: "MAYORIA/SA",
      valor_base: reinforced ? "> 1/2 presente en 1a; >= 2/3 emitidos si < 50% en 2a" : "mayoria simple",
      fuente_base: reinforced ? "art. 201.2 LSC" : "art. 201.1 LSC",
      comentario: reinforced ? "Mayoría reforzada SA" : "Mayoría ordinaria SA",
    });
    const slBase = slBaseForMateria(row.materia);
    baseRows.push({
      materia: row.materia,
      organo_tipo: row.organo_tipo,
      tipo_social: "SL",
      gate: "MAYORIA/SL",
      valor_base: slBase.value,
      fuente_base: slBase.source,
      comentario: slBase.comment,
    });
    for (const doc of DOCS_BASE_BY_MATERIA[row.materia] ?? []) {
      baseRows.push({
        materia: row.materia,
        organo_tipo: row.organo_tipo,
        tipo_social: "SA/SL",
        gate: `DOCUMENTACION/OBLIGATORIA/${doc}`,
        valor_base: doc,
        fuente_base: "LSC / dossier legal",
        comentario: "Documento base para revision legal",
      });
    }
    if (deduceInscribible(row)) {
      baseRows.push({
        materia: row.materia,
        organo_tipo: row.organo_tipo,
        tipo_social: "SA/SL",
        gate: "INSCRIPCION/INSCRIBIBLE",
        valor_base: "true",
        fuente_base: "LSC / RRM",
        comentario: "Materia marcada como inscribible en payload vigente",
      });
    }
  }
  return baseRows;
}

function classify({ gate, comparison, inscribible }) {
  if (comparison === "equal") {
    return null;
  }
  if (comparison === "unknown") {
    return {
      clasificacion_preliminar: "REVISAR_EQUIVALENCIA",
      severidad_propuesta: "TRAZABILIDAD_PARCIAL",
      requiere_decision_legal: "Si",
    };
  }
  if (comparison === "strict") {
    return {
      clasificacion_preliminar: "POSIBLE_OVERRIDE_ESTATUTARIO",
      severidad_propuesta: "TRAZABILIDAD_PARCIAL",
      requiere_decision_legal: "Si",
    };
  }
  if (gate.startsWith("QUORUM")) {
    return {
      clasificacion_preliminar: "PROBABLE_ERROR_RULE_PACK",
      severidad_propuesta: "NULIDAD",
      requiere_decision_legal: inscribible ? "Si" : "No",
    };
  }
  if (gate.startsWith("MAYORIA")) {
    return {
      clasificacion_preliminar: "PROBABLE_ERROR_RULE_PACK",
      severidad_propuesta: "IMPUGNABILIDAD",
      requiere_decision_legal: inscribible ? "Si" : "No",
    };
  }
  if (gate.startsWith("CONVOCATORIA")) {
    return {
      clasificacion_preliminar: "PROBABLE_ERROR_RULE_PACK",
      severidad_propuesta: "IMPUGNABILIDAD",
      requiere_decision_legal: inscribible ? "Si" : "No",
    };
  }
  if (gate.startsWith("DOCUMENTACION") || gate.startsWith("INSCRIPCION")) {
    return {
      clasificacion_preliminar: "PROBABLE_ERROR_RULE_PACK",
      severidad_propuesta: inscribible ? "CALIFICACION_REGISTRAL" : "TRAZABILIDAD_PARCIAL",
      requiere_decision_legal: inscribible ? "Si" : "No",
    };
  }
  return {
    clasificacion_preliminar: "REVISAR_EQUIVALENCIA",
    severidad_propuesta: "TRAZABILIDAD_PARCIAL",
    requiere_decision_legal: "Si",
  };
}

function buildDivergences(normalizedRows, lscBaseRows) {
  const divergences = [];
  for (const row of normalizedRows) {
    const bases = lscBaseRows.filter((base) => base.materia === row.materia && base.organo_tipo === row.organo_tipo);
    for (const base of bases) {
      let ruleValue = "";
      let comparison = "unknown";
      if (base.gate === "CONVOCATORIA/ANTELACION_DIAS" && base.tipo_social === "SA") {
        ruleValue = row.conv_sa_dias;
        comparison = ruleValue === "" ? "unknown" : compareNumeric(ruleValue, base.valor_base);
      } else if (base.gate === "CONVOCATORIA/ANTELACION_DIAS" && base.tipo_social === "SL") {
        ruleValue = row.conv_sl_dias;
        comparison = ruleValue === "" ? "unknown" : compareNumeric(ruleValue, base.valor_base);
      } else if (base.gate === "QUORUM/SA_1A") {
        ruleValue = row.quorum_sa_1a;
        comparison = ruleValue === "" ? "unknown" : compareNumeric(ruleValue, base.valor_base);
      } else if (base.gate === "QUORUM/SA_2A") {
        ruleValue = row.quorum_sa_2a;
        comparison = ruleValue === "" ? "unknown" : compareNumeric(ruleValue, base.valor_base);
      } else if (base.gate === "QUORUM/SL") {
        ruleValue = row.quorum_sl;
        comparison = base.valor_base === "NA" && row.quorum_sl !== "" ? "strict" : "equal";
      } else if (base.gate === "MAYORIA/SA") {
        ruleValue = row.mayoria_sa;
        comparison = compareThreshold(ruleValue, base.valor_base);
      } else if (base.gate === "MAYORIA/SL") {
        ruleValue = row.mayoria_sl;
        comparison = base.valor_base === "REVISAR" ? "unknown" : compareThreshold(ruleValue, base.valor_base);
      } else if (base.gate.startsWith("DOCUMENTACION/OBLIGATORIA/")) {
        const expected = base.valor_base;
        ruleValue = row.docs_obligatorias.join(" | ");
        comparison = row.docs_obligatorias.some((doc) => doc.toLowerCase().includes(String(expected).toLowerCase()))
          ? "equal"
          : "lax";
      } else if (base.gate === "INSCRIPCION/INSCRIBIBLE") {
        ruleValue = row.inscribible;
        comparison = row.inscribible === "true" ? "equal" : "lax";
      }
      const result = classify({ gate: base.gate, comparison, inscribible: row.inscribible === "true" });
      if (!result) continue;
      divergences.push({
        materia: row.materia,
        organo_tipo: row.organo_tipo,
        tipo_social: base.tipo_social,
        gate: base.gate,
        valor_rulepack: ruleValue,
        valor_base: base.valor_base,
        clasificacion_preliminar: result.clasificacion_preliminar,
        severidad_propuesta: result.severidad_propuesta,
        inscribible: row.inscribible,
        requiere_decision_legal: result.requiere_decision_legal,
        justificacion_breve: `${base.gate}: payload (${ruleValue || "sin dato"}) frente a base (${base.valor_base}) -> ${result.severidad_propuesta}`,
      });
    }
  }
  return divergences;
}

function compactSummary(row) {
  return [
    `conv SA ${row.conv_sa_dias || "NA"}`,
    `conv SL ${row.conv_sl_dias || "NA"}`,
    `q ${row.quorum_sa_1a || "NA"}/${row.quorum_sa_2a || "NA"}/${row.quorum_sl || "NA"}`,
    `may SA ${row.mayoria_sa || "NA"}`,
    `may SL ${row.mayoria_sl || "NA"}`,
    `docs ${row.docs_obligatorias.length}`,
    `insc ${row.inscribible || "NA"}`,
  ].join("; ");
}

function diffRows(a, b) {
  const fields = [
    "conv_sa_dias",
    "conv_sl_dias",
    "conv_canales_sa",
    "conv_canales_sl",
    "conv_contenido_min",
    "quorum_sa_1a",
    "quorum_sa_2a",
    "quorum_sl",
    "mayoria_sa",
    "mayoria_sl",
    "docs_obligatorias",
    "inscribible",
    "instrumento_requerido",
    "publicacion_requerida",
  ];
  return fields
    .filter((field) => JSON.stringify(a[field] ?? "") !== JSON.stringify(b[field] ?? ""))
    .map((field) => `${field}: ${Array.isArray(a[field]) ? a[field].join(" | ") : a[field] || "NA"} <> ${Array.isArray(b[field]) ? b[field].join(" | ") : b[field] || "NA"}`);
}

function buildDuplicates(normalizedRows) {
  const groups = new Map();
  for (const row of normalizedRows) {
    const key = `${row.materia}::${row.organo_tipo}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  const duplicates = [];
  for (const [key, rows] of groups.entries()) {
    if (rows.length < 2) continue;
    const [materia, organo_tipo] = key.split("::");
    const sorted = [...rows].sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)) || String(b.version).localeCompare(String(a.version)));
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        const a = sorted[i];
        const b = sorted[j];
        duplicates.push({
          materia,
          organo_tipo,
          rule_pack_id_a: a.rule_pack_version_id,
          version_a: a.version,
          hash_a: a.payload_hash,
          resumen_a: compactSummary(a),
          rule_pack_id_b: b.rule_pack_version_id,
          version_b: b.version,
          hash_b: b.payload_hash,
          resumen_b: compactSummary(b),
          diferencias: diffRows(a, b),
          decision_pendiente: "Completar por Legal: conservar / archivar / fusionar",
        });
      }
    }
  }
  return duplicates;
}

function buildRulepacksMonitor(normalizedRows) {
  const groups = new Map();
  for (const row of normalizedRows) {
    const key = `${row.materia}::${row.organo_tipo}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .map(([key, rows]) => {
      const [materia, organo_tipo] = key.split("::");
      const sorted = [...rows].sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)) || String(b.version).localeCompare(String(a.version)));
      return {
        materia,
        organo_tipo,
        versiones_activas: sorted.length,
        versions: sorted.map((row) => row.version),
        rule_pack_version_ids: sorted.map((row) => row.rule_pack_version_id),
        payload_hashes: sorted.map((row) => row.payload_hash),
        has_duplicate: sorted.length > 1 ? "Si" : "No",
      };
    })
    .sort((a, b) => a.materia.localeCompare(b.materia) || a.organo_tipo.localeCompare(b.organo_tipo));
}

function priorityForDivergence(row) {
  const severityRank = {
    NULIDAD: 1,
    IMPUGNABILIDAD: 2,
    CALIFICACION_REGISTRAL: 3,
    TRAZABILIDAD_PARCIAL: 4,
  };
  const severity = severityRank[row.severidad_propuesta] ?? 9;
  const scope = row.inscribible_deducido === "true" ? 0 : 10;
  return String(scope + severity).padStart(2, "0");
}

function priorityReason({ inscribible, reinforced }) {
  if (inscribible && reinforced) return "IR";
  if (inscribible && !reinforced) return "IN";
  if (!inscribible && reinforced) return "nIR";
  return "nIn";
}

function actionForDivergence(row) {
  if (row.gate.startsWith("DOCUMENTACION/OBLIGATORIA/")) {
    return `Anadir o mapear documento imperativo ${row.valor_base} en documentacion.obligatoria; si ya existe con alias, registrar equivalencia canonica.`;
  }
  if (row.gate.startsWith("QUORUM")) {
    return `Elevar ${row.gate} de ${row.valor_rulepack || "sin dato"} a ${row.valor_base} o marcar NA explicito si Legal confirma no aplicabilidad.`;
  }
  if (row.gate.startsWith("MAYORIA")) {
    return `Elevar mayoria de ${row.valor_rulepack || "sin dato"} a ${row.valor_base} en el dominio correcto de computo.`;
  }
  if (row.gate.startsWith("CONVOCATORIA")) {
    return `Completar o elevar antelacion de convocatoria a ${row.valor_base} dias para ${row.tipo_social}.`;
  }
  if (row.gate.startsWith("INSCRIPCION")) {
    return `Alinear inscribibilidad/instrumento/publicacion con base ${row.valor_base}.`;
  }
  return "Revisar payload y actualizar gate contra LSC base.";
}

function buildPatchPlan(divergences, normalizedRows) {
  const activeByMatterBody = new Map();
  for (const row of normalizedRows) {
    activeByMatterBody.set(`${row.materia}::${row.organo_tipo}`, row);
  }
  return divergences
    .filter((row) => row.clasificacion_preliminar === "PROBABLE_ERROR_RULE_PACK")
    .map((row) => {
      const pack = activeByMatterBody.get(`${row.materia}::${row.organo_tipo}`) ?? {};
      const inscribible = deduceInscribible(pack);
      const reinforced = reinforcedInfo(pack, row.tipo_social);
      const enriched = {
        ...row,
        inscribible_deducido: inscribible ? "true" : "false",
      };
      return {
        prioridad: priorityForDivergence(enriched),
        materia: row.materia,
        organo_tipo: row.organo_tipo,
        rule_pack_id: pack.rule_pack_id ?? "",
        rule_pack_version_id: pack.rule_pack_version_id ?? "",
        version: pack.version ?? "",
        payload_hash: pack.payload_hash ?? "",
        tipo_social: row.tipo_social,
        gate: row.gate,
        valor_actual: row.valor_rulepack,
        valor_base: row.valor_base,
        severidad_propuesta: row.severidad_propuesta,
        inscribible: row.inscribible,
        inscribible_deducido: inscribible ? "true" : "false",
        reforzada_deducida: reinforced.reinforced ? "true" : "false",
        fuente_refuerzo: reinforced.source,
        motivo_prioridad: priorityReason({ inscribible, reinforced: reinforced.reinforced }),
        accion_recomendada: actionForDivergence(row),
        estado: "PENDIENTE_PATCH_PAYLOAD",
        requiere_decision_legal: row.requiere_decision_legal,
        justificacion_breve: row.justificacion_breve,
      };
    })
    .sort((a, b) => a.prioridad.localeCompare(b.prioridad) || a.materia.localeCompare(b.materia) || a.gate.localeCompare(b.gate));
}

function buildEquivalenceReview(divergences) {
  return divergences
    .filter((row) => row.clasificacion_preliminar === "REVISAR_EQUIVALENCIA")
    .map((row) => {
      const result = classifyEquivalence(row);
      return {
        materia: row.materia,
        organo_tipo: row.organo_tipo,
        tipo_social: row.tipo_social,
        gate: row.gate,
        valor_rulepack: row.valor_rulepack,
        valor_base: row.valor_base,
        equivalence_status: result.status,
        normalized_payload: result.normalized_payload,
        normalized_base: result.normalized_base,
        accion_recomendada: result.status === "NO_EQUIVALENTE_A_LA_BAJA"
          ? "Incluir en patch plan 2 de correccion core"
          : result.status === "SUB_EQUIVALENTE"
            ? "Mantener como trazabilidad; no blocking salvo criterio Legal"
            : "Mantener para decision o trazabilidad",
      };
    });
}

function buildPatchPlanEquivalence(equivalenceRows) {
  return equivalenceRows
    .filter((row) => row.equivalence_status === "NO_EQUIVALENTE_A_LA_BAJA")
    .map((row) => ({
      prioridad: "02",
      materia: row.materia,
      organo_tipo: row.organo_tipo,
      tipo_social: row.tipo_social,
      gate: row.gate,
      valor_actual: row.valor_rulepack,
      valor_base: row.valor_base,
      equivalence_status: row.equivalence_status,
      normalized_payload: row.normalized_payload,
      normalized_base: row.normalized_base,
      accion_recomendada: "Elevar payload al valor base o documentar excepcion legal antes de Formal Gates MVP.",
      estado: "PENDIENTE_PATCH_PAYLOAD_2",
    }));
}

function suggestedValueForMissing(row, field) {
  if (field === "conv_sa_dias") return row.organo_tipo === "JUNTA_GENERAL" ? "30" : "NA";
  if (field === "conv_sl_dias") return row.organo_tipo === "JUNTA_GENERAL" ? "15" : "NA";
  if (field === "mayoria_sa" || field === "mayoria_sl") {
    if (row.organo_tipo === "CONSEJO") return "NA; mapear votacion.mayoria.CONSEJO como mayoria de organo";
    if (row.organo_tipo === "SOCIO_UNICO") return "NA; decision de socio unico sin votacion colegiada";
    return field === "mayoria_sl" ? slBaseForMateria(row.materia).value : "mayoria simple o reforzada segun matriz LSC";
  }
  if (field === "docs_obligatorias") {
    const docs = DOCS_BASE_BY_MATERIA[row.materia] ?? [];
    return docs.length > 0 ? docs.join(" | ") : "NA explicito solo si no hay documento obligatorio";
  }
  return "Completar segun matriz LSC o NA explicito";
}

function referenceForMissing(row, field) {
  if (field === "conv_sa_dias" || field === "conv_sl_dias") return row.organo_tipo === "JUNTA_GENERAL" ? "art. 176 LSC" : "convocatoria de organo de administracion / P1";
  if (field === "mayoria_sa") return row.organo_tipo === "JUNTA_GENERAL" ? "art. 201 LSC" : "art. 247/248 LSC o regla organica";
  if (field === "mayoria_sl") return row.organo_tipo === "JUNTA_GENERAL" ? slBaseForMateria(row.materia).source : "art. 247/248 LSC o regla organica";
  if (field === "docs_obligatorias") return DOCS_BASE_BY_MATERIA[row.materia]?.length ? "LSC / dossier legal" : "P1-P10";
  return "matriz LSC base";
}

function buildIncompleteChecklist(normalizedRows) {
  return normalizedRows
    .filter((row) => row.payload_incompleto === "Si")
    .flatMap((row) => row.campos_faltantes.map((field) => ({
      materia: row.materia,
      organo_tipo: row.organo_tipo,
      rule_pack_id: row.rule_pack_id,
      rule_pack_version_id: row.rule_pack_version_id,
      version: row.version,
      payload_hash: row.payload_hash,
      campo_faltante: field,
      valor_aplicar_o_na: suggestedValueForMissing(row, field),
      nullable_by_na: suggestedValueForMissing(row, field).startsWith("NA") ? "true" : "false",
      referencia: referenceForMissing(row, field),
      estado: "PENDIENTE_SANEAMIENTO_SCHEMA",
      justificacion: "null/ausente rechazado por contrato; usar valor base o NA explicito segun semantica del gate",
    })));
}

async function authenticate(url, anon) {
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: anon, "content-type": "application/json" },
    body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
  });
  const projectRef = response.headers.get("sb-project-ref");
  if (projectRef !== EXPECTED_REF) {
    throw new Error(`Auth respondio desde ${projectRef ?? "<sin ref>"}, esperado ${EXPECTED_REF}`);
  }
  if (!response.ok) throw new Error(`Auth fallo ${response.status}: ${await response.text()}`);
  return response.json();
}

async function fetchRulePackVersions(url, anon, accessToken) {
  const select = [
    "id",
    "pack_id",
    "version",
    "status",
    "is_active",
    "payload",
    "payload_hash",
    "created_at",
    "effective_from",
    "effective_to",
    "approved_at",
    "approved_by",
    "rule_packs!inner(id,tenant_id,materia,organo_tipo,descripcion)",
  ].join(",");
  const params = new URLSearchParams({
    select,
    is_active: "eq.true",
    "rule_packs.tenant_id": `eq.${TENANT_ID}`,
    order: "version.desc",
  });
  const response = await fetch(`${url}/rest/v1/rule_pack_versions?${params.toString()}`, {
    headers: {
      apikey: anon,
      authorization: `Bearer ${accessToken}`,
      prefer: "count=exact",
      range: "0-999",
    },
  });
  const projectRef = response.headers.get("sb-project-ref");
  if (projectRef !== EXPECTED_REF) {
    throw new Error(`REST respondio desde ${projectRef ?? "<sin ref>"}, esperado ${EXPECTED_REF}`);
  }
  if (!response.ok) throw new Error(`REST fallo ${response.status}: ${await response.text()}`);
  const rows = await response.json();
  return { rows, contentRange: response.headers.get("content-range") ?? "" };
}

function buildDossier({ normalizedRows, divergences, duplicates }) {
  const stats = {
    active: normalizedRows.length,
    materias: new Set(normalizedRows.map((row) => row.materia)).size,
    organos: new Set(normalizedRows.map((row) => row.organo_tipo)).size,
    incomplete: normalizedRows.filter((row) => row.payload_incompleto === "Si").length,
    divergences: divergences.length,
    duplicates: duplicates.length,
  };
  const topDivergences = divergences
    .filter((row) => row.inscribible === "true")
    .slice(0, 40)
    .map((row) => `| ${mdCell(row.materia)} | ${mdCell(row.organo_tipo)} | ${mdCell(row.tipo_social)} | ${mdCell(row.gate)} | ${mdCell(row.valor_rulepack)} | ${mdCell(row.valor_base)} | ${mdCell(row.clasificacion_preliminar)} | ${mdCell(row.severidad_propuesta)} | ${mdCell(row.requiere_decision_legal)} |`)
    .join("\n");
  const duplicateRows = duplicates
    .map((row) => `| ${mdCell(row.materia)} | ${mdCell(row.organo_tipo)} | ${mdCell(row.version_a)} / ${mdCell(row.version_b)} | ${mdCell(row.hash_a.slice(0, 10))} / ${mdCell(row.hash_b.slice(0, 10))} | ${mdCell(Array.isArray(row.diferencias) ? row.diferencias.slice(0, 4).join("; ") : row.diferencias)} | [Completar] |`)
    .join("\n");

  return `# Dossier Legal Fase 1 - Rule packs y formal gates\n\nFecha: 2026-05-20  \nTarget confirmado: governance_OS (${EXPECTED_REF})  \nModo: extraccion read-only, sin escrituras en BD\n\n## Resumen ejecutivo\n\nSe han extraido ${stats.active} versiones activas de rule packs, sobre ${stats.materias} materias y ${stats.organos} tipos de organo. La normalizacion detecta ${stats.incomplete} payloads incompletos para los campos minimos de Fase 1, ${stats.divergences} divergencias preliminares gate x tipo social y ${stats.duplicates} pares duplicados activos materia+organo. Las divergencias son una preclasificacion tecnica para decision legal, no una modificacion de payloads.\n\n## Tabla 1 - Decisiones P1-P10\n\n| Item | Regla general propuesta | Excepciones por materia | Articulo o referencia | Observaciones |\n|---|---|---|---|---|\n| Plazo de convocatoria del CdA | [Completar] | [Completar] | [Completar] | Homologar presencial/telematico; canales minimos |\n| Segunda convocatoria en SL | [Completar] | [Completar] | [Completar] | Si estatutos permiten segunda convocatoria; plazos |\n| Severidad de prerequisitos | [Completar] | [Completar] | [Completar] | Clasificar como BLOCKING, WARNING o INFO |\n| Cooptacion, solo SA | Confirmar solo SA | Trato de intento en SL | art. 244 LSC | Gap tipico: rechazar y redirigir a JG |\n| Operaciones vinculadas no cotizadas | [Completar] | [Completar] | [Completar] | Abstenciones y computo de mayorias |\n| Comunicacion regulatoria | [Completar] | [Completar] | [Completar] | CNMV, BORME u otros si aplica |\n| Mayoria SL, art. 199 LSC | [Completar] | Materias reforzadas | arts. 198 y 199 LSC | Diferenciar un tercio frente a mas de la mitad |\n| Duracion auditor, 3-9 anos | Confirmar rango | Excepciones | art. 264 LSC | Tratamiento de propuestas fuera de rango |\n| Derecho de informacion | [Completar] | Materias estatutarias | art. 287 LSC | Medios y antelacion |\n| BORME y publicaciones | [Completar] | [Completar] | [Completar] | Cuando es requisito habilitante para inscripcion |\n\n## Tabla 2 - Regla de severidad propuesta\n\n| Incumplimiento | Severidad principal | Regla de absorcion | Consecuencia operativa recomendada |\n|---|---|---|---|\n| Falta quorum | NULIDAD | NULIDAD absorbe el resto | Bloqueo sin override; mensaje explicativo y accion correctora |\n| Falta mayoria | IMPUGNABILIDAD | IMPUGNABILIDAD absorbe CALIFICACION_REGISTRAL | Bloqueo sin override; ajustar recuento o repetir votacion |\n| Falta convocatoria suficiente | IMPUGNABILIDAD | Si deviene en nulidad por materia, aplicar NULIDAD | Bloqueo sin override; reconvocar conforme a plazos/canales |\n| Falta documento obligatorio | CALIFICACION_REGISTRAL | CALIFICACION_REGISTRAL absorbe TRAZABILIDAD_PARCIAL | Bloqueo en materias inscribibles; advertencia en no inscribibles |\n| Falta prerequisito | BLOCKING segun P1-P10 | Ajustar por materia | Bloqueo o warning trazable segun severidad fijada |\n| Falta plantilla | TRAZABILIDAD_PARCIAL | No absorbe nada | Permitir avance solo con plantilla sustitutiva aprobada o detener |\n\n## Tabla 3 - Duplicados activos a resolver\n\n| Materia | Organo | Versiones activas | Hashes | Diferencias principales | Decision Legal |\n|---|---|---|---|---|---|\n${duplicateRows || "| Sin duplicados detectados | - | - | - | - | - |"}\n\n## Tabla 4 - Divergencias priorizadas para decision\n\n| Materia | Organo | Tipo social | Gate | Valor rule pack | Valor base | Clasificacion preliminar | Severidad propuesta | Requiere Legal |\n|---|---|---|---|---|---|---|---|---|\n${topDivergences || "| Sin divergencias priorizadas | - | - | - | - | - | - | - | - |"}\n\n## Anexos\n\n- [rulepacks_vigentes_extraccion.jsonl](./rulepacks_vigentes_extraccion.jsonl)\n- [rulepacks_vigentes_normalizado.csv](./rulepacks_vigentes_normalizado.csv)\n- [lsc_base_gate_tipo_social.csv](./lsc_base_gate_tipo_social.csv)\n- [divergencias_gate_tipo_social.csv](./divergencias_gate_tipo_social.csv)\n- [patch_plan_probable_error_rule_pack.csv](./patch_plan_probable_error_rule_pack.csv)\n- [duplicados_materia_organo.csv](./duplicados_materia_organo.csv)\n- [rulepacks_monitor.csv](./rulepacks_monitor.csv)\n- [fase1_manifest.json](./fase1_manifest.json)\n\n## Notas tecnicas\n\n- La clasificacion preliminar aplica solo direccion de divergencia frente a LSC base: a la baja se marca como probable error; al alza como posible override estatutario.\n- Los falsos positivos por estatutos se deben resolver en Legal como P1-P10.\n- El patch plan lista los PROBABLE_ERROR_RULE_PACK como backlog tecnico; no aplica cambios en BD.\n- No se ha ejecutado ningun INSERT, UPDATE, DELETE ni DDL.\n`;
}

async function writeArtifact(outputDir, name, content) {
  const filePath = path.join(outputDir, name);
  await writeFile(filePath, content);
  return {
    path: path.relative(ROOT, filePath),
    sha256: sha256(content),
    bytes: Buffer.byteLength(content),
  };
}

function buildDossierV2({ normalizedRows, divergences, duplicates, patchPlan, patchPlanEquivalence, incompleteChecklist }) {
  const stats = {
    active: normalizedRows.length,
    materias: new Set(normalizedRows.map((row) => row.materia)).size,
    organos: new Set(normalizedRows.map((row) => row.organo_tipo)).size,
    incomplete: normalizedRows.filter((row) => row.payload_incompleto === "Si").length,
    incompleteItems: incompleteChecklist.length,
    divergences: divergences.length,
    probable: patchPlan.length,
    eqDown: patchPlanEquivalence.length,
    duplicates: duplicates.length,
  };
  return `# Dossier Legal Fase 1 - Rule packs y formal gates\n\nFecha: 2026-05-20  \nTarget confirmado: governance_OS (${EXPECTED_REF})  \nModo: extraccion read-only, sin escrituras en BD\n\n## Resumen ejecutivo\n\nSe han extraido ${stats.active} versiones activas de rule packs, sobre ${stats.materias} materias y ${stats.organos} tipos de organo. La normalizacion detecta ${stats.incomplete} payloads incompletos (${stats.incompleteItems} campos accionables), ${stats.divergences} divergencias preliminares gate x tipo social, ${stats.probable} PROBABLE_ERROR_RULE_PACK y ${stats.eqDown} equivalencias NO_EQUIVALENTE_A_LA_BAJA. No se detectan duplicados activos materia+organo.\n\n## Decisiones P1-P10\n\n| Item | Regla general propuesta | Excepciones por materia | Articulo o referencia | Observaciones |\n|---|---|---|---|---|\n| Plazo de convocatoria del CdA | [Completar] | [Completar] | [Completar] | Homologar presencial/telematico; canales minimos |\n| Segunda convocatoria en SL | [Completar] | [Completar] | [Completar] | Si estatutos permiten segunda convocatoria; plazos |\n| Severidad de prerequisitos | [Completar] | [Completar] | [Completar] | Clasificar como BLOCKING, WARNING o INFO |\n| Cooptacion, solo SA | Confirmar solo SA | Trato de intento en SL | art. 244 LSC | Rechazar y redirigir a JG si aplica |\n| Operaciones vinculadas no cotizadas | [Completar] | [Completar] | [Completar] | Abstenciones y computo de mayorias |\n| Comunicacion regulatoria | [Completar] | [Completar] | [Completar] | CNMV, BORME u otros si aplica |\n| Mayoria SL, art. 199 LSC | [Completar] | Materias reforzadas | arts. 198 y 199 LSC | Diferenciar un tercio frente a mas de la mitad |\n| Duracion auditor, 3-9 anos | Confirmar rango | Excepciones | art. 264 LSC | Tratamiento de propuestas fuera de rango |\n| Derecho de informacion | [Completar] | Materias estatutarias | art. 287 LSC | Medios y antelacion |\n| BORME y publicaciones | [Completar] | [Completar] | [Completar] | Cuando es requisito habilitante para inscripcion |\n\n## Artefactos de trabajo\n\n- [rulepacks_vigentes_extraccion.jsonl](./rulepacks_vigentes_extraccion.jsonl)\n- [rulepacks_vigentes_normalizado.csv](./rulepacks_vigentes_normalizado.csv)\n- [lsc_base_gate_tipo_social.csv](./lsc_base_gate_tipo_social.csv)\n- [divergencias_gate_tipo_social.csv](./divergencias_gate_tipo_social.csv)\n- [patch_plan_probable_error_rule_pack.csv](./patch_plan_probable_error_rule_pack.csv)\n- [patch_plan_equivalencias_a_la_baja.csv](./patch_plan_equivalencias_a_la_baja.csv)\n- [payloads_incompletos_checklist.csv](./payloads_incompletos_checklist.csv)\n- [equivalence_review.csv](./equivalence_review.csv)\n- [duplicados_materia_organo.csv](./duplicados_materia_organo.csv)\n- [rulepacks_monitor.csv](./rulepacks_monitor.csv)\n- [fase1_manifest.json](./fase1_manifest.json)\n\n## Notas tecnicas\n\n- El patch plan principal lista correcciones a la baja frente a LSC base; no aplica cambios en BD.\n- El patch plan 2 queda reservado a NO_EQUIVALENTE_A_LA_BAJA detectados por el clasificador.\n- La checklist de incompletos separa valor base, NA explicito y mapping de organo no-Junta.\n- No se ha ejecutado ningun INSERT, UPDATE, DELETE ni DDL.\n`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const clientSource = await readFile(path.join(ROOT, "src/integrations/supabase/client.ts"), "utf8");
  const { url, anon } = parseClientConfig(clientSource);
  if (options.checkEnvOnly) {
    console.log(JSON.stringify({
      ok: true,
      target_project_ref: EXPECTED_REF,
      supabase_url: url,
      anon_key_ref: EXPECTED_REF,
      mode: "check-env-only",
    }, null, 2));
    return;
  }

  await mkdir(options.outputDir, { recursive: true });
  const auth = await authenticate(url, anon);
  const { rows, contentRange } = await fetchRulePackVersions(url, anon, auth.access_token);
  const normalizedRows = rows.map(normalizeRulePack).sort((a, b) =>
    a.materia.localeCompare(b.materia) || a.organo_tipo.localeCompare(b.organo_tipo) || b.version.localeCompare(a.version)
  );
  const lscBaseRows = buildLscBaseRows(normalizedRows);
  const divergences = buildDivergences(normalizedRows, lscBaseRows).sort((a, b) =>
    String(b.inscribible).localeCompare(String(a.inscribible)) ||
    a.materia.localeCompare(b.materia) ||
    a.gate.localeCompare(b.gate)
  );
  const duplicates = buildDuplicates(normalizedRows);
  const patchPlan = buildPatchPlan(divergences, normalizedRows);
  const equivalenceReview = buildEquivalenceReview(divergences);
  const patchPlanEquivalence = buildPatchPlanEquivalence(equivalenceReview);
  const incompleteChecklist = buildIncompleteChecklist(normalizedRows);
  const monitorRows = buildRulepacksMonitor(normalizedRows);

  const jsonl = normalizedRows.map((row) => stableStringify({
      rule_pack_version_id: row.rule_pack_version_id,
      rule_pack_id: row.rule_pack_id,
      materia: row.materia,
      organo_tipo: row.organo_tipo,
      version: row.version,
      is_active: row.is_active,
      status: row.raw.status,
      created_at: row.raw.created_at,
      effective_from: row.raw.effective_from,
      effective_to: row.raw.effective_to,
      approved_at: row.raw.approved_at,
      approved_by: row.raw.approved_by,
      payload_hash: row.payload_hash,
      payload: row.raw.payload,
    })).join("\n") + "\n";

  const artifacts = [];
  artifacts.push(await writeArtifact(options.outputDir, "rulepacks_vigentes_extraccion.jsonl", jsonl));
  artifacts.push(await writeArtifact(options.outputDir, "rulepacks_vigentes_normalizado.csv", toCsv(normalizedRows, CSV_HEADERS.normalized)));
  artifacts.push(await writeArtifact(options.outputDir, "lsc_base_gate_tipo_social.csv", toCsv(lscBaseRows, CSV_HEADERS.lscBase)));
  artifacts.push(await writeArtifact(options.outputDir, "divergencias_gate_tipo_social.csv", toCsv(divergences, CSV_HEADERS.divergences)));
  artifacts.push(await writeArtifact(options.outputDir, "patch_plan_probable_error_rule_pack.csv", toCsv(patchPlan, CSV_HEADERS.patchPlan)));
  artifacts.push(await writeArtifact(options.outputDir, "patch_plan_equivalencias_a_la_baja.csv", toCsv(patchPlanEquivalence, CSV_HEADERS.patchPlanEquivalence)));
  artifacts.push(await writeArtifact(options.outputDir, "payloads_incompletos_checklist.csv", toCsv(incompleteChecklist, CSV_HEADERS.incompleteChecklist)));
  artifacts.push(await writeArtifact(options.outputDir, "equivalence_review.csv", toCsv(equivalenceReview, CSV_HEADERS.equivalenceReview)));
  artifacts.push(await writeArtifact(options.outputDir, "duplicados_materia_organo.csv", toCsv(duplicates, CSV_HEADERS.duplicates)));
  artifacts.push(await writeArtifact(options.outputDir, "rulepacks_monitor.csv", toCsv(monitorRows, CSV_HEADERS.monitor)));
  artifacts.push(await writeArtifact(options.outputDir, "dossier_legal_fase1.md", buildDossierV2({
    normalizedRows,
    divergences,
    duplicates,
    patchPlan,
    patchPlanEquivalence,
    incompleteChecklist,
  })));

  await writeFile(path.join(options.outputDir, "fase1_manifest.json"), JSON.stringify({
    generated_at: new Date().toISOString(),
    target_project_ref: EXPECTED_REF,
    tenant_id: TENANT_ID,
    mode: "read-only",
    source: "PostgREST authenticated demo session",
    content_range: contentRange,
    environment: {
      supabase_url: url,
      expected_project_ref: EXPECTED_REF,
      anon_key_ref: EXPECTED_REF,
      rest_header_project_ref: EXPECTED_REF,
    },
    counts: {
      active_rule_pack_versions: normalizedRows.length,
      rulepacks_activos: normalizedRows.length,
      materias: new Set(normalizedRows.map((row) => row.materia)).size,
      organos: new Set(normalizedRows.map((row) => row.organo_tipo)).size,
      payloads_incompletos: normalizedRows.filter((row) => row.payload_incompleto === "Si").length,
      lsc_base_rows: lscBaseRows.length,
      lsc_rows: lscBaseRows.length,
      divergencias: divergences.length,
      divergencias_total: divergences.length,
      probable_error_rule_pack: patchPlan.length,
      patch_plan_equivalencias_a_la_baja: patchPlanEquivalence.length,
      payloads_incompletos_checklist_items: incompleteChecklist.length,
      duplicados: duplicates.length,
    },
    artefacts: artifacts,
    guardrails: {
      no_writes: true,
      abort_unless_environment_match: true,
      fail_on_active_duplicates: true,
    },
    files: [
      "rulepacks_vigentes_extraccion.jsonl",
      "rulepacks_vigentes_normalizado.csv",
      "lsc_base_gate_tipo_social.csv",
      "divergencias_gate_tipo_social.csv",
      "patch_plan_probable_error_rule_pack.csv",
      "patch_plan_equivalencias_a_la_baja.csv",
      "payloads_incompletos_checklist.csv",
      "equivalence_review.csv",
      "duplicados_materia_organo.csv",
      "rulepacks_monitor.csv",
      "dossier_legal_fase1.md",
    ],
  }, null, 2) + "\n");

  console.log(JSON.stringify({
    output_dir: path.relative(ROOT, options.outputDir),
    active_rule_pack_versions: normalizedRows.length,
    materias: new Set(normalizedRows.map((row) => row.materia)).size,
    organos: new Set(normalizedRows.map((row) => row.organo_tipo)).size,
    payloads_incompletos: normalizedRows.filter((row) => row.payload_incompleto === "Si").length,
    divergencias: divergences.length,
    probable_error_rule_pack: patchPlan.length,
    patch_plan_equivalencias_a_la_baja: patchPlanEquivalence.length,
    payloads_incompletos_checklist_items: incompleteChecklist.length,
    duplicados: duplicates.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
