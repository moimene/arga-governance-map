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
