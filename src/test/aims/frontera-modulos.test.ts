// src/test/aims/frontera-modulos.test.ts
//
// F5.T2 (MOI-175) — gate de frontera entre AIMS, GRC Compass y Secretaría
// Societaria. SOLO LECTURA de ficheros: escanea el texto de TODAS las
// migraciones (E-10), no una lista elegida a mano, así que una función nueva
// que cruce de módulo sin declararse la coge igual que las de hoy.
//
// La regla vive en `src/lib/aims/frontera-modulos.ts` (C-01 a C-08 del
// contrato, `docs/superpowers/specs/2026-09-28-contrato-aims-grc-secretaria-ria.md`):
// una función `fn_<modulo>_*` no escribe en una tabla de OTRO módulo salvo que
// conste en `HANDOFFS_DECLARADOS`.
//
// Un escáner que nunca encuentra nada es un gate vacuo. Por eso el test no se
// limita a afirmar "0 violaciones en el repo real": construye DOS señuelos —
// una función de GRC que escribe en `ai_systems` y una de AIMS que escribe en
// `obligations`, ninguna declarada como handoff — y exige que el MISMO
// extractor que recorre las migraciones reales los detecte. Si alguien
// afloja la regex para que el repo real pase, los señuelos dejan de caer y el
// test lo dice.
import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  esEscrituraPermitida,
  moduloDeFuncion,
  moduloDeTabla,
  type Modulo,
  type ViolacionFrontera,
} from "../../lib/aims/frontera-modulos";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

// Delimitador de la definición de función: `create [or replace] function
// public.fn_x(...) ... $tag$ cuerpo $tag$`. El tag dólar puede ir vacío
// (`$$`) o con nombre (`$fn$`, `$verificacion$`, …); se captura para exigir
// el MISMO tag al cerrar y no cortar en la primera `$$` de otra función.
const FUNCION_RE =
  /create\s+(?:or\s+replace\s+)?function\s+public\.(\w+)\s*\([^)]*\)[\s\S]*?\$(\w*)\$([\s\S]*?)\$\2\$/gi;

const ESCRITURA_RES: Array<{ re: RegExp; }> = [
  { re: /\binsert\s+into\s+(?:only\s+)?(?:public\.)?([a-z_][a-z0-9_]*)/gi },
  { re: /\bupdate\s+(?:only\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s+set\b/gi },
  { re: /\bdelete\s+from\s+(?:only\s+)?(?:public\.)?([a-z_][a-z0-9_]*)/gi },
];

/**
 * Extrae, de un fichero SQL (real o señuelo), cada escritura de cada función
 * `fn_*` que viola la frontera de módulo. Es el ÚNICO extractor: lo usan
 * tanto el escaneo real como los dos señuelos, para que no puedan divergir.
 */
function extraerViolaciones(archivo: string, contenido: string): ViolacionFrontera[] {
  const violaciones: ViolacionFrontera[] = [];
  for (const m of contenido.matchAll(FUNCION_RE)) {
    const nombreFuncion = m[1];
    const cuerpo = m[3];
    const moduloFuncion = moduloDeFuncion(nombreFuncion);
    if (!moduloFuncion) continue; // no es fn_aims_/fn_grc_/fn_secretaria_: fuera del contrato.
    for (const { re } of ESCRITURA_RES) {
      for (const w of cuerpo.matchAll(re)) {
        const tabla = w[1];
        if (esEscrituraPermitida(nombreFuncion, tabla)) continue;
        const moduloTabla = moduloDeTabla(tabla) as Modulo;
        violaciones.push({
          archivo,
          funcion: nombreFuncion,
          moduloFuncion,
          tabla,
          moduloTabla,
          sentencia: w[0],
        });
      }
    }
  }
  return violaciones;
}

describe("F5.T2 — frontera de módulo entre AIMS, GRC y Secretaría", () => {
  it("ninguna función fn_aims_/fn_grc_/fn_secretaria_ de las migraciones reales cruza de módulo sin handoff declarado", () => {
    const ficheros = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
    // Control positivo del propio inventario: si esto se queda en 0, el
    // escaneo de abajo mediría un directorio vacío y "0 violaciones" no
    // significaría nada.
    expect(ficheros.length).toBeGreaterThan(100);

    const violaciones: ViolacionFrontera[] = [];
    for (const f of ficheros) {
      const contenido = readFileSync(join(MIGRATIONS_DIR, f), "utf8");
      violaciones.push(...extraerViolaciones(f, contenido));
    }

    if (violaciones.length > 0) {
      const detalle = violaciones
        .map((v) => `${v.archivo}: ${v.funcion} (${v.moduloFuncion}) → ${v.sentencia.trim()} en ${v.tabla} (${v.moduloTabla})`)
        .join("\n");
      throw new Error(`Frontera de módulo violada:\n${detalle}`);
    }
    expect(violaciones).toEqual([]);
  });

  it("señuelo 1: una función de GRC que escribe directo en ai_systems SÍ se detecta", () => {
    const senuelo = `
      create or replace function public.fn_grc_senuelo_escritura_directa_ia()
      returns void
      language plpgsql
      as $fn$
      begin
        insert into public.ai_systems (id, tenant_id, name) values (gen_random_uuid(), '00000000-0000-0000-0000-000000000001', 'señuelo');
      end;
      $fn$;
    `;
    const violaciones = extraerViolaciones("__senuelo_1__.sql", senuelo);
    expect(violaciones).toHaveLength(1);
    expect(violaciones[0].funcion).toBe("fn_grc_senuelo_escritura_directa_ia");
    expect(violaciones[0].moduloFuncion).toBe("grc");
    expect(violaciones[0].tabla).toBe("ai_systems");
    expect(violaciones[0].moduloTabla).toBe("aims");
  });

  it("señuelo 2: una función de AIMS que escribe directo en obligations SÍ se detecta", () => {
    const senuelo = `
      create or replace function public.fn_aims_senuelo_alta_obligacion()
      returns void
      language plpgsql
      as $fn$
      begin
        insert into public.obligations (id, tenant_id, code, title) values (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'OBL-SENUELO', 'Señuelo');
        update public.obligations set title = 'x' where code = 'OBL-SENUELO';
      end;
      $fn$;
    `;
    const violaciones = extraerViolaciones("__senuelo_2__.sql", senuelo);
    expect(violaciones.length).toBeGreaterThanOrEqual(2);
    expect(violaciones.every((v) => v.funcion === "fn_aims_senuelo_alta_obligacion")).toBe(true);
    expect(violaciones.every((v) => v.moduloFuncion === "aims" && v.moduloTabla === "grc")).toBe(true);
  });

  it("y un handoff DECLARADO no se marca como violación (control negativo del propio señuelo)", () => {
    const handoff = `
      create or replace function public.fn_grc_registrar_hallazgo_ia()
      returns void
      language plpgsql
      as $fn$
      begin
        insert into public.findings (id, tenant_id, code) values (gen_random_uuid(), '00000000-0000-0000-0000-000000000002', 'FND-X');
      end;
      $fn$;
    `;
    expect(extraerViolaciones("__handoff__.sql", handoff)).toEqual([]);
  });
});
