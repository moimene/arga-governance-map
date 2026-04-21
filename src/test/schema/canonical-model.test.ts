// src/test/schema/canonical-model.test.ts
/**
 * Canonical identity model — schema guardrails.
 *
 * Verifies migrations under supabase/migrations/20260421_000019_modelo_canonico_base.sql
 * have landed on the cloud project `hzqwefkwsxopwrmtksbg`. Each describe block maps to
 * one task of the Phase 0+1 plan; this file grows as T3..T12 land.
 *
 * Runtime env: requires VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in `.env.local`.
 * Without those, `hasAdminClient()` returns false and every describe block is skipped.
 * We verify via PostgREST-compatible probes because the `execute_sql` RPC is not
 * exposed on this project.
 */
import { describe, it, expect } from "vitest";
import {
  supabaseAdmin,
  hasAdminClient,
  DEMO_TENANT,
  DEMO_ENTITY_ARGA,
} from "../helpers/supabase-test-client";

describe.skipIf(!hasAdminClient())(
  "Canonical model — T2 ALTER entities (person_id + tipo_organo_admin)",
  () => {
    it("entities.person_id and entities.tipo_organo_admin columns exist", async () => {
      // PostgREST returns an error if we select unknown columns. A clean response
      // (error === null) implies both columns are present and PostgREST-visible.
      const { error } = await supabaseAdmin!
        .from("entities")
        .select("id, person_id, tipo_organo_admin")
        .limit(0);
      expect(error).toBeNull();
    });

    it("fk_entities_person_id rejects invalid person references", async () => {
      // A random UUID that cannot exist in persons(id) must trigger the FK.
      const fakePerson = "00000000-0000-0000-0000-0000000fffff";
      const { error } = await supabaseAdmin!.from("entities").insert({
        tenant_id: DEMO_TENANT,
        slug: "test-fk-violation-canonical-t2",
        legal_name: "Test entity (should fail FK)",
        person_id: fakePerson,
      });
      expect(error).not.toBeNull();
      // Must specifically be a foreign-key violation — not any DB error.
      // The loose /violates/ match would also pass on NOT NULL / CHECK /
      // unique violations, which would hide schema regressions.
      expect(error!.message.toLowerCase()).toMatch(
        /foreign key|fk_entities_person_id/
      );
    });

    it("tipo_organo_admin CHECK constraint rejects invalid values", async () => {
      const { error } = await supabaseAdmin!.from("entities").insert({
        tenant_id: DEMO_TENANT,
        slug: "test-check-violation-canonical-t2",
        legal_name: "Test entity (should fail CHECK)",
        tipo_organo_admin: "INVALID_VALUE",
      });
      expect(error).not.toBeNull();
      // Must specifically be a CHECK violation — matches either a generic
      // "check constraint" phrasing, our explicit constraint name, or the
      // column name. Tightened from a bare /check|violates/ to prevent
      // false positives from unrelated DB errors.
      expect(error!.message.toLowerCase()).toMatch(
        /check.*constraint|chk_entities_tipo_organo_admin|tipo_organo_admin/
      );
    });

    // TODO(T14): Once bootstrap assigns person_id to entities during seed,
    // verify ux_entities_person_id prevents two entities sharing a persons(id).
    // For now we skip — proving uniqueness via transient INSERTs without cleanup
    // would dirty the cloud project.
    it.skip(
      "ux_entities_person_id prevents duplicate person_id across entities (verified in T14 bootstrap)",
      async () => {
        // intentionally empty
      }
    );
  }
);

describe.skipIf(!hasAdminClient())(
  "Canonical model — T3 entity_capital_profile",
  () => {
    const entityId = DEMO_ENTITY_ARGA;

    it("entity_capital_profile table exists with required columns", async () => {
      const { error } = await supabaseAdmin!
        .from("entity_capital_profile")
        .select(
          "id, tenant_id, entity_id, capital_escriturado, capital_desembolsado, numero_titulos, valor_nominal, currency, estado, effective_from, effective_to"
        )
        .limit(0);
      expect(error).toBeNull();
    });

    it("estado CHECK constraint rejects invalid values", async () => {
      // clean slate
      await supabaseAdmin!
        .from("entity_capital_profile")
        .delete()
        .eq("entity_id", entityId);

      const { error } = await supabaseAdmin!
        .from("entity_capital_profile")
        .insert({
          tenant_id: DEMO_TENANT,
          entity_id: entityId,
          capital_escriturado: 100000,
          estado: "INVALID_STATE",
          effective_from: "2026-01-01",
        });
      expect(error).not.toBeNull();
      expect(error!.message.toLowerCase()).toMatch(
        /check.*constraint|estado/
      );
    });

    it("ux_entity_capital_vigente rejects two VIGENTE rows for the same entity", async () => {
      // clean slate
      await supabaseAdmin!
        .from("entity_capital_profile")
        .delete()
        .eq("entity_id", entityId);

      const { error: err1 } = await supabaseAdmin!
        .from("entity_capital_profile")
        .insert({
          tenant_id: DEMO_TENANT,
          entity_id: entityId,
          capital_escriturado: 100000,
          effective_from: "2026-01-01",
          // estado defaults to VIGENTE
        });
      expect(err1).toBeNull();

      const { error: err2 } = await supabaseAdmin!
        .from("entity_capital_profile")
        .insert({
          tenant_id: DEMO_TENANT,
          entity_id: entityId,
          capital_escriturado: 200000,
          effective_from: "2026-06-01",
        });
      expect(err2).not.toBeNull();
      expect(err2!.message.toLowerCase()).toMatch(
        /ux_entity_capital_vigente|unique|duplicate/
      );

      // cleanup for next test
      await supabaseAdmin!
        .from("entity_capital_profile")
        .delete()
        .eq("entity_id", entityId);
    });

    it("allows one VIGENTE + multiple HISTORICO rows for the same entity", async () => {
      await supabaseAdmin!
        .from("entity_capital_profile")
        .delete()
        .eq("entity_id", entityId);

      // HISTORICO — one
      const { error: errH1 } = await supabaseAdmin!
        .from("entity_capital_profile")
        .insert({
          tenant_id: DEMO_TENANT,
          entity_id: entityId,
          capital_escriturado: 50000,
          effective_from: "2024-01-01",
          effective_to: "2024-12-31",
          estado: "HISTORICO",
        });
      expect(errH1).toBeNull();

      // HISTORICO — two
      const { error: errH2 } = await supabaseAdmin!
        .from("entity_capital_profile")
        .insert({
          tenant_id: DEMO_TENANT,
          entity_id: entityId,
          capital_escriturado: 75000,
          effective_from: "2025-01-01",
          effective_to: "2025-12-31",
          estado: "HISTORICO",
        });
      expect(errH2).toBeNull();

      // VIGENTE — only one allowed
      const { error: errV } = await supabaseAdmin!
        .from("entity_capital_profile")
        .insert({
          tenant_id: DEMO_TENANT,
          entity_id: entityId,
          capital_escriturado: 100000,
          effective_from: "2026-01-01",
        });
      expect(errV).toBeNull();

      // cleanup
      await supabaseAdmin!
        .from("entity_capital_profile")
        .delete()
        .eq("entity_id", entityId);
    });
  }
);
