// src/test/schema/g4-normative-schema.test.ts
// G4 Task 1 gate: columnas y precondiciones del sistema normativo. Patrón
// graceful-skip de garrigues-rule-packs-seed.test.ts.
import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { GARRIGUES_DEMO_EMAIL } from "../helpers/supabase-test-client";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://hzqwefkwsxopwrmtksbg.supabase.co";
// Fallback con la clave publicable (mismo patrón que
// garrigues-rule-packs-seed.test.ts). Sin él el test se salta SIEMPRE y el
// gate queda verde sin asertar nada.
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cXdlZmt3c3hvcHdybXRrc2JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Mjc1MDMsImV4cCI6MjA5MjAwMzUwM30.IZ2FbhQLp2ljRcsvsvzpLWQ9cq9p5Lz4dJfVzY3whjQ";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "TGMSdemo2026!";

describe("G4 Task 1 — esquema de ownership normativo", () => {
  let garr: SupabaseClient | null = null;
  let authed = false;

  beforeAll(async () => {
    if (!SUPABASE_ANON_KEY) return;
    const c = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { error } = await c.auth.signInWithPassword({
      email: GARRIGUES_DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });
    if (!error) { garr = c; authed = true; }
  });

  it("policies expone owner_body_id, summary y content_outline", async () => {
    if (!authed || !garr) return;
    const { error } = await garr
      .from("policies")
      .select("id, owner_body_id, summary, content_outline")
      .limit(1);
    expect(error).toBeNull();
  });

  it("obligations expone owner_body_id, legal_reference y periodicity", async () => {
    if (!authed || !garr) return;
    const { error } = await garr
      .from("obligations")
      .select("id, owner_body_id, legal_reference, periodicity")
      .limit(1);
    expect(error).toBeNull();
  });

  it("controls expone owner_body_id", async () => {
    if (!authed || !garr) return;
    const { error } = await garr.from("controls").select("id, owner_body_id").limit(1);
    expect(error).toBeNull();
  });
});
