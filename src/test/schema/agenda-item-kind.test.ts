// src/test/schema/agenda-item-kind.test.ts
/**
 * Agenda Item Kind (v1.3) — schema guardrails for migration
 * supabase/migrations/20260512_000059_agenda_item_kind.sql.
 *
 * Verifies the 5 active triggers + new columns + WORM audit log behavior
 * post-adversarial patches (commit 71722c8 + 9b18458). T6 was DROPPED
 * because meetings.adoption_mode does not exist in the real schema; the
 * invariant is covered by the data model itself (no test here).
 *
 * Triggers under test (5):
 *   T1 tr_agenda_kind_immutable_after_voted   BEFORE UPDATE agenda_items
 *   T2 tr_agenda_kind_immutable_after_closed  BEFORE UPDATE agenda_items  (CANCELADA — Spanish)
 *   T3 tr_agenda_kind_audit_after_convoked    AFTER  UPDATE agenda_items (SECURITY DEFINER)
 *                                             — fires on CONVOCADA/CELEBRADA (Spanish)
 *   T4 tr_resolution_kind_matches_agenda      BEFORE INSERT/UPDATE meeting_resolutions
 *   T5 tr_agreement_requires_decisorio        BEFORE INSERT/UPDATE agreements
 *
 * Plus WORM coverage: UPDATE/DELETE on agenda_item_kind_changelog rejected
 * (worm_guard trigger from migration helper).
 *
 * NOTE: meeting.status uses Spanish enums in production. Migration 000059
 * shipped with English placeholders (CONVOKED/OPEN/CLOSED) that did not match
 * the meetings_status_check CHECK constraint
 * (DRAFT, CONVOCADA, CELEBRADA, CANCELADA) — migration 000061 patched the
 * trigger bodies. This test now exercises the Spanish state names.
 *
 * Runtime env: requires VITE_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in
 * `.env.local`. Without those, `hasAdminClient()` returns false and every
 * describe block is skipped. We use PostgREST probes (no execute_sql RPC
 * exposed on this project — see CLAUDE.md "Limitaciones conocidas").
 *
 * Sentinel cleanup pattern: each describe block uses a unique sentinel
 * substring (TEST_T1_AGENDAKIND_SENTINEL, TEST_T2_..., etc.) in title /
 * resolution_text / slug fields so afterEach can scope DELETE strictly to
 * rows this suite inserted. Real demo data with status='CELEBRADA' or audit
 * rows from production code are NEVER touched.
 *
 * SCHEMA NOTES (verified against supabase/functions/_types/database.ts):
 *   - agenda_items uses `order_number` (NOT `index` — the spec was wrong;
 *     migration patched in commit 71722c8).
 *   - meetings has NO `scheduled_date` column — uses `scheduled_start` /
 *     `scheduled_end` instead. Fixtures use slug + body_id + status.
 *   - meeting_resolutions.agenda_item_index is the correct join column.
 *   - meetings.status is `string | null` (nullable).
 *   - agreements requires adoption_mode + matter_class + agreement_kind +
 *     tenant_id NOT NULL.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import {
  supabaseAdmin,
  hasAdminClient,
  DEMO_TENANT,
  DEMO_ENTITY_ARGA,
} from "../helpers/supabase-test-client";

// ─────────────────────────────────────────────────────────────────────────────
// Module-level fixture: every describe block needs a governing body to be able
// to insert meetings (meetings.body_id NOT NULL). We probe for one tied to
// DEMO_ENTITY_ARGA in beforeAll of each describe block. If absent (e.g. a
// fresh project without T14 bootstrap), each describe block soft-skips with a
// visible console.warn — matches the canonical-* test convention.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Helper: locate one governing_bodies row for DEMO_ENTITY_ARGA. Returns
 * null if none exist (caller soft-skips). Tests do NOT create bodies —
 * we only consume what T14 / production seed already inserted.
 */
async function findGoverningBodyId(): Promise<string | null> {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin
    .from("governing_bodies")
    .select("id")
    .eq("entity_id", DEMO_ENTITY_ARGA)
    .limit(1);
  if (error || !data || data.length === 0) return null;
  return data[0].id as string;
}

// ─────────────────────────────────────────────────────────────────────────────
// T1 — Immutability post-voted (any kind_resolution exists)
// ─────────────────────────────────────────────────────────────────────────────
describe.skipIf(!hasAdminClient())(
  "Agenda Item Kind — T1 immutability post-voted",
  () => {
    const SENTINEL = "TEST_T1_AGENDAKIND_SENTINEL_PLEASE_DELETE";
    let bodyId: string | null = null;
    let entityPresent = false;

    beforeAll(async () => {
      bodyId = await findGoverningBodyId();
      if (!bodyId) {
        console.warn(
          "[T1] Skipping — DEMO_ENTITY_ARGA has no governing_bodies row. " +
          "T14 bootstrap will unblock."
        );
        return;
      }
      entityPresent = true;
    });

    // Cleanup: remove every fixture row this block touched. Order matters
    // because of FKs: resolutions → agenda_items → meetings.
    afterEach(async () => {
      if (!supabaseAdmin) return;
      await supabaseAdmin
        .from("meeting_resolutions")
        .delete()
        .like("resolution_text", `%${SENTINEL}%`);
      await supabaseAdmin
        .from("agenda_items")
        .delete()
        .like("title", `%${SENTINEL}%`);
      await supabaseAdmin
        .from("meetings")
        .delete()
        .like("slug", `%${SENTINEL.toLowerCase()}%`);
    });

    /**
     * Build a meeting + agenda_item + meeting_resolution fixture, then
     * attempt to mutate agenda_items.kind. The trigger must reject the
     * UPDATE regardless of which kind_resolution flavour we seeded.
     */
    async function runImmutabilityScenario(
      kindResolution: "DECISION" | "DELIBERATION_OUTCOME" | "INFORMATION_NOTED",
      agendaKind: "DECISORIO" | "DELIBERATIVO" | "INFORMATIVO",
    ) {
      // 1. Meeting (status DRAFT — T2 must not fire)
      const meetingSlug = `${SENTINEL.toLowerCase()}-${kindResolution.toLowerCase()}`;
      const { data: meeting, error: errM } = await supabaseAdmin!
        .from("meetings")
        .insert({
          tenant_id: DEMO_TENANT,
          body_id: bodyId!,
          slug: meetingSlug,
          status: "DRAFT",
        })
        .select("id")
        .single();
      expect(errM).toBeNull();

      // 2. Agenda item with kind aligned to kindResolution (so step 3's
      // T4 cross-validation accepts the insert).
      const { data: agenda, error: errA } = await supabaseAdmin!
        .from("agenda_items")
        .insert({
          meeting_id: meeting!.id,
          order_number: 1,
          title: `${SENTINEL} — ${kindResolution}`,
          tenant_id: DEMO_TENANT,
          // @ts-expect-error new column not in generated types yet
          kind: agendaKind,
        })
        .select("id")
        .single();
      expect(errA).toBeNull();

      // 3. Resolution with matching kind_resolution
      const { error: errR } = await supabaseAdmin!
        .from("meeting_resolutions")
        .insert({
          tenant_id: DEMO_TENANT,
          meeting_id: meeting!.id,
          agenda_item_index: 1,
          resolution_text: `${SENTINEL} — resolution for ${kindResolution}`,
          status: "ADOPTED",
          // @ts-expect-error new column not in generated types yet
          kind_resolution: kindResolution,
        });
      expect(errR).toBeNull();

      // 4. Now attempt to change agenda_items.kind — T1 must reject.
      const newKind = agendaKind === "DECISORIO" ? "DELIBERATIVO" : "DECISORIO";
      const { error: errU } = await supabaseAdmin!
        .from("agenda_items")
        // @ts-expect-error new column not in generated types yet
        .update({ kind: newKind })
        .eq("id", agenda!.id);

      expect(errU).not.toBeNull();
      expect(errU?.message.toLowerCase()).toMatch(/inmutable|meeting_resolution|voted/);
    }

    it("rejects kind change when a DECISION resolution exists", async () => {
      if (!entityPresent) {
        console.warn("[T1] Skipping DECISION scenario — body missing.");
        return;
      }
      await runImmutabilityScenario("DECISION", "DECISORIO");
    });

    it("rejects kind change when a DELIBERATION_OUTCOME resolution exists", async () => {
      if (!entityPresent) {
        console.warn("[T1] Skipping DELIBERATION_OUTCOME scenario — body missing.");
        return;
      }
      await runImmutabilityScenario("DELIBERATION_OUTCOME", "DELIBERATIVO");
    });

    it("rejects kind change when an INFORMATION_NOTED resolution exists", async () => {
      if (!entityPresent) {
        console.warn("[T1] Skipping INFORMATION_NOTED scenario — body missing.");
        return;
      }
      await runImmutabilityScenario("INFORMATION_NOTED", "INFORMATIVO");
    });
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// T2 — Immutability post-CANCELADA (Spanish status; production uses CANCELADA
// as the "closed" terminal state). Migration 000061 mapped CLOSED → CANCELADA.
// ─────────────────────────────────────────────────────────────────────────────
describe.skipIf(!hasAdminClient())(
  "Agenda Item Kind — T2 immutability post-CANCELADA",
  () => {
    const SENTINEL = "TEST_T2_AGENDAKIND_SENTINEL_PLEASE_DELETE";
    let bodyId: string | null = null;
    let entityPresent = false;

    beforeAll(async () => {
      bodyId = await findGoverningBodyId();
      if (!bodyId) {
        console.warn(
          "[T2] Skipping — DEMO_ENTITY_ARGA has no governing_bodies row.",
        );
        return;
      }
      entityPresent = true;
    });

    afterEach(async () => {
      if (!supabaseAdmin) return;
      await supabaseAdmin
        .from("agenda_items")
        .delete()
        .like("title", `%${SENTINEL}%`);
      await supabaseAdmin
        .from("meetings")
        .delete()
        .like("slug", `%${SENTINEL.toLowerCase()}%`);
    });

    it("rejects kind change when meeting.status='CANCELADA'", async () => {
      if (!entityPresent) {
        console.warn("[T2] Skipping CANCELADA scenario — body missing.");
        return;
      }

      // 1. Meeting that starts DRAFT (so agenda insert is unconstrained)
      const { data: meeting, error: errM } = await supabaseAdmin!
        .from("meetings")
        .insert({
          tenant_id: DEMO_TENANT,
          body_id: bodyId!,
          slug: `${SENTINEL.toLowerCase()}-cancelada`,
          status: "DRAFT",
        })
        .select("id")
        .single();
      expect(errM).toBeNull();

      // 2. Agenda item (kind defaults to DELIBERATIVO)
      const { data: agenda, error: errA } = await supabaseAdmin!
        .from("agenda_items")
        .insert({
          meeting_id: meeting!.id,
          order_number: 1,
          title: `${SENTINEL} — cancelada test`,
          tenant_id: DEMO_TENANT,
        })
        .select("id")
        .single();
      expect(errA).toBeNull();

      // 3. Flip meeting to CANCELADA (terminal/closed status in production)
      const { error: errCloseMeeting } = await supabaseAdmin!
        .from("meetings")
        .update({ status: "CANCELADA" })
        .eq("id", meeting!.id);
      expect(errCloseMeeting).toBeNull();

      // 4. Attempt to change agenda kind — must be rejected by T2.
      const { error: errU } = await supabaseAdmin!
        .from("agenda_items")
        // @ts-expect-error new column not in generated types yet
        .update({ kind: "DECISORIO" })
        .eq("id", agenda!.id);
      expect(errU).not.toBeNull();
      expect(errU?.message.toLowerCase()).toMatch(/inmutable|cancelada|reunión/);
    });

    it("allows kind change when meeting.status='DRAFT' (happy path)", async () => {
      if (!entityPresent) {
        console.warn("[T2] Skipping DRAFT happy-path — body missing.");
        return;
      }

      const { data: meeting, error: errM } = await supabaseAdmin!
        .from("meetings")
        .insert({
          tenant_id: DEMO_TENANT,
          body_id: bodyId!,
          slug: `${SENTINEL.toLowerCase()}-draft`,
          status: "DRAFT",
        })
        .select("id")
        .single();
      expect(errM).toBeNull();

      const { data: agenda, error: errA } = await supabaseAdmin!
        .from("agenda_items")
        .insert({
          meeting_id: meeting!.id,
          order_number: 1,
          title: `${SENTINEL} — draft happy path`,
          tenant_id: DEMO_TENANT,
        })
        .select("id")
        .single();
      expect(errA).toBeNull();

      // DRAFT meeting + no resolutions => T1 and T2 should let this through.
      const { error: errU } = await supabaseAdmin!
        .from("agenda_items")
        // @ts-expect-error new column not in generated types yet
        .update({ kind: "DECISORIO" })
        .eq("id", agenda!.id);
      expect(errU).toBeNull();
    });
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// T3 — Audit log after CONVOCADA/CELEBRADA (Spanish status names).
// Migration 000061 mapped CONVOKED → CONVOCADA, OPEN → CELEBRADA.
// ─────────────────────────────────────────────────────────────────────────────
describe.skipIf(!hasAdminClient())(
  "Agenda Item Kind — T3 audit log on kind change post-CONVOCADA",
  () => {
    const SENTINEL = "TEST_T3_AGENDAKIND_SENTINEL_PLEASE_DELETE";
    let bodyId: string | null = null;
    let entityPresent = false;

    beforeAll(async () => {
      bodyId = await findGoverningBodyId();
      if (!bodyId) {
        console.warn(
          "[T3] Skipping — DEMO_ENTITY_ARGA has no governing_bodies row.",
        );
        return;
      }
      entityPresent = true;
    });

    // Cleanup: changelog has WORM guard so we cannot DELETE the rows we
    // produced. That is BY DESIGN (matches censo_snapshot pattern in
    // canonical-triggers.test.ts). We DO delete the agenda_items /
    // meetings we created — RESTRICT on changelog.agenda_item_id FK
    // would block this if we left a changelog row pointing at the agenda
    // item. Soft-delete the agenda first AFTER verifying audit row, but
    // the FK is ON DELETE RESTRICT — so we cannot delete the agenda_item
    // while a changelog row references it. The pragmatic answer: leave
    // the fixture trio in place. Re-running the test is safe because
    // the slug includes a fresh timestamp and assertions count rows
    // produced in THIS run only (filtered by motivo sentinel).
    //
    // To avoid noise piling up forever, we DO try to delete; if it fails
    // due to FK, the rows are left in place — production data is untouched
    // and the cloud project is the shared demo, not a regulated env.
    afterAll(async () => {
      if (!supabaseAdmin) return;
      // Best-effort cleanup; failures expected for changelog FK.
      await supabaseAdmin
        .from("agenda_items")
        .delete()
        .like("title", `%${SENTINEL}%`);
      await supabaseAdmin
        .from("meetings")
        .delete()
        .like("slug", `%${SENTINEL.toLowerCase()}%`);
    });

    it("INSERTs audit log row when status='CONVOCADA' and kind changes", async () => {
      if (!entityPresent) {
        console.warn("[T3] Skipping CONVOCADA audit test — body missing.");
        return;
      }

      // Unique motivo per run so we can scope audit-log assertion safely.
      const runMotivo = `${SENTINEL}_motivo_${Date.now()}_convocada`;

      const { data: meeting, error: errM } = await supabaseAdmin!
        .from("meetings")
        .insert({
          tenant_id: DEMO_TENANT,
          body_id: bodyId!,
          slug: `${SENTINEL.toLowerCase()}-convocada-${Date.now()}`,
          status: "DRAFT",
        })
        .select("id")
        .single();
      expect(errM).toBeNull();

      const { data: agenda, error: errA } = await supabaseAdmin!
        .from("agenda_items")
        .insert({
          meeting_id: meeting!.id,
          order_number: 1,
          title: `${SENTINEL} — convocada audit`,
          tenant_id: DEMO_TENANT,
        })
        .select("id")
        .single();
      expect(errA).toBeNull();

      // Promote to CONVOCADA before changing kind
      await supabaseAdmin!
        .from("meetings")
        .update({ status: "CONVOCADA" })
        .eq("id", meeting!.id);

      // Set audit context (motivo gets captured by T3 trigger via
      // current_setting('app.kind_change_motivo')).
      await supabaseAdmin!.rpc("set_kind_change_context", {
        p_motivo: runMotivo,
        p_user_id: "00000000-0000-0000-0000-000000000aaa",
      });

      // The kind change — triggers T3 INSERT into changelog
      const { error: errU } = await supabaseAdmin!
        .from("agenda_items")
        // @ts-expect-error new column not in generated types yet
        .update({ kind: "DECISORIO" })
        .eq("id", agenda!.id);
      expect(errU).toBeNull();

      // Now verify the audit row exists. NOTE: set_config(..., true) is
      // TRANSACTION-local, but PostgREST opens a fresh tx per request, so
      // the motivo captured by the trigger is "sin_motivo_proporcionado"
      // unless the RPC + UPDATE share the same connection. With the JS
      // client doing separate HTTP requests, they do NOT share — so we
      // expect "sin_motivo_proporcionado" here, which is exactly the
      // bypass-hook detectable state the migration documents. The test
      // verifies the row was inserted, not the motivo value.
      const { data: audit, error: errAudit } = await supabaseAdmin!
        .from("agenda_item_kind_changelog")
        .select("id, from_kind, to_kind, meeting_status_at_change, motivo")
        .eq("agenda_item_id", agenda!.id);
      expect(errAudit).toBeNull();
      expect(audit).not.toBeNull();
      expect(audit!.length).toBeGreaterThanOrEqual(1);

      const auditRow = audit![0];
      expect(auditRow.from_kind).toBe("DELIBERATIVO"); // default
      expect(auditRow.to_kind).toBe("DECISORIO");
      expect(auditRow.meeting_status_at_change).toBe("CONVOCADA");
    });

    it("does NOT insert audit log when status='DRAFT'", async () => {
      if (!entityPresent) {
        console.warn("[T3] Skipping DRAFT no-audit test — body missing.");
        return;
      }

      const { data: meeting } = await supabaseAdmin!
        .from("meetings")
        .insert({
          tenant_id: DEMO_TENANT,
          body_id: bodyId!,
          slug: `${SENTINEL.toLowerCase()}-draft-noaudit-${Date.now()}`,
          status: "DRAFT",
        })
        .select("id")
        .single();

      const { data: agenda } = await supabaseAdmin!
        .from("agenda_items")
        .insert({
          meeting_id: meeting!.id,
          order_number: 1,
          title: `${SENTINEL} — draft no audit`,
          tenant_id: DEMO_TENANT,
        })
        .select("id")
        .single();

      // Kind change while still DRAFT — T1/T2 allow it (no resolutions,
      // not CLOSED), T3 must skip (status not in CONVOKED/OPEN).
      const { error: errU } = await supabaseAdmin!
        .from("agenda_items")
        // @ts-expect-error new column not in generated types yet
        .update({ kind: "DECISORIO" })
        .eq("id", agenda!.id);
      expect(errU).toBeNull();

      const { data: audit } = await supabaseAdmin!
        .from("agenda_item_kind_changelog")
        .select("id")
        .eq("agenda_item_id", agenda!.id);
      expect(audit).toBeDefined();
      expect(audit!.length).toBe(0);
    });
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// T4 — Cross-validation BIDIRECTIONAL agenda.kind ↔ resolution.kind_resolution
// Full 9-cell matrix (3 agenda kinds × 3 resolution kinds).
// ─────────────────────────────────────────────────────────────────────────────
describe.skipIf(!hasAdminClient())(
  "Agenda Item Kind — T4 cross-validation BIDIRECTIONAL (D1)",
  () => {
    const SENTINEL = "TEST_T4_AGENDAKIND_SENTINEL_PLEASE_DELETE";
    let bodyId: string | null = null;
    let entityPresent = false;

    beforeAll(async () => {
      bodyId = await findGoverningBodyId();
      if (!bodyId) {
        console.warn(
          "[T4] Skipping — DEMO_ENTITY_ARGA has no governing_bodies row.",
        );
        return;
      }
      entityPresent = true;
    });

    afterEach(async () => {
      if (!supabaseAdmin) return;
      await supabaseAdmin
        .from("meeting_resolutions")
        .delete()
        .like("resolution_text", `%${SENTINEL}%`);
      await supabaseAdmin
        .from("agenda_items")
        .delete()
        .like("title", `%${SENTINEL}%`);
      await supabaseAdmin
        .from("meetings")
        .delete()
        .like("slug", `%${SENTINEL.toLowerCase()}%`);
    });

    /**
     * 9-cell matrix: diagonal succeeds (matching pair), off-diagonal fails.
     */
    const matrix: Array<{
      agendaKind: "DECISORIO" | "DELIBERATIVO" | "INFORMATIVO";
      kindResolution: "DECISION" | "DELIBERATION_OUTCOME" | "INFORMATION_NOTED";
      shouldPass: boolean;
    }> = [
      // Matching diagonal — pass
      { agendaKind: "DECISORIO", kindResolution: "DECISION", shouldPass: true },
      { agendaKind: "DELIBERATIVO", kindResolution: "DELIBERATION_OUTCOME", shouldPass: true },
      { agendaKind: "INFORMATIVO", kindResolution: "INFORMATION_NOTED", shouldPass: true },
      // Off-diagonal — fail
      { agendaKind: "DECISORIO", kindResolution: "DELIBERATION_OUTCOME", shouldPass: false },
      { agendaKind: "DECISORIO", kindResolution: "INFORMATION_NOTED", shouldPass: false },
      { agendaKind: "DELIBERATIVO", kindResolution: "DECISION", shouldPass: false },
      { agendaKind: "DELIBERATIVO", kindResolution: "INFORMATION_NOTED", shouldPass: false },
      { agendaKind: "INFORMATIVO", kindResolution: "DECISION", shouldPass: false },
      { agendaKind: "INFORMATIVO", kindResolution: "DELIBERATION_OUTCOME", shouldPass: false },
    ];

    it.each(matrix)(
      "agenda.kind=$agendaKind + resolution.kind_resolution=$kindResolution → pass=$shouldPass",
      async ({ agendaKind, kindResolution, shouldPass }) => {
        if (!entityPresent) {
          console.warn(`[T4] Skipping ${agendaKind}+${kindResolution} — body missing.`);
          return;
        }

        const meetingSlug =
          `${SENTINEL.toLowerCase()}-${agendaKind.toLowerCase()}-${kindResolution.toLowerCase()}-${Date.now()}`;
        const { data: meeting, error: errM } = await supabaseAdmin!
          .from("meetings")
          .insert({
            tenant_id: DEMO_TENANT,
            body_id: bodyId!,
            slug: meetingSlug,
            status: "DRAFT",
          })
          .select("id")
          .single();
        expect(errM).toBeNull();

        const { error: errA } = await supabaseAdmin!
          .from("agenda_items")
          .insert({
            meeting_id: meeting!.id,
            order_number: 1,
            title: `${SENTINEL} — ${agendaKind} / ${kindResolution}`,
            tenant_id: DEMO_TENANT,
            // @ts-expect-error new column not in generated types yet
            kind: agendaKind,
          });
        expect(errA).toBeNull();

        // Now try to insert the resolution — T4 fires here.
        const { error: errR } = await supabaseAdmin!
          .from("meeting_resolutions")
          .insert({
            tenant_id: DEMO_TENANT,
            meeting_id: meeting!.id,
            agenda_item_index: 1,
            resolution_text: `${SENTINEL} — ${agendaKind} / ${kindResolution}`,
            status: "ADOPTED",
            // @ts-expect-error new column not in generated types yet
            kind_resolution: kindResolution,
          });

        if (shouldPass) {
          expect(errR).toBeNull();
        } else {
          expect(errR).not.toBeNull();
          expect(errR?.message.toLowerCase()).toMatch(
            /requiere agenda_items\.kind|kind_resolution|decisorio|deliberativo|informativo/,
          );
        }
      },
    );
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// T5 — Agreement requires DECISORIO (NULL-guard paths + happy/sad paths)
// ─────────────────────────────────────────────────────────────────────────────
describe.skipIf(!hasAdminClient())(
  "Agenda Item Kind — T5 agreement requires DECISORIO",
  () => {
    const SENTINEL = "TEST_T5_AGENDAKIND_SENTINEL_PLEASE_DELETE";
    let bodyId: string | null = null;
    let entityPresent = false;

    beforeAll(async () => {
      bodyId = await findGoverningBodyId();
      if (!bodyId) {
        console.warn(
          "[T5] Skipping — DEMO_ENTITY_ARGA has no governing_bodies row.",
        );
        return;
      }
      entityPresent = true;
    });

    afterEach(async () => {
      if (!supabaseAdmin) return;
      // Order matters: agreements may reference meetings via parent_meeting_id
      await supabaseAdmin
        .from("agreements")
        .delete()
        .like("proposal_text", `%${SENTINEL}%`);
      await supabaseAdmin
        .from("agenda_items")
        .delete()
        .like("title", `%${SENTINEL}%`);
      await supabaseAdmin
        .from("meetings")
        .delete()
        .like("slug", `%${SENTINEL.toLowerCase()}%`);
    });

    it("path 1: parent_meeting_id=NULL → trigger skips (insert succeeds)", async () => {
      if (!entityPresent) {
        console.warn("[T5] Skipping NULL-meeting path — body missing.");
        return;
      }
      // NO_SESSION style: no parent_meeting_id, no execution_mode. T5 must
      // short-circuit before any kind lookup.
      const { error } = await supabaseAdmin!.from("agreements").insert({
        tenant_id: DEMO_TENANT,
        adoption_mode: "NO_SESSION",
        agreement_kind: "MOD_ESTATUTOS",
        matter_class: "ESTATUTARIA",
        parent_meeting_id: null,
        proposal_text: `${SENTINEL} — NO_SESSION no parent`,
      });
      expect(error).toBeNull();
    });

    it("path 2: parent_meeting_id set but execution_mode=NULL → trigger skips", async () => {
      if (!entityPresent) {
        console.warn("[T5] Skipping execution_mode NULL path — body missing.");
        return;
      }
      // Meeting exists, agreement points to it, but no execution_mode JSON.
      // Per migration: legacy compatibility, trigger returns NEW.
      const { data: meeting } = await supabaseAdmin!
        .from("meetings")
        .insert({
          tenant_id: DEMO_TENANT,
          body_id: bodyId!,
          slug: `${SENTINEL.toLowerCase()}-exec-null-${Date.now()}`,
          status: "DRAFT",
        })
        .select("id")
        .single();

      const { error } = await supabaseAdmin!.from("agreements").insert({
        tenant_id: DEMO_TENANT,
        adoption_mode: "MEETING",
        agreement_kind: "APROBACION_CUENTAS",
        matter_class: "ORDINARIA",
        parent_meeting_id: meeting!.id,
        execution_mode: null, // explicit NULL
        proposal_text: `${SENTINEL} — exec_mode NULL`,
      });
      expect(error).toBeNull();
    });

    it("path 3: agenda kind=INFORMATIVO → trigger REJECTS", async () => {
      if (!entityPresent) {
        console.warn("[T5] Skipping INFORMATIVO rejection path — body missing.");
        return;
      }

      const { data: meeting } = await supabaseAdmin!
        .from("meetings")
        .insert({
          tenant_id: DEMO_TENANT,
          body_id: bodyId!,
          slug: `${SENTINEL.toLowerCase()}-info-reject-${Date.now()}`,
          status: "DRAFT",
        })
        .select("id")
        .single();

      const { error: errA } = await supabaseAdmin!
        .from("agenda_items")
        .insert({
          meeting_id: meeting!.id,
          order_number: 1,
          title: `${SENTINEL} — INFORMATIVO agenda`,
          tenant_id: DEMO_TENANT,
          // @ts-expect-error new column not in generated types yet
          kind: "INFORMATIVO",
        });
      expect(errA).toBeNull();

      const { error } = await supabaseAdmin!.from("agreements").insert({
        tenant_id: DEMO_TENANT,
        adoption_mode: "MEETING",
        agreement_kind: "APROBACION_CUENTAS",
        matter_class: "ORDINARIA",
        parent_meeting_id: meeting!.id,
        execution_mode: { agreement_360: { agenda_item_index: 1 } },
        proposal_text: `${SENTINEL} — info kind reject`,
      });

      expect(error).not.toBeNull();
      expect(error?.message.toLowerCase()).toMatch(
        /decisorio|punto informativo|punto deliberativo|materializar/,
      );
    });

    it("path 4: agenda kind=DECISORIO → trigger ACCEPTS (happy path)", async () => {
      if (!entityPresent) {
        console.warn("[T5] Skipping DECISORIO happy path — body missing.");
        return;
      }

      const { data: meeting } = await supabaseAdmin!
        .from("meetings")
        .insert({
          tenant_id: DEMO_TENANT,
          body_id: bodyId!,
          slug: `${SENTINEL.toLowerCase()}-dec-ok-${Date.now()}`,
          status: "DRAFT",
        })
        .select("id")
        .single();

      const { error: errA } = await supabaseAdmin!
        .from("agenda_items")
        .insert({
          meeting_id: meeting!.id,
          order_number: 1,
          title: `${SENTINEL} — DECISORIO agenda`,
          tenant_id: DEMO_TENANT,
          // @ts-expect-error new column not in generated types yet
          kind: "DECISORIO",
        });
      expect(errA).toBeNull();

      const { error } = await supabaseAdmin!.from("agreements").insert({
        tenant_id: DEMO_TENANT,
        adoption_mode: "MEETING",
        agreement_kind: "APROBACION_CUENTAS",
        matter_class: "ORDINARIA",
        parent_meeting_id: meeting!.id,
        execution_mode: { agreement_360: { agenda_item_index: 1 } },
        proposal_text: `${SENTINEL} — decisorio happy path`,
      });
      expect(error).toBeNull();
    });
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// WORM — UPDATE/DELETE on agenda_item_kind_changelog rejected
// ─────────────────────────────────────────────────────────────────────────────
describe.skipIf(!hasAdminClient())(
  "Agenda Item Kind — WORM guard on agenda_item_kind_changelog",
  () => {
    const SENTINEL = "TEST_WORM_AGENDAKIND_SENTINEL_PLEASE_DELETE";
    let bodyId: string | null = null;
    let entityPresent = false;
    let auditRowId: string | null = null;

    beforeAll(async () => {
      if (!supabaseAdmin) return;
      bodyId = await findGoverningBodyId();
      if (!bodyId) {
        console.warn(
          "[WORM] Skipping — DEMO_ENTITY_ARGA has no governing_bodies row.",
        );
        return;
      }
      entityPresent = true;

      // Seed: meeting → agenda → CONVOKED → kind change → audit row exists.
      const { data: meeting } = await supabaseAdmin
        .from("meetings")
        .insert({
          tenant_id: DEMO_TENANT,
          body_id: bodyId!,
          slug: `${SENTINEL.toLowerCase()}-worm-${Date.now()}`,
          status: "DRAFT",
        })
        .select("id")
        .single();

      const { data: agenda } = await supabaseAdmin
        .from("agenda_items")
        .insert({
          meeting_id: meeting!.id,
          order_number: 1,
          title: `${SENTINEL} — worm seed`,
          tenant_id: DEMO_TENANT,
        })
        .select("id")
        .single();

      await supabaseAdmin
        .from("meetings")
        .update({ status: "CONVOCADA" })
        .eq("id", meeting!.id);

      // Trigger T3 INSERT into changelog
      await supabaseAdmin
        .from("agenda_items")
        // @ts-expect-error new column not in generated types yet
        .update({ kind: "DECISORIO" })
        .eq("id", agenda!.id);

      const { data: rows } = await supabaseAdmin
        .from("agenda_item_kind_changelog")
        .select("id")
        .eq("agenda_item_id", agenda!.id);

      if (rows && rows.length > 0) {
        auditRowId = rows[0].id as string;
      }
    });

    // NO afterAll cleanup — WORM rejects DELETE by design. The sentinel
    // motivo + agenda_item title are unique per run (timestamp suffix) so
    // re-runs do not collide, but rows DO accumulate. This mirrors the
    // censo_snapshot WORM debt documented in canonical-triggers.test.ts.

    it("rejects UPDATE on agenda_item_kind_changelog", async () => {
      if (!entityPresent || !auditRowId) {
        console.warn("[WORM] Skipping UPDATE test — fixture missing.");
        return;
      }
      const { error } = await supabaseAdmin!
        .from("agenda_item_kind_changelog")
        .update({ motivo: "tampered" })
        .eq("id", auditRowId);
      expect(error).not.toBeNull();
      // worm_guard message includes "WORM" or "no se permite" / "immutable"
      expect(error?.message.toLowerCase()).toMatch(
        /worm|inmutable|not allowed|no se permite|read.?only/,
      );
    });

    it("rejects DELETE on agenda_item_kind_changelog", async () => {
      if (!entityPresent || !auditRowId) {
        console.warn("[WORM] Skipping DELETE test — fixture missing.");
        return;
      }
      const { error } = await supabaseAdmin!
        .from("agenda_item_kind_changelog")
        .delete()
        .eq("id", auditRowId);
      expect(error).not.toBeNull();
      expect(error?.message.toLowerCase()).toMatch(
        /worm|inmutable|not allowed|no se permite|read.?only/,
      );
    });
  },
);
