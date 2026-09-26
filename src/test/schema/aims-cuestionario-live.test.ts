// src/test/schema/aims-cuestionario-live.test.ts
//
// El cuestionario guiado de calificación, medido en Cloud con logins reales.
//
// Es la capa FUERTE del par: `aims-cuestionario-migration-shape.test.ts` sólo
// comprueba que el SQL dice lo que esperábamos. Este comprueba que HACE lo que
// esperábamos.
//
// MOI-210 (decisión D-12, `20260926121000_aims_ai_systems_fk_restrict.sql`):
// las 4 FK con valor probatorio hacia `ai_systems` (cuestionario, versiones,
// expediente técnico, indicadores) pasaron de CASCADE a RESTRICT. Este
// fichero creaba un sistema real por `fn_aims_registrar_sistema`, lo
// completaba, lo reclasificaba y lo borraba al final confiando en el CASCADE
// para arrastrar el cuestionario; con RESTRICT ese borrado ya no es posible y
// dejaría residuo permanente en el inventario de ARGA y de Garrigues.
//
// Reescrito según DS-31/E-04
// (docs/superpowers/specs/2026-09-19-aims-cobertura-ria-experto-design.md):
//   * G-VIVO-NEG (aquí, permanente): el INSERT directo se rechaza (no crea
//     nada) y la derivación servidor↔TypeScript sólo llama a funciones
//     IMMUTABLE (fn_aims_derivar_rol/nivel, fn_aims_perfil_catalogo) — no
//     escriben fila, sin residuo por construcción. El registro de una
//     práctica prohibida o de una clasificación incoherente también queda:
//     el propio servidor revierte la fila antes de devolver el error, así
//     que no hay nada que limpiar.
//   * G-VIVO-REV (archivada, no en `bun test`): el alta positiva, la
//     inmutabilidad de la COMPLETED, el bloqueo de edición directa de
//     rol/nivel, la reclasificación v2 con art. 6.3, el "sin DELETE" y el
//     aislamiento en las dos direcciones con fila real —los seis tests que
//     antes creaban `sistemaGarr`/`sistemaArga`— pasan a
//     `docs/superpowers/plans/2026-09-26-moi-210-sonda-revertida-post-restrict.sql`
//     (BEGIN … ROLLBACK), ejecutada por quien tiene permiso de escribir en
//     Cloud y archivada en el ledger.
//
// GOTCHAs del repo que aplican:
//  * Un UPDATE ajeno filtrado por RLS devuelve 0 filas SIN error; aquí, además,
//    los triggers LANZAN para el propio dueño: se exige el error, no el vacío.
//  * `sesionDe` ya usa `persistSession: false` y `storageKey` propia por cuenta.
import { beforeAll, describe, expect, it } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sesionDe } from "../helpers/supabase-test-client";
import { resultadoProvisional, type Respuestas } from "../../lib/aims/cuestionario-calificacion";

const MARCA = `PROBE-CUESTIONARIO-${crypto.randomUUID()}`;

/** Despliegue · limitado · GPAI: el caso de un despacho que usa un asistente de IA. */
const DESPLIEGUE_LIMITADO: Respuestas = {
  Q1_1: false, Q1_2: false, Q1_3: false, Q1_4: true,
  Q2_1: false, Q2_2: false, Q2_4: true, Q2_5: true,
};

function payload(respuestas: Respuestas, justificacion = "") {
  const r = resultadoProvisional(respuestas);
  return {
    questionnaire_version: "1.1",
    phase1_responses: Object.fromEntries(Object.entries(respuestas).filter(([k]) => k.startsWith("Q1"))),
    phase2_responses: Object.fromEntries(Object.entries(respuestas).filter(([k]) => k.startsWith("Q2"))),
    phase2_art63_justification: justificacion || null,
    computed_role: r.rol,
    computed_risk_level: r.nivel,
    gpai_dependency: r.gpai,
    applicable_frameworks: r.marcos,
    catalog_profile: r.perfil,
  };
}

describe("cuestionario guiado — vivo, con los dos logins (G-VIVO-NEG: sin residuo)", () => {
  let garr: SupabaseClient;

  beforeAll(async () => {
    garr = await sesionDe("GARRIGUES");
  }, 30_000);

  it("un INSERT directo en ai_systems como usuario autenticado se rechaza: el alta va por la RPC", async () => {
    const { data, error } = await garr
      .from("ai_systems")
      .insert({ tenant_id: "00000000-0000-0000-0000-000000000002", name: `${MARCA}-DIRECTO`, status: "ACTIVO" })
      .select("id");
    // Si el trigger no está (migración sin aplicar), el INSERT aterriza: se
    // borra ANTES de asertar para que la sonda roja no deje residuo en el
    // inventario de Garrigues. Ocurrió el 2026-09-08 en la primera corrida.
    for (const fila of data ?? []) await garr.from("ai_systems").delete().eq("id", fila.id);
    expect(error?.message ?? "", "el INSERT directo no fue rechazado").toContain("ALTA_SOLO_POR_CUESTIONARIO");
    expect(data ?? []).toEqual([]);
  });

  it("una práctica prohibida no se registra", async () => {
    const prohibida: Respuestas = { ...DESPLIEGUE_LIMITADO, Q2_1: true };
    const { data, error } = await garr.rpc("fn_aims_registrar_sistema", {
      p_sistema: { name: `${MARCA}-PROHIBIDA` },
      p_cuestionario: payload(prohibida),
    });
    expect(error?.message ?? "").toContain("PRACTICA_PROHIBIDA_BLOQUEA");
    expect(data ?? []).toEqual([]);
    // Y la transacción se revirtió entera: no quedó sistema a medias.
    const { data: restos } = await garr.from("ai_systems").select("id").eq("name", `${MARCA}-PROHIBIDA`);
    expect(restos ?? []).toEqual([]);
  });

  it("el servidor no se fía de la conclusión del cliente: prohibida por la respuesta e incoherencia rechazadas", async () => {
    // Revisión adversarial 2026-09-08: antes PRACTICA_PROHIBIDA se validaba
    // contra computed_risk_level, que manda el cliente.
    const manipulado = { ...payload({ ...DESPLIEGUE_LIMITADO, Q2_1: true }), computed_risk_level: "Mínimo", catalog_profile: "PROFILE_C" };
    const prohibida = await garr.rpc("fn_aims_registrar_sistema", {
      p_sistema: { name: `${MARCA}-MANIPULADA` },
      p_cuestionario: manipulado,
    });
    expect(prohibida.error?.message ?? "").toContain("PRACTICA_PROHIBIDA_BLOQUEA");

    const incoherente = { ...payload(DESPLIEGUE_LIMITADO), computed_role: "PROVEEDOR", catalog_profile: "PROFILE_C" };
    const rechazo = await garr.rpc("fn_aims_registrar_sistema", {
      p_sistema: { name: `${MARCA}-INCOHERENTE` },
      p_cuestionario: incoherente,
    });
    expect(rechazo.error?.message ?? "").toContain("CLASIFICACION_INCOHERENTE");
    // Ningún registro rechazado dejó fila: la sonda no crea nada en este describe.
    const restos = await garr.from("ai_systems").select("id").like("name", `${MARCA}%`);
    expect(restos.data ?? []).toEqual([]);
  });

  it("el árbol en servidor deriva igual que la hoja TypeScript, caso a caso", async () => {
    // Dos implementaciones del mismo criterio (TS para pintar en tiempo real,
    // SQL para no fiarse del cliente): este es el gate de que no diverjan.
    // fn_aims_derivar_rol/nivel y fn_aims_perfil_catalogo son IMMUTABLE: no
    // escriben fila, así que esta comprobación no deja residuo.
    const casos: Respuestas[] = [
      { Q1_1: true }, { Q1_1: false, Q1_2: true, Q1_3: false }, { Q1_1: false, Q1_2: false, Q1_3: false }, { Q1_1: false },
      { Q2_1: true }, { Q2_1: false, Q2_2: true, Q2_3: false }, { Q2_1: false, Q2_2: true, Q2_3: true, Q2_4: true },
      { Q2_1: false, Q2_2: true, Q2_3: true, Q2_4: false }, { Q2_1: false, Q2_2: false, Q2_4: true },
      { Q2_1: false, Q2_2: false, Q2_4: false }, { Q2_1: false, Q2_2: true }, { Q2_1: false, Q2_2: false }, {},
    ];
    for (const c of casos) {
      const esperado = resultadoProvisional(c);
      const rol = await garr.rpc("fn_aims_derivar_rol", { p: c });
      const nivel = await garr.rpc("fn_aims_derivar_nivel", { p: c });
      expect(rol.error).toBeNull();
      expect(nivel.error).toBeNull();
      expect(rol.data ?? null, `rol para ${JSON.stringify(c)}`).toBe(esperado.rol);
      expect(nivel.data ?? null, `nivel para ${JSON.stringify(c)}`).toBe(esperado.nivel);
    }
    const perfil = await garr.rpc("fn_aims_perfil_catalogo", { p_rol: "RESPONSABLE_DESPLIEGUE", p_nivel: "Alto" });
    expect(perfil.data).toBe("PROFILE_B");
  });
});
