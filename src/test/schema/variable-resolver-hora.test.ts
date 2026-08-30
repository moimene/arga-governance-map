import { describe, expect, it, beforeAll } from "bun:test";
import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEMO_TENANT, GARRIGUES_TENANT, sesionDe } from "../helpers/supabase-test-client";

/**
 * `variable-resolver` alimenta las variables de TODAS las plantillas del motor
 * documental: un dato fabricado ahí entra en cualquier documento que se genere,
 * para cualquier materia y cualquier tenant.
 *
 * LO QUE AQUÍ NO SE PUEDE PROBAR, Y POR QUÉ. La prueba buena sería ejecutar el
 * resolvedor contra los dos tenants. Se puede —lo hice, y funciona: ARGA
 * devuelve «10:00» y Garrigues «—»—, pero el resolvedor usa el cliente
 * SINGLETON de la aplicación, que es compartido por todo el proceso de tests y
 * por ficheros que corren a la vez. Medido con control discriminante:
 *
 *     suite sin este fichero ......................  0 fail
 *     dejando el singleton autenticado ............  3 fail
 *     cerrándole la sesión en un `afterAll` ....... 25 fail
 *     guardando y restaurando la sesión previa .... 33 fail
 *
 * Las tres veces el daño lo causaba mi instrumento, no el código bajo prueba.
 * Un test que rompe treinta y tres mediciones ajenas para hacer una propia no
 * es un test mejor: es la forma nº8, «el instrumento borra el sujeto», escrita
 * por mí. Así que la ejecución queda fuera de la suite y aquí se pina el
 * FUENTE — que es la única capa que este proceso puede vigilar sin estropear
 * las demás.
 *
 * El pin cubre las TRES piezas, incluida la que la revisión encontró fuera de
 * la captura anterior: la DEFINICIÓN de la condición. Sin ella, invertir la
 * polaridad (`=== true` → `!== true`) —que vacía la hora de todos los
 * documentos de ARGA y devuelve las 02:00 a Garrigues— pasaba inadvertido.
 */
const RUTA = "src/lib/doc-gen/variable-resolver.ts";

function piezasDeHora(texto: string): { condicion: string | null; inicio: string; fin: string } {
  const norm = (x: string) => x.replace(/\s+/g, " ").trim();
  const cond = texto.match(/const horaNoAcreditada = ([^;]*);/);
  const m = texto.match(/const meetingStartTime = ([\s\S]*?);\n\s*const meetingEndTime = ([\s\S]*?);\n/);
  if (!m) throw new Error("no se encontraron las expresiones de hora en el fuente");
  return { condicion: cond ? norm(cond[1]) : null, inicio: norm(m[1]), fin: norm(m[2]) };
}
const ramaSinBandera = (e: string) => e.replace(/^horaNoAcreditada \? "" : /, "");

describe("C1 — el motor documental no fabrica horas, y ARGA no cambia", () => {
  it("la condición está escrita en la polaridad correcta", () => {
    // La pieza que faltaba: invertirla no cambia ninguna de las dos ternarias,
    // así que el pin anterior —que solo miraba las ternarias— era sordo a ella.
    const { condicion } = piezasDeHora(readFileSync(RUTA, "utf8"));
    expect(condicion).toBe("meetingTyped.quorum_data?.hora_no_acreditada === true");
  });

  it("sin bandera, la expresión es EXACTAMENTE la que había antes del arreglo", () => {
    // Esta comprobación se hacía contra `git show origin/main:…`, y ESO ERA UN
    // DEFECTO DE DISEÑO: el test se autodestruía al mergear. En cuanto el
    // commit entra en `origin/main`, los dos lados coinciden, el control
    // `not.toBe` deja de cumplirse y el test rompe `main` para todos.
    // Medido: 0 fail en la rama, 1 fail en `main` recién mergeado.
    //
    // Un test que compara contra una referencia móvil mide la POSICIÓN del
    // commit, no el código. Lo que quería pinar es que la rama sin bandera sea
    // la expresión original, y eso se escribe como literal.
    const head = piezasDeHora(readFileSync(RUTA, "utf8"));
    expect(ramaSinBandera(head.inicio))
      .toBe("meetingTyped.start_time || formatScheduledTime(meetingTyped.scheduled_start)");
    expect(ramaSinBandera(head.fin))
      .toBe("meetingTyped.end_time || formatScheduledTime(meetingTyped.scheduled_end)");

    // Control del método: la expresión REAL no es la rama sin bandera —lleva el
    // condicional delante—, así que el `replace` de arriba está haciendo algo.
    expect(head.inicio).not.toBe(ramaSinBandera(head.inicio));
    expect(head.inicio).toContain("horaNoAcreditada");
  });

  describe("y el dato", () => {
    let garr: SupabaseClient;
    let arga: SupabaseClient;
    beforeAll(async () => {
      [garr, arga] = await Promise.all([sesionDe("GARRIGUES"), sesionDe("ARGA")]);
    });

    it("ninguna reunión de ARGA declara la bandera; la de Garrigues sí", async () => {
      const { data: enArga, error } = await arga.from("meetings")
        .select("quorum_data").eq("tenant_id", DEMO_TENANT).limit(100);
      expect(error).toBeNull();
      // Positivo conocido: si ARGA no tuviera reuniones, el «ninguna» sería vacuo.
      expect((enArga ?? []).length).toBeGreaterThan(0);
      expect((enArga ?? []).filter(
        (r) => (r.quorum_data as { hora_no_acreditada?: unknown } | null)?.hora_no_acreditada === true,
      )).toHaveLength(0);

      const { data: enGarr } = await garr.from("meetings")
        .select("quorum_data").eq("tenant_id", GARRIGUES_TENANT);
      expect((enGarr ?? []).filter(
        (r) => (r.quorum_data as { hora_no_acreditada?: unknown } | null)?.hora_no_acreditada === true,
      )).toHaveLength(1);
    });
  });
});
