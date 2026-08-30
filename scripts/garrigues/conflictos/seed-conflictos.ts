// scripts/garrigues/conflictos/seed-conflictos.ts
//
// Siembra los conflictos de interés tipológicos del tenant Garrigues.
// Toca EXCLUSIVAMENTE `conflicts_of_interest`.
//
// `person_id` va a NULL a propósito y el script lo fuerza: no es un campo que
// se deje sin rellenar por comodidad, es la garantía de que ninguna de estas
// situaciones se atribuye a una persona identificada del censo.
//
// `tenant_id` explícito en TODOS los INSERT. Varias tablas de este esquema
// tienen DEFAULT ARGA y un INSERT sin tenant no falla: aterriza en ARGA.
//
// Idempotente. Dry-run por defecto; escribe solo con --apply.
//   bun run scripts/garrigues/conflictos/seed-conflictos.ts
//   bun run scripts/garrigues/conflictos/seed-conflictos.ts --apply
import { createClient } from "@supabase/supabase-js";
import { CONFLICTOS_DEMO, CONFLICTOS_TENANT } from "./catalogo-conflictos";

const APPLY = process.argv.includes("--apply");

const SERVICE_KEY_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY", "SUPABASE_SECRET_KEY",
  "SERVICE_ROLE_KEY", "SERVICE_ROLE_SECRET", "SUPABASE_SERVICE_ROLE", "SB_SERVICE_ROLE_KEY",
];
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://hzqwefkwsxopwrmtksbg.supabase.co";
const key = SERVICE_KEY_NAMES.map((n) => process.env[n]).find(Boolean);
if (!key) {
  console.error(`Faltan credenciales. Se buscó la service-role en: ${SERVICE_KEY_NAMES.join(", ")}`);
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

let creados = 0;
let actualizados = 0;

for (const c of CONFLICTOS_DEMO) {
  const fila = {
    tenant_id: CONFLICTOS_TENANT,
    code: c.code,
    // `conflict_type` se deja en NULL. El CHECK de la columna solo admite
    // 'Permanente' y 'Situacional' (20260417121410_001_core_schema.sql:214),
    // que es OTRO EJE: PI-02 clasifica por «sentido estricto» vs «comercial o
    // de negocio», no por duracion. Mapear una taxonomia sobre la otra seria
    // inventar una correspondencia que la fuente no hace. Mismo criterio que
    // G5 aplico a `findings.severity`. La categoria de PI-02 viaja en el
    // catalogo y la pinta la pantalla, con su apartado.
    conflict_type: null,
    description: c.descripcion,
    status: c.status,
    // NULL explícito, no omitido: la ausencia de persona es el requisito.
    person_id: null,
  };

  const { data: ya, error: eSel } = await db.from("conflicts_of_interest")
    .select("id").eq("tenant_id", CONFLICTOS_TENANT).eq("code", c.code).maybeSingle();
  if (eSel) { console.error(`${c.code}: ${eSel.message}`); process.exit(1); }

  console.log(`  ${ya ? "actualiza" : "crea"} ${c.code} (${c.conflict_type})`);
  if (!APPLY) { if (ya) actualizados++; else creados++; continue; }

  const { error } = ya
    ? await db.from("conflicts_of_interest").update(fila).eq("id", ya.id)
    : await db.from("conflicts_of_interest").insert(fila);
  if (error) { console.error(`${c.code}: ${error.message}`); process.exit(1); }
  if (ya) actualizados++; else creados++;
}

// Comprobación de salida, no de entrada: se lee lo que quedó escrito. Si algo
// hubiera aterrizado con persona o en el tenant equivocado, se ve aquí.
if (APPLY) {
  const { data } = await db.from("conflicts_of_interest")
    .select("code, tenant_id, person_id, conflict_type").eq("tenant_id", CONFLICTOS_TENANT);
  const conPersona = (data ?? []).filter((r) => r.person_id !== null);
  if (conPersona.length) {
    console.error(`FALLO: ${conPersona.length} filas con person_id. No debería ocurrir.`);
    process.exit(1);
  }
  console.log(`  verificado: ${data?.length} filas, 0 con persona.`);
}

console.log(`${APPLY ? "APLICADO" : "DRY-RUN"}: ${creados} altas, ${actualizados} actualizaciones.`);
if (!APPLY) console.log("Nada se ha escrito. Repite con --apply.");
