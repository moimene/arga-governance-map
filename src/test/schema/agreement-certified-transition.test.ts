import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sesionDe } from "../helpers/supabase-test-client";

// ITEM-042 [P1] loop estabilización Secretaría (2026-06-11).
// La vía de certificación desde acta (golden path) no transicionaba los
// agreements a CERTIFIED (asimetría con la vía sin sesión): acuerdos con
// certificación SIGNED quedaban en ADOPTED para siempre. La migración
// 20260611191500 añade la transición en fn_emitir_certificacion + backfill.
// Este test bloquea el INVARIANTE en Cloud: ningún agreement ADOPTED puede
// figurar en el agreements_certified de una certificación SIGNED.
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://hzqwefkwsxopwrmtksbg.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cXdlZmt3c3hvcHdybXRrc2JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Mjc1MDMsImV4cCI6MjA5MjAwMzUwM30.IZ2FbhQLp2ljRcsvsvzpLWQ9cq9p5Lz4dJfVzY3whjQ";
const DEMO_EMAIL = process.env.DEMO_EMAIL || "demo@arga-seguros.com";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("ITEM-042 — invariante: cert SIGNED implica agreement CERTIFIED (o posterior)", () => {
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

  it("ningún agreement ADOPTED figura en una certificación SIGNED", async () => {
    if (!authed || !client) {
      expect(true).toBe(true);
      return;
    }
    const { data: certs, error: certsError } = await client
      .from("certifications")
      .select("id, agreements_certified")
      .eq("signature_status", "SIGNED");
    expect(certsError).toBeNull();

    const certifiedIds = [
      ...new Set(
        ((certs ?? []) as Array<{ agreements_certified: string[] | null }>)
          .flatMap((c) => c.agreements_certified ?? [])
          .filter((ref) => UUID_RE.test(ref))
      ),
    ];
    if (certifiedIds.length === 0) {
      expect(true).toBe(true);
      return;
    }

    const { data: stuck, error: agreementsError } = await client
      .from("agreements")
      .select("id, agreement_kind, status")
      .in("id", certifiedIds)
      .eq("status", "ADOPTED");
    expect(agreementsError).toBeNull();
    expect(stuck ?? []).toEqual([]);
  }, 30_000);
});
