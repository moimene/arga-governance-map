// src/test/schema/garrigues-ia-owner-write.test.ts
//
// n=1002 — el owner-write de AI Governance y su aislamiento, medidos de verdad.
//
// POR QUÉ HACE FALTA OTRO FICHERO
// ------------------------------
// `tenant-isolation.test.ts` vigila 9 tablas `ai_*`/`aims_*`, y en la dirección
// «ARGA no ve filas de Garrigues» las nueve son HOY vacuas: Garrigues tiene 0
// filas (medido en Cloud el 2026-09-07: `ai_systems` 8 filas, todas de ARGA;
// `ai_incidents` 1, de ARGA). Esa vacuidad está declarada con su motivo en
// `src/test/garrigues/aislamiento-declarado.ts`, así que no está oculta — pero
// declarada o no, una aserción vacua no prueba aislamiento.
//
// Y el módulo AI Governance ESCRIBE: `/ai-governance/sistemas/nuevo` es
// owner-write sobre `ai_systems`. Nadie comprobaba ni que el segundo tenant
// pueda escribir su propio inventario —con las políticas originales del repo,
// que cableaban ARGA, no podría— ni que lo que escriba quede fuera del alcance
// del otro.
//
// Este gate crea UNA fila propia, marcada, y la borra. No siembra inventario de
// IA de Garrigues: el catálogo de `scripts/garrigues/ia/` sigue sin sembrarse y
// esto no lo adelanta.
//
// GOTCHAs del repo que aplican aquí:
//  * Un write cross-tenant filtrado por RLS en UPDATE/DELETE devuelve 0 filas
//    SIN error. En INSERT es distinto: lo rechaza el WITH CHECK y sí hay error.
//    Se asierta lo que importa —que no aterrice— y se acepta cualquiera de las
//    dos formas.
//  * Toda sonda con más de un cliente necesita `persistSession: false` y
//    `storageKey` propia. `sesionDe` ya lo hace; por eso no se crean clientes
//    aquí a mano.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEMO_TENANT,
  GARRIGUES_TENANT,
  sesionDe,
} from "../helpers/supabase-test-client";

/** Marca única por ejecución: dos corridas simultáneas no se pisan. */
const MARCA = `PROBE-OWNER-WRITE-G-${crypto.randomUUID()}`;
const MARCA_FORJADA = `${MARCA}-FORJADO`;

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
    // Limpieza SIEMPRE, aunque una aserción haya fallado. Si el borrado no se
    // pudiera hacer, se dice en voz alta: una fila de sonda que se queda
    // contamina el recuento de la siguiente medición.
    if (!creado || !garr) return;
    const { error } = await garr.from("ai_systems").delete().eq("id", creado);
    if (error) throw new Error(`la sonda dejó la fila ${creado} sin borrar: ${error.message}`);
    const { data } = await garr.from("ai_systems").select("id").eq("id", creado);
    if ((data ?? []).length > 0) throw new Error(`la fila ${creado} sigue viva tras el DELETE`);
  }, 30_000);

  it("el owner-write del tenant nuevo funciona sobre su propia tabla", async () => {
    const { data, error } = await garr
      .from("ai_systems")
      .insert({ tenant_id: GARRIGUES_TENANT, name: MARCA, status: "ACTIVO" })
      .select("id, tenant_id, name");
    expect(error, `Garrigues no puede dar de alta un sistema de IA propio: ${error?.message}`)
      .toBeNull();
    expect((data ?? []).length, "el INSERT no devolvió la fila").toBe(1);
    expect(data![0].tenant_id).toBe(GARRIGUES_TENANT);
    creado = data![0].id;
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
    // GOTCHA: RLS filtra las filas → 0 afectadas y SIN 42501.
    const mutacion = await arga
      .from("ai_systems").update({ name: "PROBE-DENY-CROSS" }).eq("id", creado!).select();
    expect(mutacion.error).toBeNull();
    expect(mutacion.data ?? []).toEqual([]);

    const borrado = await arga.from("ai_systems").delete().eq("id", creado!).select();
    expect(borrado.error).toBeNull();
    expect(borrado.data ?? []).toEqual([]);

    // Y la fila sigue intacta para su dueño.
    const { data } = await garr.from("ai_systems").select("name").eq("id", creado!);
    expect((data ?? []).map((r) => r.name)).toEqual([MARCA]);
  });

  it("un INSERT con el tenant del otro no cuela", async () => {
    const forjado = await garr
      .from("ai_systems")
      .insert({ tenant_id: DEMO_TENANT, name: MARCA_FORJADA, status: "ACTIVO" })
      .select("id");
    // Se acepta cualquiera de las dos formas de negativa (error del WITH CHECK
    // o cero filas), pero NO que aterrice.
    expect(forjado.data ?? [], "el INSERT forjado devolvió fila").toEqual([]);

    const enArga = await arga.from("ai_systems").select("id").eq("name", MARCA_FORJADA);
    expect(enArga.error).toBeNull();
    expect(
      enArga.data ?? [],
      "una sesión de Garrigues ha escrito una fila en el inventario de IA de ARGA",
    ).toEqual([]);
  });
});
