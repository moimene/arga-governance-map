// src/test/schema/canonical-triggers.test.ts
/**
 * Canonical triggers — schema guardrails (T9 onwards).
 *
 * First per-task file of this phase (T5–T8 accumulated into canonical-model.test.ts).
 * Verifies DDL under supabase/migrations/20260421_000019_modelo_canonico_base.sql
 * landed on cloud project `hzqwefkwsxopwrmtksbg`.
 *
 * T9 covers CA-7: censo_snapshot is an append-only WORM table — UPDATE and DELETE
 * must raise an exception whose message contains "inmutable". The FK to
 * audit_worm_trail(id) is explicitly deferred to T11 (audit_worm_id stays
 * NULL-able without a FK until then).
 *
 * Runtime env: requires VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in
 * `.env.local`. Without those, `hasAdminClient()` returns false and every
 * describe block is skipped. We verify via PostgREST-compatible probes because
 * the `execute_sql` RPC is not exposed on this project.
 *
 * DEMO_ENTITY_ARGA (00000000-0000-0000-0000-000000000010) is not yet bootstrapped
 * in entities on Cloud (T14 will do that). Tests that depend on inserting a
 * snapshot row soft-skip with a visible console.warn when the entity is absent,
 * matching the T5/T6/T7/T8 hardening pattern. The structural probe test is
 * unconditional so we can still verify the migration file matches Cloud shape
 * even without DEMO_ENTITY_ARGA.
 */
import { describe, it, expect, beforeAll } from "vitest";
import {
  supabaseAdmin,
  hasAdminClient,
  DEMO_TENANT,
  DEMO_ENTITY_ARGA,
} from "../helpers/supabase-test-client";

describe.skipIf(!hasAdminClient())(
  "Canonical triggers — T9 censo_snapshot inmutabilidad",
  () => {
    // Sentinel UUIDs — T9 uses the eeeeeeee-* prefix so it never collides with
    // T5 (aaaa), T6 (bbbb), T7 (cccc), or T8 (dddd). meeting_id has no FK on
    // censo_snapshot (verified in the DDL: UUID NOT NULL without REFERENCES),
    // so a synthetic sentinel is safe for the insert that seeds the suite.
    const MEETING_SENTINEL = "eeeeeeee-0000-0000-0000-000000000001";

    // Populated in beforeAll only when DEMO_ENTITY_ARGA is present. The
    // UPDATE/DELETE tests early-return when snapshotId is still null.
    let snapshotId: string | null = null;
    let entityPresent = false;

    beforeAll(async () => {
      if (!supabaseAdmin) return;

      // Visible soft-skip: DEMO_ENTITY_ARGA is not yet bootstrapped on Cloud
      // (T14). Without it, the FK entity_id -> entities(id) blocks the insert
      // and every test in the block fails with an FK violation masked as
      // unrelated error. Skip loudly so the debt stays visible.
      const { data: entityCheck } = await supabaseAdmin
        .from("entities")
        .select("id")
        .eq("id", DEMO_ENTITY_ARGA)
        .limit(1);
      if (!entityCheck || entityCheck.length === 0) {
        console.warn(
          "[T9] Skipping censo_snapshot trigger tests — DEMO_ENTITY_ARGA absent. " +
          "T14 bootstrap will unblock."
        );
        return;
      }
      entityPresent = true;

      const { data, error } = await supabaseAdmin
        .from("censo_snapshot")
        .insert({
          tenant_id: DEMO_TENANT,
          meeting_id: MEETING_SENTINEL,
          session_kind: "MEETING",
          entity_id: DEMO_ENTITY_ARGA,
          body_id: null,
          snapshot_type: "ECONOMICO",
          payload: [{ test: true }],
          total_partes: 1,
        })
        .select("id")
        .single();
      if (error) throw error;
      snapshotId = data.id;
    });

    // Structural probe — runs unconditionally. Verifies that the migration
    // file matches the live Cloud shape, even in environments where
    // DEMO_ENTITY_ARGA hasn't been bootstrapped. Selects ALL columns in the
    // same order as the CREATE TABLE statement so a rename/drop is caught
    // immediately. `.limit(0)` returns an empty set without scanning, so a
    // clean `error === null` implies PostgREST sees every column.
    it("structural: censo_snapshot exposes all declared columns (PostgREST probe)", async () => {
      const { error } = await supabaseAdmin!
        .from("censo_snapshot")
        .select(
          "id,tenant_id,meeting_id,session_kind,entity_id,body_id,snapshot_type,payload,capital_total_base,total_partes,audit_worm_id,created_at"
        )
        .limit(0);
      expect(error).toBeNull();
    });

    it("CA-7: UPDATE en censo_snapshot lanza excepción", async () => {
      if (!entityPresent || !snapshotId) {
        console.warn(
          "[T9] Skipping UPDATE CA-7 test — beforeAll soft-skipped (DEMO_ENTITY_ARGA absent)."
        );
        return;
      }
      const { error } = await supabaseAdmin!
        .from("censo_snapshot")
        .update({ total_partes: 99 })
        .eq("id", snapshotId);
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/inmutable/i);
    });

    it("CA-7: DELETE en censo_snapshot lanza excepción", async () => {
      if (!entityPresent || !snapshotId) {
        console.warn(
          "[T9] Skipping DELETE CA-7 test — beforeAll soft-skipped (DEMO_ENTITY_ARGA absent)."
        );
        return;
      }
      const { error } = await supabaseAdmin!
        .from("censo_snapshot")
        .delete()
        .eq("id", snapshotId);
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/inmutable/i);
    });
  }
);
