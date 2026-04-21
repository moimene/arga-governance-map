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
