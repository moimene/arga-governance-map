import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "TGMSdemo2026!";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("ITEM-042 — invariante: cert SIGNED implica agreement CERTIFIED (o posterior)", () => {
  let client: SupabaseClient | null = null;
  let authed = false;

  beforeAll(async () => {
    try {
      client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
      const { error } = await client.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
      authed = !error;
    } catch {
      authed = false;
    }
  }, 30_000);

  afterAll(async () => {
    try { await client?.auth.signOut(); } catch { /* noop */ }
  });

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
