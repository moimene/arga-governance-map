// src/lib/secretaria/__tests__/baseline-plantillas.test.ts
import { describe, it, expect } from "vitest";
import { hasDemoCredentials, sesionDe, DEMO_TENANT } from "@/test/helpers/supabase-test-client";

const SNAPSHOT_DATE = "2026-05-12";

/**
 * MOI-192 (2026-09-26). Este baseline era `it.todo` porque pedía
 * `supabaseAdmin` (service_role), y el helper lee `SUPABASE_SERVICE_ROLE_KEY`
 * mientras el `.env` del proyecto solo define `SERVICE_ROLE_SECRET` —GOTCHA
 * medido el 2026-09-05, nunca se llegó a comprobar si valía la pena arreglarlo
 * porque la regla del proyecto prohíbe correr tests con service_role contra
 * `governance_OS` (memoria `feedback_no_vitest_admin_cloud.md`). Decisión A
 * del issue: sonda de SOLO LECTURA con la sesión demo autenticada
 * (`sesionDe("ARGA")`, RLS real, el mismo camino que usa la app en
 * `usePlantillasProtegidas.ts`), no `service_role`. Salta si faltan
 * credenciales demo (`hasDemoCredentials`); si las hay y el login falla,
 * `sesionDe` lanza — no hay paso silencioso.
 */
const CREDENCIALES_DISPONIBLES = hasDemoCredentials("ARGA");
const FALTAN_CREDENCIALES = "requiere DEMO_PASSWORD_ARGA en .env";

describe.skipIf(CREDENCIALES_DISPONIBLES)("baseline plantillas — sin credenciales", () => {
  it.todo(`baseline de plantillas no ejecutado: ${FALTAN_CREDENCIALES}`);
});

describe.skipIf(!CREDENCIALES_DISPONIBLES)(`baseline plantillas (snapshot ${SNAPSHOT_DATE}, solo lectura)`, () => {
  it("catálogo ARGA mantiene 41+ ACTIVA con metadata", async () => {
    const arga = await sesionDe("ARGA");
    const { data, error } = await arga
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
    const arga = await sesionDe("ARGA");
    const { data } = await arga
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
