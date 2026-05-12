// src/lib/secretaria/__tests__/baseline-plantillas.test.ts
import { describe, it, expect } from "vitest";
import { supabaseAdmin, hasAdminClient, DEMO_TENANT } from "@/test/helpers/supabase-test-client";

const SNAPSHOT_DATE = "2026-05-12";

describe.skipIf(!hasAdminClient())(`baseline plantillas (snapshot ${SNAPSHOT_DATE})`, () => {
  it("catálogo ARGA mantiene 41+ ACTIVA con metadata", async () => {
    const { data, error } = await supabaseAdmin!
      .from("plantillas_protegidas")
      .select("id, estado, organo_tipo, aprobada_por, referencia_legal, fecha_aprobacion")
      .eq("tenant_id", DEMO_TENANT);
    expect(error).toBeNull();

    const rows = data ?? [];
    const activas = rows.filter((r) => r.estado === "ACTIVA");

    expect(activas.length).toBeGreaterThanOrEqual(41);
    expect(activas.every((r) => r.organo_tipo !== null)).toBe(true);

    const firmadas = activas.filter(
      (r) =>
        r.aprobada_por !== null &&
        r.aprobada_por !== "" &&
        !/^(falta|pendiente)/i.test(r.aprobada_por as string),
    );
    expect(firmadas.length).toBeGreaterThanOrEqual(41);
    expect(firmadas.every((r) => r.referencia_legal !== null && r.fecha_aprobacion !== null)).toBe(true);
  });

  it("no hay duplicados funcionales activos", async () => {
    const { data } = await supabaseAdmin!
      .from("plantillas_protegidas")
      .select("tipo, jurisdiccion, materia, materia_acuerdo, organo_tipo, adoption_mode")
      .eq("tenant_id", DEMO_TENANT)
      .eq("estado", "ACTIVA");

    const seen = new Map<string, number>();
    for (const r of data ?? []) {
      const key = [
        r.tipo,
        r.jurisdiccion,
        r.materia_acuerdo ?? r.materia ?? "",
        r.organo_tipo,
        r.adoption_mode ?? "",
      ].join("|");
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    const dups = [...seen.entries()].filter(([, n]) => n > 1);
    expect(dups).toEqual([]);
  });
});
