import { describe, expect, it, beforeAll } from "bun:test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEMO_TENANT, GARRIGUES_TENANT, sesionDe } from "../helpers/supabase-test-client";

/**
 * `variable-resolver` alimenta las variables de TODAS las plantillas del motor
 * documental: es el arreglo de mayor RADIO de la ronda, porque un dato
 * fabricado ahí no se queda en una pantalla ni en un fichero — entra en
 * cualquier documento que el motor genere, para cualquier materia y tenant.
 *
 * Por eso hay que demostrar que NO toca ARGA, y demostrarlo con dos mediciones
 * en vez de con el razonamiento «la bandera no está, luego no cambia» — que es
 * exactamente la forma de razonar que ya dejó pasar hoy un cambio a ARGA (el
 * helper de fechas unificó tres formatos y la bandera tampoco estaba).
 *
 * Las dos mediciones son:
 *   1. ninguna reunión de ARGA declara la bandera;
 *   2. cuando la bandera es falsa, la expresión evaluada es CARÁCTER A CARÁCTER
 *      la de `origin/main`.
 * Juntas cierran el caso sin depender de ejecutar el motor entero.
 */
const RUTA = "src/lib/doc-gen/variable-resolver.ts";

function expresionesDeHora(texto: string): { inicio: string; fin: string } {
  const m = texto.match(/const meetingStartTime = ([\s\S]*?);\n\s*const meetingEndTime = ([\s\S]*?);\n/);
  if (!m) throw new Error("no se encontraron las expresiones de hora en el fuente");
  const norm = (x: string) => x.replace(/\s+/g, " ").trim();
  return { inicio: norm(m[1]), fin: norm(m[2]) };
}
/** Lo que se evalúa cuando el expediente NO declara la bandera. */
const ramaSinBandera = (e: string) => e.replace(/^horaNoAcreditada \? "" : /, "");

describe("C1 — el motor documental no fabrica horas, y ARGA no cambia", () => {
  it("sin bandera, la expresión es la de origin/main carácter a carácter", () => {
    const main = expresionesDeHora(
      execFileSync("git", ["show", `origin/main:${RUTA}`], { encoding: "utf8" }),
    );
    const head = expresionesDeHora(readFileSync(RUTA, "utf8"));

    expect(ramaSinBandera(head.inicio)).toBe(main.inicio);
    expect(ramaSinBandera(head.fin)).toBe(main.fin);

    // Control del método: la expresión de HEAD sí cambió respecto de main —si
    // no, este test estaría comparando dos cosas iguales y no probaría que la
    // rama sin bandera es la que se conserva.
    expect(head.inicio).not.toBe(main.inicio);
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
