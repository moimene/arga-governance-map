// src/test/schema/aims-cuestionario-live.test.ts
//
// El cuestionario guiado de calificación, medido en Cloud con logins reales.
//
// Es la capa FUERTE del par: `aims-cuestionario-migration-shape.test.ts` sólo
// comprueba que el SQL dice lo que esperábamos. Este comprueba que HACE lo que
// esperábamos: alta por RPC con huella de servidor, inmutabilidad, supersedencia,
// art. 6.3, práctica prohibida, sin DELETE, y aislamiento en las DOS direcciones
// con fila real en cada tenant (nada vacuo).
//
// ROJO hasta que se aplique `20260908120000`. Se dice a propósito: un gate que
// se autodesactivara cuando falta la tabla sería un verde que no asierta.
//
// GOTCHAs del repo que aplican:
//  * Un UPDATE ajeno filtrado por RLS devuelve 0 filas SIN error; aquí, además,
//    los triggers LANZAN para el propio dueño: se exige el error, no el vacío.
//  * `sesionDe` ya usa `persistSession: false` y `storageKey` propia por cuenta.
//  * Limpieza SIEMPRE: los sistemas de sonda se borran con su cascade.
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEMO_TENANT, GARRIGUES_TENANT, sesionDe } from "../helpers/supabase-test-client";
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

async function registrar(cli: SupabaseClient, nombre: string, respuestas = DESPLIEGUE_LIMITADO) {
  const { data, error } = await cli.rpc("fn_aims_registrar_sistema", {
    p_sistema: { name: nombre, status: "EN_EVALUACION" },
    p_cuestionario: payload(respuestas),
  });
  if (error) throw new Error(`fn_aims_registrar_sistema: ${error.message}`);
  const fila = (data ?? [])[0] as { system_id: string; cuestionario_id: string; content_hash: string };
  if (!fila) throw new Error("la RPC no devolvió fila");
  return fila;
}

describe("cuestionario guiado — vivo, con los dos logins", () => {
  let arga: SupabaseClient;
  let garr: SupabaseClient;
  let sistemaGarr: string | null = null;
  let cuestionarioGarr: string | null = null;
  let sistemaArga: string | null = null;

  beforeAll(async () => {
    [arga, garr] = await Promise.all([sesionDe("ARGA"), sesionDe("GARRIGUES")]);
  }, 30_000);

  afterAll(async () => {
    // El cascade arrastra los cuestionarios (no hay DELETE directo sobre ellos).
    for (const [cli, id] of [[garr, sistemaGarr], [arga, sistemaArga]] as const) {
      if (!cli || !id) continue;
      const { error } = await cli.from("ai_systems").delete().eq("id", id);
      if (error) throw new Error(`la sonda dejó el sistema ${id} sin borrar: ${error.message}`);
      const { data } = await cli.from("aims_classification_questionnaires").select("id").eq("system_id", id);
      if ((data ?? []).length > 0) throw new Error(`quedan cuestionarios del sistema ${id} tras el cascade`);
    }
  }, 30_000);

  it("un INSERT directo en ai_systems como usuario autenticado se rechaza: el alta va por la RPC", async () => {
    const { data, error } = await garr
      .from("ai_systems")
      .insert({ tenant_id: GARRIGUES_TENANT, name: `${MARCA}-DIRECTO`, status: "ACTIVO" })
      .select("id");
    // Si el trigger no está (migración sin aplicar), el INSERT aterriza: se
    // borra ANTES de asertar para que la sonda roja no deje residuo en el
    // inventario de Garrigues. Ocurrió el 2026-09-08 en la primera corrida.
    for (const fila of data ?? []) await garr.from("ai_systems").delete().eq("id", fila.id);
    expect(error?.message ?? "", "el INSERT directo no fue rechazado").toContain("ALTA_SOLO_POR_CUESTIONARIO");
    expect(data ?? []).toEqual([]);
  });

  it("Garrigues registra un sistema con su clasificación: huella de 128 hex y ai_systems sincronizado", async () => {
    const fila = await registrar(garr, MARCA);
    sistemaGarr = fila.system_id;
    cuestionarioGarr = fila.cuestionario_id;
    expect(fila.content_hash).toMatch(/^[0-9a-f]{128}$/);

    const { data: sys } = await garr
      .from("ai_systems")
      .select("tenant_id, regulatory_role, risk_level, regulatory_profile")
      .eq("id", fila.system_id)
      .single();
    expect(sys?.tenant_id).toBe(GARRIGUES_TENANT);
    expect(sys?.regulatory_role).toBe("RESPONSABLE_DESPLIEGUE");
    expect(sys?.risk_level).toBe("Limitado");
    expect((sys?.regulatory_profile as { perfil?: string })?.perfil).toBe("PROFILE_C");

    const { data: q } = await garr
      .from("aims_classification_questionnaires")
      .select("status, version, completed_by, completed_at")
      .eq("id", fila.cuestionario_id)
      .single();
    expect(q?.status).toBe("COMPLETED");
    expect(q?.version).toBe(1);
    expect(q?.completed_by).not.toBeNull();
  });

  it("la COMPLETED es inmutable para su propio dueño", async () => {
    expect(cuestionarioGarr).not.toBeNull();
    const { error } = await garr
      .from("aims_classification_questionnaires")
      .update({ phase2_art63_justification: "manipulado" })
      .eq("id", cuestionarioGarr!)
      .select();
    expect(error?.message ?? "").toContain("CUESTIONARIO_COMPLETADO_INMUTABLE");
  });

  it("rol y nivel de ai_systems sólo cambian por cuestionario; el resto de la ficha sí se edita", async () => {
    expect(sistemaGarr).not.toBeNull();
    const nivel = await garr.from("ai_systems").update({ risk_level: "Alto" }).eq("id", sistemaGarr!).select();
    expect(nivel.error?.message ?? "").toContain("CLASIFICACION_SOLO_POR_CUESTIONARIO");
    const desc = await garr.from("ai_systems").update({ description: "editada por la sonda" }).eq("id", sistemaGarr!).select("id");
    expect(desc.error).toBeNull();
    expect((desc.data ?? []).length).toBe(1);
  });

  it("reclasificar: DRAFT, art. 6.3 obligatorio, luego v2 COMPLETED y v1 SUPERSEDED", async () => {
    expect(sistemaGarr).not.toBeNull();
    const { data: draft, error: eDraft } = await garr
      .from("aims_classification_questionnaires")
      .insert({ tenant_id: GARRIGUES_TENANT, system_id: sistemaGarr!, questionnaire_version: "1.1" })
      .select("id, version, status")
      .single();
    expect(eDraft).toBeNull();
    expect(draft?.status).toBe("DRAFT");
    expect(draft?.version).toBe(2);

    // Anexo III con la excepción invocada y SIN motivación: la RPC lo rechaza.
    const conExcepcion: Respuestas = { ...DESPLIEGUE_LIMITADO, Q2_2: true, Q2_3: true };
    const sinMotivo = await garr
      .from("aims_classification_questionnaires")
      .update(payload(conExcepcion))
      .eq("tenant_id", GARRIGUES_TENANT)
      .eq("id", draft!.id)
      .select("id")
      .maybeSingle();
    expect(sinMotivo.error).toBeNull();
    expect(sinMotivo.data).not.toBeNull();
    const rechazo = await garr.rpc("fn_aims_completar_cuestionario", { p_id: draft!.id });
    expect(rechazo.error?.message ?? "").toContain("ART63_MOTIVACION_OBLIGATORIA");

    // El cliente no puede completar a mano ni escribir la huella.
    const aMano = await garr.from("aims_classification_questionnaires").update({ status: "COMPLETED" }).eq("id", draft!.id).select();
    expect(aMano.error?.message ?? "").toContain("COMPLETAR_SOLO_POR_RPC");
    const hashAMano = await garr.from("aims_classification_questionnaires").update({ content_hash: "falso" }).eq("id", draft!.id).select();
    expect(hashAMano.error?.message ?? "").toContain("CAMPOS_SELLADOS_POR_RPC");

    // Con motivación (≥ 40) la RPC completa y supersede.
    const motivada = payload(
      conExcepcion,
      "Uso interno de bajo importe, sin decisiones automatizadas sobre personas ni efectos jurídicos.",
    );
    const ok = await garr
      .from("aims_classification_questionnaires")
      .update(motivada)
      .eq("tenant_id", GARRIGUES_TENANT)
      .eq("id", draft!.id)
      .select("id")
      .maybeSingle();
    expect(ok.error).toBeNull();
    const completado = await garr.rpc("fn_aims_completar_cuestionario", { p_id: draft!.id });
    expect(completado.error).toBeNull();
    const fila = (completado.data ?? [])[0] as { version: number; content_hash: string };
    expect(fila.version).toBe(2);
    expect(fila.content_hash).toMatch(/^[0-9a-f]{128}$/);

    const { data: estados } = await garr
      .from("aims_classification_questionnaires")
      .select("version, status")
      .eq("system_id", sistemaGarr!)
      .order("version");
    expect(estados).toEqual([{ version: 1, status: "SUPERSEDED" }, { version: 2, status: "COMPLETED" }]);

    const { data: sys } = await garr.from("ai_systems").select("regulatory_profile").eq("id", sistemaGarr!).single();
    expect((sys?.regulatory_profile as { exige_art63?: boolean; version?: number })?.exige_art63).toBe(true);
    expect((sys?.regulatory_profile as { version?: number })?.version).toBe(2);
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

  it("no hay DELETE de cuestionarios desde la aplicación", async () => {
    expect(cuestionarioGarr).not.toBeNull();
    const { error } = await garr.from("aims_classification_questionnaires").delete().eq("id", cuestionarioGarr!);
    expect(error?.message ?? "", "el DELETE no fue rechazado").toMatch(/permission denied/i);
  });

  it("aislamiento en las DOS direcciones, con fila real en cada tenant", async () => {
    // ARGA registra el suyo: así la dirección «Garrigues no ve ARGA» tampoco es vacua.
    const filaArga = await registrar(arga, `${MARCA}-ARGA`);
    sistemaArga = filaArga.system_id;

    // Control positivo: cada dueño ve lo suyo.
    const propiosGarr = await garr.from("aims_classification_questionnaires").select("id").eq("system_id", sistemaGarr!);
    expect((propiosGarr.data ?? []).length).toBeGreaterThan(0);
    const propiosArga = await arga.from("aims_classification_questionnaires").select("id").eq("system_id", sistemaArga);
    expect((propiosArga.data ?? []).length).toBe(1);

    // Y nadie ve lo del otro.
    const argaVeGarr = await arga.from("aims_classification_questionnaires").select("id").eq("system_id", sistemaGarr!);
    expect(argaVeGarr.error).toBeNull();
    expect(argaVeGarr.data ?? []).toEqual([]);
    const garrVeArga = await garr.from("aims_classification_questionnaires").select("id").eq("system_id", sistemaArga);
    expect(garrVeArga.error).toBeNull();
    expect(garrVeArga.data ?? []).toEqual([]);

    // Ni escribe en lo del otro: un DRAFT forjado para un sistema ajeno lo para el WITH CHECK.
    const forjado = await garr
      .from("aims_classification_questionnaires")
      .insert({ tenant_id: DEMO_TENANT, system_id: sistemaArga, questionnaire_version: "1.1" })
      .select("id");
    expect(forjado.data ?? []).toEqual([]);
    const enArga = await arga.from("aims_classification_questionnaires").select("id").eq("system_id", sistemaArga);
    expect((enArga.data ?? []).length, "una sesión de Garrigues ha escrito un cuestionario en un sistema de ARGA").toBe(1);
  });
});
