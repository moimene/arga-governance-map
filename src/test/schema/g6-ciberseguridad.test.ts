// src/test/schema/g6-ciberseguridad.test.ts
// G6 — Riesgo TIC, ciberseguridad, SGSI (ISO 27001 + ENS) y marco NIS2 en el tenant Garrigues.
// Verificaciones en Cloud (Supabase) con contrato cero-cambio para ARGA.
import { describe, expect, it, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { GARRIGUES_TENANT, DEMO_TENANT, sesionDe } from "../helpers/supabase-test-client";
import { OBLIGACIONES_CIBER, CONTROLES_CIBER } from "../../../scripts/garrigues/normativo/obligaciones-ciber";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://hzqwefkwsxopwrmtksbg.supabase.co";
// GOTCHA: `VITE_SUPABASE_ANON_KEY` NO EXISTE en este repo — el .env nombra la
// clave `ANON_PUBLIC`/`PUBLISHABLE_KEY`. 17 de las 19 sondas del proyecto viven
// del literal de reserva de la 3ª rama; G5 y G6 copiaron la línea SIN el `||` y
// su bloque Cloud entero pasaba en verde SIN ASERTAR NADA: medido, 1213 de 1807
// aserciones desaparecían en silencio. No quitar ninguna de las tres ramas.
// La clave anon es pública por diseño (quien protege es RLS); no es un secreto.
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.ANON_PUBLIC ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cXdlZmt3c3hvcHdybXRrc2JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Mjc1MDMsImV4cCI6MjA5MjAwMzUwM30.IZ2FbhQLp2ljRcsvsvzpLWQ9cq9p5Lz4dJfVzY3whjQ";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "TGMSdemo2026!";
const ARGA_EMAIL = process.env.DEMO_EMAIL || "demo@arga-seguros.com";
const PERSIST_OFF = { auth: { persistSession: false } } as const;

describe("G6 — Catálogo congelado Ciberseguridad y SGSI", () => {
  it("tiene 7 obligaciones con códigos y fuentes exactas", () => {
    expect(OBLIGACIONES_CIBER).toHaveLength(7);
    const codes = OBLIGACIONES_CIBER.map((o) => o.code);
    expect(new Set(codes).size).toBe(7);
    expect(codes).toContain("OBL-GARR-CYBER-01");
    expect(codes).toContain("OBL-GARR-CYBER-02");
    expect(codes).toContain("OBL-GARR-NIS2-01");
  });

  it("las obligaciones NIS2 están explícitamente marcadas como prospectivas y asignadas a EAD Trust", () => {
    const nis2 = OBLIGACIONES_CIBER.filter((o) => o.code.includes("NIS2"));
    expect(nis2).toHaveLength(2);
    for (const o of nis2) {
      expect(o.prospectiva).toBe(true);
      expect(o.sujeto_obligado).toContain("EAD Trust");
      expect(o.title).toContain("Prospectivo");
    }
  });

  it("tiene 7 controles operativos reales (CTR-GARR-29..35) trazados a sus políticas", () => {
    expect(CONTROLES_CIBER).toHaveLength(7);
    const codes = CONTROLES_CIBER.map((c) => c.code);
    expect(new Set(codes).size).toBe(7);
    expect(codes).toEqual([
      "CTR-GARR-29",
      "CTR-GARR-30",
      "CTR-GARR-31",
      "CTR-GARR-32",
      "CTR-GARR-33",
      "CTR-GARR-34",
      "CTR-GARR-35",
    ]);
  });
});

describe("G6 — Ciberseguridad y SGSI en Cloud (Supabase)", () => {
  let garr: SupabaseClient | null = null;
  let arga: SupabaseClient | null = null;

  beforeAll(async () => {
    // Sesión COMPARTIDA y memoizada (2 logins en toda la suite, no ~40).
    // `sesionDe` LANZA si no puede autenticar: el gate se pone rojo en vez de
    // pasar mudo, que es lo que esta fase vino a cerrar.
    [garr, arga] = await Promise.all([sesionDe("GARRIGUES"), sesionDe("ARGA")]);
    expect(garr, "sin sesión Garrigues el bloque Cloud sería vacuo").not.toBeNull();
    expect(arga, "sin sesión ARGA el control discriminante sería vacuo").not.toBeNull();
  });

  it("el módulo 'cyber' existe en grc_modules para Garrigues", async () => {
    if (!garr) return;
    const { data, error } = await garr
      .from("grc_modules")
      .select("id, name, owner")
      .eq("id", "cyber")
      .maybeSingle();
    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.name).toContain("Ciberseguridad");
    expect(data!.owner).toBe("Comité de Seguridad y Privacidad");
  });

  it("la política PI-26 tiene owner_body_id asignado al Comité de Seguridad y Privacidad", async () => {
    if (!garr) return;
    const { data: body } = await garr
      .from("governing_bodies")
      .select("id")
      .eq("name", "Comité de Seguridad y Privacidad")
      .maybeSingle();
    expect(body).not.toBeNull();

    const { data: pol, error } = await garr
      .from("policies")
      .select("policy_code, title, owner_body_id, owner_function")
      .eq("policy_code", "PI-26")
      .maybeSingle();
    expect(error).toBeNull();
    expect(pol).not.toBeNull();
    expect(pol!.owner_body_id).toBe(body!.id);
    expect(pol!.owner_function).toBe("Comité de Seguridad de la Información y Privacidad");
  });

  it("las 7 obligaciones de Ciberseguridad están sembradas", async () => {
    if (!garr) return;
    const { data, error } = await garr
      .from("obligations")
      .select("code, title, source, legal_reference, periodicity, owner_body_id, policy_id")
      .in("code", OBLIGACIONES_CIBER.map((o) => o.code));
    expect(error).toBeNull();
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(7);
    for (const r of rows) {
      expect(r.owner_body_id).not.toBeNull();
      expect(r.policy_id).not.toBeNull();
      expect(r.legal_reference).not.toBeNull();
    }
  });

  it("las obligaciones ciber sincronizan al backbone como módulo 'cyber' y no 'risk'", async () => {
    if (!garr) return;
    const { data, error } = await garr
      .from("grc_obligations")
      .select("reference, module_id, authority")
      .in("reference", OBLIGACIONES_CIBER.map((o) => o.code));
    expect(error).toBeNull();
    const rows = (data ?? []) as Array<{ reference: string; module_id: string; authority: string | null }>;
    expect(rows).toHaveLength(7);
    for (const r of rows) {
      expect(r.module_id, `la obligación ${r.reference} cayó en ${r.module_id} en vez de cyber`).toBe("cyber");
      expect(r.authority).toBe("CCN-CERT / INCIBE-CERT");
    }
  });

  it("los 7 controles operativos CTR-GARR-29..35 están sembrados", async () => {
    if (!garr) return;
    const { data, error } = await garr
      .from("controls")
      .select("code, name, status, obligation_id, owner_body_id")
      .in("code", CONTROLES_CIBER.map((c) => c.code));
    expect(error).toBeNull();
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(7);
    for (const r of rows) {
      expect(r.obligation_id).not.toBeNull();
      expect(r.owner_body_id).not.toBeNull();
    }
  });

  it("ARGA intacta: su número de obligaciones y controles de ciberseguridad se mantiene", async () => {
    if (!arga) return;
    const { data: oblArga, error: eObl } = await arga
      .from("obligations")
      .select("code")
      .in("code", OBLIGACIONES_CIBER.map((o) => o.code));
    expect(eObl).toBeNull();
    expect(oblArga ?? []).toHaveLength(0);

    const { data: ctrArga, error: eCtr } = await arga
      .from("controls")
      .select("code")
      .in("code", CONTROLES_CIBER.map((c) => c.code));
    expect(eCtr).toBeNull();
    expect(ctrArga ?? []).toHaveLength(0);
  });
});
