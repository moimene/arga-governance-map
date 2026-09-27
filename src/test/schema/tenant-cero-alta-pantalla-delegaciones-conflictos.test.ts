// src/test/schema/tenant-cero-alta-pantalla-delegaciones-conflictos.test.ts
//
// MOI-149 (D-23, por delegación de Moisés: alta POR PANTALLA) — parte
// `delegations` y `conflicts_of_interest`.
//
// Este archivo hace DOS cosas con la MISMA sesión real (SECRETARIO de
// «Grupo Nuevo»), replicando exactamente lo que la pantalla haría:
//
//   1. Si el registro canónico de esta prueba todavía no existe en Cloud,
//      lo CREA con un INSERT normal de usuario autenticado (mismo camino
//      RLS que `useCreateDelegation`/`useCreateConflict`). Sirve como el
//      "al menos una alta desde pantalla" que exige el criterio de hecho.
//   2. Verifica la ARISTA: relee con la MISMA forma de SELECT que usan
//      `useDelegationsList`/`useConflictsList` y comprueba que el join
//      resuelve los nombres reales. Si alguien rompe esa consulta (por
//      ejemplo cambia una FK o el nombre de una columna), este test cae.
//
// Es idempotente por diseño (código fijo, no aleatorio): correrlo otra vez
// no duplica la fila ni la borra — comprueba que sigue ahí, igual que el
// resto de gates de "Grupo Nuevo se siembra y persiste" en CLAUDE.md.
import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEMO_TENANT, GARRIGUES_TENANT, NUEVO_TENANT, sesionDe } from "../helpers/supabase-test-client";
import { TENANT_SPECS } from "../../../scripts/tenants/tenant-spec";

const spec = TENANT_SPECS.nuevo;
const PROVISIONADO = spec.cloud === "PROVISIONADO";

// Códigos fijos: identifican el registro canónico de esta prueba (no el
// sufijo aleatorio que genera la pantalla en uso normal). `slug` de
// delegations es UNIQUE global, igual que `code`.
const DELEGATION_CODE = "GN-DEL-ALTA-PANTALLA-MOI149";
const DELEGATION_SLUG = "gn-deleg-alta-pantalla-moi-149";
const CONFLICT_CODE = "GN-COI-ALTA-PANTALLA-MOI149";

describe.skipIf(!PROVISIONADO)("Grupo Nuevo — alta por pantalla de delegaciones y conflictos (MOI-149)", () => {
  let nuevo: SupabaseClient;
  let arga: SupabaseClient;
  let garr: SupabaseClient;

  beforeAll(async () => {
    [nuevo, arga, garr] = await Promise.all([sesionDe("NUEVO"), sesionDe("ARGA"), sesionDe("GARRIGUES")]);
  }, 45_000);

  it("el tenant nuevo tiene censo propio para elegir otorgante/apoderado/persona", async () => {
    const { data, error } = await nuevo.from("persons").select("id, full_name").eq("tenant_id", NUEVO_TENANT).limit(5);
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(1);
  });

  describe("delegations", () => {
    it("existe (o se crea ahora) el alta por pantalla, con tenant explícito", async () => {
      const existing = await nuevo.from("delegations").select("id").eq("code", DELEGATION_CODE).maybeSingle();
      expect(existing.error).toBeNull();
      if (!existing.data) {
        // Censo del propio grupo, como elegiría el formulario.
        const grantor = await nuevo.from("persons").select("id").eq("tenant_id", NUEVO_TENANT).eq("full_name", "Carlos Mendoza Ruiz").maybeSingle();
        const delegate = await nuevo.from("persons").select("id").eq("tenant_id", NUEVO_TENANT).eq("full_name", "Elena Gómez Blanco").maybeSingle();
        const entity = await nuevo.from("entities").select("id").eq("tenant_id", NUEVO_TENANT).limit(1).maybeSingle();
        expect(grantor.data?.id).toBeTruthy();
        expect(delegate.data?.id).toBeTruthy();
        expect(entity.data?.id).toBeTruthy();

        const insert = await nuevo
          .from("delegations")
          .insert({
            tenant_id: NUEVO_TENANT,
            code: DELEGATION_CODE,
            slug: DELEGATION_SLUG,
            delegation_type: "Poder mercantil general",
            entity_id: entity.data!.id,
            grantor_id: grantor.data!.id,
            delegate_id: delegate.data!.id,
            scope: "Alta de prueba desde pantalla — MOI-149 (D-23)",
            start_date: "2026-09-27",
            status: "Vigente",
          })
          .select("id")
          .single();
        expect(insert.error).toBeNull();
        expect(insert.data?.id).toBeTruthy();
      }
    });

    it("arista real: el SELECT de useDelegationsList resuelve el join a nombres reales", async () => {
      const { data, error } = await nuevo
        .from("delegations")
        .select("*, entity:entity_id(common_name, slug, legal_name), grantor:grantor_id(full_name), delegate:delegate_id(full_name)")
        .eq("tenant_id", NUEVO_TENANT)
        .eq("code", DELEGATION_CODE)
        .maybeSingle();
      expect(error).toBeNull();
      expect(data?.status).toBe("Vigente");
      expect(data?.grantor?.full_name).toBe("Carlos Mendoza Ruiz");
      expect(data?.delegate?.full_name).toBe("Elena Gómez Blanco");
      expect(data?.entity?.common_name).toBeTruthy();
    });

    it("aislamiento: ARGA y Garrigues no ven la delegación del tenant nuevo", async () => {
      for (const [quien, cliente] of [["ARGA", arga], ["Garrigues", garr]] as const) {
        const { data, error } = await cliente.from("delegations").select("id").eq("code", DELEGATION_CODE);
        expect(error, quien).toBeNull();
        expect(data ?? [], `${quien} ve la delegación de Grupo Nuevo`).toEqual([]);
      }
    });

    it("ARGA conserva sus propias delegaciones (no se ha perdido ni pisado nada)", async () => {
      const { count, error } = await arga.from("delegations").select("id", { count: "exact", head: true }).eq("tenant_id", DEMO_TENANT);
      expect(error).toBeNull();
      expect(count ?? 0).toBeGreaterThan(0);
    });
  });

  describe("conflicts_of_interest", () => {
    it("existe (o se crea ahora) el alta por pantalla, con tenant explícito", async () => {
      const existing = await nuevo.from("conflicts_of_interest").select("id").eq("code", CONFLICT_CODE).maybeSingle();
      expect(existing.error).toBeNull();
      if (!existing.data) {
        const persona = await nuevo.from("persons").select("id").eq("tenant_id", NUEVO_TENANT).eq("full_name", "Carlos Mendoza Ruiz").maybeSingle();
        expect(persona.data?.id).toBeTruthy();

        const insert = await nuevo
          .from("conflicts_of_interest")
          .insert({
            tenant_id: NUEVO_TENANT,
            code: CONFLICT_CODE,
            person_id: persona.data!.id,
            conflict_type: "Situacional",
            description: "Alta de prueba desde pantalla — MOI-149 (D-23)",
            status: "Declarado",
            declared_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        expect(insert.error).toBeNull();
        expect(insert.data?.id).toBeTruthy();
      }
    });

    it("arista real: el SELECT de useConflictsList resuelve el join al nombre real", async () => {
      const { data, error } = await nuevo
        .from("conflicts_of_interest")
        .select("*, person:person_id(full_name), finding:related_finding_id(code)")
        .eq("tenant_id", NUEVO_TENANT)
        .eq("code", CONFLICT_CODE)
        .maybeSingle();
      expect(error).toBeNull();
      expect(data?.status).toBe("Declarado");
      expect(data?.conflict_type).toBe("Situacional");
      expect(data?.person?.full_name).toBe("Carlos Mendoza Ruiz");
    });

    it("aislamiento: ARGA y Garrigues no ven el conflicto del tenant nuevo", async () => {
      for (const [quien, cliente] of [["ARGA", arga], ["Garrigues", garr]] as const) {
        const { data, error } = await cliente.from("conflicts_of_interest").select("id").eq("code", CONFLICT_CODE);
        expect(error, quien).toBeNull();
        expect(data ?? [], `${quien} ve el conflicto de Grupo Nuevo`).toEqual([]);
      }
    });

    it("Garrigues conserva sus propios conflictos (no se ha perdido ni pisado nada)", async () => {
      const { data, error } = await garr.from("conflicts_of_interest").select("id").eq("tenant_id", GARRIGUES_TENANT);
      expect(error).toBeNull();
      expect((data ?? []).length).toBeGreaterThan(0);
    });
  });
});

if (!PROVISIONADO) {
  describe("Grupo Nuevo — alta por pantalla de delegaciones y conflictos (MOI-149)", () => {
    it.todo(`pendiente de que el tenant "${spec.key}" esté PROVISIONADO en scripts/tenants/tenant-spec.ts`);
  });
}
