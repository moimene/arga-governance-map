import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sesionDe } from "../helpers/supabase-test-client";

// ITEM-029/043 [P1] loop estabilización Secretaría (2026-06-11).
// authority_evidence arrastraba 12 cargos fantasma VIGENTES (AE sin
// condiciones_persona VIGENTE de respaldo cargo-a-cargo): 2 PRESIDENTE y 2
// SECRETARIO en el CdA canónico y presidentes duplicados en las comisiones,
// haciendo no determinista el Vº Bº que precarga EmitirCertificacionButton
// (arts. 109-111 RRM). La migración 20260611183000 cesa los fantasmas y crea
// el índice único parcial ux_authority_evidence_pres_sec_vigente. Este test
// bloquea la regresión contra Cloud.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://hzqwefkwsxopwrmtksbg.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cXdlZmt3c3hvcHdybXRrc2JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Mjc1MDMsImV4cCI6MjA5MjAwMzUwM30.IZ2FbhQLp2ljRcsvsvzpLWQ9cq9p5Lz4dJfVzY3whjQ";
const DEMO_EMAIL = process.env.DEMO_EMAIL || "demo@arga-seguros.com";
const ARGA_ENTITY = "6d7ed736-f263-4531-a59d-c6ca0cd41602";
const CDA_BODY = "fe05ddd9-ce3e-47b0-8948-5b975c79ab59";

describe("authority_evidence — integridad de cargos VIGENTES (ITEM-029/043)", () => {
  let client: SupabaseClient | null = null;
  let authed = false;

  beforeAll(async () => {
    try {
      // Sesión COMPARTIDA: la suite entera hace 2 logins en vez de ~40, y cada
      // cuenta lleva storageKey propio. `sesionDe` lanza si no autentica.
      client = await sesionDe("ARGA");
      authed = true;
    } catch (error) {
      authed = false;
      // UN LOGIN FALLIDO NO ES «NADA QUE COMPROBAR». Al tragarse la excepción,
      // cada `it` de abajo caía en `if (!authed) { expect(true).toBe(true); return; }`
      // y la sonda Cloud terminaba VERDE sin asertar nada: rotar una contraseña
      // o caerse Cloud dejaba el gate en verde mudo. `sesionDe` ya lanza con el
      // motivo; aquí se propaga para que el fichero se ponga ROJO.
      throw error;
    }
  }, 30_000);

  // SIN afterAll con signOut: la sesión es COMPARTIDA. Cerrarla aquí dejaría sin
  // autenticar a todas las sondas que corran después — y el síntoma no es un
  // error de login, son consultas que devuelven vacío y aserciones que fallan
  // en un fichero que no ha hecho nada mal.

  it("ningún órgano de ARGA tiene PRESIDENTE ni SECRETARIO VIGENTE duplicado", async () => {
    if (!authed || !client) {
      expect(true).toBe(true);
      return;
    }
    const { data, error } = await client
      .from("authority_evidence")
      .select("body_id, cargo")
      .eq("entity_id", ARGA_ENTITY)
      .eq("estado", "VIGENTE")
      .in("cargo", ["PRESIDENTE", "SECRETARIO"]);
    expect(error).toBeNull();
    const counts = new Map<string, number>();
    for (const row of (data ?? []) as Array<{ body_id: string | null; cargo: string }>) {
      const key = `${row.body_id ?? "null"}::${row.cargo}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const duplicated = [...counts.entries()].filter(([, n]) => n > 1);
    expect(duplicated).toEqual([]);
  }, 30_000);

  it("el CdA canónico tiene exactamente 1 PRESIDENTE y 1 SECRETARIO vigentes", async () => {
    if (!authed || !client) {
      expect(true).toBe(true);
      return;
    }
    const { data, error } = await client
      .from("authority_evidence")
      .select("cargo")
      .eq("entity_id", ARGA_ENTITY)
      .eq("body_id", CDA_BODY)
      .eq("estado", "VIGENTE")
      .in("cargo", ["PRESIDENTE", "SECRETARIO"]);
    expect(error).toBeNull();
    const cargos = ((data ?? []) as Array<{ cargo: string }>).map((r) => r.cargo).sort();
    expect(cargos).toEqual(["PRESIDENTE", "SECRETARIO"]);
  }, 30_000);
});
