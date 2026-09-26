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
// MOI-210 (decisión D-12, `20260926121000_aims_ai_systems_fk_restrict.sql`):
// las 4 FK con valor probatorio hacia `ai_systems` pasaron de CASCADE a
// RESTRICT. Un sistema con cuestionario, versión, expediente o indicador ya
// no se puede borrar desde la aplicación. Este fichero creaba un sistema real
// por RPC y lo borraba al final confiando en el CASCADE (líneas 70-107 antes
// de esta reescritura); con RESTRICT ese borrado ya no es posible y dejaría
// residuo permanente. Se reescribe según DS-31/E-04
// (docs/superpowers/specs/2026-09-19-aims-cobertura-ria-experto-design.md):
//   * G-VIVO-NEG (aquí, permanente): el INSERT directo se rechaza (no crea
//     nada), y el aislamiento se comprueba con FILAS YA EXISTENTES de cada
//     tenant, no con una fila creada para la ocasión — sin residuo por
//     construcción.
//   * G-VIVO-REV (archivada, no en `bun test`): el alta positiva por RPC y el
//     rechazo del tenant forjado por el cliente, en
//     `docs/superpowers/plans/2026-09-26-moi-210-sonda-revertida-post-restrict.sql`
//     (BEGIN … ROLLBACK), ejecutada por quien tiene permiso de escribir en
//     Cloud y archivada en el ledger.
//
// GOTCHAs del repo que aplican aquí:
//  * Un write cross-tenant filtrado por RLS en UPDATE/DELETE devuelve 0 filas
//    SIN error. En INSERT lo rechaza el WITH CHECK y sí hay error. Se asierta lo
//    que importa —que no aterrice— y se acepta cualquiera de las dos formas.
//  * Toda sonda con más de un cliente necesita `persistSession: false` y
//    `storageKey` propia. `sesionDe` ya lo hace.
//  * Mutar/borrar una fila EXISTENTE desde el tenant ajeno es seguro contra
//    dato real: RLS garantiza 0 filas afectadas, así que no hay escritura
//    efectiva que revertir.
import { beforeAll, describe, expect, it } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEMO_TENANT, GARRIGUES_TENANT, sesionDe } from "../helpers/supabase-test-client";

const MARCA = `PROBE-OWNER-WRITE-G-${crypto.randomUUID()}`;

describe("n=1002 — Garrigues escribe su inventario de IA y sólo lo ve él", () => {
  let arga: SupabaseClient;
  let garr: SupabaseClient;
  let filaArga: string;
  let filaGarr: string;

  beforeAll(async () => {
    // Sin graceful-skip: `sesionDe` lanza y el gate se pone rojo. Una sonda que
    // se autodesactiva cuando no puede autenticar es un verde que no asierta.
    [arga, garr] = await Promise.all([sesionDe("ARGA"), sesionDe("GARRIGUES")]);

    // Filas EXISTENTES de cada tenant (sembradas: ARGA 8, Garrigues 6 a
    // 2026-09-24). Ninguna se crea ni se borra en este fichero.
    const [{ data: propiasArga, error: eArga }, { data: propiasGarr, error: eGarr }] = await Promise.all([
      arga.from("ai_systems").select("id").limit(1),
      garr.from("ai_systems").select("id").limit(1),
    ]);
    if (eArga) throw new Error(`ARGA no pudo leer su propio inventario: ${eArga.message}`);
    if (eGarr) throw new Error(`Garrigues no pudo leer su propio inventario: ${eGarr.message}`);
    if ((propiasArga ?? []).length === 0) throw new Error("ARGA no tiene ningún sistema de IA que usar como fila real");
    if ((propiasGarr ?? []).length === 0) throw new Error("Garrigues no tiene ningún sistema de IA que usar como fila real");
    filaArga = propiasArga![0].id;
    filaGarr = propiasGarr![0].id;
  }, 30_000);

  it("el INSERT directo ya no es el camino: lo rechaza el trigger", async () => {
    const { data, error } = await garr
      .from("ai_systems")
      .insert({ tenant_id: GARRIGUES_TENANT, name: `${MARCA}-DIRECTO`, status: "ACTIVO" })
      .select("id");
    // Sin el trigger (migración sin aplicar) el INSERT aterriza: se borra antes
    // de asertar para que una sonda roja no deje residuo en el inventario.
    for (const fila of data ?? []) await garr.from("ai_systems").delete().eq("id", fila.id);
    expect(error?.message ?? "").toContain("ALTA_SOLO_POR_CUESTIONARIO");
    expect(data ?? []).toEqual([]);
  });

  it("cada tenant ve su propia fila (control positivo del instrumento)", async () => {
    // Sin esto, «el otro no la ve» podría pasar porque la fila no existe, no
    // porque el aislamiento funcione.
    const { data: dGarr, error: eGarr } = await garr.from("ai_systems").select("id, tenant_id").eq("id", filaGarr);
    expect(eGarr).toBeNull();
    expect((dGarr ?? []).map((r) => r.tenant_id)).toEqual([GARRIGUES_TENANT]);

    const { data: dArga, error: eArga } = await arga.from("ai_systems").select("id, tenant_id").eq("id", filaArga);
    expect(eArga).toBeNull();
    expect((dArga ?? []).map((r) => r.tenant_id)).toEqual([DEMO_TENANT]);
  });

  it("ARGA no ve la fila real de Garrigues, y sí ve las suyas", async () => {
    const porId = await arga.from("ai_systems").select("id").eq("id", filaGarr);
    expect(porId.error).toBeNull();
    expect(porId.data ?? [], "la sesión de ARGA alcanza una fila del otro tenant").toEqual([]);

    // Control positivo DEL CLIENTE QUE HACE LA AFIRMACIÓN: si la sesión de ARGA
    // estuviera caída o ciega, la aserción de arriba pasaría por ceguera.
    const suyas = await arga.from("ai_systems").select("id, tenant_id").limit(500);
    expect(suyas.error).toBeNull();
    expect((suyas.data ?? []).length, "ARGA no ve ni su propio inventario").toBeGreaterThan(0);
    expect((suyas.data ?? []).every((r) => r.tenant_id === DEMO_TENANT)).toBe(true);
  });

  it("Garrigues no ve la fila real de ARGA, y sí ve las suyas", async () => {
    const porId = await garr.from("ai_systems").select("id").eq("id", filaArga);
    expect(porId.error).toBeNull();
    expect(porId.data ?? [], "la sesión de Garrigues alcanza una fila de ARGA").toEqual([]);

    const suyas = await garr.from("ai_systems").select("id, tenant_id").limit(500);
    expect(suyas.error).toBeNull();
    expect((suyas.data ?? []).length, "Garrigues no ve ni su propio inventario").toBeGreaterThan(0);
    expect((suyas.data ?? []).every((r) => r.tenant_id === GARRIGUES_TENANT)).toBe(true);
  });

  it("ARGA no puede mutar ni borrar la fila real de Garrigues (0 filas, sin dato tocado)", async () => {
    // GOTCHA: RLS filtra las filas → 0 afectadas y SIN 42501. Se lee la
    // descripción ANTES para probar, después de intentar la mutación, que no
    // cambió — sin tocar una columna que el trigger de clasificación vigile.
    const { data: antes } = await garr.from("ai_systems").select("description").eq("id", filaGarr).single();

    const mutacion = await arga
      .from("ai_systems").update({ description: "PROBE-DENY-CROSS-MOI-210" }).eq("id", filaGarr).select();
    expect(mutacion.error).toBeNull();
    expect(mutacion.data ?? []).toEqual([]);

    const borrado = await arga.from("ai_systems").delete().eq("id", filaGarr).select();
    expect(borrado.error).toBeNull();
    expect(borrado.data ?? []).toEqual([]);

    // Y la fila real de Garrigues sigue exactamente igual.
    const { data: despues } = await garr.from("ai_systems").select("id, description").eq("id", filaGarr).single();
    expect(despues?.id).toBe(filaGarr);
    expect(despues?.description ?? null).toBe(antes?.description ?? null);
  });
});
