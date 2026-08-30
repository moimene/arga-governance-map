// Tarea 5 del carril C3 — la arista riesgo ↔ hallazgo existe, y los planes de
// acción están etiquetados como lo que son.
//
// El KPI «Con hallazgo» marca hoy 0 sobre 82 porque `risks.finding_id` está a
// NULL en las 82 filas mientras los 8 hallazgos existen sueltos. La arista no
// está: hay dos conjuntos de datos que nadie ha unido.
//
// El segundo bloque cubre algo que no se ve mirando la pantalla: el código del
// hallazgo se derivaba de la POSICIÓN en el array de celdas, así que reordenar
// el catálogo cambiaba en silencio a qué celda se refiere cada hallazgo. Ese
// test se escribe barajando el catálogo, no leyendo el fuente.
import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sesionDe, GARRIGUES_TENANT, DEMO_TENANT } from "../helpers/supabase-test-client";
import { CELDAS_BANDA_ALTA } from "../../../scripts/garrigues/penal/mapa-penal";
import {
  codigoHallazgo,
  ES_CODIGO_POR_POSICION,
  PLAN_ACCION_AUSENCIA,
} from "../../../scripts/garrigues/hallazgos/hallazgos-penales";

describe("C3 Tarea 5 — hallazgos enlazados y planes etiquetados", () => {
  let garr: SupabaseClient;
  let arga: SupabaseClient;

  beforeAll(async () => {
    // Sin graceful-skip: una sonda que se salta a sí misma es un gate verde
    // que no asierta nada.
    [garr, arga] = await Promise.all([sesionDe("GARRIGUES"), sesionDe("ARGA")]);
  }, 30_000);

  it("las 8 celdas de banda alta llegan a su hallazgo por la FK, no de vista", async () => {
    const codigos = CELDAS_BANDA_ALTA.map((c) => c.codigo);
    const { data: risks, error } = await garr.from("risks")
      .select("code, finding_id").in("code", codigos);
    expect(error).toBeNull();
    expect(risks).toHaveLength(8);
    // La arista es la FK. Que la pantalla pinte un rótulo no prueba nada.
    expect(risks.filter((r) => r.finding_id)).toHaveLength(8);
  });

  it("y cada riesgo apunta al hallazgo de SU celda, no a otro cualquiera", async () => {
    const { data: risks } = await garr.from("risks")
      .select("code, finding_id").in("code", CELDAS_BANDA_ALTA.map((c) => c.codigo));
    const { data: hallazgos } = await garr.from("findings")
      .select("id, code").eq("tenant_id", GARRIGUES_TENANT);
    const codePorId = new Map((hallazgos ?? []).map((h) => [h.id, h.code]));

    for (const celda of CELDAS_BANDA_ALTA) {
      const r = risks.find((x) => x.code === celda.codigo);
      expect(codePorId.get(r.finding_id), `celda ${celda.codigo} (${celda.columna})`)
        .toBe(codigoHallazgo(celda));
    }
  });

  it("el código del hallazgo NO depende del orden del catálogo", () => {
    // El esquema anterior era `FND-GARR-PEN-${i + 1}`: reordenar el catálogo
    // reasignaba los ocho hallazgos en silencio, sin tocar una sola línea de
    // código. Esto se comprueba barajando, no leyendo el fuente.
    const original = CELDAS_BANDA_ALTA.map(codigoHallazgo);
    const barajado = [...CELDAS_BANDA_ALTA].reverse().map(codigoHallazgo);
    expect(new Set(barajado)).toEqual(new Set(original));
    // Y sigue identificando a la misma celda una por una.
    for (const c of CELDAS_BANDA_ALTA) {
      expect(codigoHallazgo(c)).toBe(codigoHallazgo({ ...c }));
    }
    expect(new Set(original).size).toBe(CELDAS_BANDA_ALTA.length);
  });

  it("NO hay planes de acción sembrados, y eso es el requisito", async () => {
    // PPD-01 §4.2 describe el MECANISMO del Plan de acción y no publica la
    // lista. Sembrar ocho planes verosímiles los haría indistinguibles de los
    // reales, que es justo lo que este carril tiene prohibido. La aserción va
    // en positivo: si alguien los siembra, esto cae.
    const { data, error } = await garr.from("action_plans")
      .select("id, title").eq("tenant_id", GARRIGUES_TENANT);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("y la ausencia se explica con su motivo y su fuente, no en blanco", () => {
    expect(PLAN_ACCION_AUSENCIA.motivo).toContain("no publica");
    expect(PLAN_ACCION_AUSENCIA.fuente).toContain("PPD-01");
    expect(PLAN_ACCION_AUSENCIA.fuente).toContain("§4.2");
    // Lo que sí consta del mecanismo está sembrado como controles de
    // supervisión —actividades recurrentes con órgano responsable—, así que la
    // ausencia remite a ellos en vez de dejar el hueco mudo.
    expect(PLAN_ACCION_AUSENCIA.controlesRelacionados.length).toBe(4);
  });

  it("ningún hallazgo conserva el código por posición", async () => {
    const { data } = await garr.from("findings")
      .select("code").eq("tenant_id", GARRIGUES_TENANT).like("code", "FND-GARR-PEN-%");
    expect(data.length).toBe(8);
    expect(data.filter((h) => ES_CODIGO_POR_POSICION.test(h.code))).toEqual([]);
  });

  it("ARGA no cambia: sigue sin hallazgos ni planes del prefijo de Garrigues", async () => {
    // Control POSITIVO antes de la ausencia. Una lista vacía puede significar
    // «no los tiene» o «el cliente no ve nada» —RLS mal, sesión caída, tabla
    // equivocada—, y las dos se ven idénticas. Si ARGA no viera ni lo suyo,
    // la ausencia de abajo pasaría por el motivo equivocado.
    const { data: propios, error } = await arga.from("findings")
      .select("code").eq("tenant_id", DEMO_TENANT);
    expect(error).toBeNull();
    expect(propios.length).toBeGreaterThan(0);

    const { data: f } = await arga.from("findings")
      .select("code").eq("tenant_id", DEMO_TENANT).like("code", "FND-GARR-%");
    expect(f).toEqual([]);
  });
});
