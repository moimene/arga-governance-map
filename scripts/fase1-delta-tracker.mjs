import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const DEFAULT_BASELINE = "docs/superpowers/specs/2026-05-20-fase1";
const DEFAULT_CURRENT = "/tmp/arga-fase1-current";

function parseArgs(argv) {
  const options = {
    before: DEFAULT_BASELINE,
    after: DEFAULT_CURRENT,
    out: null,
    jsonOut: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--before") {
      const value = argv[index + 1];
      if (!value) throw new Error("--before requiere un directorio");
      options.before = value;
      index += 1;
    } else if (arg === "--after") {
      const value = argv[index + 1];
      if (!value) throw new Error("--after requiere un directorio");
      options.after = value;
      index += 1;
    } else if (arg === "--out") {
      const value = argv[index + 1];
      if (!value) throw new Error("--out requiere un path");
      options.out = value;
      index += 1;
    } else if (arg === "--json-out") {
      const value = argv[index + 1];
      if (!value) throw new Error("--json-out requiere un path");
      options.jsonOut = value;
      index += 1;
    } else {
      throw new Error(`Argumento no soportado: ${arg}`);
    }
  }
  options.before = path.resolve(ROOT, options.before);
  options.after = path.resolve(ROOT, options.after);
  if (options.out) options.out = path.resolve(ROOT, options.out);
  if (options.jsonOut) options.jsonOut = path.resolve(ROOT, options.jsonOut);
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

async function readText(filePath) {
  return readFile(filePath, "utf8");
}

async function readCsvOptional(dir, name) {
  try {
    return parseCsv(await readText(path.join(dir, name)));
  } catch {
    return [];
  }
}

async function readJsonOptional(dir, name) {
  try {
    return JSON.parse(await readText(path.join(dir, name)));
  } catch {
    return null;
  }
}

async function readJsonlOptional(dir, name) {
  try {
    const text = await readText(path.join(dir, name));
    return text.trim() === "" ? [] : text.trimEnd().split("\n").map((line) => JSON.parse(line));
  } catch {
    return [];
  }
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
  if (semantic === null || semantic === undefined || semantic === "") return false;
  if (policy.allowNA && (semantic === "NA" || (Array.isArray(semantic) && semantic.length === 0))) return true;
  if (!policy.allowNA && Array.isArray(semantic) && semantic.length === 0) return false;
  if (policy.type === "number" && typeof semantic !== "number") return false;
  if (policy.type === "array" && !Array.isArray(semantic)) return false;
  if (policy.type === "boolean" && typeof semantic !== "boolean") return false;
  return true;
}

function schemaPoliciesFor(row) {
  const nonJunta = row.organo_tipo !== "JUNTA_GENERAL";
  return [
    { type: "number", allowNA: nonJunta, paths: [["payload", "convocatoria", "antelacionDias", "SA"]] },
    { type: "number", allowNA: nonJunta, paths: [["payload", "convocatoria", "antelacionDias", "SL"]] },
    { type: "array", allowNA: nonJunta, paths: [["payload", "convocatoria", "canales", "SA"]] },
    { type: "array", allowNA: nonJunta, paths: [["payload", "convocatoria", "canales", "SL"]] },
    { type: "array", allowNA: nonJunta, paths: [["payload", "convocatoria", "contenidoMinimo"], ["payload", "acta", "contenidoMinimo", "sesion"]] },
    { type: "number", allowNA: nonJunta, paths: [["payload", "constitucion", "quorum", "SA_1a"], ["payload", "quorum", "SA_1a"]] },
    { type: "number", allowNA: nonJunta, paths: [["payload", "constitucion", "quorum", "SA_2a"], ["payload", "quorum", "SA_2a"]] },
    { type: "number", allowNA: true, paths: [["payload", "constitucion", "quorum", "SL"], ["payload", "quorum", "SL"]] },
    { type: "string", allowNA: nonJunta, paths: [["payload", "votacion", "mayoria", "SA"], ["payload", "mayoria", "SA"]] },
    { type: "string", allowNA: nonJunta, paths: [["payload", "votacion", "mayoria", "SL"], ["payload", "mayoria", "SL"]] },
    { type: "array", allowNA: false, paths: [["payload", "documentacion", "obligatoria"], ["payload", "documentacionObligatoria"]] },
    { type: "boolean", allowNA: false, paths: [["payload", "postAcuerdo", "inscribible"], ["payload", "inscripcion", "inscribible"]] },
    { type: "string", allowNA: false, paths: [["payload", "postAcuerdo", "instrumentoRequerido"], ["payload", "inscripcion", "instrumentoRequerido"]] },
    { type: "boolean", allowNA: false, paths: [["payload", "postAcuerdo", "publicacionRequerida"], ["payload", "inscripcion", "publicacionRequerida"]] },
  ];
}

function countSchemaContractErrors(rawRows) {
  return rawRows.reduce((count, row) => {
    return count + schemaPoliciesFor(row).filter((policy) => !checkField(getPath(row, policy.paths), policy)).length;
  }, 0);
}

function indexBy(rows, keyFn) {
  const map = new Map();
  for (const row of rows) map.set(keyFn(row), row);
  return map;
}

function keyDivergence(row) {
  return [row.materia, row.organo_tipo, row.tipo_social, row.gate].join("::");
}

function keyRulePack(row) {
  return [row.rule_pack_id || row.materia, row.organo_tipo].join("::");
}

function keyIncomplete(row) {
  return [row.rule_pack_version_id || row.rule_pack_id, row.materia, row.organo_tipo, row.campo_faltante].join("::");
}

function diffSets(beforeRows, afterRows, keyFn) {
  const before = indexBy(beforeRows, keyFn);
  const after = indexBy(afterRows, keyFn);
  const resolved = [];
  const added = [];
  const retained = [];
  const changed = [];

  for (const [key, row] of before.entries()) {
    if (!after.has(key)) {
      resolved.push(row);
      continue;
    }
    const afterRow = after.get(key);
    retained.push(afterRow);
    if (JSON.stringify(row) !== JSON.stringify(afterRow)) {
      changed.push({ before: row, after: afterRow });
    }
  }
  for (const [key, row] of after.entries()) {
    if (!before.has(key)) added.push(row);
  }
  return { resolved, added, retained, changed };
}

function csvCell(value) {
  if (value === null || value === undefined || value === "") return "sin dato";
  return String(value).replaceAll("|", "\\|").replaceAll("\n", " ");
}

function mdTable(headers, rows, emptyText) {
  if (rows.length === 0) return emptyText;
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${headers.map((header) => csvCell(row[header])).join(" | ")} |`),
  ].join("\n");
}

function valueForGate(normalizedRow, gate, tipoSocial) {
  if (!normalizedRow) return "";
  if (gate === "CONVOCATORIA/ANTELACION_DIAS") {
    return tipoSocial === "SA" ? normalizedRow.conv_sa_dias : normalizedRow.conv_sl_dias;
  }
  if (gate === "QUORUM/SA_1A") return normalizedRow.quorum_sa_1a;
  if (gate === "QUORUM/SA_2A") return normalizedRow.quorum_sa_2a;
  if (gate === "QUORUM/SL") return normalizedRow.quorum_sl;
  if (gate === "MAYORIA/SA") return normalizedRow.mayoria_sa;
  if (gate === "MAYORIA/SL") return normalizedRow.mayoria_sl;
  if (gate.startsWith("DOCUMENTACION/OBLIGATORIA/")) return normalizedRow.docs_obligatorias;
  if (gate === "INSCRIPCION/INSCRIBIBLE") return normalizedRow.inscribible;
  return "";
}

function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    const value = row[key] || "";
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function buildResolvedPatchRows(resolvedPatchRows, afterNormalized) {
  const afterByPack = indexBy(afterNormalized, keyRulePack);
  return resolvedPatchRows.map((row) => {
    const afterRow = afterByPack.get([row.rule_pack_id || row.materia, row.organo_tipo].join("::"));
    return {
      materia: row.materia,
      organo: row.organo_tipo,
      gate: row.gate,
      tipo_social: row.tipo_social,
      cambio: `${row.valor_actual || "sin dato"} -> ${valueForGate(afterRow, row.gate, row.tipo_social) || row.valor_base}`,
      referencia: row.fuente_refuerzo || row.justificacion_breve,
      motivo_prioridad: row.motivo_prioridad,
    };
  });
}

function buildRulePackHashChanges(beforeNormalized, afterNormalized) {
  const afterByPack = indexBy(afterNormalized, keyRulePack);
  return beforeNormalized
    .map((beforeRow) => {
      const afterRow = afterByPack.get(keyRulePack(beforeRow));
      if (!afterRow || beforeRow.payload_hash === afterRow.payload_hash) return null;
      return {
        materia: beforeRow.materia,
        organo: beforeRow.organo_tipo,
        version: afterRow.version || beforeRow.version,
        hash_prev: beforeRow.payload_hash,
        hash_nuevo: afterRow.payload_hash,
        incompleto_prev: beforeRow.payload_incompleto,
        incompleto_nuevo: afterRow.payload_incompleto,
      };
    })
    .filter(Boolean);
}

function buildMarkdown(delta) {
  const counts = delta.counts;
  const summaryRows = [
    { metrica: "PROBABLE_ERROR_RULE_PACK", antes: counts.before.probable_error_rule_pack, despues: counts.after.probable_error_rule_pack, delta: counts.after.probable_error_rule_pack - counts.before.probable_error_rule_pack },
    { metrica: "payloads_incompletos", antes: counts.before.payloads_incompletos, despues: counts.after.payloads_incompletos, delta: counts.after.payloads_incompletos - counts.before.payloads_incompletos },
    { metrica: "schema_contract_errors", antes: counts.before.schema_contract_errors, despues: counts.after.schema_contract_errors, delta: counts.after.schema_contract_errors - counts.before.schema_contract_errors },
    { metrica: "divergencias_total", antes: counts.before.divergencias_total, despues: counts.after.divergencias_total, delta: counts.after.divergencias_total - counts.before.divergencias_total },
    { metrica: "duplicados", antes: counts.before.duplicados, despues: counts.after.duplicados, delta: counts.after.duplicados - counts.before.duplicados },
  ];

  return `# Delta tracker Fase 1 - Rule packs\n\nGenerado: ${new Date().toISOString()}  \nBaseline: ${delta.before_dir}  \nCurrent: ${delta.after_dir}\n\n## Resumen\n\n${mdTable(["metrica", "antes", "despues", "delta"], summaryRows, "Sin metricas.")}\n\n## Correcciones a la baja resueltas\n\n${mdTable(["materia", "organo", "gate", "tipo_social", "cambio", "referencia", "motivo_prioridad"], delta.resolved_probable_errors, "Sin correcciones resueltas en esta comparacion.")}\n\n## Nuevos errores a la baja\n\n${mdTable(["materia", "organo_tipo", "tipo_social", "gate", "valor_actual", "valor_base", "severidad_propuesta"], delta.new_probable_errors, "Sin nuevos PROBABLE_ERROR_RULE_PACK.")}\n\n## Payloads incompletos resueltos\n\n${mdTable(["materia", "organo_tipo", "campo_faltante", "valor_aplicar_o_na", "referencia"], delta.resolved_incomplete_items, "Sin incompletos resueltos en esta comparacion.")}\n\n## Nuevos incompletos\n\n${mdTable(["materia", "organo_tipo", "campo_faltante", "valor_aplicar_o_na", "referencia"], delta.new_incomplete_items, "Sin nuevos incompletos.")}\n\n## Cambios de hash por rule pack\n\n${mdTable(["materia", "organo", "version", "hash_prev", "hash_nuevo", "incompleto_prev", "incompleto_nuevo"], delta.rulepack_hash_changes, "Sin cambios de hash de payload.")}\n\n## Equivalencias a la baja\n\n${mdTable(["materia", "organo_tipo", "tipo_social", "gate", "valor_actual", "valor_base", "equivalence_status"], delta.new_equivalence_down, "Sin NO_EQUIVALENTE_A_LA_BAJA nuevos.")}\n`;
}

async function loadDir(dir) {
  const manifest = await readJsonOptional(dir, "fase1_manifest.json");
  const normalized = await readCsvOptional(dir, "rulepacks_vigentes_normalizado.csv");
  const divergences = await readCsvOptional(dir, "divergencias_gate_tipo_social.csv");
  const patchPlan = await readCsvOptional(dir, "patch_plan_probable_error_rule_pack.csv");
  const patchPlanEquivalence = await readCsvOptional(dir, "patch_plan_equivalencias_a_la_baja.csv");
  const incompleteChecklist = await readCsvOptional(dir, "payloads_incompletos_checklist.csv");
  const duplicates = await readCsvOptional(dir, "duplicados_materia_organo.csv");
  const rawRows = await readJsonlOptional(dir, "rulepacks_vigentes_extraccion.jsonl");
  return {
    manifest,
    normalized,
    divergences,
    patchPlan,
    patchPlanEquivalence,
    incompleteChecklist,
    duplicates,
    rawRows,
  };
}

function buildCounts(data) {
  return {
    probable_error_rule_pack: data.patchPlan.length,
    payloads_incompletos: data.normalized.filter((row) => row.payload_incompleto === "Si").length,
    schema_contract_errors: countSchemaContractErrors(data.rawRows),
    divergencias_total: data.divergences.length,
    duplicados: data.duplicates.length,
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const before = await loadDir(options.before);
  const after = await loadDir(options.after);

  const patchDiff = diffSets(before.patchPlan, after.patchPlan, keyDivergence);
  const incompleteDiff = diffSets(before.incompleteChecklist, after.incompleteChecklist, keyIncomplete);
  const eqDiff = diffSets(before.patchPlanEquivalence, after.patchPlanEquivalence, keyDivergence);

  const delta = {
    before_dir: path.relative(ROOT, options.before),
    after_dir: path.relative(ROOT, options.after),
    counts: {
      before: buildCounts(before),
      after: buildCounts(after),
    },
    resolved_probable_errors: buildResolvedPatchRows(patchDiff.resolved, after.normalized),
    new_probable_errors: patchDiff.added,
    changed_probable_errors: patchDiff.changed,
    resolved_incomplete_items: incompleteDiff.resolved,
    new_incomplete_items: incompleteDiff.added,
    changed_incomplete_items: incompleteDiff.changed,
    rulepack_hash_changes: buildRulePackHashChanges(before.normalized, after.normalized),
    new_equivalence_down: eqDiff.added,
    resolved_equivalence_down: eqDiff.resolved,
    divergence_class_delta: {
      before: countBy(before.divergences, "clasificacion_preliminar"),
      after: countBy(after.divergences, "clasificacion_preliminar"),
    },
  };

  const markdown = buildMarkdown(delta);
  if (options.out) {
    await mkdir(path.dirname(options.out), { recursive: true });
    await writeFile(options.out, markdown);
  }
  if (options.jsonOut) {
    await mkdir(path.dirname(options.jsonOut), { recursive: true });
    await writeFile(options.jsonOut, JSON.stringify(delta, null, 2) + "\n");
  }

  console.log(JSON.stringify({
    ok: true,
    before: delta.before_dir,
    after: delta.after_dir,
    resolved_probable_errors: delta.resolved_probable_errors.length,
    new_probable_errors: delta.new_probable_errors.length,
    resolved_incomplete_items: delta.resolved_incomplete_items.length,
    new_incomplete_items: delta.new_incomplete_items.length,
    rulepack_hash_changes: delta.rulepack_hash_changes.length,
    new_equivalence_down: delta.new_equivalence_down.length,
    out: options.out ? path.relative(ROOT, options.out) : null,
    json_out: options.jsonOut ? path.relative(ROOT, options.jsonOut) : null,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
