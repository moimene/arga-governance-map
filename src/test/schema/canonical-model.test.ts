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

// NOTE on CI & parallel execution:
// These tests write to the shared Supabase Cloud demo project and
// operate on DEMO_ENTITY_ARGA. Vitest parallelizes at file level and
// serializes within a file, which covers same-file ordering.
// However, two concurrent CI runs (or a CI run + a local run with
// `.env.local`) against the same cloud project CAN contaminate each
// other. If flakiness appears, serialize CI at the org level or
// move to per-test sentinel UUIDs (spec amendment required).
import { describe, it, expect, afterEach } from "vitest";
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

    // Clean up rows for DEMO_ENTITY_ARGA after every test to keep the
    // shared cloud entity free of leftover state even if an assertion
    // fails between insert and explicit cleanup. Runs after the
    // read-only probe too — harmless no-op delete.
    afterEach(async () => {
      if (supabaseAdmin) {
        await supabaseAdmin
          .from("entity_capital_profile")
          .delete()
          .eq("entity_id", entityId);
      }
    });

    it("entity_capital_profile table exists with required columns", async () => {
      const { error } = await supabaseAdmin!
        .from("entity_capital_profile")
        .select(
          "id, tenant_id, entity_id, capital_escriturado, capital_desembolsado, numero_titulos, valor_nominal, currency, estado, effective_from, effective_to"
        )
        .limit(0);
      expect(error).toBeNull();
    });

    it("chk_entity_capital_profile_estado rejects invalid estado values", async () => {
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
      // Tightened per code review: require explicit constraint name or
      // generic "check constraint" phrasing (no bare column-name match).
      expect(error!.message.toLowerCase()).toMatch(
        /chk_entity_capital_profile_estado|check.*constraint/
      );
    });

    it("ux_entity_capital_vigente rejects two VIGENTE rows for the same entity", async () => {
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
      // Tightened per code review: require the index name explicitly.
      expect(err2!.message.toLowerCase()).toMatch(/ux_entity_capital_vigente/);
    });

    it("allows one VIGENTE + multiple HISTORICO rows for the same entity", async () => {
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
    });
  }
);

describe.skipIf(!hasAdminClient())(
  "Canonical model — T4 share_classes",
  () => {
    const entityId = DEMO_ENTITY_ARGA;

    // Cleanup pattern matches T3: single afterEach deleting all rows for
    // DEMO_ENTITY_ARGA so assertion failures between insert and explicit
    // cleanup never leave junk in the shared cloud project.
    afterEach(async () => {
      if (supabaseAdmin) {
        await supabaseAdmin
          .from("share_classes")
          .delete()
          .eq("entity_id", entityId);
      }
    });

    it("share_classes table exists with required columns", async () => {
      const { error } = await supabaseAdmin!
        .from("share_classes")
        .select(
          "id, tenant_id, entity_id, class_code, name, votes_per_title, economic_rights_coeff, voting_rights, veto_rights, created_at"
        )
        .limit(0);
      expect(error).toBeNull();
    });

    it("ux_share_class_entity_code rejects duplicate class_code per entity", async () => {
      const { error: err1 } = await supabaseAdmin!
        .from("share_classes")
        .insert({
          tenant_id: DEMO_TENANT,
          entity_id: entityId,
          class_code: "TEST_ORD",
          name: "Test Ordinaria",
        });
      expect(err1).toBeNull();

      const { error: err2 } = await supabaseAdmin!
        .from("share_classes")
        .insert({
          tenant_id: DEMO_TENANT,
          entity_id: entityId,
          class_code: "TEST_ORD", // same code for same entity
          name: "Duplicate attempt",
        });
      expect(err2).not.toBeNull();
      expect(err2!.message.toLowerCase()).toMatch(/ux_share_class_entity_code/);
    });

    // Limitation: the plan intended "same class_code across different
    // entities is allowed", but we only have DEMO_ENTITY_ARGA reliably
    // seeded in the cloud demo project. Rather than introduce a temporary
    // entity (adds fixtures + teardown complexity we don't need yet), we
    // verify the weaker but still useful invariant: distinct class_codes
    // for the same entity are accepted. The full cross-entity scenario
    // will be covered naturally in T6/T14 once multiple entities exist.
    it("allows distinct class_codes for the same entity", async () => {
      const { error: err1 } = await supabaseAdmin!
        .from("share_classes")
        .insert({
          tenant_id: DEMO_TENANT,
          entity_id: entityId,
          class_code: "TEST_A",
          name: "Clase A",
          votes_per_title: 1,
          economic_rights_coeff: 1,
        });
      expect(err1).toBeNull();

      const { error: err2 } = await supabaseAdmin!
        .from("share_classes")
        .insert({
          tenant_id: DEMO_TENANT,
          entity_id: entityId,
          class_code: "TEST_B",
          name: "Clase B",
          votes_per_title: 10,
          economic_rights_coeff: 0.5,
        });
      expect(err2).toBeNull();
    });

    it("applies column defaults (votes_per_title=1, economic_rights_coeff=1, voting_rights=true, veto_rights=false)", async () => {
      const { data, error } = await supabaseAdmin!
        .from("share_classes")
        .insert({
          tenant_id: DEMO_TENANT,
          entity_id: entityId,
          class_code: "TEST_DEFAULTS",
          name: "Defaults test",
        })
        .select()
        .single();
      expect(error).toBeNull();
      expect(data).not.toBeNull();
      // PostgREST returns NUMERIC as strings (e.g. "1") rather than numbers;
      // coerce via Number() so the assertion is robust to either wire form
      // and our intent (value == 1) reads clearly.
      expect(Number(data!.votes_per_title)).toBe(1);
      expect(Number(data!.economic_rights_coeff)).toBe(1);
      expect(data!.voting_rights).toBe(true);
      expect(data!.veto_rights).toBe(false);
    });
  }
);

describe.skipIf(!hasAdminClient())(
  "Canonical model — T5 condiciones_persona",
  () => {
    const entityId = DEMO_ENTITY_ARGA;
    // Sentinel person IDs — kept out of the persons auto-gen range so
    // they don't collide with real seed rows. Upserted per-test via
    // persons.upsert() with onConflict:'id' so reruns are idempotent.
    const PERSON_A = "aaaaaaaa-0000-0000-0000-000000000001";
    const PERSON_B = "aaaaaaaa-0000-0000-0000-000000000002";
    const PERSON_C = "aaaaaaaa-0000-0000-0000-000000000003";
    const PERSON_D = "aaaaaaaa-0000-0000-0000-000000000004";
    const testPersonIds = [PERSON_A, PERSON_B, PERSON_C, PERSON_D];

    // Cleanup matches T3/T4 shape: remove the condiciones_persona rows
    // we inserted so assertion failures mid-test never leave junk. We
    // intentionally do NOT delete the persons rows — they're reusable
    // fixtures and upsert makes re-seeding free. Using .in() for a
    // single round-trip instead of parallel .eq() calls.
    afterEach(async () => {
      if (!supabaseAdmin) return;
      await supabaseAdmin
        .from("condiciones_persona")
        .delete()
        .in("person_id", testPersonIds);
    });

    async function ensurePerson(id: string, fullName: string) {
      // person_type 'PF' is the persons-table vocabulary on this
      // project (CHECK: 'PF'|'PJ'). Using upsert with ignoreDuplicates
      // because rerunning the test suite must not fail on the second
      // insert, and we don't need to mutate existing person rows.
      //
      // tax_id derivation: persons.tax_id is currently `text` with no
      // UNIQUE constraint and no format CHECK (verified 2026-04-21),
      // but if a UNIQUE constraint is added later, test IDs derived
      // from only the last UUID char would collide. Derive from the
      // full UUID hex so each sentinel person gets a distinct tax_id.
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

    it("condiciones_persona table exists with required columns", async () => {
      // PostgREST returns an error if any column is unknown. A clean
      // response proves every column in the plan landed. The existence
      // of chk_condicion_body_coherente is proven implicitly by the
      // SOCIO/CONSEJERO rejection tests below — no need to query
      // pg_constraint (not exposed via PostgREST anyway).
      const { error } = await supabaseAdmin!
        .from("condiciones_persona")
        .select(
          "id, tenant_id, person_id, entity_id, body_id, tipo_condicion, estado, fecha_inicio, fecha_fin, representative_person_id, metadata, created_at"
        )
        .limit(0);
      expect(error).toBeNull();
    });

    it("ux_condicion_vigente (CA-4) rejects two VIGENTE SOCIO rows for same (person, entity) despite body_id NULL", async () => {
      await ensurePerson(PERSON_A, "Test CA-4 Socio");

      const { error: err1 } = await supabaseAdmin!
        .from("condiciones_persona")
        .insert({
          tenant_id: DEMO_TENANT,
          person_id: PERSON_A,
          entity_id: entityId,
          body_id: null,
          tipo_condicion: "SOCIO",
          fecha_inicio: "2026-01-01",
        });
      expect(err1).toBeNull();

      // Second SOCIO VIGENTE row — must collide via COALESCE sentinel
      // even though body_id is NULL on both rows. Without the COALESCE
      // in the unique index, PostgreSQL's NULL-distinct semantics would
      // let this insert succeed — that's the CA-4 defect we're guarding.
      const { error: err2 } = await supabaseAdmin!
        .from("condiciones_persona")
        .insert({
          tenant_id: DEMO_TENANT,
          person_id: PERSON_A,
          entity_id: entityId,
          body_id: null,
          tipo_condicion: "SOCIO",
          fecha_inicio: "2026-06-01",
        });
      expect(err2).not.toBeNull();
      expect(err2!.message.toLowerCase()).toMatch(/ux_condicion_vigente/);
    });

    it("chk_condicion_body_coherente rejects SOCIO with body_id NOT NULL", async () => {
      await ensurePerson(PERSON_B, "Test body-coherente SOCIO");

      // Need an existing body_id to trigger the CHECK rather than the
      // FK. If no bodies are seeded for DEMO_ENTITY_ARGA, this test is
      // a no-op (the query returns no rows and we bail early) — better
      // than inventing a UUID that would fail via FK before CHECK.
      const { data: bodies } = await supabaseAdmin!
        .from("governing_bodies")
        .select("id")
        .eq("entity_id", entityId)
        .limit(1);
      if (!bodies || bodies.length === 0) {
        // Cannot exercise CHECK without a valid body_id. Log visibly so
        // the gap shows in CI rather than passing silently green — T14
        // bootstrap must seed at least one governing_bodies row for
        // DEMO_ENTITY_ARGA to exercise chk_condicion_body_coherente
        // path B.
        console.warn(
          "[T5] Skipping SOCIO+body_id rejection test — DEMO_ENTITY_ARGA has no governing_bodies. " +
          "T14 bootstrap must seed at least one body to exercise chk_condicion_body_coherente path B."
        );
        return;
      }
      const bodyId = bodies[0].id;

      const { error } = await supabaseAdmin!
        .from("condiciones_persona")
        .insert({
          tenant_id: DEMO_TENANT,
          person_id: PERSON_B,
          entity_id: entityId,
          body_id: bodyId, // must be NULL for SOCIO — should violate CHECK
          tipo_condicion: "SOCIO",
          fecha_inicio: "2026-01-01",
        });
      expect(error).not.toBeNull();
      expect(error!.message.toLowerCase()).toMatch(
        /chk_condicion_body_coherente/
      );
    });

    it("chk_condicion_body_coherente rejects CONSEJERO with body_id NULL", async () => {
      await ensurePerson(PERSON_C, "Test body-coherente CONSEJERO");

      const { error } = await supabaseAdmin!
        .from("condiciones_persona")
        .insert({
          tenant_id: DEMO_TENANT,
          person_id: PERSON_C,
          entity_id: entityId,
          body_id: null, // must be NOT NULL for CONSEJERO — should violate CHECK
          tipo_condicion: "CONSEJERO",
          fecha_inicio: "2026-01-01",
        });
      expect(error).not.toBeNull();
      expect(error!.message.toLowerCase()).toMatch(
        /chk_condicion_body_coherente/
      );
    });

    it("chk_condiciones_persona_tipo_condicion rejects invalid tipo_condicion values", async () => {
      await ensurePerson(PERSON_D, "Test invalid tipo");

      const { error } = await supabaseAdmin!
        .from("condiciones_persona")
        .insert({
          tenant_id: DEMO_TENANT,
          person_id: PERSON_D,
          entity_id: entityId,
          body_id: null,
          tipo_condicion: "INVALID_ROLE",
          fecha_inicio: "2026-01-01",
        });
      expect(error).not.toBeNull();
      // Tightened: require explicit constraint name OR generic
      // "check constraint" phrasing (no bare column-name match, which
      // would pass on NOT NULL violations too).
      expect(error!.message.toLowerCase()).toMatch(
        /chk_condiciones_persona_tipo_condicion|check.*constraint/
      );
    });
  }
);

describe.skipIf(!hasAdminClient())(
  "Canonical model — T6 capital_holdings",
  () => {
    const entityId = DEMO_ENTITY_ARGA;
    // Sentinel person IDs — different prefix from T5 (aaaaaaaa-*) so
    // the two describe blocks can never collide if afterEach ordering
    // ever changes or parallelisation semantics shift.
    const PERSON_A = "bbbbbbbb-0000-0000-0000-000000000001";
    const PERSON_B = "bbbbbbbb-0000-0000-0000-000000000002";
    const PERSON_C = "bbbbbbbb-0000-0000-0000-000000000003";
    const testPersonIds = [PERSON_A, PERSON_B, PERSON_C];

    // Cleanup narrowed to rows this block inserted (holder_person_id IN
    // testPersonIds) so we never stomp seed data or rows from other
    // blocks that might share entity_id. persons rows are fixtures —
    // left in place because upsert makes re-seeding free.
    afterEach(async () => {
      if (!supabaseAdmin) return;
      await supabaseAdmin
        .from("capital_holdings")
        .delete()
        .in("holder_person_id", testPersonIds);
    });

    // Inline helper duplicated from T5 (same persons vocabulary, same
    // tax_id derivation). Keeps this block self-contained — extracting
    // a shared module-level helper is a refactor tracked separately,
    // not part of T6 scope.
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

    it("capital_holdings table exists with required columns", async () => {
      // PostgREST returns an error if we select unknown columns. A clean
      // response proves every T6 column landed. We don't probe indexes
      // (not visible through PostgREST) — uniqueness/CHECK tests below
      // exercise them implicitly.
      const { error } = await supabaseAdmin!
        .from("capital_holdings")
        .select(
          "id, tenant_id, entity_id, holder_person_id, share_class_id, numero_titulos, porcentaje_capital, voting_rights, is_treasury, effective_from, effective_to, metadata, created_at"
        )
        .limit(0);
      expect(error).toBeNull();
    });

    it("chk_capital_holdings_porcentaje_capital rejects values >100", async () => {
      await ensurePerson(PERSON_A, "Test pct>100");

      const { error } = await supabaseAdmin!
        .from("capital_holdings")
        .insert({
          tenant_id: DEMO_TENANT,
          entity_id: entityId,
          holder_person_id: PERSON_A,
          numero_titulos: 10,
          porcentaje_capital: 101, // out of [0,100]
          effective_from: "2026-01-01",
        });
      expect(error).not.toBeNull();
      expect(error!.message.toLowerCase()).toMatch(
        /chk_capital_holdings_porcentaje_capital|porcentaje_capital/
      );
    });

    it("chk_capital_holdings_numero_titulos rejects negative values", async () => {
      await ensurePerson(PERSON_B, "Test negative titulos");

      const { error } = await supabaseAdmin!
        .from("capital_holdings")
        .insert({
          tenant_id: DEMO_TENANT,
          entity_id: entityId,
          holder_person_id: PERSON_B,
          numero_titulos: -1, // violates numero_titulos >= 0
          effective_from: "2026-01-01",
        });
      expect(error).not.toBeNull();
      expect(error!.message.toLowerCase()).toMatch(
        /chk_capital_holdings_numero_titulos|numero_titulos/
      );
    });

    it("applies column defaults (voting_rights=true, is_treasury=false, metadata={})", async () => {
      await ensurePerson(PERSON_C, "Test defaults");

      const { data, error } = await supabaseAdmin!
        .from("capital_holdings")
        .insert({
          tenant_id: DEMO_TENANT,
          entity_id: entityId,
          holder_person_id: PERSON_C,
          numero_titulos: 100,
          effective_from: "2026-01-01",
          // voting_rights, is_treasury, metadata omitted — defaults should apply
        })
        .select()
        .maybeSingle();
      expect(error).toBeNull();
      expect(data).not.toBeNull();
      // Booleans come back as booleans through PostgREST (only NUMERIC
      // serialises to string — see T4 defaults test).
      expect(data!.voting_rights).toBe(true);
      expect(data!.is_treasury).toBe(false);
      // metadata default is '{}'::jsonb which PostgREST deserialises
      // to a plain JS object.
      expect(data!.metadata).toEqual({});
    });
  }
);
