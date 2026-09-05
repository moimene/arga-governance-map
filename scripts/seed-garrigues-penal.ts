// scripts/seed-garrigues-penal.ts
// G5 — siembra el mapa de riesgos penales evaluado 2025 del tenant Garrigues.
// Idempotente. Dry-run por defecto; escribe solo con --apply.
//   bun run scripts/seed-garrigues-penal.ts            # dry-run
//   bun run scripts/seed-garrigues-penal.ts --apply
import { createClient } from "@supabase/supabase-js";
import { MAPA_PENAL, CELDAS_BANDA_ALTA } from "./garrigues/penal/mapa-penal";
import { CONTROLES_SEGUIMIENTO, SEGUIMIENTO_DESCRIPCION } from "./garrigues/penal/seguimiento-ppd";
import { codigoHallazgo } from "./garrigues/hallazgos/hallazgos-penales";
import { descripcionArticulo } from "./garrigues/penal/descripcion-articulo";

const TENANT = "00000000-0000-0000-0000-000000000002";
const APPLY = process.argv.includes("--apply");

const SERVICE_KEY_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY", "SUPABASE_SECRET_KEY",
  "SERVICE_ROLE_KEY", "SERVICE_ROLE_SECRET", "SUPABASE_SERVICE_ROLE", "SB_SERVICE_ROLE_KEY",
];
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://hzqwefkwsxopwrmtksbg.supabase.co";
const key = SERVICE_KEY_NAMES.map((n) => process.env[n]).find(Boolean);
if (!url || !key) {
  console.error(`Faltan credenciales. Se buscó la service-role en: ${SERVICE_KEY_NAMES.join(", ")}`);
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

const PROVENANCE = {
  fuente: "Mapa de riesgos penales evaluado 2025 — áreas de negocio y departamentos internos",
  metodo_extraccion: "muestreo de píxel sobre render pdftoppm; el nivel es color, no texto",
  escala: {
    tipo: "ORDINAL_SIN_NOMBRES",
    bandas: 5,
    leyenda_en_fuente: false,
    orden_indeterminado: ["VERDE_INTENSO", "VERDE_CLARO"],
    advertencia:
      "La fuente no publica leyenda ni criterio de bandas, y PPD-01 tampoco los documenta. " +
      "El orden del tramo amarillo-naranja-rojo se infiere del degradado; el de los dos verdes no está publicado.",
  },
  firmeza: "DEMO_PILOTO",
} as const;

// Celda gris = no evaluada. nivel:null y NUNCA 0: el cero es un valor de la escala.
const celda = (c: string) => (c === "GRIS" ? { nivel: null, motivo: "NO_EVALUADA" } : { color: c });
const mapear = (o: Record<string, string>) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, celda(v)]));

let creados = 0, actualizados = 0;
for (const d of MAPA_PENAL) {
  const fila = {
    tenant_id: TENANT,
    code: d.codigo,
    title: d.delito,
    description: descripcionArticulo(d.articulo),
    module_id: "risk",
    status: "Abierto",
    // probability / impact / residual_score se dejan sin tocar: la fuente da un
    // nivel compuesto por celda y no lo descompone en ejes.
    assessed_band: d.banda,
    assessment_breakdown: {
      areas_negocio: mapear(d.areas_negocio),
      departamentos_internos: mapear(d.departamentos_internos),
    },
    assessment_provenance: PROVENANCE,
  };

  const { data: ya, error: eSel } = await db.from("risks")
    .select("id").eq("tenant_id", TENANT).eq("code", d.codigo).maybeSingle();
  if (eSel) { console.error(`${d.codigo}: ${eSel.message}`); process.exit(1); }

  if (!APPLY) { if (ya) actualizados++; else creados++; continue; }
  const { error } = ya
    ? await db.from("risks").update(fila).eq("id", ya.id)
    : await db.from("risks").insert(fila);
  if (error) { console.error(`${d.codigo}: ${error.message}`); process.exit(1); }
  if (ya) actualizados++; else creados++;
}

console.log(`${APPLY ? "APLICADO" : "DRY-RUN"}: ${creados} altas, ${actualizados} actualizaciones (${MAPA_PENAL.length} delitos)`);

const ORIGEN = "Mapa de riesgos penales evaluado 2025 (áreas de negocio)";

let hallazgos = 0;
for (const c of CELDAS_BANDA_ALTA) {
  // El codigo se deriva de la CELDA (riesgo + area), no de la posicion en el
  // array: con `i + 1` bastaba reordenar el catalogo para que los ocho
  // hallazgos cambiaran de celda en silencio, sin tocar codigo y sin que
  // ningun gate lo notara. Ver garrigues/hallazgos/hallazgos-penales.ts.
  const code = codigoHallazgo(c);
  const fila = {
    tenant_id: TENANT,
    code,
    title: `Nivel máximo evaluado: ${c.delito} — ${c.columna}`,
    // severity se deja en NULL: el CHECK solo admite cuatro nombres castellanos
    // y la escala de la fuente no tiene nombres.
    status: "Abierto",
    origin: `${ORIGEN} — celda ${c.celda} en ${c.columna}`,
    // `findings.opened_at` tiene DEFAULT CURRENT_DATE, así que omitirlo hacía
    // que los ocho hallazgos quedaran «Detectados» el día en que se ejecutó el
    // script. La fuente es un mapa evaluado en 2025 y NO publica fecha de
    // detección de cada celda: se escribe NULL explícito en vez de la fecha del
    // seed, que es un dato del proceso disfrazado de dato del expediente.
    opened_at: null,
    // due_date y owner_id en NULL: la fuente no los da.
  };
  const { data: ya } = await db.from("findings")
    .select("id").eq("tenant_id", TENANT).eq("code", code).maybeSingle();
  if (!APPLY) { hallazgos++; continue; }
  const { error } = ya
    ? await db.from("findings").update(fila).eq("id", ya.id)
    : await db.from("findings").insert(fila);
  if (error) { console.error(`${code}: ${error.message}`); process.exit(1); }
  hallazgos++;
}

let controles = 0;
for (const c of CONTROLES_SEGUIMIENTO) {
  const fila = {
    tenant_id: TENANT, code: c.code, name: c.name,
    status: "Parcial",
  };
  const { data: ya } = await db.from("controls")
    .select("id").eq("tenant_id", TENANT).eq("code", c.code).maybeSingle();
  if (!APPLY) { controles++; continue; }
  const { error } = ya
    ? await db.from("controls").update(fila).eq("id", ya.id)
    : await db.from("controls").insert(fila);
  if (error) { console.error(`${c.code}: ${error.message}`); process.exit(1); }
  controles++;
}
console.log(`  hallazgos: ${hallazgos}, controles de seguimiento: ${controles}`);
if (!APPLY) console.log("Nada se ha escrito. Repite con --apply.");
