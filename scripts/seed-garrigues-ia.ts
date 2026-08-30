#!/usr/bin/env bun
/**
 * Seed C2 — Inventario de sistemas de IA del tenant Garrigues.
 *
 * Siembra en `public.ai_systems` los 6 sistemas del catálogo
 * (`scripts/garrigues/ia/catalogo-ia.ts`, SISTEMAS_IA — única fuente de verdad,
 * no se reinterpreta aquí).
 *
 * ANTES DE EJECUTAR CON --commit
 * ------------------------------
 * Correr desde el ÁRBOL CANÓNICO, no desde un worktree: `bun run db:check-target`
 * falla en un worktree porque el CLI de Supabase no está enlazado allí (dice
 * "Do not run DB writes" por una razón que no tiene que ver con el destino).
 * Verificado 2026-08-30: pasa en el árbol canónico, falla en /private/tmp/c2-aims.
 * La respuesta correcta es ejecutar donde pasa, no aprender a ignorar el guardián.
 *
 * TRES AUSENCIAS DE ESQUEMA, MEDIDAS EN CLOUD (2026-08-30)
 * -------------------------------------------------------
 * `public.ai_systems` tiene EXACTAMENTE dos constraints: PK sobre `id` y
 * FK `owner_id → persons(id)`. Nada más. En concreto:
 *
 *  1. **`tenant_id` NO tiene FK a `tenants`.** Una constante mal escrita crearía
 *     un tenant fantasma que ninguna consulta por tenant vería. Por eso el
 *     discriminante de abajo cierra el conjunto: total de la tabla MÁS desglose.
 *     Contar sólo "ARGA sigue en 8" y "Garrigues sube a 6" no detecta una
 *     séptima fila colgada de un UUID inexistente.
 *  2. **`aims_reference_code` NO es único.** Re-ejecutar duplicaría EN SILENCIO.
 *     La idempotencia es de este script y no tiene red debajo — mismo defecto
 *     que `policies.policy_code` en G4. Deuda declarada: la unicidad por tenant
 *     es superficie compartida y no se abre aquí.
 *  3. **`status` no tiene CHECK.** Acepta cualquier texto. Se siembra el literal
 *     del catálogo y no se confía en validación del servidor.
 *
 * Hay otras tres tablas `ai_systems` en Cloud (`w3_backup`, `w3_backup_20260614`,
 * `w3_backup_gh_20260614`), residuo del saneamiento W3. PostgREST sólo ve
 * `public`, pero toda consulta de verificación debe cualificar el esquema: una
 * medición sobre la tabla equivocada es un universo mal cerrado.
 *
 * LO QUE EL CATÁLOGO LLEVA Y LA TABLA NO PUEDE GUARDAR
 * ---------------------------------------------------
 * `ai_systems` no tiene columna para `provenance`, `sourceRef` ni `restrictions`.
 * En vez de perderlos —que es lo que convertiría el inventario en una lista de
 * nombres sin trazabilidad— se componen dentro de `description`, que la ficha ya
 * pinta. `humanOversight` y `owner_body_slug` no se siembran: el primero no tiene
 * dónde ir, y el segundo apunta a un COMITÉ mientras `owner_id` referencia
 * `persons`. Colgar el comité de una persona sería inventar una atribución.
 *
 * Contrato cero-cambio ARGA: este script NUNCA escribe fuera del tenant
 * Garrigues, y aborta si detecta que fuera a hacerlo.
 *
 * Uso: bun run scripts/seed-garrigues-ia.ts [--commit]
 */
import { createClient } from "@supabase/supabase-js";
import { GARRIGUES_TENANT } from "./garrigues/entities-catalog";
import { SISTEMAS_IA, type SistemaIA } from "./garrigues/ia/catalogo-ia";

const ARGA_TENANT = "00000000-0000-0000-0000-000000000001";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "https://hzqwefkwsxopwrmtksbg.supabase.co";
const SERVICE_KEY_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY", "SUPABASE_SECRET_KEY",
  "SERVICE_ROLE_KEY", "SERVICE_ROLE_SECRET", "SUPABASE_SERVICE_ROLE", "SB_SERVICE_ROLE_KEY",
];
const SERVICE_KEY = SERVICE_KEY_NAMES.map((n) => process.env[n]).find(Boolean) ?? "";

const COMMIT = process.argv.includes("--commit");

function fail(msg: string): never {
  console.error(`\n  ABORTA · ${msg}\n`);
  process.exit(1);
}

function crearAdmin() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}
type AdminClient = ReturnType<typeof crearAdmin>;

/**
 * La procedencia viaja DENTRO del texto porque la tabla no tiene columna para
 * ella. Sin esto el inventario diría "Copilot, herramienta corporativa" sin que
 * nadie pueda ir a comprobar de dónde sale — y lo declarado por el usuario
 * quedaría indistinguible de lo que dice la política.
 */
function componerDescripcion(s: SistemaIA): string {
  const partes = [s.description, `Procedencia: ${s.provenance}. ${s.sourceRef}`];
  if (s.restrictions) partes.push(`Restricciones: ${s.restrictions}`);
  return partes.join("\n\n");
}

function aFila(s: SistemaIA) {
  return {
    tenant_id: GARRIGUES_TENANT,
    name: s.name,
    system_type: s.system_type,
    risk_level: s.risk_level,          // null a propósito: nadie ha clasificado
    vendor: s.vendor,
    use_case: s.use_case,
    description: componerDescripcion(s),
    status: s.status,
    aims_reference_code: s.code,
    owner_id: null,                    // FK a persons; el propietario es un comité
  };
}

/** Cierra el conjunto: total de la tabla MÁS desglose por tenant. */
async function censo(db: AdminClient) {
  const { count: total, error: e1 } = await db
    .from("ai_systems").select("*", { count: "exact", head: true });
  if (e1) fail(`no se pudo contar ai_systems: ${e1.message}`);
  const porTenant: Record<string, number> = {};
  const { data, error: e2 } = await db.from("ai_systems").select("tenant_id");
  if (e2) fail(`no se pudo desglosar ai_systems: ${e2.message}`);
  for (const r of data ?? []) porTenant[(r as { tenant_id: string }).tenant_id] =
    (porTenant[(r as { tenant_id: string }).tenant_id] ?? 0) + 1;
  return { total: total ?? 0, porTenant };
}

function pintarCenso(t: string, c: { total: number; porTenant: Record<string, number> }) {
  console.log(`  ${t}: total ${c.total}`);
  for (const [tid, n] of Object.entries(c.porTenant).sort()) {
    const etiqueta = tid === ARGA_TENANT ? "ARGA" : tid === GARRIGUES_TENANT ? "Garrigues" : "DESCONOCIDO ⚠";
    console.log(`      ${etiqueta.padEnd(13)} ${tid}  ${n}`);
  }
}

async function main() {
  // Aquí había dos "guardas" que tsc demostró muertas: comparar GARRIGUES_TENANT
  // con ARGA_TENANT es comparar dos literales distintos, y `fila.tenant_id !==
  // GARRIGUES_TENANT` nunca podía ser cierto porque `aFila` lo escribe él mismo.
  // Un guard que no puede dispararse no protege: da confianza falsa y ocupa el
  // sitio de uno que sí. Lo que de verdad acota la escritura es el `.eq(
  // "tenant_id", …)` del UPDATE y el discriminante del final, que se mide.
  if (!SERVICE_KEY) fail(`falta la service-role key. Nombres aceptados: ${SERVICE_KEY_NAMES.join(", ")}`);

  console.log(`\n  Seed inventario IA — tenant Garrigues ${GARRIGUES_TENANT}`);
  console.log(`  Modo: ${COMMIT ? "COMMIT (escribe)" : "DRY-RUN (no escribe)"}\n`);

  const db = crearAdmin();
  const antes = await censo(db);
  pintarCenso("ANTES", antes);

  const argaAntes = antes.porTenant[ARGA_TENANT] ?? 0;

  // Idempotencia: por (tenant_id, aims_reference_code). No hay unicidad en BD
  // detrás, así que la comprobación es de este script y ha de ser explícita.
  const { data: existentes, error } = await db
    .from("ai_systems").select("id, aims_reference_code")
    .eq("tenant_id", GARRIGUES_TENANT);
  if (error) fail(`no se pudieron leer los sistemas del tenant: ${error.message}`);
  const porCodigo = new Map<string, string>();
  for (const r of (existentes ?? []) as { id: string; aims_reference_code: string | null }[]) {
    if (r.aims_reference_code) porCodigo.set(r.aims_reference_code, r.id);
  }

  let altas = 0, actualizaciones = 0;
  for (const s of SISTEMAS_IA) {
    const fila = aFila(s);
    const existente = porCodigo.get(s.code);
    const accion = existente ? "actualiza" : "alta     ";
    console.log(`  ${accion} ${s.code.padEnd(12)} ${s.name.padEnd(24)} [${s.provenance}]`);
    if (!COMMIT) { if (existente) actualizaciones++; else altas++; continue; }

    if (existente) {
      const { error: e } = await db.from("ai_systems").update(fila)
        .eq("tenant_id", GARRIGUES_TENANT).eq("id", existente);
      if (e) fail(`${s.code}: ${e.message}`);
      actualizaciones++;
    } else {
      const { error: e } = await db.from("ai_systems").insert(fila);
      if (e) fail(`${s.code}: ${e.message}`);
      altas++;
    }
  }

  console.log(`\n  ${altas} altas, ${actualizaciones} actualizaciones${COMMIT ? "" : " (simuladas)"}\n`);

  const despues = await censo(db);
  pintarCenso("DESPUÉS", despues);

  // Discriminante. Se comprueban las TRES cosas, no sólo que Garrigues suba:
  // que ARGA no se mueva, que Garrigues quede exactamente en el catálogo, y que
  // el total suba EXACTAMENTE lo que subió Garrigues — esto último es lo único
  // que detecta una fila colgada de un tenant que no existe, porque `tenant_id`
  // no tiene FK.
  const argaDespues = despues.porTenant[ARGA_TENANT] ?? 0;
  const garrDespues = despues.porTenant[GARRIGUES_TENANT] ?? 0;
  const problemas: string[] = [];
  if (argaDespues !== argaAntes) problemas.push(`ARGA se movió: ${argaAntes} → ${argaDespues}`);
  if (COMMIT && garrDespues !== SISTEMAS_IA.length)
    problemas.push(`Garrigues quedó en ${garrDespues}, el catálogo tiene ${SISTEMAS_IA.length}`);
  if (despues.total - antes.total !== garrDespues - (antes.porTenant[GARRIGUES_TENANT] ?? 0))
    problemas.push(`el total subió ${despues.total - antes.total} y Garrigues ` +
      `${garrDespues - (antes.porTenant[GARRIGUES_TENANT] ?? 0)}: hay filas en otro tenant`);
  for (const tid of Object.keys(despues.porTenant))
    if (tid !== ARGA_TENANT && tid !== GARRIGUES_TENANT) problemas.push(`tenant desconocido: ${tid}`);

  if (problemas.length) fail(`discriminante:\n     - ${problemas.join("\n     - ")}`);

  // En dry-run el discriminante de arriba pasa TRIVIALMENTE: no ha cambiado
  // nada, así que no puede fallar. Decir "discriminante OK" ahí sería un verde
  // que no mira nada. Lo que sí tiene contenido en dry-run es lo contrario:
  // comprobar que efectivamente NO se escribió.
  if (!COMMIT) {
    if (despues.total !== antes.total)
      fail(`el DRY-RUN escribió: total ${antes.total} → ${despues.total}`);
    console.log(`\n  DRY-RUN verificado: la tabla sigue en ${despues.total} filas, no se ha escrito nada.`);
    console.log(`  El discriminante real (ARGA intacta + Garrigues = ${SISTEMAS_IA.length} + total coherente)`);
    console.log("  sólo puede comprobarse con --commit, desde el árbol canónico.\n");
    return;
  }
  console.log(`\n  Discriminante OK: ARGA intacta en ${argaAntes}, Garrigues ${garrDespues}, sin tenants ajenos.\n`);
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
