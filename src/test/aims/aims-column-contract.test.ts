// src/test/aims/aims-column-contract.test.ts
//
// Gate vacuo nº11 — el contrato de columnas, contra Cloud y no contra una lista.
//
// QUÉ ESTABA MAL
// --------------
// `no-fabricated-claims.test.ts` tiene un bloque «A3 — contrato de columnas
// real» que compara los hooks contra la constante `FANTASMAS`, congelada el
// 2026-08-29 con los 19 literales que se conocían entonces. Los hooks de FRIA y
// del expediente técnico lo citan en sus comentarios como su red de seguridad
// («comparan las columnas declaradas con las que existen en Cloud»), y no lo
// era: el fichero no hace ni una consulta. Sólo caza la REINTRODUCCIÓN de un
// fantasma conocido, y el defecto de 1028 es que aparece uno NUEVO en cada hook
// nuevo. Aquel bloque se conserva —es barato y sigue impidiendo la vuelta de los
// 19— pero renombrado a lo que hace.
//
// QUÉ HACE ESTE
// -------------
// Toma los tipos de fila declarados en `src/hooks/useAims*.ts` y pregunta a
// Cloud si esas columnas existen. PostgREST responde `42703` a un `select` de
// una columna inexistente ANTES de aplicar RLS, así que basta la clave anónima:
// no hace falta login, no consume el cupo de sesiones y no puede estrangularse
// con 429.
//
// Por qué no vale leer una fila y mirar sus claves: las tablas `aims_*` están
// vacías en los dos tenants, y con `select("*")` —que es lo que usan los hooks—
// una columna inventada NUNCA falla: la fila llega sin esa clave y la UI pinta
// `undefined`. Ese es exactamente el daño que hubo que reparar en agosto.
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

const URL_BASE =
  process.env.VITE_SUPABASE_URL || "https://hzqwefkwsxopwrmtksbg.supabase.co";
const ANON =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.ANON_PUBLIC ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cXdlZmt3c3hvcHdybXRrc2JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Mjc1MDMsImV4cCI6MjA5MjAwMzUwM30.IZ2FbhQLp2ljRcsvsvzpLWQ9cq9p5Lz4dJfVzY3whjQ";

/**
 * Tipo de fila → tabla que lo produce. Es un mapa a mano, sí, pero las COLUMNAS
 * —que es lo que puede estar inventado— salen de Cloud. Y el mapa no puede
 * quedarse corto en silencio: el primer test exige que TODO tipo exportado por
 * los hooks esté aquí, así que un hook nuevo con un tipo nuevo pone el gate en
 * rojo hasta que alguien diga de qué tabla sale.
 */
const TIPO_A_TABLA: Record<string, string> = {
  AimsTechnicalFileSection: "aims_technical_file_sections",
  AimsSystemVersion: "aims_system_versions",
  AimsMonitoringIndicator: "aims_monitoring_indicators",
  IncidentRegimeCase: "aims_incident_regimes",
};

const HOOKS = [
  "src/hooks/useAimsTechnicalFile.ts",
  "src/hooks/useAimsMultiregime.ts",
];

interface TipoDeclarado {
  nombre: string;
  fichero: string;
  campos: string[];
}

/** Tipos de fila exportados por los hooks, con sus campos escalares. */
function tiposDeclarados(): TipoDeclarado[] {
  const out: TipoDeclarado[] = [];
  for (const fichero of HOOKS) {
    const src = readFileSync(fichero, "utf8");
    for (const m of src.matchAll(/export (?:type|interface) (\w+)\s*=?\s*\{/g)) {
      const cuerpo = src.slice(m.index! + m[0].length, src.indexOf("\n}", m.index!));
      const campos: string[] = [];
      for (const linea of cuerpo.split("\n")) {
        const c = linea.match(/^\s{2}(\w+)\??\s*:\s*(.*)$/);
        if (!c) continue;
        // Un campo cuyo tipo es un objeto en línea es un EMBED de PostgREST
        // (`governing_bodies: { name; slug }`), no una columna de la tabla.
        if (c[2].trimStart().startsWith("{")) continue;
        campos.push(c[1]);
      }
      out.push({ nombre: m[1], fichero, campos });
    }
  }
  return out;
}

/** Pregunta a Cloud por esas columnas. Devuelve el error de PostgREST, o null. */
async function columnasInexistentes(tabla: string, columnas: string[]): Promise<string | null> {
  const url = `${URL_BASE}/rest/v1/${tabla}?select=${encodeURIComponent(columnas.join(","))}&limit=1`;
  const r = await fetch(url, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
  if (r.ok) return null;
  const cuerpo = (await r.json()) as { code?: string; message?: string };
  // Desde `20260908130000` `anon` no tiene SELECT sobre el backbone: una columna
  // REAL responde `42501 permission denied`, y una inexistente sigue
  // respondiendo `42703` porque el análisis del `select` precede al chequeo de
  // privilegios (medido en la sonda revertida del 2026-09-08). El permiso
  // denegado NO es un fallo del contrato: las columnas existen.
  if (cuerpo.code === "42501") return null;
  return `${cuerpo.code}: ${cuerpo.message}`;
}

describe("n=1028 — las columnas declaradas por los hooks AIMS existen en Cloud", () => {
  it("el instrumento detecta una columna inexistente (control positivo)", async () => {
    // Sin esto, «ninguna columna falta» podría significar «la sonda ya no
    // pregunta»: un cambio de endpoint, una clave caducada o un `r.ok` mal
    // leído dejarían el gate verde sin mirar nada.
    const fallo = await columnasInexistentes("ai_systems", ["id", "completeness_score"]);
    expect(fallo, "Cloud acepta una columna que no existe: la sonda no mide").not.toBeNull();
    expect(fallo).toContain("42703");

    const ok = await columnasInexistentes("ai_systems", ["id", "name"]);
    expect(ok, `la sonda falla con columnas reales: ${ok}`).toBeNull();
  }, 30_000);

  it("todo tipo de fila exportado por los hooks declara de qué tabla sale", () => {
    const tipos = tiposDeclarados();
    // Cuatro y no trece: la frontera del backbone (2026-09-08) retiró el hook de
    // FRIA entero y los dos tipos de registro de modelos y datasets, tablas de
    // destino (b) sin ninguna superficie que las lea ni las escriba.
    expect(tipos.length, "el barrido no encuentra tipos en los hooks AIMS").toBeGreaterThanOrEqual(4);
    const huerfanos = tipos.filter((t) => !TIPO_A_TABLA[t.nombre]);
    expect(
      huerfanos.map((t) => `${t.nombre} (${t.fichero})`),
      "tipo de fila sin tabla declarada: añádelo a TIPO_A_TABLA o el gate no lo mira",
    ).toEqual([]);
    // Y ningún tipo del mapa puede haber desaparecido sin que se note: si se
    // renombra un tipo y nadie toca el mapa, el barrido lo daría por cubierto.
    const nombres = new Set(tipos.map((t) => t.nombre));
    expect(
      Object.keys(TIPO_A_TABLA).filter((n) => !nombres.has(n)),
      "el mapa nombra tipos que ya no existen: el gate cree cubrir más de lo que cubre",
    ).toEqual([]);
  });

  it("ninguna columna declarada es inventada", async () => {
    const tipos = tiposDeclarados();
    let examinadas = 0;
    const fallos: string[] = [];
    for (const t of tipos) {
      const tabla = TIPO_A_TABLA[t.nombre];
      if (!tabla || t.campos.length === 0) continue;
      examinadas += t.campos.length;
      const err = await columnasInexistentes(tabla, t.campos);
      if (err) fallos.push(`${t.nombre} → ${tabla}: ${err}`);
    }
    // Un bucle con un `continue` puede recorrer cero columnas y pasar por verde.
    // 40 y no 80 por la misma razón: los cuatro tipos que quedan declaran 55
    // columnas entre todos, y el ancla sigue cazando un bucle que no mira nada.
    expect(examinadas, "no se ha comprobado ni una columna").toBeGreaterThan(40);
    expect(fallos, "columnas declaradas que Cloud no tiene").toEqual([]);
  }, 60_000);
});
