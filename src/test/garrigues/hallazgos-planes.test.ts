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

  it("el código del hallazgo sale de la CELDA, no de su posición", () => {
    // Barajar el catálogo y comparar conjuntos NO probaba nada: `map` sobre una
    // permutación da el mismo conjunto para CUALQUIER función pura, igual que
    // `f(c) === f({...c})`. Las dos aserciones anteriores no podían caer ni con
    // el esquema por posición `FND-GARR-PEN-${i + 1}`, que es justo lo que
    // venían a impedir. Se sustituyen por el CONTENIDO del código.
    expect(codigoHallazgo({ codigo: "RSK-GARR-PEN-010", columna: "IP" }))
      .toBe("FND-GARR-PEN-010-IP");
    expect(codigoHallazgo({ codigo: "RSK-GARR-PEN-069", columna: "Fiscal" }))
      .toBe("FND-GARR-PEN-069-FISCAL");

    // La columna forma parte de la identidad: el mismo delito en dos áreas da
    // dos hallazgos distintos. Sin esto, quitar el área del código pasaría.
    expect(codigoHallazgo({ codigo: "RSK-GARR-PEN-010", columna: "IP" }))
      .not.toBe(codigoHallazgo({ codigo: "RSK-GARR-PEN-010", columna: "Fiscal" }));

    // Y el número sale del riesgo, no del índice: mover una celda de sitio no
    // le cambia el código.
    const primera = CELDAS_BANDA_ALTA[0];
    const ultima = CELDAS_BANDA_ALTA[CELDAS_BANDA_ALTA.length - 1];
    expect(codigoHallazgo(primera)).toContain(primera.codigo.replace("RSK-GARR-PEN-", ""));
    expect(codigoHallazgo(ultima)).toContain(ultima.codigo.replace("RSK-GARR-PEN-", ""));

    const original = CELDAS_BANDA_ALTA.map(codigoHallazgo);
    expect(new Set(original).size).toBe(CELDAS_BANDA_ALTA.length);
  });

  it("todo plan de acción de Garrigues cuelga de un hallazgo del propio tenant", async () => {
    // ANTES decía `expect(data).toEqual([])` — «no hay planes, y eso es el
    // requisito». Eso era la orden vieja, la de no sembrar el tenant: el primer
    // plan simulado ponía en rojo justo el avance que ahora se pide, y la
    // salida fácil habría sido revertir la siembra en vez de tocar el gate.
    //
    // Queda vigilado lo que es defecto con cero planes y con doscientos: uno
    // huérfano o colgado del hallazgo de otro tenant. Y que el recuento se MIDA
    // —un error de PostgREST no puede volver a pasar por «no hay ninguno»—.
    const { data, error } = await garr.from("action_plans")
      .select("id, title, finding_id").eq("tenant_id", GARRIGUES_TENANT);
    expect(error).toBeNull();
    expect(data, "la consulta de action_plans no devolvió ni filas ni error").not.toBeNull();

    const { data: hallazgos, error: eH } = await garr.from("findings")
      .select("id").eq("tenant_id", GARRIGUES_TENANT);
    expect(eH).toBeNull();
    // Control positivo: sin hallazgos, la comprobación de abajo se haría contra
    // un conjunto vacío y cualquier plan pasaría por huérfano o por bueno según
    // el azar de la consulta.
    expect(hallazgos.length).toBeGreaterThan(0);
    const propios = new Set(hallazgos.map((h) => h.id));
    expect(data.filter((p) => !propios.has(p.finding_id)).map((p) => p.title)).toEqual([]);
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

  it("los 8 códigos de las celdas altas siguen en Cloud, y ninguno es por posición", async () => {
    // El conteo cerrado (`length === 8` sobre el prefijo) se rompía en cuanto
    // alguien sembrase un noveno hallazgo penal. Se sustituye por la aserción
    // que crece bien y encoge mal: los ocho conocidos tienen que estar —si
    // falta uno, sale nombrado— y el esquema por posición no vuelve por ningún
    // camino, tampoco por una fila nueva.
    const { data, error } = await garr.from("findings")
      .select("code").eq("tenant_id", GARRIGUES_TENANT).like("code", "FND-GARR-PEN-%");
    expect(error).toBeNull();
    const enCloud = new Set((data ?? []).map((h) => h.code));
    const esperados = CELDAS_BANDA_ALTA.map(codigoHallazgo);
    expect(esperados).toHaveLength(8);
    expect(esperados.filter((c) => !enCloud.has(c))).toEqual([]);
    expect((data ?? []).filter((h) => ES_CODIGO_POR_POSICION.test(h.code))).toEqual([]);
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
