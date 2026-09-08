// src/test/schema/garrigues-ia-owner-write.test.ts
//
// n=1002 — el owner-write de AI Governance y su aislamiento, medidos de verdad.
//
// POR QUÉ HACE FALTA OTRO FICHERO
// ------------------------------
// `tenant-isolation.test.ts` vigila las tablas `ai_*`/`aims_*` con dato de
// ARGA, y en la dirección «ARGA no ve filas de Garrigues» varias son vacuas:
// Garrigues no tiene fila en ellas. Esa vacuidad está declarada con su motivo
// en `src/test/garrigues/aislamiento-declarado.ts` — pero declarada o no, una
// aserción vacua no prueba aislamiento.
//
// Y el módulo AI Governance ESCRIBE. Desde el refactor del 2026-09-08 el alta
// de un sistema por un usuario autenticado va SÓLO por
// `fn_aims_registrar_sistema` (sistema + cuestionario guiado en una
// transacción, tenant de la sesión): el INSERT directo lo rechaza el trigger.
// Este gate ejercita ese camino REAL, comprueba que lo que escribe queda fuera
// del alcance del otro tenant, y lo borra.
//
// ROJO hasta que se aplique `20260908120000` (la RPC no existe antes). Se dice
// a propósito: un gate que se autodesactivara cuando falta la RPC sería un
// verde que no asierta.
//
// GOTCHAs del repo que aplican aquí:
//  * Un write cross-tenant filtrado por RLS en UPDATE/DELETE devuelve 0 filas
//    SIN error. En INSERT lo rechaza el WITH CHECK y sí hay error. Se asierta lo
//    que importa —que no aterrice— y se acepta cualquiera de las dos formas.
//  * Toda sonda con más de un cliente necesita `persistSession: false` y
//    `storageKey` propia. `sesionDe` ya lo hace.
import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEMO_TENANT, GARRIGUES_TENANT, sesionDe } from "../helpers/supabase-test-client";
import { resultadoProvisional, type Respuestas } from "../../lib/aims/cuestionario-calificacion";

/** Marca única por ejecución: dos corridas simultáneas no se pisan. */
const MARCA = `PROBE-OWNER-WRITE-G-${crypto.randomUUID()}`;
const MARCA_FORJADA = `${MARCA}-FORJADO`;

const DESPLIEGUE_LIMITADO: Respuestas = {
  Q1_1: false, Q1_2: false, Q1_3: false, Q1_4: true,
  Q2_1: false, Q2_2: false, Q2_4: true, Q2_5: true,
};

function cuestionario(r: Respuestas) {
  const res = resultadoProvisional(r);
  return {
    questionnaire_version: "1.1",
    phase1_responses: Object.fromEntries(Object.entries(r).filter(([k]) => k.startsWith("Q1"))),
    phase2_responses: Object.fromEntries(Object.entries(r).filter(([k]) => k.startsWith("Q2"))),
    phase2_art63_justification: null,
    computed_role: res.rol,
    computed_risk_level: res.nivel,
    gpai_dependency: res.gpai,
    applicable_frameworks: res.marcos,
    catalog_profile: res.perfil,
  };
}

describe("n=1002 — Garrigues escribe su inventario de IA y sólo lo ve él", () => {
  let arga: SupabaseClient;
  let garr: SupabaseClient;
  let creado: string | null = null;

  beforeAll(async () => {
    // Sin graceful-skip: `sesionDe` lanza y el gate se pone rojo. Una sonda que
    // se autodesactiva cuando no puede autenticar es un verde que no asierta.
    [arga, garr] = await Promise.all([sesionDe("ARGA"), sesionDe("GARRIGUES")]);
  }, 30_000);

  afterAll(async () => {
    // Limpieza SIEMPRE, aunque una aserción haya fallado. El cascade arrastra el
    // cuestionario. Si el borrado no se pudiera hacer, se dice en voz alta.
    if (!creado || !garr) return;
    const { error } = await garr.from("ai_systems").delete().eq("id", creado);
    if (error) throw new Error(`la sonda dejó la fila ${creado} sin borrar: ${error.message}`);
    const { data } = await garr.from("ai_systems").select("id").eq("id", creado);
    if ((data ?? []).length > 0) throw new Error(`la fila ${creado} sigue viva tras el DELETE`);
    const { data: q } = await garr.from("aims_classification_questionnaires").select("id").eq("system_id", creado);
    if ((q ?? []).length > 0) throw new Error(`el cascade no arrastró el cuestionario de ${creado}`);
  }, 30_000);

  it("el INSERT directo ya no es el camino: lo rechaza el trigger", async () => {
    const { data, error } = await garr
      .from("ai_systems")
      .insert({ tenant_id: GARRIGUES_TENANT, name: `${MARCA}-DIRECTO`, status: "ACTIVO" })
      .select("id");
    expect(error?.message ?? "").toContain("ALTA_SOLO_POR_CUESTIONARIO");
    expect(data ?? []).toEqual([]);
  });

  it("el owner-write del tenant nuevo funciona por la RPC, sobre su propia tabla", async () => {
    const { data, error } = await garr.rpc("fn_aims_registrar_sistema", {
      p_sistema: { name: MARCA, status: "ACTIVO" },
      p_cuestionario: cuestionario(DESPLIEGUE_LIMITADO),
    });
    expect(error, `Garrigues no puede dar de alta un sistema de IA propio: ${error?.message}`).toBeNull();
    const fila = (data ?? [])[0] as { system_id: string; content_hash: string } | undefined;
    expect(fila, "la RPC no devolvió la fila").toBeDefined();
    creado = fila!.system_id;
    expect(fila!.content_hash).toMatch(/^[0-9a-f]{128}$/);

    const { data: sys } = await garr.from("ai_systems").select("id, tenant_id, name").eq("id", creado);
    expect((sys ?? []).map((r) => r.tenant_id)).toEqual([GARRIGUES_TENANT]);
  });

  it("Garrigues ve su fila (control positivo del instrumento)", async () => {
    // Sin esto, «ARGA no la ve» podría pasar porque la fila no existe, no
    // porque el aislamiento funcione.
    expect(creado, "no hay fila que aislar: el alta falló").not.toBeNull();
    const { data, error } = await garr.from("ai_systems").select("id, name").eq("id", creado!);
    expect(error).toBeNull();
    expect((data ?? []).map((r) => r.name)).toEqual([MARCA]);
  });

  it("ARGA no ve la fila de Garrigues, y sí ve las suyas", async () => {
    expect(creado, "no hay fila que aislar: el alta falló").not.toBeNull();
    const porId = await arga.from("ai_systems").select("id").eq("id", creado!);
    expect(porId.error).toBeNull();
    expect(porId.data ?? [], "la sesión de ARGA alcanza una fila del otro tenant").toEqual([]);

    // Control positivo DEL CLIENTE QUE HACE LA AFIRMACIÓN: si la sesión de ARGA
    // estuviera caída o ciega, la aserción de arriba pasaría por ceguera.
    const suyas = await arga.from("ai_systems").select("id, tenant_id").limit(500);
    expect(suyas.error).toBeNull();
    expect((suyas.data ?? []).length, "ARGA no ve ni su propio inventario").toBeGreaterThan(0);
    expect((suyas.data ?? []).every((r) => r.tenant_id === DEMO_TENANT)).toBe(true);
  });

  it("ARGA no puede mutar ni borrar la fila del otro tenant", async () => {
    expect(creado, "no hay fila que aislar: el alta falló").not.toBeNull();
    // GOTCHA: RLS filtra las filas → 0 afectadas y SIN 42501. Se muta una
    // columna que el trigger de clasificación NO vigila, para que lo que se
    // mida aquí sea el aislamiento y no el trigger.
    const mutacion = await arga
      .from("ai_systems").update({ description: "PROBE-DENY-CROSS" }).eq("id", creado!).select();
    expect(mutacion.error).toBeNull();
    expect(mutacion.data ?? []).toEqual([]);

    const borrado = await arga.from("ai_systems").delete().eq("id", creado!).select();
    expect(borrado.error).toBeNull();
    expect(borrado.data ?? []).toEqual([]);

    // Y la fila sigue intacta para su dueño.
    const { data } = await garr.from("ai_systems").select("name, description").eq("id", creado!);
    expect((data ?? []).map((r) => r.name)).toEqual([MARCA]);
    expect((data ?? [])[0]?.description ?? null).toBeNull();
  });

  it("la RPC no acepta un tenant del cliente: el sistema nace en el tenant de la sesión", async () => {
    // Antes el INSERT forjado con el tenant del otro lo paraba el WITH CHECK.
    // Ahora el cliente ni siquiera manda tenant: la RPC lo toma de la sesión.
    // Si alguien lo colara en `p_sistema`, se ignora.
    const forjado = await garr.rpc("fn_aims_registrar_sistema", {
      p_sistema: { name: MARCA_FORJADA, status: "ACTIVO", tenant_id: DEMO_TENANT },
      p_cuestionario: cuestionario(DESPLIEGUE_LIMITADO),
    });
    const fila = (forjado.data ?? [])[0] as { system_id: string } | undefined;
    try {
      const enArga = await arga.from("ai_systems").select("id").eq("name", MARCA_FORJADA);
      expect(enArga.error).toBeNull();
      expect(
        enArga.data ?? [],
        "una sesión de Garrigues ha escrito una fila en el inventario de IA de ARGA",
      ).toEqual([]);
      if (fila) {
        const { data: donde } = await garr.from("ai_systems").select("tenant_id").eq("id", fila.system_id);
        expect((donde ?? []).map((r) => r.tenant_id)).toEqual([GARRIGUES_TENANT]);
      }
    } finally {
      if (fila) await garr.from("ai_systems").delete().eq("id", fila.system_id);
    }
  });
});
