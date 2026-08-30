// scripts/garrigues/hallazgos/enlazar-hallazgos.ts
//
// Une los dos conjuntos de datos que G5 dejó sueltos: las 82 filas de `risks`
// y los 8 `findings` de las celdas de banda alta. Hoy `risks.finding_id` está
// a NULL en las 82, así que el KPI «Con hallazgo» marca 0 sobre 82 y desde un
// riesgo no se llega a su hallazgo.
//
// Toca EXCLUSIVAMENTE `findings` y `risks`. No toca `controls` —el seed de G5
// sí lo hace y esa tabla está congelada en este carril—, ni ninguna otra.
//
// Idempotente. Dry-run por defecto; escribe solo con --apply.
//   bun run scripts/garrigues/hallazgos/enlazar-hallazgos.ts
//   bun run scripts/garrigues/hallazgos/enlazar-hallazgos.ts --apply
import { createClient } from "@supabase/supabase-js";
import { CELDAS_BANDA_ALTA } from "../penal/mapa-penal";
import { codigoHallazgo, ES_CODIGO_POR_POSICION } from "./hallazgos-penales";

const TENANT = "00000000-0000-0000-0000-000000000002";
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

// El título es único por celda (contiene el delito y el área) y NO depende del
// orden, así que sirve para reconocer un hallazgo del esquema antiguo sin
// reintroducir la dependencia de posición que este cambio elimina.
const tituloDe = (c: (typeof CELDAS_BANDA_ALTA)[number]) =>
  `Nivel máximo evaluado: ${c.delito} — ${c.columna}`;

let renombrados = 0;
let enlazados = 0;
let yaCorrectos = 0;

for (const celda of CELDAS_BANDA_ALTA) {
  const nuevo = codigoHallazgo(celda);

  const { data: porCodigo, error: e1 } = await db.from("findings")
    .select("id, code").eq("tenant_id", TENANT).eq("code", nuevo).maybeSingle();
  if (e1) { console.error(`${nuevo}: ${e1.message}`); process.exit(1); }

  let hallazgoId = porCodigo?.id ?? null;

  if (!hallazgoId) {
    // Buscar el del esquema antiguo por TÍTULO y renombrarlo, en vez de crear
    // uno nuevo y dejar ocho huérfanos con código por posición.
    const { data: porTitulo, error: e2 } = await db.from("findings")
      .select("id, code").eq("tenant_id", TENANT).eq("title", tituloDe(celda)).maybeSingle();
    if (e2) { console.error(`${nuevo} (por título): ${e2.message}`); process.exit(1); }

    if (porTitulo && ES_CODIGO_POR_POSICION.test(porTitulo.code)) {
      console.log(`  ${porTitulo.code} → ${nuevo}`);
      if (APPLY) {
        const { error } = await db.from("findings").update({ code: nuevo }).eq("id", porTitulo.id);
        if (error) { console.error(`renombrar ${porTitulo.code}: ${error.message}`); process.exit(1); }
      }
      hallazgoId = porTitulo.id;
      renombrados++;
    } else if (porTitulo) {
      hallazgoId = porTitulo.id;
    } else {
      console.error(`No existe hallazgo para la celda ${celda.codigo} (${celda.columna}). ` +
        `Ejecuta antes seed-garrigues-penal.ts.`);
      process.exit(1);
    }
  }

  const { data: riesgo, error: e3 } = await db.from("risks")
    .select("id, finding_id").eq("tenant_id", TENANT).eq("code", celda.codigo).maybeSingle();
  if (e3) { console.error(`${celda.codigo}: ${e3.message}`); process.exit(1); }
  if (!riesgo) { console.error(`No existe el riesgo ${celda.codigo}.`); process.exit(1); }

  if (riesgo.finding_id === hallazgoId) { yaCorrectos++; continue; }

  console.log(`  ${celda.codigo} → ${nuevo}`);
  if (APPLY) {
    const { error } = await db.from("risks").update({ finding_id: hallazgoId }).eq("id", riesgo.id);
    if (error) { console.error(`enlazar ${celda.codigo}: ${error.message}`); process.exit(1); }
  }
  enlazados++;
}

console.log(
  `${APPLY ? "APLICADO" : "DRY-RUN"}: ${renombrados} hallazgos renombrados, ` +
  `${enlazados} riesgos enlazados, ${yaCorrectos} ya correctos.`,
);
if (!APPLY) console.log("Nada se ha escrito. Repite con --apply.");
