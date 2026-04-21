// src/test/schema/canonical-functions.test.ts
/**
 * Canonical functions — schema guardrails (T10 onwards).
 *
 * Second per-task file for Phase 0+1 (T9 lives in canonical-triggers.test.ts;
 * T5–T8 accumulated into canonical-model.test.ts). Verifies DDL under
 * supabase/migrations/20260421_000019_modelo_canonico_base.sql landed on cloud
 * project `hzqwefkwsxopwrmtksbg`.
 *
 * T10 covers CA-5 and CA-9:
 *   - CA-5: a socio with voting_rights=true and is_treasury=false produces a
 *     CAPITAL-source row in parte_votante_current with positive
 *     denominator_weight.
 *   - CA-9: a capital_holdings row with is_treasury=true produces voting_weight
 *     AND denominator_weight both 0 — autocartera is stripped from the voting
 *     base per LSC art. 148.
 *
 * Runtime env: requires VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in
 * `.env.local`. Without those, `hasAdminClient()` returns false and every
 * describe block is skipped. We verify via PostgREST-compatible probes and
 * RPC calls because the `execute_sql` RPC is not exposed on this project.
 *
 * DEMO_ENTITY_ARGA (00000000-0000-0000-0000-000000000010) is not yet
 * bootstrapped in entities on Cloud (T14 will do that). Behavioral tests
 * (CA-5 / CA-9) soft-skip with a visible console.warn when the entity is
 * absent, matching the T5/T6/T7/T8/T9 hardening pattern. Structural tests
 * that call the RPC with a random UUID run unconditionally so we can still
 * verify the function is deployed even without DEMO_ENTITY_ARGA.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  supabaseAdmin,
  hasAdminClient,
  DEMO_TENANT,
  DEMO_ENTITY_ARGA,
} from "../helpers/supabase-test-client";

describe.skipIf(!hasAdminClient())(
  "Canonical functions — T10 fn_refresh_parte_votante_entity/_body",
  () => {
    // Sentinel UUIDs — T10 uses the ffffffff-* prefix so it never collides with
    // T5 (aaaa), T6 (bbbb), T7 (cccc), T8 (dddd), or T9 (eeee). Per-task prefix
    // convention keeps cleanup narrow and the origin of every sentinel obvious.
    const PERSON_ID = "ffffffff-0000-0000-0000-000000000001";

    // Populated in beforeAll only when DEMO_ENTITY_ARGA is present. The
    // CA-5 / CA-9 behavioral tests early-return with a visible warn when
    // this stays false.
    let entityPresent = false;

    // Inline ensurePerson helper — same vocabulary as T5/T6/T7/T8 (`person_type: 'PF'`,
    // TEST-prefix tax_id derived from the full UUID hex). Kept self-contained so
    // this describe block matches the convention and doesn't depend on test-file
    // ordering. Upsert with ignoreDuplicates so reruns are idempotent.
    async function ensurePerson(id: string, fullName: string) {
      const { error } = await supabaseAdmin!
        .from("persons")
        .upsert(
          {
            id,
            tenant_id: DEMO_TENANT,
            full_name: fullName,
            person_type: "PF",
            tax_id: `TEST-${id.replace(/-/g, "").slice(0, 12).toUpperCase()}`,
          },
          { onConflict: "id", ignoreDuplicates: true }
        );
      expect(error).toBeNull();
    }

    beforeAll(async () => {
      if (!supabaseAdmin) return;

      // Visible soft-skip: DEMO_ENTITY_ARGA is not yet bootstrapped on Cloud
      // (T14). Without it, the capital_holdings FK entity_id -> entities(id)
      // fails and the whole setup chain collapses with an FK error. Skip
      // loudly so the debt stays visible in CI.
      const { data: entityCheck } = await supabaseAdmin
        .from("entities")
        .select("id")
        .eq("id", DEMO_ENTITY_ARGA)
        .limit(1);
      if (!entityCheck || entityCheck.length === 0) {
        console.warn(
          "[T10] Skipping behavioral tests — DEMO_ENTITY_ARGA absent. " +
          "T14 bootstrap will unblock."
        );
        return;
      }
      entityPresent = true;

      // Seed the holder person + a single VIGENTE capital_holdings row.
      // CA-5 asserts this produces a CAPITAL-source voting row; CA-9
      // overrides it with is_treasury=true and asserts weights are 0.
      await ensurePerson(PERSON_ID, "Test Holder T10");

      // Clean slate — remove any holdings from a prior run (the ux_capital_holdings_vigente
      // partial unique index would otherwise reject the fresh insert).
      await supabaseAdmin
        .from("capital_holdings")
        .delete()
        .eq("holder_person_id", PERSON_ID);
    });

    afterAll(async () => {
      if (!supabaseAdmin) return;
      // Cleanup order per T10 hardening convention (see plan Deviation 7):
      //   1. Delete parte_votante_current rows first (generated projection,
      //      harmless — T10 refresh function will regenerate on next call).
      //   2. Delete capital_holdings rows by holder_person_id (narrower than
      //      entity_id, so we never stomp seed data or other tests' rows).
      //   3. Do NOT delete the person — left as idempotent sentinel (T7/T8
      //      convention: upsert makes re-seeding free).
      await supabaseAdmin
        .from("parte_votante_current")
        .delete()
        .eq("person_id", PERSON_ID);
      await supabaseAdmin
        .from("capital_holdings")
        .delete()
        .eq("holder_person_id", PERSON_ID);
    });

    // ---------------------------------------------------------------------
    // Structural tests — run unconditionally.
    // These verify the RPC is deployed and callable without requiring
    // DEMO_ENTITY_ARGA. Calling with a random UUID that has no capital_holdings
    // / condiciones_persona matches is a valid no-op: the function DELETE-
    // then-INSERTs, and with zero input rows the INSERT writes zero rows.
    // ---------------------------------------------------------------------

    it("structural: fn_refresh_parte_votante_entity is deployed and callable", async () => {
      const { error } = await supabaseAdmin!.rpc(
        "fn_refresh_parte_votante_entity",
        {
          // Random UUID guaranteed to have no capital_holdings rows.
          p_entity_id: "99999999-0000-0000-0000-000000000099",
        }
      );
      expect(error).toBeNull();
    });

    it("structural: fn_refresh_parte_votante_body is deployed and callable", async () => {
      const { error } = await supabaseAdmin!.rpc(
        "fn_refresh_parte_votante_body",
        {
          // Random UUID guaranteed to have no condiciones_persona rows.
          p_body_id: "99999999-0000-0000-0000-000000000099",
        }
      );
      expect(error).toBeNull();
    });

    // ---------------------------------------------------------------------
    // Behavioral tests — depend on DEMO_ENTITY_ARGA.
    // Each test soft-skips with console.warn when entityPresent is false,
    // matching the T5/T7/T8/T9 hardening pattern.
    // ---------------------------------------------------------------------

    it("CA-5: socio sin cargo aparece como CAPITAL en parte_votante_current", async () => {
      if (!entityPresent) {
        console.warn(
          "[T10] CA-5 skipped — DEMO_ENTITY_ARGA absent. T14 bootstrap will unblock."
        );
        return;
      }

      // Pre-cleanup: remove holdings AND any generated parte_votante_current
      // rows for this holder from prior iterations. The refresh function
      // idempotently DELETE-then-INSERTs based on entity_id, so stale
      // projection rows never survive, but holdings would block reinsert.
      await supabaseAdmin!
        .from("capital_holdings")
        .delete()
        .eq("holder_person_id", PERSON_ID);

      // VIGENTE capital holding: socio with voting rights, not treasury.
      const { error: insertErr } = await supabaseAdmin!
        .from("capital_holdings")
        .insert({
          tenant_id: DEMO_TENANT,
          entity_id: DEMO_ENTITY_ARGA,
          holder_person_id: PERSON_ID,
          numero_titulos: 1000,
          porcentaje_capital: 50,
          voting_rights: true,
          effective_from: "2026-01-01",
        });
      expect(insertErr).toBeNull();

      // Invoke the refresh RPC — it DELETE-then-INSERTs rows in
      // parte_votante_current where entity_id = p_entity_id AND body_id IS NULL.
      const { error } = await supabaseAdmin!.rpc(
        "fn_refresh_parte_votante_entity",
        { p_entity_id: DEMO_ENTITY_ARGA }
      );
      expect(error).toBeNull();

      // Verify: one CAPITAL-source row for this holder with positive
      // denominator_weight. source_type = 'CAPITAL' distinguishes junta-level
      // voters (vs 'CARGO' for consejo-level); body_id IS NULL for junta scope.
      const { data } = await supabaseAdmin!
        .from("parte_votante_current")
        .select("source_type, voting_weight, denominator_weight")
        .eq("entity_id", DEMO_ENTITY_ARGA)
        .eq("person_id", PERSON_ID)
        .is("body_id", null);

      expect(data).toHaveLength(1);
      expect(data![0].source_type).toBe("CAPITAL");
      // NUMERIC → string via PostgREST; coerce with Number() for comparison.
      expect(Number(data![0].denominator_weight)).toBeGreaterThan(0);
      expect(Number(data![0].voting_weight)).toBeGreaterThan(0);
    });

    it("CA-9: is_treasury=true produce voting_weight=0 y denominator_weight=0", async () => {
      if (!entityPresent) {
        console.warn(
          "[T10] CA-9 skipped — DEMO_ENTITY_ARGA absent. T14 bootstrap will unblock."
        );
        return;
      }

      // Replace the CA-5 holding with a treasury one. Delete first to avoid
      // ux_capital_holdings_vigente colliding (same entity + holder + null
      // share_class + both VIGENTE).
      await supabaseAdmin!
        .from("capital_holdings")
        .delete()
        .eq("holder_person_id", PERSON_ID);

      const { error: insertErr } = await supabaseAdmin!
        .from("capital_holdings")
        .insert({
          tenant_id: DEMO_TENANT,
          entity_id: DEMO_ENTITY_ARGA,
          holder_person_id: PERSON_ID,
          numero_titulos: 500,
          porcentaje_capital: 5,
          voting_rights: true,
          is_treasury: true, // autocartera — weights must be stripped to 0
          effective_from: "2026-01-01",
        });
      expect(insertErr).toBeNull();

      const { error } = await supabaseAdmin!.rpc(
        "fn_refresh_parte_votante_entity",
        { p_entity_id: DEMO_ENTITY_ARGA }
      );
      expect(error).toBeNull();

      const { data } = await supabaseAdmin!
        .from("parte_votante_current")
        .select("voting_weight, denominator_weight")
        .eq("entity_id", DEMO_ENTITY_ARGA)
        .eq("person_id", PERSON_ID);

      expect(data).toHaveLength(1);
      // Both weights are NUMERIC → PostgREST serialises as string; Number() coerces.
      expect(Number(data![0].voting_weight)).toBe(0);
      expect(Number(data![0].denominator_weight)).toBe(0);
    });
  }
);

// =====================================================================
// T11: fn_crear_censo_snapshot + WORM trigger integration
// =====================================================================
// T11 orchestrates snapshot creation:
//   1. fn_crear_censo_snapshot(p_meeting_id, p_session_kind, p_entity_id,
//      p_body_id, p_snapshot_type) → UUID
//      - Looks up tenant_id from entities(p_entity_id).
//      - Delegates to fn_refresh_parte_votante_entity(_body) first.
//      - INSERTs a censo_snapshot row aggregating parte_votante_current rows
//        via jsonb_agg + SUM(denominator_weight) + COUNT(*), filtered by
//        source_type matching p_snapshot_type (ECONOMICO↔CAPITAL,
//        POLITICO↔CARGO, UNIVERSAL↔CAPITAL).
//   2. trg_censo_snapshot_worm (BEFORE INSERT): writes an audit_log entry
//      and stores the audit row id back into NEW.audit_worm_id. The hash
//      chain follows the same shape as fn_audit_worm so the chain stays
//      consistent across the app.
//   3. FK fk_censo_snapshot_worm DEFERRABLE INITIALLY DEFERRED, so the FK
//      is satisfied within the same tx when the BEFORE trigger populates
//      NEW.audit_worm_id.
//
// Critical adaptation (documented in detail in the migration): the plan
// references "audit_worm_trail" but the actual audit sink on this project
// is "audit_log". All columns, target table, and chain hash pattern match
// the existing fn_audit_worm. SECURITY DEFINER is required because
// audit_log has RLS enabled with 4 policies.
//
// DEMO_ENTITY_ARGA latent FK debt (T14 bootstrap pending): the behavioral
// test exercises the full path, but fn_crear_censo_snapshot's INSERT into
// censo_snapshot.entity_id FK-fails when the entity is absent. Apply the
// visible-soft-skip pattern established in T7/T8/T9/T10 — structural
// verification via pg_catalog happens on the server (MCP list_migrations
// + pg_proc probe performed before commit), and the behavioral test
// soft-skips cleanly locally with a console.warn when entity is absent.
//
// CLEANUP note: censo_snapshot has T9 WORM triggers that block DELETE
// with RAISE EXCEPTION '... inmutable ...'. Rows this test creates persist
// forever on Cloud. Same trade-off as T9 — acceptable because rows are
// small and distinguishable via the 11111111-* sentinel prefix.
// =====================================================================
describe.skipIf(!hasAdminClient())(
  "Canonical functions — T11 fn_crear_censo_snapshot + WORM",
  () => {
    // T11 sentinel prefix — never collides with T5 (aaaa), T6 (bbbb),
    // T7 (cccc), T8 (dddd), T9 (eeee), T10 (ffff). Per-task prefix convention.
    const MEETING_ID = "11111111-0000-0000-0000-000000000001";
    const HOLDER_PERSON_ID = "11111111-0000-0000-0000-000000000002";

    let entityPresent = false;

    async function ensurePerson(id: string, fullName: string) {
      const { error } = await supabaseAdmin!
        .from("persons")
        .upsert(
          {
            id,
            tenant_id: DEMO_TENANT,
            full_name: fullName,
            person_type: "PF",
            tax_id: `TEST-${id.replace(/-/g, "").slice(0, 12).toUpperCase()}`,
          },
          { onConflict: "id", ignoreDuplicates: true }
        );
      expect(error).toBeNull();
    }

    beforeAll(async () => {
      if (!supabaseAdmin) return;
      const { data: entityCheck } = await supabaseAdmin
        .from("entities")
        .select("id")
        .eq("id", DEMO_ENTITY_ARGA)
        .limit(1);
      if (!entityCheck || entityCheck.length === 0) {
        console.warn(
          "[T11] Skipping behavioral test — DEMO_ENTITY_ARGA absent. " +
          "T14 bootstrap will unblock."
        );
        return;
      }
      entityPresent = true;

      // Seed holder + one VIGENTE capital_holdings row so the snapshot has
      // at least one parte_votante_current entry to aggregate.
      await ensurePerson(HOLDER_PERSON_ID, "Test Holder T11");
      await supabaseAdmin
        .from("capital_holdings")
        .delete()
        .eq("holder_person_id", HOLDER_PERSON_ID);
      const { error: insertErr } = await supabaseAdmin
        .from("capital_holdings")
        .insert({
          tenant_id: DEMO_TENANT,
          entity_id: DEMO_ENTITY_ARGA,
          holder_person_id: HOLDER_PERSON_ID,
          numero_titulos: 2000,
          porcentaje_capital: 25,
          voting_rights: true,
          effective_from: "2026-01-01",
        });
      expect(insertErr).toBeNull();
    });

    afterAll(async () => {
      if (!supabaseAdmin) return;
      // Narrow cleanup — remove projection rows + holdings by holder,
      // never touch censo_snapshot (WORM, DELETE-blocked by T9 trigger).
      await supabaseAdmin
        .from("parte_votante_current")
        .delete()
        .eq("person_id", HOLDER_PERSON_ID);
      await supabaseAdmin
        .from("capital_holdings")
        .delete()
        .eq("holder_person_id", HOLDER_PERSON_ID);
    });

    it("snapshot se crea y se vincula a audit_log vía audit_worm_id", async () => {
      if (!entityPresent) {
        console.warn(
          "[T11] behavioral test skipped — DEMO_ENTITY_ARGA absent. " +
          "T14 bootstrap will unblock."
        );
        return;
      }

      // Refresh the projection first (idempotent — T10 function) so the
      // snapshot aggregation has current data. fn_crear_censo_snapshot
      // also does this internally, but calling it explicitly here mirrors
      // the plan's test narrative and makes the setup chain visible.
      const { error: refreshErr } = await supabaseAdmin!.rpc(
        "fn_refresh_parte_votante_entity",
        { p_entity_id: DEMO_ENTITY_ARGA }
      );
      expect(refreshErr).toBeNull();

      // Call the RPC — ECONOMICO snapshot of a MEETING session, junta
      // scope (body_id = null), returns the new censo_snapshot.id.
      const { data: snapshotId, error } = await supabaseAdmin!.rpc(
        "fn_crear_censo_snapshot",
        {
          p_meeting_id: MEETING_ID,
          p_session_kind: "MEETING",
          p_entity_id: DEMO_ENTITY_ARGA,
          p_body_id: null,
          p_snapshot_type: "ECONOMICO",
        }
      );
      expect(error).toBeNull();
      expect(snapshotId).toBeTruthy();

      // Verify snapshot row: audit_worm_id populated by BEFORE trigger,
      // payload is the jsonb_agg array, total_partes > 0.
      const { data: snap } = await supabaseAdmin!
        .from("censo_snapshot")
        .select("id, audit_worm_id, payload, total_partes")
        .eq("id", snapshotId as string)
        .single();

      expect(snap?.audit_worm_id).toBeTruthy();
      expect(Array.isArray(snap?.payload)).toBe(true);
      expect((snap?.payload as unknown[]).length).toBeGreaterThan(0);
      expect(snap?.total_partes).toBeGreaterThan(0);

      // Verify the audit_log row exists and references back. action,
      // table_name, and hash_sha512 shape-match fn_audit_worm so the
      // chain verify function stays consistent across tables.
      const { data: auditRow } = await supabaseAdmin!
        .from("audit_log")
        .select("id, action, table_name, record_id, hash_sha512")
        .eq("id", snap!.audit_worm_id as string)
        .single();

      expect(auditRow?.action).toBe("CENSO_SNAPSHOT_CREATED");
      expect(auditRow?.table_name).toBe("censo_snapshot");
      expect(auditRow?.record_id).toBe(snapshotId);
      expect(auditRow?.hash_sha512).toBeTruthy();
    });
  }
);
