import { describe, expect, it, beforeAll } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  lecturaDeSelloMotivo,
  motivosConLectura,
} from "@/lib/secretaria/sello-motivo-lectura";
import { GARRIGUES_TENANT, sesionDe } from "../helpers/supabase-test-client";

/**
 * ACOPLAMIENTO entre el registro WORM y su lectura jurídica.
 *
 * No comprueba que la traducción exista: comprueba que NO SE HA DESACOPLADO.
 * Una traducción que vive en otro fichero que su original se separa de él en
 * silencio — el registro es inmutable, así que nadie recibe un error el día que
 * se re-acuña con otra redacción, y la pantalla seguiría enseñando la lectura
 * vieja para siempre. Este test es el único punto donde esa divergencia hace
 * ruido.
 */
describe("C1 — la lectura jurídica sigue pegada al literal del WORM", () => {
  let garr: SupabaseClient;
  let motivosVivos: string[] = [];

  beforeAll(async () => {
    garr = await sesionDe("GARRIGUES");
    const { data, error } = await garr.from("rule_evaluation_results")
      .select("explain, agreements!inner(tenant_id)")
      .eq("agreements.tenant_id", GARRIGUES_TENANT);
    if (error) throw new Error(`no se pudieron leer las evaluaciones: ${error.message}`);
    motivosVivos = [...new Set(
      (data ?? [])
        .map((r) => (r.explain as { sello?: string; sello_motivo?: string } | null))
        .filter((e) => e?.sello === "NO_SELLADO_EN_SERVIDOR")
        .map((e) => String(e!.sello_motivo ?? "").trim())
        .filter(Boolean),
    )];
  });

  it("hay motivos vivos que traducir: si no, el resto del fichero sería vacuo", () => {
    expect(motivosVivos.length).toBeGreaterThan(0);
  });

  it("TODO motivo vivo en Cloud tiene lectura — cae si alguien re-acuña el WORM", () => {
    // ESTE es el test que pidió la orquestación. No falla porque falte una
    // traducción en abstracto: falla cuando el texto del registro y la clave del
    // mapa DIVERGEN. La clave del mapa es el propio texto fuente, así que
    // cualquier reescritura del WORM la rompe.
    const sinLectura = motivosVivos.filter((m) => lecturaDeSelloMotivo(m).lectura === null);
    expect(sinLectura).toEqual([]);
  });

  it("no sobra ninguna lectura: una clave que ya nadie usa es una traducción huérfana", () => {
    const vivos = new Set(motivosVivos);
    expect(motivosConLectura().filter((k) => !vivos.has(k))).toEqual([]);
  });

  it("la lectura no cambia el sentido, y el literal queda siempre alcanzable", () => {
    for (const m of motivosVivos) {
      const { lectura, literal } = lecturaDeSelloMotivo(m);
      expect(literal).toBe(m);                       // el literal es el registro, sin tocar
      expect(lectura).not.toContain("fn_");          // …y la lectura, sin jerga
      // Mismo sentido: la lectura tiene que seguir diciendo las dos cosas que
      // el literal dice — que la vía sellada no cubre este caso y quién calculó.
      expect(lectura).toMatch(/sellad/i);
      expect(lectura).toMatch(/motor de reglas/i);
    }
  });

  it("un motivo desconocido devuelve lectura null y el literal intacto (fail-safe)", () => {
    // Es lo que hace segura la traducción: si el WORM cambia, la ficha pinta el
    // literal. Nunca oculta; como mucho, no traduce.
    const inventado = "Un motivo que nadie ha registrado nunca.";
    expect(lecturaDeSelloMotivo(inventado)).toEqual({ lectura: null, literal: inventado });
  });
});
