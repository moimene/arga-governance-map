import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DEFAULT_DIR = "docs/superpowers/specs/2026-05-20-fase1";
const EPSILON = 0.0005;

function parseArgs(argv) {
  const options = {
    dir: DEFAULT_DIR,
    failOnProbableErrors: false,
    failOnIncomplete: false,
    writeEquivalenceReport: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dir") {
      const value = argv[index + 1];
      if (!value) throw new Error("--dir requiere un directorio");
      options.dir = value;
      index += 1;
    } else if (arg === "--fail-on-probable-errors") {
      options.failOnProbableErrors = true;
    } else if (arg === "--fail-on-incomplete") {
      options.failOnIncomplete = true;
    } else if (arg === "--write-equivalence-report") {
      const value = argv[index + 1];
      if (!value) throw new Error("--write-equivalence-report requiere un path");
      options.writeEquivalenceReport = value;
      index += 1;
    } else {
      throw new Error(`Argumento no soportado: ${arg}`);
    }
  }
  options.dir = path.resolve(ROOT, options.dir);
  if (options.writeEquivalenceReport) {
    options.writeEquivalenceReport = path.resolve(ROOT, options.writeEquivalenceReport);
  }
  return options;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    if (row.some((value) => value !== "")) rows.push(row);
  }
  const [headers, ...data] = rows;
  if (!headers) return [];
  return data.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  const text = Array.isArray(value) ? value.join(" | ") : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function toCsv(rows, headers) {
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n") + "\n";
}

async function readCsv(dir, name) {
  return parseCsv(await readFile(path.join(dir, name), "utf8"));
}

async function readJsonl(dir, name) {
  const text = await readFile(path.join(dir, name), "utf8");
  return text.trim() === "" ? [] : text.trimEnd().split("\n").map((line) => JSON.parse(line));
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

function semanticValue(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value.valor ?? value.formula ?? value.umbral ?? value;
  }
  return value;
}

function checkField(value, policy) {
  const semantic = semanticValue(value);
  if (semantic === null || semantic === undefined || semantic === "") {
    return { ok: false, reason: "null_rejected" };
  }
  if (policy.allowNA && (semantic === "NA" || (Array.isArray(semantic) && semantic.length === 0))) {
    return { ok: true, reason: "na_accepted" };
  }
  if (!policy.allowNA && Array.isArray(semantic) && semantic.length === 0) {
    return { ok: false, reason: "empty_array_rejected" };
  }
  if (policy.type === "number" && typeof semantic !== "number") {
    return { ok: false, reason: "type_mismatch" };
  }
  if (policy.type === "array" && !Array.isArray(semantic)) {
    return { ok: false, reason: "type_mismatch" };
  }
  if (policy.type === "boolean" && typeof semantic !== "boolean") {
    return { ok: false, reason: "type_mismatch" };
  }
  return { ok: true, reason: "present" };
}

function schemaPoliciesFor(row) {
  const nonJunta = row.organo_tipo !== "JUNTA_GENERAL";
  return [
    { field: "convocatoria.antelacionDias.SA", type: "number", allowNA: nonJunta, paths: [["payload", "convocatoria", "antelacionDias", "SA"]] },
    { field: "convocatoria.antelacionDias.SL", type: "number", allowNA: nonJunta, paths: [["payload", "convocatoria", "antelacionDias", "SL"]] },
    { field: "convocatoria.canales.SA", type: "array", allowNA: nonJunta, paths: [["payload", "convocatoria", "canales", "SA"]] },
    { field: "convocatoria.canales.SL", type: "array", allowNA: nonJunta, paths: [["payload", "convocatoria", "canales", "SL"]] },
    { field: "convocatoria.contenidoMinimo", type: "array", allowNA: nonJunta, paths: [["payload", "convocatoria", "contenidoMinimo"], ["payload", "acta", "contenidoMinimo", "sesion"]] },
    { field: "constitucion.quorum.SA_1a", type: "number", allowNA: nonJunta, paths: [["payload", "constitucion", "quorum", "SA_1a"], ["payload", "quorum", "SA_1a"]] },
    { field: "constitucion.quorum.SA_2a", type: "number", allowNA: nonJunta, paths: [["payload", "constitucion", "quorum", "SA_2a"], ["payload", "quorum", "SA_2a"]] },
    { field: "constitucion.quorum.SL", type: "number", allowNA: true, paths: [["payload", "constitucion", "quorum", "SL"], ["payload", "quorum", "SL"]] },
    { field: "votacion.mayoria.SA", type: "string", allowNA: nonJunta, paths: [["payload", "votacion", "mayoria", "SA"], ["payload", "mayoria", "SA"]] },
    { field: "votacion.mayoria.SL", type: "string", allowNA: nonJunta, paths: [["payload", "votacion", "mayoria", "SL"], ["payload", "mayoria", "SL"]] },
    { field: "documentacion.obligatoria", type: "array", allowNA: false, paths: [["payload", "documentacion", "obligatoria"], ["payload", "documentacionObligatoria"]] },
    { field: "postAcuerdo.inscribible", type: "boolean", allowNA: false, paths: [["payload", "postAcuerdo", "inscribible"], ["payload", "inscripcion", "inscribible"]] },
    { field: "postAcuerdo.instrumentoRequerido", type: "string", allowNA: false, paths: [["payload", "postAcuerdo", "instrumentoRequerido"], ["payload", "inscripcion", "instrumentoRequerido"]] },
    { field: "postAcuerdo.publicacionRequerida", type: "boolean", allowNA: false, paths: [["payload", "postAcuerdo", "publicacionRequerida"], ["payload", "inscripcion", "publicacionRequerida"]] },
  ];
}

function buildSchemaContractErrors(rawRows) {
  return rawRows.flatMap((row) => schemaPoliciesFor(row).map((policy) => {
    const value = getPath(row, policy.paths);
    const result = checkField(value, policy);
    if (result.ok) return null;
    return {
      materia: row.materia,
      organo_tipo: row.organo_tipo,
      rule_pack_version_id: row.rule_pack_version_id,
      field: policy.field,
      reason: result.reason,
      allow_na: policy.allowNA ? "true" : "false",
    };
  }).filter(Boolean));
}

function thresholdFromFormula(value) {
  const text = String(value ?? "").toLowerCase();
  if (!text || text === "revisar" || text === "na") return null;
  if (/(2\/3|0\.66|0,66|66\.6|66,6|dos tercios|>= 2\/3|≥ 2\/3|art\.?\s*201\.2|reforzada)/.test(text)) {
    return 0.6667;
  }
  if (/(1\/2|0\.5|0,5|50\s*%|mitad|> 1\/2|mas de la mitad|más de la mitad|mayoria simple|mayoría simple|favor\s*>\s*contra)/.test(text)) {
    return 0.5;
  }
  if (/(1\/3|0\.33|0,33|33\.3|33,3|tercio)/.test(text)) return 0.3333;
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
  if (!Number.isFinite(rule) || !Number.isFinite(base)) return "INDETERMINADO";
  const delta = rule - base;
  if (Math.abs(delta) <= EPSILON) return "EQUIVALENTE";
  return delta < 0 ? "NO_EQUIVALENTE_A_LA_BAJA" : "NO_EQUIVALENTE_AL_ALZA";
}

function classifyEquivalence(row) {
  const rule = row.valor_rulepack;
  const base = row.valor_base;
  if (!rule) return { status: "PAYLOAD_INCOMPLETO", normalized_payload: "", normalized_base: base };
  if (!base || base === "REVISAR") return { status: "PENDIENTE_BASE_LSC", normalized_payload: rule, normalized_base: base };
  if (base === "NA") return { status: "NO_APLICA_BASE", normalized_payload: rule, normalized_base: base };

  if (row.gate.startsWith("CONVOCATORIA") || row.gate.startsWith("QUORUM")) {
    return { status: compareNumeric(rule, base), normalized_payload: rule, normalized_base: base };
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
    if (Math.abs(delta) <= EPSILON) {
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

function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    const value = row[key] || "";
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const divergences = await readCsv(options.dir, "divergencias_gate_tipo_social.csv");
  const duplicates = await readCsv(options.dir, "duplicados_materia_organo.csv");
  const normalized = await readCsv(options.dir, "rulepacks_vigentes_normalizado.csv");
  const rawRows = await readJsonl(options.dir, "rulepacks_vigentes_extraccion.jsonl");

  const probable = divergences.filter((row) => row.clasificacion_preliminar === "PROBABLE_ERROR_RULE_PACK");
  const incomplete = normalized.filter((row) => row.payload_incompleto === "Si");
  const schemaContractErrors = buildSchemaContractErrors(rawRows);
  const equivalenceRows = divergences
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
        accion_recomendada: result.status === "SUB_EQUIVALENTE" || result.status === "NO_EQUIVALENTE_A_LA_BAJA"
          ? "Tratar como PROBABLE_ERROR_RULE_PACK en correccion core"
          : "Mantener para decision o trazabilidad",
      };
    });

  if (options.writeEquivalenceReport) {
    await mkdir(path.dirname(options.writeEquivalenceReport), { recursive: true });
    await writeFile(options.writeEquivalenceReport, toCsv(equivalenceRows, [
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
    ]));
  }

  const errors = [];
  if (duplicates.length > 0) errors.push(`Duplicados activos detectados: ${duplicates.length}`);
  if (options.failOnProbableErrors && probable.length > 0) {
    errors.push(`PROBABLE_ERROR_RULE_PACK abiertos: ${probable.length}`);
  }
  if (options.failOnIncomplete && incomplete.length > 0) {
    errors.push(`Payloads incompletos abiertos: ${incomplete.length}`);
  }
  if (options.failOnIncomplete && schemaContractErrors.length > 0) {
    errors.push(`Errores de contrato schema/NA abiertos: ${schemaContractErrors.length}`);
  }

  const result = {
    ok: errors.length === 0,
    dir: path.relative(ROOT, options.dir),
    duplicate_count: duplicates.length,
    probable_error_rule_pack_count: probable.length,
    payloads_incompletos: incomplete.length,
    schema_contract_errors: schemaContractErrors.length,
    schema_contract_errors_by_reason: countBy(schemaContractErrors, "reason"),
    divergencias_by_class: countBy(divergences, "clasificacion_preliminar"),
    equivalence_review: countBy(equivalenceRows, "equivalence_status"),
    strict_flags: {
      fail_on_probable_errors: options.failOnProbableErrors,
      fail_on_incomplete: options.failOnIncomplete,
    },
    errors,
  };
  console.log(JSON.stringify(result, null, 2));
  if (errors.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
