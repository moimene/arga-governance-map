// Los tres casos demo del Canal Interno de Garrigues.
//
// Lo que este test protege no es que existan: es que **no afirmen nada que la
// fuente no diga y no señalen a nadie**. Una denuncia simulada atribuida a una
// persona real del censo sería el peor daño que este carril puede causar, y no
// dejaría rastro de que fue simulada en cuanto alguien hiciera una captura.
import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sesionDe, GARRIGUES_TENANT } from "../helpers/supabase-test-client";
import {
  CASOS_DEMO_AVISO,
  CASOS_DEMO_FIRMEZA,
  CASOS_DEMO_GARRIGUES,
  casosDemoGarrigues,
} from "../../../scripts/garrigues/sii/casos-demo";
import { SII_ORGANOS_GARRIGUES } from "../../../scripts/garrigues/sii/canal-interno";

describe("SII — los casos demo son de despacho, y son simulados", () => {
  let garr: SupabaseClient;
  beforeAll(async () => {
    garr = await sesionDe("GARRIGUES");
  }, 30_000);

  it("son tres, de las tres materias que la normativa del despacho contempla", () => {
    expect(CASOS_DEMO_GARRIGUES).toHaveLength(3);
    expect(CASOS_DEMO_GARRIGUES.map((c) => c.materia))
      .toEqual(["PBC/FT", "Conflicto de intereses", "Acoso"]);
    // Cada uno con su fundamento nombrado. Sin esto son tres historias.
    expect(CASOS_DEMO_GARRIGUES.every((c) => c.fundamento.length > 20)).toBe(true);
  });

  it("TODOS etiquetados como simulados, y el aviso dice por qué no puede haber reales", () => {
    expect(CASOS_DEMO_GARRIGUES).toHaveLength(3);
    expect(CASOS_DEMO_GARRIGUES.every((c) => c.firmeza === CASOS_DEMO_FIRMEZA)).toBe(true);
    // Aserción inversa: si alguien añade uno afirmándolo real, cae.
    expect(CASOS_DEMO_GARRIGUES.filter((c) => c.firmeza !== CASOS_DEMO_FIRMEZA)).toEqual([]);
    // La negación va en la construcción «ni… ni… publican», así que se
    // comprueba entera y no por un «no» que no está.
    expect(CASOS_DEMO_AVISO).toMatch(/ni .*ni .*publican un registro de comunicaciones/);
    expect(CASOS_DEMO_AVISO).toContain("confidencialidad reforzada");
  });

  it("y NINGUNO nombra a nadie del censo real", async () => {
    // Contra el censo de Cloud, como en conflictos: es la misma regla y el
    // mismo daño. Aquí es peor, porque lo que se atribuiría es una denuncia.
    const { data: personas, error } = await garr.from("persons")
      .select("full_name, person_type").eq("tenant_id", GARRIGUES_TENANT).limit(1000);
    expect(error).toBeNull();
    const fisicas = personas.filter((p) => p.person_type === "PF");
    expect(fisicas.length).toBeGreaterThan(100);

    const texto = CASOS_DEMO_GARRIGUES
      .flatMap((c) => [c.summary, c.detailedDescription, c.category])
      .join(" \n ")
      .toLowerCase();

    const nombres = fisicas
      .map((p) => p.full_name as string)
      .filter(Boolean)
      .filter((n) => texto.includes(n.toLowerCase()));
    expect(nombres).toEqual([]);

    const escapar = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const apellidos = [...new Set(
      fisicas.flatMap((p) => ((p.full_name as string) ?? "").split(/\s+/).slice(1))
        .filter((a) => a.length >= 5),
    )];
    expect(apellidos.filter((a) => new RegExp(`\\b${escapar(a.toLowerCase())}\\b`).test(texto)))
      .toEqual([]);
  });

  it("y su destino son los órganos reales, no un comité de aseguradora", () => {
    const destinos = CASOS_DEMO_GARRIGUES.map((c) => c.destino).join(" ");
    expect(destinos).toContain("Senior Partner");
    expect(destinos).not.toMatch(/Comité de Cumplimiento\b/);
    expect(destinos).not.toMatch(/Comisión de Auditoría/);
    // Y el de acoso escala con la salida por conflicto, porque puede afectar a
    // quien instruye.
    const acoso = CASOS_DEMO_GARRIGUES.find((c) => c.materia === "Acoso")!;
    expect(acoso.destino).toBe(SII_ORGANOS_GARRIGUES.organoEscalado);
    expect(acoso.destino).toContain("órgano de administración");
  });

  it("ninguno afirma que el canal interno haya que agotarlo primero", () => {
    // El mismo error de derecho del art. 25, esta vez colado en la narrativa
    // de un caso en vez de en el copy de la pantalla.
    // Se prohíbe la AFIRMACIÓN, no la palabra. La primera versión vetaba
    // «agotar» a secas y tropezaba con el propio texto correcto —«no requiere
    // agotar antes el canal interno»—: una lista negra de palabras no
    // distingue afirmar de negar. Es el mismo defecto que el `includes("ia")`
    // del clasificador, cometido por mí quince minutos después de arreglarlo.
    const texto = CASOS_DEMO_GARRIGUES.map((c) => c.detailedDescription).join(" ");
    expect(texto).not.toMatch(/(debe|deberá|hay que|es necesario|procede)\s+agotar/i);
    expect(texto).not.toMatch(/con carácter previo al canal externo/i);
    const pbc = CASOS_DEMO_GARRIGUES.find((c) => c.materia === "PBC/FT")!;
    expect(pbc.detailedDescription).toContain("no requiere");
  });

  it("y en la forma que consume el módulo, el instructor es un CARGO", () => {
    const casos = casosDemoGarrigues("J&A Garrigues, S.L.P.");
    expect(casos).toHaveLength(3);
    // Nunca un nombre: es el rol el que instruye, y poner una persona en un
    // expediente simulado le atribuiría la instrucción de algo que no existe.
    expect(casos.every((c) => c.assignedInvestigatorName.includes("Directora de Cumplimiento")))
      .toBe(true);
    expect(casos.every((c) => c.subcases[0].ownerName.includes("Senior Partner"))).toBe(true);
    // Los relojes de la Ley 2/2023: acuse dentro de 7 días naturales (9.2.c) y
    // resolución a 3 meses (9.2.d). Si el fixture los pusiera fuera de plazo,
    // la demo mostraría un incumplimiento que nadie ha querido enseñar.
    for (const c of casos) {
      const dias = (t: string) =>
        (Date.parse(t) - Date.parse(c.intakeDate)) / 86_400_000;
      expect(dias(c.acknowledgmentSentDate)).toBeLessThanOrEqual(7);
      expect(dias(c.resolutionDeadline)).toBeGreaterThan(80);
      expect(dias(c.resolutionDeadline)).toBeLessThanOrEqual(93);
    }
  });
});
