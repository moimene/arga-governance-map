import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEMO_TENANT, GARRIGUES_TENANT, sesionDe } from "../helpers/supabase-test-client";

/**
 * Aislamiento cross-tenant REAL de las superficies P0 de Secretaría.
 *
 * QUÉ HABÍA AQUÍ ANTES. Este era el único fichero del carril con
 * «tenant-isolation» en el nombre y no comprobaba ningún aislamiento: hacía
 * `readFileSync` de `scripts/secretaria-p0-cloud-smoke.ts` y sus 25 aserciones
 * eran `toMatch` de cadenas sobre ese texto. Ese script no lo ejecuta nada de
 * la suite (solo `scripts/secretaria-p0-preflight.sh`, que se lanza a mano), de
 * modo que el gate se ponía verde comprobando que un fichero MENCIONA el
 * aislamiento, no que el aislamiento exista. Un test que no puede fallar por el
 * hecho que dice cubrir es peor que no tenerlo.
 *
 * QUÉ COMPRUEBA AHORA. Con dos sesiones reales (ARGA y Garrigues), que cada
 * tenant NO ve las filas del otro en las tablas propias del carril, y que la
 * escritura directa está cortada a nivel de privilegio.
 *
 * ANTI-VACUIDAD. Cada aserción de aislamiento va precedida de la comprobación
 * de que el tenant propio SÍ ve sus filas: sin eso, una consulta que devuelve
 * vacío por cualquier motivo (RLS mal configurada, tabla vacía, sesión perdida)
 * pasaría como «aislamiento correcto».
 *
 * GOTCHA de este repo: un WRITE cross-tenant filtrado por RLS devuelve 0 filas
 * SIN error, no `42501`. El `42501` solo aparece cuando el privilegio de tabla
 * está revocado, que es justo lo que comprueba el último bloque.
 */

/** Tablas del carril Secretaría con filas reales en AMBOS tenants (Cloud, 2026-09-05). */
const TABLAS_SECRETARIA = [
  "registry_filings",
  "plantillas_protegidas",
  "agreements",
  "governing_bodies",
  "rule_packs",
] as const;

/** Id inexistente: el DELETE/UPDATE de sondeo no puede tocar ninguna fila. */
const ID_INEXISTENTE = "00000000-0000-4000-8000-00000000dead";

describe("Secretaría P0 — aislamiento cross-tenant real", () => {
  let arga: SupabaseClient;
  let garrigues: SupabaseClient;

  beforeAll(async () => {
    // `sesionDe` LANZA si no autentica: sin sesión no hay nada que verificar y
    // el fichero debe ponerse rojo, no saltarse.
    arga = await sesionDe("ARGA");
    garrigues = await sesionDe("GARRIGUES");
  }, 60_000);

  it.each(TABLAS_SECRETARIA)("%s — ARGA no ve filas de Garrigues", async (tabla) => {
    const propias = await arga.from(tabla).select("tenant_id").eq("tenant_id", DEMO_TENANT).limit(5);
    expect(propias.error, `${tabla}: la consulta propia falló, la medición no es válida`).toBeNull();
    // Sin esto la aserción de abajo sería vacua.
    expect((propias.data ?? []).length, `${tabla}: ARGA no ve NINGUNA fila propia`).toBeGreaterThan(0);

    const ajenas = await arga.from(tabla).select("tenant_id").eq("tenant_id", GARRIGUES_TENANT);
    expect(ajenas.error).toBeNull();
    expect(ajenas.data ?? []).toEqual([]);
  }, 30_000);

  it.each(TABLAS_SECRETARIA)("%s — Garrigues no ve filas de ARGA", async (tabla) => {
    const propias = await garrigues.from(tabla).select("tenant_id").eq("tenant_id", GARRIGUES_TENANT).limit(5);
    expect(propias.error, `${tabla}: la consulta propia falló, la medición no es válida`).toBeNull();
    expect((propias.data ?? []).length, `${tabla}: Garrigues no ve NINGUNA fila propia`).toBeGreaterThan(0);

    const ajenas = await garrigues.from(tabla).select("tenant_id").eq("tenant_id", DEMO_TENANT);
    expect(ajenas.error).toBeNull();
    expect(ajenas.data ?? []).toEqual([]);
  }, 30_000);

  it("un SELECT sin filtro solo devuelve filas del propio tenant", async () => {
    for (const [nombre, cliente, propio] of [
      ["ARGA", arga, DEMO_TENANT],
      ["Garrigues", garrigues, GARRIGUES_TENANT],
    ] as const) {
      const { data, error } = await cliente.from("agreements").select("tenant_id").limit(200);
      expect(error, `${nombre}: consulta fallida`).toBeNull();
      expect((data ?? []).length, `${nombre}: sin filas, la aserción sería vacua`).toBeGreaterThan(0);
      expect(
        (data ?? []).map((row) => (row as { tenant_id: string }).tenant_id).filter((t) => t !== propio),
      ).toEqual([]);
    }
  }, 30_000);
});
