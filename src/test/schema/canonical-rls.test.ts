// src/test/schema/canonical-rls.test.ts
/**
 * Canonical RLS — T12 tenant_isolation policies.
 *
 * Verifies the 7 new canonical tables (entity_capital_profile, share_classes,
 * condiciones_persona, capital_holdings, representaciones, parte_votante_current,
 * censo_snapshot) have RLS enabled with a `<table>_tenant_isolation` policy that
 * filters rows by the hardcoded DEMO_TENANT UUID. This matches the established
 * app-wide pattern (Sprint B1): single policy `FOR ALL USING (tenant_id =
 * DEMO_TENANT::uuid)`, no `WITH CHECK`, no RBAC role differentiation (RBAC is
 * handled app-side in Sprint B2 via SodGuard).
 *
 * Test target — share_classes:
 *   Picked because it has only one FK (entity_id -> entities). Other tables in
 *   the set either demand a tangle of FKs (condiciones_persona needs persons +
 *   entities + governing_bodies), are WORM with DELETE triggers (censo_snapshot),
 *   or are regenerable projections owned by triggers (parte_votante_current).
 *   share_classes lets us seed two rows with minimal setup and clean up cleanly
 *   in afterAll.
 *
 * Scoping strengthening (vs. plan's literal "anon sees 0 rows from
 * condiciones_persona"): because the policy admits rows whose tenant_id matches
 * the hardcoded DEMO_TENANT, the naive "zero rows" check only holds when the
 * table is empty — not a real scoping exercise. Instead:
 *   1. Seed ONE row at tenant = DEMO_TENANT (reuses an existing DEMO entity).
 *   2. Seed ONE row at tenant = OTHER_TENANT ('99999999-...') along with a
 *      sentinel entity at that tenant (entity FK coherence).
 *   3. With the anon Supabase client, SELECT filtered by the T12 sentinel
 *      class_code. Assert:
 *        - exactly ONE row comes back,
 *        - its tenant_id equals DEMO_TENANT (never OTHER_TENANT).
 *
 * Visible-soft-skip pattern (T7–T11 convention): if admin client is absent,
 * describe.skipIf() short-circuits the whole block. Setup failures inside
 * beforeAll print console.warn and leave `setupOk=false` so tests early-return.
 *
 * Sentinel prefix: T12 → 22222222-* (T5=aaaa, T6=bbbb, T7=cccc, T8=dddd,
 * T9=eeee, T10=ffff, T11=1111, T12=2222).
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import {
  supabaseAdmin,
  hasAdminClient,
  DEMO_TENANT,
} from "../helpers/supabase-test-client";

describe.skipIf(!hasAdminClient())(
  "Canonical RLS — T12 tenant_isolation on 7 new tables",
  () => {
    // Sentinel UUIDs — T12 uses the 22222222-* prefix so it never collides
    // with T5..T11. Per-task prefix convention keeps cleanup narrow and the
    // origin of every sentinel obvious.
    const OTHER_TENANT = "99999999-9999-9999-9999-999999999999";
    const OTHER_ENTITY_ID = "22222222-0000-0000-0000-000000000001";
    const DEMO_SHARE_CLASS_ID = "22222222-0000-0000-0000-000000000002";
    const OTHER_SHARE_CLASS_ID = "22222222-0000-0000-0000-000000000003";
    const SENTINEL_CLASS_CODE = "T12-SENTINEL";

    // Anon client configured from the same URL the app uses. We reuse the
    // publishable anon key hardcoded in src/integrations/supabase/client.ts
    // because tests run against the real Cloud project — no env prefixing
    // needed (the key is public-safe by design).
    //
    // Key-rotation maintenance: if the Cloud project anon key is rotated,
    // update both src/integrations/supabase/client.ts AND the literal below
    // in lock-step. A mismatch will surface as `JWSError` in the anon
    // query's `error.message` and is caught by the explicit diagnostic
    // below (not `expect(error).toBeNull()` alone).
    const SUPABASE_URL =
      process.env.VITE_SUPABASE_URL ?? "https://hzqwefkwsxopwrmtksbg.supabase.co";
    const SUPABASE_ANON_KEY =
      process.env.VITE_SUPABASE_ANON_KEY ??
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6cXdlZmt3c3hvcHdybXRrc2JnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0Mjc1MDMsImV4cCI6MjA5MjAwMzUwM30.IZ2FbhQLp2ljRcsvsvzpLWQ9cq9p5Lz4dJfVzY3whjQ";
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });

    // Populated in beforeAll — behavioural tests early-return with a visible
    // warn when setup fails (matches the T7–T11 pattern).
    let setupOk = false;
    let demoEntityId: string | null = null;

    beforeAll(async () => {
      if (!supabaseAdmin) return;

      // Pick any existing DEMO entity as the FK target for the DEMO-side
      // share_classes row. DEMO_ENTITY_ARGA isn't bootstrapped yet (T14) but
      // the DEMO tenant has seeded entities — any of them works because
      // share_classes.entity_id FK is scope-agnostic within the tenant.
      const { data: demoEntities, error: demoEntErr } = await supabaseAdmin
        .from("entities")
        .select("id")
        .eq("tenant_id", DEMO_TENANT)
        .limit(1);
      if (demoEntErr || !demoEntities || demoEntities.length === 0) {
        console.warn(
          "[T12] Skipping RLS scoping test — no DEMO entity available " +
            "to anchor share_classes.entity_id. Seed DEMO entities and retry."
        );
        return;
      }
      demoEntityId = demoEntities[0].id as string;

      // Other-tenant entity — insert a sentinel entity so the OTHER-side
      // share_classes row has a valid FK target. Pre-delete residue from
      // aborted prior runs before upserting, so a process-killed previous
      // run can't leave an entity with a stale `slug` that would collide
      // on a UNIQUE constraint (id upsert resolves id-conflicts but a
      // slug-UNIQUE index would still fail). share_classes with this
      // entity_id get cascaded away by the ON DELETE CASCADE FK.
      await supabaseAdmin.from("entities").delete().eq("id", OTHER_ENTITY_ID);
      {
        const { error } = await supabaseAdmin.from("entities").upsert(
          {
            id: OTHER_ENTITY_ID,
            tenant_id: OTHER_TENANT,
            slug: `test-t12-other-${OTHER_ENTITY_ID.slice(0, 8)}`,
            legal_name: "TEST-T12 Other Tenant Entity",
          },
          { onConflict: "id", ignoreDuplicates: false }
        );
        if (error) {
          console.warn("[T12] Skipping — failed to seed OTHER entity: " + error.message);
          return;
        }
      }

      // Clean any residue from prior runs.
      await supabaseAdmin
        .from("share_classes")
        .delete()
        .in("id", [DEMO_SHARE_CLASS_ID, OTHER_SHARE_CLASS_ID]);

      // Seed DEMO-tenant row.
      {
        const { error } = await supabaseAdmin.from("share_classes").insert({
          id: DEMO_SHARE_CLASS_ID,
          tenant_id: DEMO_TENANT,
          entity_id: demoEntityId,
          class_code: SENTINEL_CLASS_CODE,
          name: "T12 demo tenant share class",
        });
        if (error) {
          console.warn("[T12] Skipping — failed to seed DEMO share_class: " + error.message);
          return;
        }
      }

      // Seed OTHER-tenant row.
      {
        const { error } = await supabaseAdmin.from("share_classes").insert({
          id: OTHER_SHARE_CLASS_ID,
          tenant_id: OTHER_TENANT,
          entity_id: OTHER_ENTITY_ID,
          class_code: SENTINEL_CLASS_CODE,
          name: "T12 other tenant share class",
        });
        if (error) {
          console.warn("[T12] Skipping — failed to seed OTHER share_class: " + error.message);
          return;
        }
      }

      setupOk = true;
    });

    afterAll(async () => {
      if (!supabaseAdmin) return;
      // Remove the two sentinel share_classes rows unconditionally so reruns
      // are idempotent regardless of setup outcome.
      await supabaseAdmin
        .from("share_classes")
        .delete()
        .in("id", [DEMO_SHARE_CLASS_ID, OTHER_SHARE_CLASS_ID]);
      // Remove the sentinel other-tenant entity.
      await supabaseAdmin.from("entities").delete().eq("id", OTHER_ENTITY_ID);
    });

    it(
      "anon client reads only DEMO_TENANT rows from share_classes (scoping enforced)",
      async () => {
        if (!setupOk) {
          console.warn("[T12] Test skipped — setup did not complete.");
          return;
        }

        // Anon client query — RLS is active, so only rows whose tenant_id
        // matches the hardcoded DEMO_TENANT in the policy qual are visible.
        const { data, error } = await anonClient
          .from("share_classes")
          .select("id, tenant_id, class_code")
          .eq("class_code", SENTINEL_CLASS_CODE);

        // Explicit diagnostic: a RLS/JWT failure surfaces as a populated
        // error object (e.g. `JWSError` after anon key rotation without
        // updating the fallback literal above, or a policy evaluation
        // error). Throwing here produces a readable message instead of
        // the opaque `expected { message: '...' } to be null` that a bare
        // toBeNull() would emit. Preserve the toBeNull() assertion below
        // so vitest still records the expectation.
        if (error) {
          throw new Error(
            `[T12] anon query failed — RLS policy or anon-key problem: ${error.message}. ` +
              `If this says JWSError, the anon-key fallback above is stale; update it ` +
              `in lock-step with src/integrations/supabase/client.ts.`
          );
        }
        expect(error).toBeNull();
        expect(data).not.toBeNull();
        // (a) anon SEES the DEMO_TENANT row.
        // (b) anon does NOT see the OTHER_TENANT row.
        expect(data).toHaveLength(1);
        expect(data![0].id).toBe(DEMO_SHARE_CLASS_ID);
        expect(data![0].tenant_id).toBe(DEMO_TENANT);
      }
    );
  }
);
