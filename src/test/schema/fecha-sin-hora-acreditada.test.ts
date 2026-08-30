import { readFileSync } from "node:fs";
import { describe, expect, it, beforeAll } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fechaConHoraSiConsta,
  horaNoAcreditadaEn,
} from "@/lib/secretaria/fecha-sin-hora-acreditada";
import { DEMO_TENANT, GARRIGUES_TENANT, sesionDe } from "../helpers/supabase-test-client";

describe("C1 — la hora que no consta no se pinta como si constara", () => {
  it("con bandera: día sí, hora no", () => {
    expect(fechaConHoraSiConsta("2026-05-06T00:00:00.000Z", true))
      .toBe("6 may 2026 · hora no acreditada");
  });

  it("SIN bandera, cada formato produce lo de antes — y los tres SIGUEN SIENDO DISTINTOS", () => {
    // Dos correcciones a la primera versión de este test, las dos de la lente:
    //
    // 1. Recomputaba `d.toLocaleString(...)` con las mismas opciones que el
    //    helper: se comparaba consigo mismo por el mismo camino. Caía si
    //    cambiabas UNO de los dos y sobrevivía al cambio que de verdad importa
    //    —el que toca los dos, que es lo que hace un refactor—.
    // 2. No se puede pinar la cadena entera: `toLocaleString("es-ES")` depende
    //    de la zona horaria del runner, así que el literal completo sería
    //    frágil y alguien lo relajaría volviendo a recomputar.
    //
    // Lo que se pina es la PROPIEDAD LITERAL QUE DISCRIMINA: que los tres
    // formatos den tres cadenas DISTINTAS, y la forma característica de cada
    // una escrita a mano. El fallo real fue unificar tres formatos en uno, y
    // eso iguala las tres cadenas: es lo que este test tiene que cazar.
    const iso = "2026-12-17T08:00:00.000Z";
    const plano = fechaConHoraSiConsta(iso, false);
    const medio = fechaConHoraSiConsta(iso, false, { dateStyle: "medium", timeStyle: "short" });
    const largo = fechaConHoraSiConsta(iso, false, { dateStyle: "long", timeStyle: "short" });

    expect(new Set([plano, medio, largo]).size).toBe(3);   // unificar formatos rompe esto

    expect(plano).toMatch(/^\d{1,2}\/\d{1,2}\/\d{4}, \d{1,2}:\d{2}:\d{2}$/);  // numérico y CON segundos
    expect(medio).toMatch(/^\d{1,2} \w{3} \d{4}, \d{1,2}:\d{2}$/);              // mes abreviado, SIN segundos
    expect(largo).toMatch(/^\d{1,2} de \w+ de \d{4}, \d{1,2}:\d{2}$/);          // mes completo
    for (const v of [plano, medio, largo]) expect(v).not.toContain("no acreditada");
  });

  it("y los PUNTOS DE LLAMADA conservan su formato — aquí es donde falló de verdad", () => {
    // El guard anterior protegía el helper. El fallo histórico no fue tocar el
    // helper: fue IMPONER un formato en un punto de llamada, y eso pasaba la
    // suite entera (medido por la lente: 3803 pass con el mutante puesto).
    // Se pina el formato que cada superficie pasa, leyéndolo del fuente: si
    // alguien se lo cambia, esto cae.
    const fuentes: Array<[string, RegExp]> = [
      // Sin opciones → `toLocaleString("es-ES")` pelado.
      ["src/pages/secretaria/ConvocatoriasList.tsx", /fechaConHoraSiConsta\(c\.fecha_1, horaNoAcreditadaEn\(c\.rule_trace\)\)/],
      ["src/pages/secretaria/ReunionesLista.tsx", /fechaConHoraSiConsta\(m\.scheduled_start, horaNoAcreditadaEn\(m\.quorum_data\)\)/],
      // Con su formato propio.
      ["src/pages/secretaria/ReunionStepper.tsx", /dateStyle: "medium", timeStyle: "short"/],
      ["src/pages/secretaria/ReunionStepper.tsx", /dateStyle: "long", timeStyle: "short"/],
    ];
    for (const [ruta, patron] of fuentes) {
      const src = readFileSync(ruta, "utf8");
      expect(patron.test(src)).toBe(true);
    }
    // Control positivo del método: un patrón que NO está tiene que dar falso,
    // o esto no distinguiría nada.
    expect(/dateStyle: "full"/.test(readFileSync("src/pages/secretaria/ReunionStepper.tsx", "utf8"))).toBe(false);
  });

  it("sin fecha, guion; y la bandera tolera null y formas raras", () => {
    expect(fechaConHoraSiConsta(null, true)).toBe("—");
    expect(horaNoAcreditadaEn(null)).toBe(false);
    expect(horaNoAcreditadaEn({})).toBe(false);
    expect(horaNoAcreditadaEn({ hora_no_acreditada: "true" })).toBe(false);  // solo el boolean
    expect(horaNoAcreditadaEn({ hora_no_acreditada: true })).toBe(true);
  });
});

describe("C1 — la bandera está donde la leen las cuatro superficies, y ARGA no la tiene", () => {
  let garr: SupabaseClient;
  let arga: SupabaseClient;
  beforeAll(async () => {
    [garr, arga] = await Promise.all([sesionDe("GARRIGUES"), sesionDe("ARGA")]);
  });

  it("la reunión y la convocatoria de la Junta la declaran", async () => {
    const { data: m, error: eM } = await garr.from("meetings")
      .select("quorum_data").eq("tenant_id", GARRIGUES_TENANT).maybeSingle();
    expect(eM).toBeNull();
    expect(horaNoAcreditadaEn(m!.quorum_data)).toBe(true);

    // `convocatorias.rule_trace`: sin esto, la lista y el detalle seguían
    // pintando «2:00» aunque la reunión ya lo declarase. Son dos tablas y hacen
    // falta las dos banderas.
    const { data: c, error: eC } = await garr.from("convocatorias")
      .select("rule_trace").eq("tenant_id", GARRIGUES_TENANT).maybeSingle();
    expect(eC).toBeNull();
    expect(horaNoAcreditadaEn(c!.rule_trace)).toBe(true);
  });

  it("ARGA no la lleva en ninguna fila — y sus expedientes existen", async () => {
    const { data: reunionesArga } = await arga.from("meetings")
      .select("quorum_data").eq("tenant_id", DEMO_TENANT).limit(50);
    // Control: si esto fuera 0 filas, el «ninguna la lleva» sería vacuo.
    expect((reunionesArga ?? []).length).toBeGreaterThan(0);
    expect((reunionesArga ?? []).filter((r) => horaNoAcreditadaEn(r.quorum_data))).toHaveLength(0);

    const { data: convArga } = await arga.from("convocatorias")
      .select("rule_trace").eq("tenant_id", DEMO_TENANT).limit(50);
    expect((convArga ?? []).length).toBeGreaterThan(0);
    expect((convArga ?? []).filter((c) => horaNoAcreditadaEn(c.rule_trace))).toHaveLength(0);
  });
});
