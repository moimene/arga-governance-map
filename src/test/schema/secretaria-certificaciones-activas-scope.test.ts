// src/test/schema/secretaria-certificaciones-activas-scope.test.ts
/**
 * Sonda viva de solo lectura para el catálogo de tipos de certificación autónoma.
 *
 * Vigila que en el tenant ARGA (DEMO_TENANT):
 *  1. 0 tipos activos tengan `requires_qes === true`.
 *  2. 0 tipos activos sean excluidos por `certificationKindExclusion` (no afirmen
 *     envío, entrega electrónica certificada, ERDS, QES ni sello de tiempo).
 *  3. Los tres tipos de certificación desactivados (`CERT_ENVIO_CONVOCATORIA`,
 *     `CERT_ERDS_ENTREGA`, `CERT_COMUNICACIONES_REGULATORIAS`) siguen existiendo
 *     en el histórico con `is_active === false`.
 *  4. Control positivo: existen tipos activos legítimos (p. ej. `CERT_ACUERDO_360`,
 *     `CERT_CAP_TABLE_FECHA`), asegurando que la consulta no devuelve vacío espurio.
 *  5. Tenant Garrigues (GARRIGUES_TENANT) mantiene su catálogo vacío.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEMO_TENANT,
  GARRIGUES_TENANT,
  sesionDe,
} from "../helpers/supabase-test-client";
import {
  certificationKindExclusion,
  type CertificationKindScopeInput,
} from "../../lib/secretaria/certification-kind-scope";

const MIGRATION_PATH = join(
  process.cwd(),
  "supabase/migrations/20260925100000_secretaria_desactivar_tipos_certificacion_envio_qes.sql",
);

describe("Sonda viva · Catálogo de tipos de certificación de Secretaría (MOI-145)", () => {
  let argaClient: SupabaseClient;

  beforeAll(async () => {
    argaClient = await sesionDe("ARGA");
  });

  it("la migración de desactivación existe en disco con las aserciones preceptivas", () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true);
    const content = readFileSync(MIGRATION_PATH, "utf8");
    expect(content).toContain("CERT_ENVIO_CONVOCATORIA");
    expect(content).toContain("CERT_ERDS_ENTREGA");
    expect(content).toContain("CERT_COMUNICACIONES_REGULATORIAS");
    expect(content).toContain("is_active = false");
    expect(content).toContain("RAISE EXCEPTION");
  });

  it("control positivo: el catálogo de ARGA contiene tipos activos legítimos", async () => {
    const { data, error } = await argaClient
      .from("standalone_certification_kinds")
      .select("kind_code, label, is_active, requires_qes")
      .eq("tenant_id", DEMO_TENANT)
      .eq("is_active", true);

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect((data ?? []).length).toBeGreaterThanOrEqual(35);

    const codes = (data ?? []).map((row) => row.kind_code);
    expect(codes).toContain("CERT_ACUERDO_360");
    expect(codes).toContain("CERT_CAP_TABLE_FECHA");
    expect(codes).toContain("CERT_COMPOSICION_ORGANO");
  });

  it("ningún tipo activo en ARGA exige firma electrónica cualificada (requires_qes = true)", async () => {
    const { data, error } = await argaClient
      .from("standalone_certification_kinds")
      .select("kind_code, label, is_active, requires_qes")
      .eq("tenant_id", DEMO_TENANT)
      .eq("is_active", true)
      .eq("requires_qes", true);

    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  it("ningún tipo activo en ARGA es rechazado por certificationKindExclusion (política EAD Trust)", async () => {
    const { data, error } = await argaClient
      .from("standalone_certification_kinds")
      .select("kind_code, label, is_active, requires_qes")
      .eq("tenant_id", DEMO_TENANT)
      .eq("is_active", true);

    expect(error).toBeNull();
    const activos = (data ?? []) as CertificationKindScopeInput[];
    const excluidos = activos.filter((k) => certificationKindExclusion(k) !== null);

    expect(excluidos).toHaveLength(0);
  });

  it("los tres tipos desestimados siguen existiendo en el histórico pero con is_active = false", async () => {
    const { data, error } = await argaClient
      .from("standalone_certification_kinds")
      .select("kind_code, label, is_active, requires_qes")
      .eq("tenant_id", DEMO_TENANT)
      .in("kind_code", [
        "CERT_ENVIO_CONVOCATORIA",
        "CERT_ERDS_ENTREGA",
        "CERT_COMUNICACIONES_REGULATORIAS",
      ]);

    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(3);

    for (const row of data ?? []) {
      expect(row.is_active).toBe(false);
    }
  });

  it("aislamiento: el catálogo de tipos de certificación de Garrigues permanece vacío", async () => {
    const garriguesClient = await sesionDe("GARRIGUES");
    const { data, error } = await garriguesClient
      .from("standalone_certification_kinds")
      .select("kind_code")
      .eq("tenant_id", GARRIGUES_TENANT);

    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });
});
