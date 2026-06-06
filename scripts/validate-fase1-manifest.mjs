import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const EXPECTED_REF = "hzqwefkwsxopwrmtksbg";

function parseArgs(argv) {
  const options = {
    manifestPath: "docs/superpowers/specs/2026-05-20-fase1/fase1_manifest.json",
    actualDir: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--manifest") {
      const value = argv[index + 1];
      if (!value) throw new Error("--manifest requiere un path");
      options.manifestPath = value;
      index += 1;
    } else if (arg === "--actual-dir") {
      const value = argv[index + 1];
      if (!value) throw new Error("--actual-dir requiere un directorio");
      options.actualDir = value;
      index += 1;
    } else {
      throw new Error(`Argumento no soportado: ${arg}`);
    }
  }
  options.manifestPath = path.resolve(ROOT, options.manifestPath);
  options.actualDir = path.resolve(ROOT, options.actualDir ?? path.dirname(options.manifestPath));
  return options;
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
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

async function countJsonl(filePath) {
  const text = await readText(filePath);
  return text.trim() === "" ? 0 : text.trimEnd().split("\n").length;
}

async function computeCounts(actualDir) {
  const normalized = parseCsv(await readText(path.join(actualDir, "rulepacks_vigentes_normalizado.csv")));
  const lsc = parseCsv(await readText(path.join(actualDir, "lsc_base_gate_tipo_social.csv")));
  const divergences = parseCsv(await readText(path.join(actualDir, "divergencias_gate_tipo_social.csv")));
  const duplicates = parseCsv(await readText(path.join(actualDir, "duplicados_materia_organo.csv")));
  const patchPlanPath = path.join(actualDir, "patch_plan_probable_error_rule_pack.csv");
  const patchPlanEquivalencePath = path.join(actualDir, "patch_plan_equivalencias_a_la_baja.csv");
  const incompleteChecklistPath = path.join(actualDir, "payloads_incompletos_checklist.csv");
  let patchPlan = [];
  let patchPlanEquivalence = [];
  let incompleteChecklist = [];
  try {
    patchPlan = parseCsv(await readText(patchPlanPath));
  } catch {
    patchPlan = [];
  }
  try {
    patchPlanEquivalence = parseCsv(await readText(patchPlanEquivalencePath));
  } catch {
    patchPlanEquivalence = [];
  }
  try {
    incompleteChecklist = parseCsv(await readText(incompleteChecklistPath));
  } catch {
    incompleteChecklist = [];
  }
  return {
    active_rule_pack_versions: await countJsonl(path.join(actualDir, "rulepacks_vigentes_extraccion.jsonl")),
    rulepacks_activos: await countJsonl(path.join(actualDir, "rulepacks_vigentes_extraccion.jsonl")),
    materias: new Set(normalized.map((row) => row.materia).filter(Boolean)).size,
    organos: new Set(normalized.map((row) => row.organo_tipo).filter(Boolean)).size,
    payloads_incompletos: normalized.filter((row) => row.payload_incompleto === "Si").length,
    lsc_base_rows: lsc.length,
    lsc_rows: lsc.length,
    divergencias: divergences.length,
    divergencias_total: divergences.length,
    probable_error_rule_pack: patchPlan.length,
    patch_plan_equivalencias_a_la_baja: patchPlanEquivalence.length,
    payloads_incompletos_checklist_items: incompleteChecklist.length,
    duplicados: duplicates.length,
  };
}

function parseClientConfig(source) {
  const url = source.match(/DEMO_SUPABASE_URL = "([^"]+)"/)?.[1];
  const anon = source.match(/DEMO_SUPABASE_ANON_KEY =\s*\n\s*"([^"]+)"/)?.[1];
  if (!url || !anon) throw new Error("No se pudo leer Supabase URL/anon key del cliente");
  const [, payload] = anon.split(".");
  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  return { url, ref: decoded.ref ?? "" };
}

function assertEqual(errors, label, actual, expected) {
  if (actual !== expected) {
    errors.push(`${label}: esperado ${expected}, actual ${actual}`);
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const manifest = JSON.parse(await readText(options.manifestPath));
  const errors = [];

  const client = parseClientConfig(await readText(path.join(ROOT, "src/integrations/supabase/client.ts")));
  assertEqual(errors, "target_project_ref", manifest.target_project_ref, EXPECTED_REF);
  assertEqual(errors, "environment.expected_project_ref", manifest.environment?.expected_project_ref, EXPECTED_REF);
  assertEqual(errors, "environment.anon_key_ref", manifest.environment?.anon_key_ref, EXPECTED_REF);
  assertEqual(errors, "local anon key ref", client.ref, EXPECTED_REF);
  if (!client.url.includes(EXPECTED_REF)) {
    errors.push(`local Supabase URL no contiene ${EXPECTED_REF}: ${client.url}`);
  }
  if (manifest.guardrails?.no_writes !== true) errors.push("guardrails.no_writes debe ser true");
  if (manifest.guardrails?.abort_unless_environment_match !== true) {
    errors.push("guardrails.abort_unless_environment_match debe ser true");
  }

  const actualCounts = await computeCounts(options.actualDir);
  const expectedCounts = manifest.counts ?? {};
  for (const key of [
    "active_rule_pack_versions",
    "rulepacks_activos",
    "materias",
    "organos",
    "payloads_incompletos",
    "lsc_base_rows",
    "lsc_rows",
    "divergencias",
    "divergencias_total",
    "probable_error_rule_pack",
    "patch_plan_equivalencias_a_la_baja",
    "payloads_incompletos_checklist_items",
    "duplicados",
  ]) {
    if (key in expectedCounts) {
      assertEqual(errors, `counts.${key}`, actualCounts[key], expectedCounts[key]);
    }
  }

  for (const artifact of manifest.artefacts ?? []) {
    const filePath = path.join(options.actualDir, path.basename(artifact.path));
    const buffer = await readFile(filePath);
    assertEqual(errors, `sha256.${path.basename(artifact.path)}`, sha256(buffer), artifact.sha256);
  }

  if (manifest.guardrails?.fail_on_active_duplicates === true && actualCounts.duplicados > 0) {
    errors.push(`duplicados activos detectados: ${actualCounts.duplicados}`);
  }

  const result = {
    ok: errors.length === 0,
    manifest: path.relative(ROOT, options.manifestPath),
    actual_dir: path.relative(ROOT, options.actualDir),
    counts: actualCounts,
    errors,
  };
  console.log(JSON.stringify(result, null, 2));
  if (errors.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
