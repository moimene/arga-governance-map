import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { createClient } from "@supabase/supabase-js";
import { buildSecretariaDocumentGenerationRequest } from "../src/lib/secretaria/document-generation-boundary";
import { composeDocument } from "../src/lib/motor-plantillas";
import type { PlantillaProtegidaRow } from "../src/hooks/usePlantillasProtegidas";
import type { SecretariaDocumentType } from "../src/lib/secretaria/document-generation-boundary";

const PROJECT_ROOT = new URL("..", import.meta.url).pathname;
const OUTPUT_FILE = join(
  PROJECT_ROOT,
  "docs/benchmarks/motor-plantillas-baseline-2026-05-03.md",
);
const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const ENTITY_ID = "00000000-0000-0000-0000-000000000010";
const AGREEMENT_ID = "00000000-0000-4000-8000-000000000001";
const ITERATIONS = Number(process.env.BENCH_ITERATIONS ?? "3");
const PUBLIC_SUPABASE_URL = "https://hzqwefkwsxopwrmtksbg.supabase.co";
const PUBLIC_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cXdlZmt3c3hvcHdybXRrc2JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Mjc1MDMsImV4cCI6MjA5MjAwMzUwM30.IZ2FbhQLp2ljRcsvsvzpLWQ9cq9p5Lz4dJfVzY3whjQ";

function checkTarget() {
  const result = spawnSync("bun", ["run", "db:check-target"], {
    cwd: PROJECT_ROOT,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error("db:check-target failed; benchmark aborted.");
  }
}

function documentTypeFor(template: PlantillaProtegidaRow): SecretariaDocumentType {
  const tipo = template.tipo;
  const mode = template.adoption_mode?.toUpperCase() ?? "";
  if (tipo.startsWith("CONVOCATORIA")) return "CONVOCATORIA";
  if (tipo === "CERTIFICACION") return "CERTIFICACION";
  if (tipo === "INFORME_PRECEPTIVO") return "INFORME_PRECEPTIVO";
  if (tipo === "INFORME_DOCUMENTAL_PRE") return "INFORME_DOCUMENTAL_PRE";
  if (tipo === "ACTA_ACUERDO_ESCRITO" || mode === "NO_SESSION" || mode === "CO_APROBACION" || mode === "SOLIDARIO") {
    return "ACUERDO_SIN_SESION";
  }
  if (tipo === "ACTA_CONSIGNACION" || mode.startsWith("UNIPERSONAL")) return "DECISION_UNIPERSONAL";
  if (tipo === "ACTA_SESION") return "ACTA";
  return "INFORME_DOCUMENTAL_PRE";
}

function requestPatch(documentType: SecretariaDocumentType) {
  const base = {
    documentType,
    tenantId: TENANT_ID,
    entityId: ENTITY_ID,
    templateId: "placeholder",
    requestedAt: "2026-05-03T10:00:00.000Z",
  };
  if (documentType === "CONVOCATORIA" || documentType === "INFORME_PRECEPTIVO") {
    return { ...base, convocatoriaId: "conv-benchmark" };
  }
  if (documentType === "ACTA") {
    return {
      ...base,
      agreementIds: [AGREEMENT_ID],
      meetingId: "meeting-benchmark",
      minuteId: "minute-benchmark",
    };
  }
  if (documentType === "CERTIFICACION") {
    return { ...base, agreementIds: [AGREEMENT_ID], certificationId: "cert-benchmark" };
  }
  if (documentType === "ACUERDO_SIN_SESION" || documentType === "DECISION_UNIPERSONAL") {
    return { ...base, agreementIds: [AGREEMENT_ID] };
  }
  return base;
}

function valueForField(field: string) {
  const lower = field.toLowerCase();
  if (lower.includes("fecha")) return "2026-05-03";
  if (lower.includes("hora")) return "10:00";
  if (lower.includes("id")) return AGREEMENT_ID;
  if (lower.endsWith("_texto") || lower.includes("documentacion") || lower.includes("orden")) {
    return "Elemento demo uno\nElemento demo dos";
  }
  if (lower.includes("hash")) return "hash-demo-benchmark";
  if (lower.includes("porcentaje")) return "75";
  return `Valor demo ${field}`;
}

function capa3ValuesFor(template: PlantillaProtegidaRow) {
  return (template.capa3_editables ?? []).reduce<Record<string, string>>((acc, field) => {
    if (!field?.campo) return acc;
    acc[field.campo] = valueForField(field.campo);
    return acc;
  }, {});
}

const BASE_VARIABLES: Record<string, unknown> = {
  denominacion_social: "ARGA Seguros, S.A.",
  cif: "A00000000",
  domicilio_social: "Madrid",
  registro_mercantil: "Madrid",
  organo_nombre: "Consejo de Administracion",
  presidente: "Antonio Rios",
  secretario: "Lucia Paredes",
  fecha: "2026-05-03",
  fecha_junta: "2026-05-03",
  hora_inicio: "10:00",
  hora_fin: "11:00",
  lugar: "Madrid",
  resultado_gate: "CONFORME",
  resultado_evaluacion: "Sin incidencias bloqueantes.",
  snapshot_hash: "hash-demo-benchmark",
  agreement_id: AGREEMENT_ID,
  materia_acuerdo: "APROBACION_CUENTAS",
  modo_adopcion: "MEETING",
  estado_acuerdo: "ADOPTED",
  instrumento_requerido: "ESCRITURA",
  tipo_presentacion: "SIGER",
  texto_decision: "Se aprueba el acuerdo demo.",
};

function percentile(values: number[], p: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}

async function main() {
  checkTarget();

  const url = process.env.VITE_SUPABASE_URL ?? PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? PUBLIC_SUPABASE_ANON_KEY;

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from("plantillas_protegidas")
    .select("*")
    .eq("tenant_id", TENANT_ID)
    .eq("estado", "ACTIVA")
    .order("tipo", { ascending: true });
  if (error) throw new Error(JSON.stringify(error));

  const templates = (data ?? []) as PlantillaProtegidaRow[];
  const rows: Array<{ id: string; tipo: string; version: string; p50: number; p95: number; runs: number; error?: string }> = [];

  for (const template of templates) {
    const durations: number[] = [];
    let errorMessage: string | undefined;
    const documentType = documentTypeFor(template);
    for (let i = 0; i < ITERATIONS; i += 1) {
      const started = performance.now();
      try {
        const request = await buildSecretariaDocumentGenerationRequest({
          ...requestPatch(documentType),
          templateId: template.id,
        });
        await composeDocument(request, capa3ValuesFor(template), {
          plantilla: template,
          resolveCapa2: false,
          archiveDraft: false,
          generatedAt: "2026-05-03",
          baseVariables: BASE_VARIABLES,
        });
        durations.push(performance.now() - started);
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : String(error);
        break;
      }
    }
    rows.push({
      id: template.id,
      tipo: template.tipo,
      version: template.version,
      p50: percentile(durations, 50),
      p95: percentile(durations, 95),
      runs: durations.length,
      error: errorMessage,
    });
  }

  const allDurations = rows.flatMap((row) => (row.error ? [] : [row.p50]));
  const markdown = [
    "# Motor Plantillas baseline — 2026-05-03",
    "",
    `Templates ACTIVE measured: ${templates.length}`,
    `Iterations per template: ${ITERATIONS}`,
    `Overall p50 of template p50: ${percentile(allDurations, 50).toFixed(1)} ms`,
    `Overall p95 of template p50: ${percentile(allDurations, 95).toFixed(1)} ms`,
    "",
    "| Template | Version | Runs | p50 ms | p95 ms | Status |",
    "|---|---:|---:|---:|---:|---|",
    ...rows.map((row) =>
      `| ${row.tipo} (${row.id.slice(0, 8)}) | ${row.version} | ${row.runs} | ${row.p50.toFixed(1)} | ${row.p95.toFixed(1)} | ${row.error ? `ERROR: ${row.error.replace(/\|/g, "/")}` : "OK"} |`,
    ),
    "",
    "Notes:",
    "- Read-only benchmark.",
    "- Archive disabled; evidence_status remains DEMO_OPERATIVA.",
    "- Capa 2 uses synthetic deterministic variables to isolate composer/render/DOCX cost.",
  ].join("\n");

  mkdirSync(join(PROJECT_ROOT, "docs/benchmarks"), { recursive: true });
  writeFileSync(OUTPUT_FILE, `${markdown}\n`);
  console.log(`Wrote ${OUTPUT_FILE}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : JSON.stringify(error));
  process.exit(1);
});
