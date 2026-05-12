#!/usr/bin/env bun
/**
 * Importador batch service-role para migrar plantillas legacy firmadas
 * offline por el Comité Legal Garrigues. Sprint 1 — Spec §6.2 (D6).
 *
 * Uso:
 *   bun run scripts/import-templates-batch.ts <input.json>           # dry-run
 *   bun run scripts/import-templates-batch.ts <input.json> --commit  # ejecuta
 *
 * Características:
 *
 * - Service-role: usa SUPABASE_SERVICE_ROLE_KEY (bypassa RLS). Por eso este
 *   script NO debe quedar accesible desde la UI / wizard / RBAC del tab
 *   Importar. Vive aislado en `scripts/` y se invoca exclusivamente desde
 *   CLI por operadores con credenciales productivas.
 *
 * - Dry-run obligatorio: sin `--commit` solo imprime el plan tabular
 *   (`console.table`) y sale sin escribir. Con `--commit` ejecuta los
 *   INSERT en `plantillas_protegidas` (estado=REVISADA, no ACTIVA — la
 *   activación final requiere Gate PRE owner-write desde la consola) y
 *   en `plantilla_changelog` (motivo=`FIRMA_LEGAL_BATCH [idemp:<hash>]`,
 *   bump_type=MINOR).
 *
 * - Validación: parsea el input contra `TemplateBatchImportSchema` (Zod
 *   estricto). Si falla, sale con código 1 imprimiendo `issues`.
 *
 * - Gate PRE por fila: ejecuta `validateTemplateForActivation` contra
 *   las plantillas ACTIVA ya en Cloud (control de duplicados funcionales).
 *   Si una fila tiene `summary.blocking > 0`, su action queda
 *   `SKIP_BLOCKING` y NO se inserta aunque venga `--commit`.
 *
 * - Idempotencia limitada: `computeIdempotencyKey(plantillaId, version)`
 *   solo cubre dobles inserts simultáneos del changelog dentro de la misma
 *   ejecución (5s bucket por plantilla recién creada). NO previene duplicados
 *   entre runs distintos del batch: ejecuta siempre dry-run y revisa el plan
 *   tabular antes de `--commit`.
 *
 * Refs: docs/superpowers/specs/2026-05-12-gestor-plantillas-sprint1-design.md §6.2
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  TemplateBatchImportSchema,
  type TemplateBatchImportPayload,
} from "../src/lib/secretaria/template-admin/template-import-schema";
import { buildDraftRow } from "../src/lib/secretaria/template-admin/template-importer";
import { validateTemplateForActivation } from "../src/lib/secretaria/template-admin/gate-pre";
import { computeIdempotencyKey } from "../src/lib/secretaria/template-admin/changelog";
import type { PlantillaCandidate } from "../src/lib/secretaria/template-admin/types";

const TENANT_ID = "00000000-0000-0000-0000-000000000001";

type PlanRow = {
  index: number;
  materia: string;
  jurisdiccion: string;
  action: "DRY_RUN_INSERT" | "INSERT" | "SKIP_BLOCKING";
  issues: number;
};

async function main(): Promise<void> {
  const [, , inputPath, ...flags] = process.argv;
  const commit = flags.includes("--commit");

  if (!inputPath) {
    console.error(
      "Uso: bun run scripts/import-templates-batch.ts <input.json> [--commit]",
    );
    process.exit(1);
  }

  // 1. Parse + validar contra TemplateBatchImportSchema (Zod estricto).
  const raw = JSON.parse(readFileSync(inputPath, "utf-8"));
  const parsed = TemplateBatchImportSchema.safeParse(raw);
  if (!parsed.success) {
    console.error("Schema inválido:", JSON.stringify(parsed.error.issues, null, 2));
    process.exit(1);
  }
  const payload: TemplateBatchImportPayload = parsed.data;

  // 2. Env vars obligatorias. Service-role bypassa RLS, por lo que el
  //    script aborta si no las encuentra (no fallback a anon key).
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY requeridos en el entorno",
    );
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // 3. Cargar plantillas ACTIVA para detectar duplicados funcionales en
  //    Gate PRE (DUP_ACTIVE_FUNCTIONAL_KEY). Si Cloud está inalcanzable
  //    (dry-run en máquina sin red), seguimos con lista vacía — el plan
  //    aún se imprime, y el operador verá los issues semánticos pre-Cloud
  //    en consola. Para `--commit` la falta de duplicados es conservadora:
  //    podría ocultar colisiones reales, por lo que registramos warning.
  const { data: active, error: activeErr } = await supabase
    .from("plantillas_protegidas")
    .select(
      "id, tipo, materia, materia_acuerdo, jurisdiccion, version, estado, organo_tipo, adoption_mode, aprobada_por, fecha_aprobacion, referencia_legal, capa1_inmutable, capa2_variables, capa3_editables",
    )
    .eq("tenant_id", TENANT_ID)
    .eq("estado", "ACTIVA");
  if (activeErr) {
    console.warn(
      "Aviso: no se pudo cargar plantillas ACTIVA (Cloud inalcanzable). El plan se imprimirá sin detección de duplicados funcionales.",
      activeErr.message,
    );
  }
  const existingActive = (active ?? []) as PlantillaCandidate[];

  // 4. Construir plan tabular (sin escribir todavía).
  const plan: PlanRow[] = [];
  for (let i = 0; i < payload.templates.length; i += 1) {
    const t = payload.templates[i];
    const candidate: PlantillaCandidate = {
      id: `batch-${i}`,
      tipo: t.template.tipo,
      materia: t.template.materia,
      materia_acuerdo: t.template.materia_acuerdo ?? null,
      jurisdiccion: t.template.jurisdiccion,
      version: t.template.version,
      estado: "REVISADA",
      organo_tipo: t.template.organo_tipo,
      adoption_mode: t.template.adoption_mode,
      aprobada_por: payload.batch_meta.aprobada_por,
      fecha_aprobacion: payload.batch_meta.fecha_aprobacion,
      referencia_legal: t.template.referencia_legal,
      capa1_inmutable: t.capa1_inmutable,
      capa2_variables: t.capa2_variables,
      capa3_editables: t.capa3_editables,
    };

    const gate = validateTemplateForActivation(candidate, {
      tenantId: TENANT_ID,
      existingActiveTemplates: existingActive,
    });

    const action: PlanRow["action"] =
      gate.summary.blocking > 0
        ? "SKIP_BLOCKING"
        : commit
          ? "INSERT"
          : "DRY_RUN_INSERT";

    plan.push({
      index: i,
      materia: t.template.materia,
      jurisdiccion: t.template.jurisdiccion,
      action,
      issues: gate.summary.blocking,
    });
  }

  console.log("Plan:");
  console.table(plan);

  if (!commit) {
    console.log("\nDry-run completo. Re-ejecuta con --commit para escribir.");
    return;
  }

  // 5. Modo --commit: insertar filas elegibles (action === "INSERT").
  //    Las filas SKIP_BLOCKING se omiten en silencio (ya están en el plan).
  for (let i = 0; i < payload.templates.length; i += 1) {
    if (plan[i].action !== "INSERT") continue;
    const t = payload.templates[i];

    // buildDraftRow genera la fila base con estado=BORRADOR. Sobrescribimos
    // a REVISADA porque el batch ya viene firmado por Comité Legal; estado
    // REVISADA es legítimo aquí. aprobada_por / fecha_aprobacion se
    // sobrescriben con los del batch_meta (buildDraftRow los deja null).
    const row = buildDraftRow(t, {
      tenantId: TENANT_ID,
      actor: payload.batch_meta.aprobada_por,
    });
    row.estado = "REVISADA";
    row.aprobada_por = payload.batch_meta.aprobada_por;
    row.fecha_aprobacion = payload.batch_meta.fecha_aprobacion;

    const { data, error } = await supabase
      .from("plantillas_protegidas")
      .insert(row)
      .select("id")
      .single();
    if (error || !data) {
      console.error(`Fila ${i}: insert falló`, error);
      continue;
    }

    const plantillaId = data.id as string;
    const idemp = computeIdempotencyKey(plantillaId, t.template.version);
    const { error: logErr } = await supabase
      .from("plantilla_changelog")
      .insert({
        tenant_id: TENANT_ID,
        plantilla_id: plantillaId,
        bump_type: "MINOR",
        motivo: `${payload.batch_meta.motivo} [${idemp}]`,
        diff_summary: {
          action: "IMPORT",
          source: "batch",
          batch_meta: payload.batch_meta,
        },
        from_version: null,
        to_version: t.template.version,
        autor: payload.batch_meta.aprobada_por,
      });
    if (logErr) {
      console.error(
        `Fila ${i}: changelog falló para plantilla ${plantillaId}`,
        logErr,
      );
      continue;
    }
    console.log(`Fila ${i}: insertada ${plantillaId}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
