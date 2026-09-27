// src/test/schema/grc-aristas-ia.test.ts
//
// F5.T10 (MOI-175) — tabla puente `grc_ai_links` y RPC `fn_grc_vincular_ia`,
// medidas con logins reales. Requiere aplicada la migración
// 20260928111000_grc_aristas_ia.sql y, para la parte "vivo" (segundo
// describe), el seed `scripts/grc/seed-aristas-ia.ts --commit`: hasta
// entonces ambos describes fallan en rojo, que es lo correcto.
//
// Dos bloques:
//   * G-VIVO-NEG (permanente, sin residuo por construcción): SECRETARIO sin
//     la capacidad GRC_AI_LINK, e INSERT directo sin pasar por la RPC.
//   * Datos sembrados: CTR-GARR-33 enlazado a sus 3 sistemas SIN mover su
//     `obligation_id` nativo, y OBL-GARR-CYBER-02 enlazada al incidente.
import { beforeAll, describe, expect, it } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import { GARRIGUES_TENANT, sesionDe } from "../helpers/supabase-test-client";

describe("grc_ai_links — G-VIVO-NEG (permanente, sin residuo)", () => {
  let garr: SupabaseClient;

  beforeAll(async () => {
    garr = await sesionDe("GARRIGUES");
  }, 30_000);

  it("un INSERT directo en grc_ai_links se rechaza: no hay política de escritura, sólo SELECT", async () => {
    const { data, error } = await garr
      .from("grc_ai_links")
      .insert({
        tenant_id: GARRIGUES_TENANT,
        grc_kind: "CONTROL",
        grc_id: "00000000-0000-0000-0000-000000000000",
        relation: "MITIGA",
      })
      .select("id");
    for (const fila of data ?? []) await garr.from("grc_ai_links").delete().eq("id", (fila as { id: string }).id);
    expect(error, "el INSERT directo debía rechazarse").not.toBeNull();
    expect(data ?? []).toEqual([]);
  });

  it("SECRETARIO (demo@garrigues-demo.dev) no tiene la capacidad GRC_AI_LINK: la RPC lo rechaza", async () => {
    const { data, error } = await garr.rpc("fn_grc_vincular_ia", {
      p_tenant_id: GARRIGUES_TENANT,
      p_grc_kind: "CONTROL",
      p_grc_id: "00000000-0000-0000-0000-000000000000",
      p_relation: "MITIGA",
      p_ai_system_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(error?.message ?? "").toContain("GRC_AI_LINK");
    expect(data ?? null).toBeNull();
  });

  it("la RPC rechaza un grc_kind fuera de las cuatro clases declaradas, incluso sin capacidad (falla antes por capacidad, nunca da de alta)", async () => {
    const { data, error } = await garr.rpc("fn_grc_vincular_ia", {
      p_tenant_id: GARRIGUES_TENANT,
      p_grc_kind: "ALGO_INVENTADO",
      p_grc_id: "00000000-0000-0000-0000-000000000000",
      p_relation: "MITIGA",
      p_ai_system_id: "00000000-0000-0000-0000-000000000000",
    });
    expect(error).not.toBeNull();
    expect(data ?? null).toBeNull();
  });
});

describe("grc_ai_links — sembrado por F5.T10 (vivo, Garrigues)", () => {
  it("CTR-GARR-33 está enlazado a sus 3 sistemas sin mover su obligation_id nativo", async () => {
    const cliente = await sesionDe("GARRIGUES");
    const { data: control, error: errControl } = await cliente
      .from("controls")
      .select("id, obligation_id")
      .eq("tenant_id", GARRIGUES_TENANT)
      .eq("code", "CTR-GARR-33")
      .maybeSingle();
    if (errControl) throw new Error(`lectura controls: ${errControl.message}`);
    expect(control, "CTR-GARR-33 debería existir en Garrigues").not.toBeNull();

    const { data: sistemas, error: errSistemas } = await cliente
      .from("ai_systems")
      .select("id, name")
      .eq("tenant_id", GARRIGUES_TENANT)
      .in("name", ["Harvey – Plataforma de IA generativa legal", "Copilot", "Garrigues GA_IA"]);
    if (errSistemas) throw new Error(`lectura ai_systems: ${errSistemas.message}`);
    expect((sistemas ?? []).length).toBe(3);
    const idsSistemas = new Set((sistemas ?? []).map((s) => s.id as string));

    const { data: enlaces, error: errEnlaces } = await cliente
      .from("grc_ai_links")
      .select("ai_system_id, relation, grc_kind")
      .eq("tenant_id", GARRIGUES_TENANT)
      .eq("grc_kind", "CONTROL")
      .eq("grc_id", control!.id as string);
    if (errEnlaces) throw new Error(`lectura grc_ai_links: ${errEnlaces.message}`);
    const sistemasEnlazados = new Set((enlaces ?? []).map((e) => e.ai_system_id as string));
    for (const id of idsSistemas) {
      expect(sistemasEnlazados.has(id), `CTR-GARR-33 no está enlazado al sistema ${id}`).toBe(true);
    }

    // La FK nativa del control (obligation_id) no se movió: la especificación
    // exige explícitamente "sin mover su obligation_id".
    expect(control!.obligation_id).toBe("77e45ac1-11a4-40d5-8a67-2b840d875a40");
  });

  it("OBL-GARR-CYBER-02 está enlazada al incidente de IA de Garrigues", async () => {
    const cliente = await sesionDe("GARRIGUES");
    const { data: obligacion, error: errObl } = await cliente
      .from("obligations")
      .select("id")
      .eq("tenant_id", GARRIGUES_TENANT)
      .eq("code", "OBL-GARR-CYBER-02")
      .maybeSingle();
    if (errObl) throw new Error(`lectura obligations: ${errObl.message}`);
    expect(obligacion).not.toBeNull();

    const { data: enlaces, error: errEnlaces } = await cliente
      .from("grc_ai_links")
      .select("ai_incident_id, relation")
      .eq("tenant_id", GARRIGUES_TENANT)
      .eq("grc_kind", "OBLIGATION")
      .eq("grc_id", obligacion!.id as string);
    if (errEnlaces) throw new Error(`lectura grc_ai_links: ${errEnlaces.message}`);
    const conIncidente = (enlaces ?? []).filter((e) => e.ai_incident_id !== null);
    expect(conIncidente.length, "OBL-GARR-CYBER-02 debería tener al menos un enlace a un incidente").toBeGreaterThan(0);
  });
});
