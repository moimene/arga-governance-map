#!/usr/bin/env bun
/* global process, console */
/**
 * MOI-188 (D-09, declarar) — sonda de solo lectura para el expediente huérfano
 * del canal interno (`sii.cases`).
 *
 * QUÉ VIGILA: que no aparezca NINGÚN expediente nuevo con `tenant_id` que no
 * exista en `tenants`, distinto del único histórico ya conocido y declarado
 * (`CASO-SII-001`, seed original del canal, `docs/superpowers/plans/
 * 2026-09-05-ledger-cierre-gaps.md` DA-9 y `supabase/migrations/
 * 20260907150000_sii_persistencia_y_endurecimiento.sql`).
 *
 * QUÉ NO HACE: no borra nada. La decisión (D-09, por delegación del usuario)
 * es CONSERVAR el histórico, no limpiarlo — es el único rastro del seed
 * original y `sii.cases` no tiene política ni grant de DELETE, a propósito.
 *
 * POR QUÉ ES UN SCRIPT Y NO UN `bun test`: el esquema `sii` no está expuesto
 * en la API de PostgREST (`Invalid schema: sii`, PGRST106) para NINGÚN rol,
 * ni siquiera `service_role` — medido en vivo el 2026-09-26. Ninguna prueba
 * bajo `src/test` puede leer esta tabla; solo una conexión SQL directa puede.
 * Mismo canal que `secretaria-p0-cloud-smoke.ts`: psql si hay DATABASE_URL,
 * si no, Supabase CLI `db query --linked` (proyecto ya enlazado a
 * `hzqwefkwsxopwrmtksbg`).
 *
 * Uso: bun run scripts/check-sii-caso-huerfano.ts
 * Exit 0: solo el huérfano declarado (o ninguno). Exit 1: hay otro distinto.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const EXPECTED_PROJECT_REF = "hzqwefkwsxopwrmtksbg";
const SUPABASE_CLI_PACKAGE = process.env.SUPABASE_CLI_PACKAGE ?? "supabase@2.98.1";

// El único expediente huérfano DECLARADO (D-09): se conserva como histórico,
// no se borra. Si aparece cualquier `id` que no esté en esta lista, la sonda
// falla — es "otro expediente sin grupo", que es justo lo que hay que atrapar.
const HUERFANOS_DECLARADOS = new Set(["580b6fae-f0fd-44cc-ac24-688d9f055537"]);

// Solo la columna `id`: `tenant_id` y `case_ref` también son UUID/texto y
// contaminarían la extracción por regex de más abajo si se seleccionaran.
const SQL = `
select id
from sii.cases
where tenant_id not in (select id from tenants)
order by id;
`;

function hasCommand(command: string): boolean {
  return spawnSync("sh", ["-lc", `command -v ${command}`], { stdio: "ignore" }).status === 0;
}

function fail(message: string): never {
  console.error(`[FAIL] ${message}`);
  process.exit(1);
}

/** Ejecuta el SELECT y devuelve stdout crudo, por psql o por la CLI enlazada. */
function runReadOnlySelect(sql: string): string {
  const databaseUrl = process.env.SII_HUERFANO_DATABASE_URL ?? process.env.DATABASE_URL;
  if (databaseUrl && hasCommand("psql")) {
    const result = spawnSync(
      "psql",
      [databaseUrl, "--no-psqlrc", "--quiet", "--tuples-only", "--set", "ON_ERROR_STOP=1"],
      { input: sql, encoding: "utf8", maxBuffer: 1024 * 1024 * 4 },
    );
    if (result.status !== 0) fail([result.stdout, result.stderr].filter(Boolean).join("\n"));
    return result.stdout;
  }

  const linkedRef = readFileSync("supabase/.temp/project-ref", "utf8").trim();
  if (linkedRef !== EXPECTED_PROJECT_REF) {
    fail(`CLI enlazada a ${linkedRef || "<vacío>"}; se esperaba ${EXPECTED_PROJECT_REF}. Aborta sin consultar.`);
  }

  const dir = mkdtempSync(join(tmpdir(), "sii-huerfano-"));
  const file = join(dir, "select.sql");
  writeFileSync(file, sql, "utf8");
  const result = spawnSync(process.execPath, ["x", SUPABASE_CLI_PACKAGE, "db", "query", "--linked", "--file", file], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 4,
  });
  rmSync(dir, { recursive: true, force: true });
  if (result.status !== 0) fail([result.stdout, result.stderr].filter(Boolean).join("\n"));
  return result.stdout;
}

// Ambos canales devuelven el `id` (UUID) como primer campo de cada fila de
// resultado; basta con extraer los UUID de la salida en vez de parsear una
// tabla con bordes que cada canal dibuja distinto.
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

const salida = runReadOnlySelect(SQL);
const encontrados = [...new Set((salida.match(UUID_RE) ?? []).map((id) => id.toLowerCase()))];
const inesperados = encontrados.filter((id) => !HUERFANOS_DECLARADOS.has(id));

if (inesperados.length > 0) {
  fail(
    `${inesperados.length} expediente(s) huérfano(s) en sii.cases NO declarado(s): ${inesperados.join(", ")}. ` +
      "Si es legítimo, decisión del usuario (declarar o limpiar) antes de actualizar HUERFANOS_DECLARADOS.",
  );
}

console.log(
  `[OK] sii.cases sin expedientes huérfanos nuevos (${encontrados.length} declarado(s), 0 inesperados).`,
);
