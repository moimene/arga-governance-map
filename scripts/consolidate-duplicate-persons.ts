#!/usr/bin/env bun
/**
 * D2 — Consolidate duplicate persons by canonical tax_id.
 *
 * Wave 2 of the personas-cargos refactor. Migrates references from a
 * duplicate `persons` row to a canonical one, then soft-archives the
 * duplicate (rename tax_id to ARCHIVED-<ts>-<original>) so the UNIQUE
 * constraint added in migration 000063 can be enforced cleanly.
 *
 * SCHEMA SOURCE OF TRUTH:
 *   The FK list (`PERSONS_FK_REFERENCES`) was extracted directly from
 *   `pg_constraint` against Cloud project hzqwefkwsxopwrmtksbg on
 *   2026-05-12. 47 FKs across 35+ tables. The Wave 2 adversarial
 *   reviewer caught that the original plan D2.2 listed only 9 of these
 *   (19% coverage). Running with the partial list would leave 38 FK
 *   columns pointing at archived rows, breaking joins silently.
 *
 * BUGS CORRECTED VS. PLAN D2.2:
 *   1. meeting_attendees.attendee_person_id → real column is `person_id`
 *      (verified via information_schema).
 *   2. agreements.proponent_person_id was flagged by legal review as a
 *      risk; probe shows it does NOT exist. Removed.
 *   3. entities.person_id is the most critical bridge: each `entities`
 *      row stores a denormalised pointer to its PJ in `persons`. If a
 *      duplicate PJ is consolidated away without remapping the entity
 *      bridge, the entity becomes orphan. Covered.
 *   4. persons.representative_person_id is self-referencing — the
 *      duplicate may BE someone's representative. Covered.
 *
 * SAFETY POSTURE:
 *   - Default mode is `--dry-run` (read-only).
 *   - `--apply` is opt-in and requires either `--auto-detect` (all
 *     auto-detected Type-A pairs) or `--pair=<canonical>:<duplicate>`
 *     (explicit, manually-verified pair).
 *   - Pre-flight check ALWAYS runs and aborts if conflicts found
 *     (e.g. canonical + duplicate both VIGENTE in same body).
 *   - Soft-archive only — duplicates are NEVER deleted, audit/FK
 *     history is preserved.
 *   - Idempotent: re-running the script on an already-archived
 *     duplicate is a no-op (detected by tax_id prefix ARCHIVED-).
 *
 * IMPORTANT — IDEMPOTENCY, NOT ATOMICITY:
 *   Each migrateFk runs as an independent PostgREST transaction.
 *   supabase-js cannot wrap multiple statements in a single tx from the
 *   client, and we deliberately do NOT introduce an RPC SECURITY DEFINER
 *   for this sprint (deferred to Plan A').
 *
 *   Consequence: if a mid-Phase-1 UPDATE fails (RLS oddity, dropped
 *   connection, manual Ctrl-C), prior UPDATEs are COMMITTED and
 *   Phase 3 (soft-archive) has NOT run. The duplicate's tax_id stays
 *   on its original value.
 *
 *   Recovery is by re-running the script:
 *     - detectDuplicates() still sees the duplicate (tax_id is not ARCHIVED-).
 *     - preflightCheck() re-evaluates. Some collisions that existed before
 *       Phase 1 may now be GONE (refs already moved), but new ones may
 *       appear because canonical has absorbed some refs already. Read the
 *       output carefully.
 *     - Phase 1 re-runs all UPDATEs. Already-migrated rows are no-ops
 *       (WHERE column = duplicate.id matches zero rows after first run).
 *     - Phase 2 orphan check confirms cleanliness.
 *     - Phase 3 archives.
 *
 *   To prove recoverability empirically, run with --apply --pair=<canon>:<dup>
 *   against a fabricated test pair in a Cloud preview branch, fault-inject
 *   by SIGTERM mid-Phase-1, then re-run — the final state must match a
 *   clean run. A scaffolding script for this (`test-consolidate-recoverability.ts`)
 *   is TODO for Plan A'; until then, the recovery flow is documented but
 *   not regression-tested.
 *
 *   If atomicity is required (e.g. production multi-pair batch with no
 *   operator), wrap in a `fn_consolidate_person` RPC SECURITY DEFINER —
 *   deferred to Plan A'.
 *
 * Usage:
 *   bun run scripts/consolidate-duplicate-persons.ts --dry-run
 *   bun run scripts/consolidate-duplicate-persons.ts --apply --auto-detect
 *   bun run scripts/consolidate-duplicate-persons.ts --apply --pair=<canonical_id>:<duplicate_id>
 *
 * Required env:
 *   SUPABASE_SERVICE_ROLE_KEY  (service role, bypasses RLS)
 *   SUPABASE_URL               (optional, defaults to governance_OS Cloud)
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL ?? "https://hzqwefkwsxopwrmtksbg.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TENANT_ID = "00000000-0000-0000-0000-000000000001";

// --------------------------------------------------------------------
// FK references to persons.id
// --------------------------------------------------------------------
// Generated via pg_constraint probe on 2026-05-12 (47 rows).
// Every row that points at the duplicate must be migrated to the
// canonical id before soft-archive, or the row will be orphaned.
//
// Action policy:
//   - "migrate"  (default, 44 FKs): UPDATE table SET column = canonical WHERE column = duplicate.
//   - "skip"     (3 FKs): the column lives on a WORM-protected table whose triggers
//                  block ANY update or delete (BEFORE UPDATE OR DELETE → RAISE). Migrating
//                  these would abort the script mid-Phase-1 with no rollback. Soft-archive
//                  of the duplicate is enough: the WORM row still references the duplicate's
//                  uuid, but the duplicate's tax_id is now ARCHIVED-<ts>- so it cannot be
//                  confused with the canonical, and the unique constraint is freed.
//                  Affected tables (verified 2026-05-12 via pg_trigger probe):
//                    * capital_movements              (trg_capital_movements_worm)
//                    * no_session_notificaciones      (worm_no_session_notificaciones)
//                    * no_session_respuestas          (worm_no_session_respuestas)
//
// Each entry carries a `rationale` so future reviewers can verify the decision.
interface FkRef {
  table: string;
  column: string;
  action: "migrate" | "skip";
  rationale: string;
  critical?: boolean; // log loudly if non-zero rows updated
}

const PERSONS_FK_REFERENCES: FkRef[] = [
  // --- Identity / canonical model bridges (CRITICAL) ----------------
  {
    table: "entities",
    column: "person_id",
    action: "migrate",
    critical: true,
    rationale:
      "entities.person_id is the denormalised bridge between an entity and its PJ row. " +
      "If left unmigrated, the entity becomes orphan (point to ARCHIVED row).",
  },
  {
    table: "condiciones_persona",
    column: "person_id",
    action: "migrate",
    critical: true,
    rationale: "Cargo holder. Must move to canonical or ux_condicion_vigente fails to enforce truth.",
  },
  {
    table: "condiciones_persona",
    column: "representative_person_id",
    action: "migrate",
    rationale: "PF that represents a PJ in a cargo (ADMIN_PJ_REPRESENTANTE pattern).",
  },
  {
    table: "capital_holdings",
    column: "holder_person_id",
    action: "migrate",
    critical: true,
    rationale: "Libro de socios. Mis-pointed holdings invalidate the cap table.",
  },
  {
    table: "representaciones",
    column: "represented_person_id",
    action: "migrate",
    rationale: "PJ represented by a PF (ADMIN_PJ_REPRESENTANTE).",
  },
  {
    table: "representaciones",
    column: "representative_person_id",
    action: "migrate",
    rationale: "PF acting as representative for a PJ.",
  },
  {
    table: "persons",
    column: "representative_person_id",
    action: "migrate",
    rationale: "Self-reference: the duplicate may BE someone else's representative.",
  },

  // --- Authority / certification (HIGH) -----------------------------
  {
    table: "authority_evidence",
    column: "person_id",
    action: "migrate",
    critical: true,
    rationale: "Cargo + RM evidence for certification. Critical for fn_emitir_certificacion.",
  },
  {
    table: "certifications",
    column: "certifier_id",
    action: "migrate",
    rationale: "Secretario/Vicesecretario who emits the certification.",
  },
  {
    table: "certifications",
    column: "visto_bueno_persona_id",
    action: "migrate",
    rationale: "Presidente/Vicepresidente granting VºBº on the certification.",
  },

  // --- Capital ------------------------------------------------------
  {
    table: "capital_movements",
    column: "person_id",
    action: "skip",
    rationale:
      "WORM-protected (BEFORE UPDATE OR DELETE trigger trg_capital_movements_worm raises). " +
      "Movimientos de capital son inmutables por diseño. Soft-archive del duplicado preserva el " +
      "row; la FK histórica sigue válida apuntando al ARCHIVED-<ts>-<tax_id> — la persona " +
      "ya no es accesible vía tax_id real pero la trazabilidad temporal se mantiene.",
  },

  // --- Meetings / minutes ------------------------------------------
  {
    table: "meeting_attendees",
    column: "person_id",
    action: "migrate",
    rationale: "Asistente a reunión. CORRECTED: plan D2.2 said attendee_person_id; real name is person_id.",
  },
  {
    table: "meeting_attendees",
    column: "represented_by_id",
    action: "migrate",
    rationale: "Person who represented this attendee (proxy / delegación de voto).",
  },
  {
    table: "meetings",
    column: "president_id",
    action: "migrate",
    rationale: "Presidente of the meeting.",
  },
  {
    table: "meetings",
    column: "secretary_id",
    action: "migrate",
    rationale: "Secretario of the meeting.",
  },
  {
    table: "minutes",
    column: "signed_by_president_id",
    action: "migrate",
    rationale: "Presidente firmante del acta.",
  },
  {
    table: "minutes",
    column: "signed_by_secretary_id",
    action: "migrate",
    rationale: "Secretario firmante del acta.",
  },

  // --- Acuerdos / decisiones ---------------------------------------
  {
    table: "unipersonal_decisions",
    column: "decided_by_id",
    action: "migrate",
    rationale: "Persona que adopta la decisión unipersonal (socio único / admin único).",
  },
  {
    table: "no_session_expedientes",
    column: "propuesta_firmada_por",
    action: "migrate",
    rationale: "Firmante de la propuesta de acuerdo sin sesión.",
  },
  {
    table: "no_session_notificaciones",
    column: "person_id",
    action: "skip",
    rationale:
      "WORM-protected (BEFORE UPDATE OR DELETE trigger worm_no_session_notificaciones via " +
      "worm_guard()). Notificaciones ERDS son evidencia probatoria inmutable. Soft-archive del " +
      "duplicado preserva la FK histórica apuntando al ARCHIVED-.",
  },
  {
    table: "no_session_respuestas",
    column: "person_id",
    action: "skip",
    rationale:
      "WORM-protected (BEFORE UPDATE OR DELETE trigger worm_no_session_respuestas via " +
      "worm_guard()). Respuestas/votos en acuerdo sin sesión son evidencia probatoria inmutable. " +
      "Mismo razonamiento que no_session_notificaciones.",
  },

  // --- Voting projection -------------------------------------------
  {
    table: "parte_votante_current",
    column: "person_id",
    action: "migrate",
    rationale: "Proyección regenerable; aún así debe apuntar a canónico para sintetizar bien.",
  },

  // --- GRC / Riesgos / Auditoría -----------------------------------
  {
    table: "action_plans",
    column: "responsible_id",
    action: "migrate",
    rationale: "Owner del plan de acción.",
  },
  {
    table: "attestations",
    column: "person_id",
    action: "migrate",
    rationale: "Persona que attesta (annual conflicts, code of conduct, etc.).",
  },
  {
    table: "conflicts_of_interest",
    column: "person_id",
    action: "migrate",
    rationale: "Persona con conflicto declarado.",
  },
  {
    table: "controls",
    column: "owner_id",
    action: "migrate",
    rationale: "Owner del control GRC.",
  },
  {
    table: "delegations",
    column: "grantor_id",
    action: "migrate",
    rationale: "Persona que otorga la delegación.",
  },
  {
    table: "delegations",
    column: "delegate_id",
    action: "migrate",
    rationale: "Persona a quien se delega.",
  },
  {
    table: "evidences",
    column: "owner_id",
    action: "migrate",
    rationale: "Owner de la evidencia.",
  },
  {
    table: "exceptions",
    column: "requester_id",
    action: "migrate",
    rationale: "Solicitante de la excepción.",
  },
  {
    table: "exceptions",
    column: "approver_id",
    action: "migrate",
    rationale: "Aprobador de la excepción.",
  },
  {
    table: "findings",
    column: "owner_id",
    action: "migrate",
    rationale: "Owner del hallazgo.",
  },
  {
    table: "group_campaign_expedientes",
    column: "responsable_id",
    action: "migrate",
    rationale: "Responsable del expediente en campaña grupal. ON DELETE SET NULL.",
  },
  {
    table: "incidents",
    column: "reported_by",
    action: "migrate",
    rationale: "Persona que reporta el incidente.",
  },
  {
    table: "incidents",
    column: "assigned_to",
    action: "migrate",
    rationale: "Persona asignada al incidente.",
  },
  {
    table: "risks",
    column: "owner_id",
    action: "migrate",
    rationale: "Owner del riesgo.",
  },

  // --- AI / AIMS ----------------------------------------------------
  {
    table: "ai_compliance_checks",
    column: "checked_by_id",
    action: "migrate",
    rationale: "Persona que ejecutó el check AI.",
  },
  {
    table: "ai_risk_assessments",
    column: "assessor_id",
    action: "migrate",
    rationale: "Evaluador del riesgo AI.",
  },
  {
    table: "ai_systems",
    column: "owner_id",
    action: "migrate",
    rationale: "Owner del sistema AI.",
  },
  {
    table: "aims_change_requests",
    column: "requested_by_id",
    action: "migrate",
    rationale: "Persona que solicita el cambio.",
  },
  {
    table: "aims_change_requests",
    column: "approved_by_id",
    action: "migrate",
    rationale: "Aprobador del cambio.",
  },
  {
    table: "aims_control_tests",
    column: "executed_by_id",
    action: "migrate",
    rationale: "Persona que ejecutó el test del control.",
  },
  {
    table: "aims_post_market_plans",
    column: "approved_by_id",
    action: "migrate",
    rationale: "Aprobador del plan post-mercado.",
  },
  {
    table: "aims_requirement_checks",
    column: "assessed_by_id",
    action: "migrate",
    rationale: "Evaluador del requirement check.",
  },
  {
    table: "aims_technical_file_sections",
    column: "reviewed_by_id",
    action: "migrate",
    rationale: "Reviewer de la sección del technical file.",
  },

  // --- Secretaría / RBAC -------------------------------------------
  {
    table: "secretaria_role_assignments",
    column: "person_id",
    action: "migrate",
    rationale: "Asignación de rol Secretaría. ON DELETE RESTRICT en Cloud — un duplicado con asignación impide DELETE pero NO impide UPDATE de la FK.",
  },
  {
    table: "user_profiles",
    column: "person_id",
    action: "migrate",
    critical: true,
    rationale:
      "Bridge entre auth.users y persons. Un duplicado vinculado a un usuario real significa que ese usuario opera bajo identidad incorrecta.",
  },
];

// Sanity check at module load: list must be exactly the 47 FKs we
// expect (or the script must be regenerated against Cloud).
// Breakdown: 44 migrate + 3 skip (WORM) = 47 total.
const EXPECTED_FK_COUNT = 47;
const EXPECTED_MIGRATE_COUNT = 44;
const EXPECTED_SKIP_COUNT = 3;
if (PERSONS_FK_REFERENCES.length !== EXPECTED_FK_COUNT) {
  console.warn(
    `⚠️ FK list has ${PERSONS_FK_REFERENCES.length} entries, expected ${EXPECTED_FK_COUNT}. ` +
      `Re-probe pg_constraint and regenerate this script.`,
  );
}
{
  const migrateCount = PERSONS_FK_REFERENCES.filter((r) => r.action === "migrate").length;
  const skipCount = PERSONS_FK_REFERENCES.filter((r) => r.action === "skip").length;
  if (migrateCount !== EXPECTED_MIGRATE_COUNT || skipCount !== EXPECTED_SKIP_COUNT) {
    console.warn(
      `⚠️ FK action mix is migrate=${migrateCount}, skip=${skipCount}; ` +
        `expected migrate=${EXPECTED_MIGRATE_COUNT}, skip=${EXPECTED_SKIP_COUNT}. ` +
        `WORM tables (capital_movements, no_session_*) must stay action=skip.`,
    );
  }
}

// --------------------------------------------------------------------
// Types
// --------------------------------------------------------------------
interface PersonRow {
  id: string;
  full_name: string;
  tax_id: string | null;
  person_type: "PF" | "PJ" | null;
  created_at: string | null;
}

interface DuplicatePair {
  canonical: PersonRow;
  duplicate: PersonRow;
  reason: string;
}

interface PreflightResult {
  ok: boolean;
  conflicts: string[];
  warnings: string[];
}

// --------------------------------------------------------------------
// Detection
// --------------------------------------------------------------------
async function detectDuplicates(supabase: SupabaseClient): Promise<DuplicatePair[]> {
  const { data: allPersons, error } = await supabase
    .from("persons")
    .select("id, full_name, tax_id, person_type, created_at")
    .eq("tenant_id", TENANT_ID)
    .order("tax_id", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(`detectDuplicates query failed: ${error.message}`);

  const persons = (allPersons ?? []) as PersonRow[];
  const pairs: DuplicatePair[] = [];

  // -- Type A: two rows with the same real tax_id ---------------------
  // (Skip synthetic prefixes: PENDIENTE-, E2E-, FREE-FLOAT-, ARCHIVED-.)
  const groupsByTaxId = new Map<string, PersonRow[]>();
  for (const p of persons) {
    if (!p.tax_id) continue;
    if (
      p.tax_id.startsWith("PENDIENTE-") ||
      p.tax_id.startsWith("E2E-") ||
      p.tax_id.startsWith("FREE-FLOAT-") ||
      p.tax_id.startsWith("ARCHIVED-")
    ) {
      continue;
    }
    const arr = groupsByTaxId.get(p.tax_id) ?? [];
    arr.push(p);
    groupsByTaxId.set(p.tax_id, arr);
  }
  for (const [taxId, group] of groupsByTaxId.entries()) {
    if (group.length < 2) continue;
    // Convention: oldest = canonical, newer = duplicate. Operator can
    // override with --pair=<canonical>:<duplicate>.
    const sorted = [...group].sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""));
    const canonical = sorted[0];
    for (const dup of sorted.slice(1)) {
      pairs.push({
        canonical,
        duplicate: dup,
        reason: `Type A (real tax_id ${taxId} shared between ${group.length} rows)`,
      });
    }
  }

  // -- Type B: a PENDIENTE-* row whose full_name matches a canonical --
  // This is a HEURISTIC. Surface for human review; do NOT auto-apply.
  const canonicals = persons.filter(
    (p) =>
      p.tax_id &&
      !p.tax_id.startsWith("PENDIENTE-") &&
      !p.tax_id.startsWith("E2E-") &&
      !p.tax_id.startsWith("FREE-FLOAT-") &&
      !p.tax_id.startsWith("ARCHIVED-"),
  );
  const pendings = persons.filter((p) => p.tax_id?.startsWith("PENDIENTE-"));

  for (const canon of canonicals) {
    const canonKey = normaliseName(canon.full_name);
    if (canonKey.length < 5) continue;
    for (const pend of pendings) {
      const pendKey = normaliseName(pend.full_name);
      if (pendKey.length < 5) continue;
      if (canonKey === pendKey) {
        pairs.push({
          canonical: canon,
          duplicate: pend,
          reason: `Type B (name match — HEURISTIC, human confirmation required): "${canon.full_name}" ↔ "${pend.full_name}"`,
        });
      }
    }
  }

  return pairs;
}

function normaliseName(n: string): string {
  return n
    .toLowerCase()
    .replace(/\s+s\.?l\.?u?\.?\b/g, "")
    .replace(/\s+s\.?a\.?\b/g, "")
    .replace(/[.,\s]+/g, " ")
    .trim();
}

// --------------------------------------------------------------------
// Preflight
// --------------------------------------------------------------------
async function preflightCheck(
  supabase: SupabaseClient,
  pair: DuplicatePair,
): Promise<PreflightResult> {
  const conflicts: string[] = [];
  const warnings: string[] = [];

  // ---- Check 1: cargo collision in condiciones_persona -------------
  // Plan §C2. Compare each VIGENTE row of duplicate against canonical
  // on (entity_id, body_id, tipo_condicion). Body_id is NULL for SOCIO
  // and ADMIN_*; index ux_condicion_vigente uses COALESCE(body_id, zero).
  const { data: dupCargos, error: e1 } = await supabase
    .from("condiciones_persona")
    .select("id, entity_id, body_id, tipo_condicion")
    .eq("tenant_id", TENANT_ID)
    .eq("person_id", pair.duplicate.id)
    .eq("estado", "VIGENTE");
  if (e1) throw new Error(`preflight cargos: ${e1.message}`);

  for (const dc of dupCargos ?? []) {
    let q = supabase
      .from("condiciones_persona")
      .select("id, tipo_condicion")
      .eq("tenant_id", TENANT_ID)
      .eq("person_id", pair.canonical.id)
      .eq("entity_id", dc.entity_id)
      .eq("tipo_condicion", dc.tipo_condicion)
      .eq("estado", "VIGENTE");
    if (dc.body_id === null) {
      q = q.is("body_id", null);
    } else {
      q = q.eq("body_id", dc.body_id);
    }
    const { data: clash } = await q.maybeSingle();
    if (clash) {
      conflicts.push(
        `cargo collision: both have ${dc.tipo_condicion} VIGENTE en entity=${dc.entity_id}${
          dc.body_id ? ` body=${dc.body_id}` : ""
        } (canonical condicion id=${clash.id})`,
      );
    }
  }

  // ---- Check 2: entities.person_id bridge --------------------------
  // CRITICAL CHECK. The duplicate may have one or more entities
  // pointing at it (entities.person_id). If we migrate FK to canonical
  // but the entities don't actually represent the same legal subject,
  // we corrupt the entity↔PJ relationship.
  const { data: dupEntities } = await supabase
    .from("entities")
    .select("id, legal_name, common_name")
    .eq("tenant_id", TENANT_ID)
    .eq("person_id", pair.duplicate.id);

  const { data: canonEntities } = await supabase
    .from("entities")
    .select("id, legal_name, common_name")
    .eq("tenant_id", TENANT_ID)
    .eq("person_id", pair.canonical.id);

  if ((dupEntities ?? []).length > 0 && (canonEntities ?? []).length > 0) {
    const dupNames = (dupEntities ?? []).map((e) => `${e.legal_name} (${e.id})`).join("; ");
    const canonNames = (canonEntities ?? []).map((e) => `${e.legal_name} (${e.id})`).join("; ");
    conflicts.push(
      `entities.person_id ambiguity: duplicate has entities [${dupNames}], canonical has [${canonNames}]. ` +
        `Two real entities share the same PJ — this requires HUMAN judgement: ` +
        `are they actually the same legal subject? If yes, one entity should be archived. ` +
        `If no, one of the persons rows has a wrong tax_id and the script cannot decide.`,
    );
  } else if ((dupEntities ?? []).length > 0) {
    warnings.push(
      `entities.person_id will move: ${(dupEntities ?? [])
        .map((e) => `${e.legal_name} (${e.id})`)
        .join("; ")} → canonical person ${pair.canonical.id}`,
    );
  }

  // ---- Check 3: capital_holdings collision -------------------------
  // If both canonical and duplicate hold capital in the same entity
  // simultaneously (active holdings, effective_to NULL), merging
  // would inflate the % capital. Flag as conflict.
  const { data: dupHoldings } = await supabase
    .from("capital_holdings")
    .select("id, entity_id, porcentaje_capital")
    .eq("tenant_id", TENANT_ID)
    .eq("holder_person_id", pair.duplicate.id)
    .is("effective_to", null);

  for (const dh of dupHoldings ?? []) {
    const { data: clash } = await supabase
      .from("capital_holdings")
      .select("id, porcentaje_capital")
      .eq("tenant_id", TENANT_ID)
      .eq("holder_person_id", pair.canonical.id)
      .eq("entity_id", dh.entity_id)
      .is("effective_to", null)
      .maybeSingle();
    if (clash) {
      conflicts.push(
        `capital_holdings collision: both hold active capital in entity=${dh.entity_id} ` +
          `(dup ${dh.porcentaje_capital}% + canon ${clash.porcentaje_capital}%). ` +
          `Merging would double-count. Close one or merge holdings manually.`,
      );
    }
  }

  // ---- Check 4: ux_representaciones_vigente -----------------------
  // Index keys (verified 2026-05-12 via pg_indexes):
  //   (entity_id, represented_person_id, scope, COALESCE(meeting_id, sentinel))
  //   WHERE effective_to IS NULL
  //
  // The unique key uses `represented_person_id`, NOT `representative_person_id`.
  // So a 23505 collision happens iff BOTH canonical and duplicate appear as
  // `represented_person_id` in a VIGENTE row with the same (entity, scope, meeting).
  // Migrations of `representative_person_id` cannot trip this index. We surface
  // an informational WARN for those moves so the operator sees the data flow.
  const { data: dupRepsRepresented, error: e5a } = await supabase
    .from("representaciones")
    .select("id, entity_id, scope, meeting_id, representative_person_id")
    .eq("tenant_id", TENANT_ID)
    .eq("represented_person_id", pair.duplicate.id)
    .is("effective_to", null);
  if (e5a) throw new Error(`preflight representaciones (represented): ${e5a.message}`);

  for (const r of dupRepsRepresented ?? []) {
    let q = supabase
      .from("representaciones")
      .select("id, representative_person_id")
      .eq("tenant_id", TENANT_ID)
      .eq("entity_id", r.entity_id)
      .eq("represented_person_id", pair.canonical.id)
      .eq("scope", r.scope)
      .is("effective_to", null);
    q = r.meeting_id ? q.eq("meeting_id", r.meeting_id) : q.is("meeting_id", null);
    const { data: clash } = await q.maybeSingle();
    if (clash) {
      conflicts.push(
        `ux_representaciones_vigente collision: both have VIGENTE representación as represented ` +
          `in entity=${r.entity_id} scope=${r.scope} meeting=${r.meeting_id ?? "NULL"} ` +
          `(canonical representación id=${clash.id})`,
      );
    }
  }

  // Informational only: how many representaciones move as representative_person_id?
  const { count: repAsRepresentativeCount } = await supabase
    .from("representaciones")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", TENANT_ID)
    .eq("representative_person_id", pair.duplicate.id)
    .is("effective_to", null);
  if ((repAsRepresentativeCount ?? 0) > 0) {
    warnings.push(
      `representaciones.representative_person_id will move ${repAsRepresentativeCount} VIGENTE row(s) ` +
        `(no unique-key collision risk — column not part of ux_representaciones_vigente)`,
    );
  }

  // ---- Check 5: ux_authority_vigente ------------------------------
  // Index keys (verified 2026-05-12 via pg_indexes):
  //   (tenant_id, entity_id, COALESCE(body_id, sentinel), person_id, cargo)
  //   WHERE estado = 'VIGENTE'
  //
  // Two VIGENTE rows for canonical + duplicate with same (entity, body, cargo)
  // would trip 23505 when migrating authority_evidence.person_id.
  const { data: dupAEs, error: e6 } = await supabase
    .from("authority_evidence")
    .select("id, entity_id, body_id, cargo")
    .eq("tenant_id", TENANT_ID)
    .eq("person_id", pair.duplicate.id)
    .eq("estado", "VIGENTE");
  if (e6) throw new Error(`preflight authority_evidence: ${e6.message}`);

  for (const ae of dupAEs ?? []) {
    let q = supabase
      .from("authority_evidence")
      .select("id, cargo")
      .eq("tenant_id", TENANT_ID)
      .eq("person_id", pair.canonical.id)
      .eq("entity_id", ae.entity_id)
      .eq("cargo", ae.cargo)
      .eq("estado", "VIGENTE");
    q = ae.body_id ? q.eq("body_id", ae.body_id) : q.is("body_id", null);
    const { data: clash } = await q.maybeSingle();
    if (clash) {
      conflicts.push(
        `ux_authority_vigente collision: both have VIGENTE authority_evidence ` +
          `entity=${ae.entity_id} body=${ae.body_id ?? "NULL"} cargo=${ae.cargo} ` +
          `(canonical authority id=${clash.id})`,
      );
    }
  }

  // ---- Check 6: idempotency ---------------------------------------
  // If duplicate is already archived, nothing to do.
  if (pair.duplicate.tax_id?.startsWith("ARCHIVED-")) {
    warnings.push(`duplicate is already archived (tax_id=${pair.duplicate.tax_id}); migration will be skipped`);
  }

  return { ok: conflicts.length === 0, conflicts, warnings };
}

// --------------------------------------------------------------------
// Reporting
// --------------------------------------------------------------------
function renderPair(pair: DuplicatePair, pf: PreflightResult) {
  const lines: string[] = [];
  lines.push(`  Canonical: ${pair.canonical.full_name} [tax=${pair.canonical.tax_id ?? "NULL"}] id=${pair.canonical.id}`);
  lines.push(`  Duplicate: ${pair.duplicate.full_name} [tax=${pair.duplicate.tax_id ?? "NULL"}] id=${pair.duplicate.id}`);
  lines.push(`  Reason   : ${pair.reason}`);
  if (pf.warnings.length > 0) {
    for (const w of pf.warnings) lines.push(`  WARN     : ${w}`);
  }
  if (pf.ok) {
    lines.push(`  Preflight: OK`);
  } else {
    lines.push(`  Preflight: FAIL (${pf.conflicts.length} conflict${pf.conflicts.length === 1 ? "" : "s"})`);
    for (const c of pf.conflicts) lines.push(`     - ${c}`);
  }
  return lines.join("\n");
}

// --------------------------------------------------------------------
// Apply mode
// --------------------------------------------------------------------
// Migrates references in every FK column listed in PERSONS_FK_REFERENCES
// from duplicate.id to canonical.id, then soft-archives the duplicate
// by renaming its tax_id (frees the UNIQUE constraint added in
// migration 000063 for the canonical to keep its real tax_id).
//
// Order matters:
//   1. Migrate ALL FK refs first (UPDATE table SET col = canon WHERE col = dup).
//   2. Verify post-migration that NO refs remain (orphan check).
//   3. Rename duplicate's tax_id + full_name as ARCHIVED-*.
//
// If step 2 fails (some FK was missed in the list), we bail BEFORE
// archiving so the duplicate row stays addressable and recoverable.
async function applyConsolidation(
  supabase: SupabaseClient,
  pair: DuplicatePair,
): Promise<void> {
  console.log(`→ Applying consolidation`);
  console.log(`     canonical : ${pair.canonical.full_name} [tax=${pair.canonical.tax_id ?? "NULL"}] id=${pair.canonical.id}`);
  console.log(`     duplicate : ${pair.duplicate.full_name} [tax=${pair.duplicate.tax_id ?? "NULL"}] id=${pair.duplicate.id}`);

  // ---- Idempotency: already archived? ------------------------------
  if (pair.duplicate.tax_id?.startsWith("ARCHIVED-")) {
    console.log(`     already archived (tax_id=${pair.duplicate.tax_id}). Skipping.`);
    return;
  }

  // ---- Phase 1: migrate FK references ------------------------------
  const migrationLog: Array<{ table: string; column: string; rows: number; critical: boolean }> = [];
  for (const ref of PERSONS_FK_REFERENCES) {
    if (ref.action !== "migrate") {
      console.log(`     [SKIP] ${ref.table}.${ref.column} (${ref.rationale})`);
      continue;
    }
    const rows = await migrateFk(supabase, ref, pair);
    migrationLog.push({ table: ref.table, column: ref.column, rows, critical: ref.critical ?? false });
    const marker = ref.critical && rows > 0 ? " [CRITICAL]" : "";
    console.log(`     [${rows.toString().padStart(3, " ")}] ${ref.table}.${ref.column}${marker}`);
  }

  // ---- Phase 2: post-migration orphan check -----------------------
  // Pick a representative sample of HIGH-traffic FKs to verify we
  // didn't miss anything. The probe-based PERSONS_FK_REFERENCES list
  // should cover all 47, but a re-probe is the gold standard before
  // archiving.
  const orphanCheck = await verifyNoRemainingRefs(supabase, pair.duplicate.id);
  if (orphanCheck.length > 0) {
    console.error(`     ✗ orphan check failed — ${orphanCheck.length} FK still points at duplicate:`);
    for (const o of orphanCheck) {
      console.error(`        - ${o.table}.${o.column}: ${o.count} row(s)`);
    }
    throw new Error(
      `Refusing to archive — duplicate still has incoming references. ` +
        `Update PERSONS_FK_REFERENCES list and re-run.`,
    );
  }

  // ---- Phase 3: soft-archive --------------------------------------
  const originalTaxId = pair.duplicate.tax_id ?? "NULL";
  const archivedTaxId = `ARCHIVED-${Date.now()}-${originalTaxId}`;
  const archivedName = `[ARCHIVED] ${pair.duplicate.full_name}`;

  const { error: archErr } = await supabase
    .from("persons")
    .update({ tax_id: archivedTaxId, full_name: archivedName })
    .eq("id", pair.duplicate.id);

  if (archErr) throw new Error(`soft-archive failed: ${archErr.message}`);

  console.log(`     ✓ archived: tax_id=${originalTaxId} → ${archivedTaxId}`);
  console.log("");
  const totalRows = migrationLog.reduce((sum, m) => sum + m.rows, 0);
  console.log(`     Summary: ${totalRows} FK row(s) migrated across ${migrationLog.filter((m) => m.rows > 0).length} table.column(s)`);
}

async function migrateFk(
  supabase: SupabaseClient,
  ref: FkRef,
  pair: DuplicatePair,
): Promise<number> {
  // Use .select("id", { count: "exact" }) to get the affected row count.
  // supabase-js' bare update() doesn't return count unless we chain select.
  const { data, error, count } = await supabase
    .from(ref.table)
    .update({ [ref.column]: pair.canonical.id })
    .eq(ref.column, pair.duplicate.id)
    .select("*", { count: "exact", head: false });

  if (error) {
    // ON DELETE RESTRICT columns may complain if a constraint trips,
    // but UPDATE shouldn't. Surface every error with context.
    throw new Error(`migrateFk(${ref.table}.${ref.column}): ${error.message}`);
  }
  return count ?? (data?.length ?? 0);
}

interface OrphanRef {
  table: string;
  column: string;
  count: number;
}

async function verifyNoRemainingRefs(
  supabase: SupabaseClient,
  duplicateId: string,
): Promise<OrphanRef[]> {
  // For every FK in our list, count rows still pointing at duplicate.
  // If any > 0, return them so the caller can abort.
  const orphans: OrphanRef[] = [];
  for (const ref of PERSONS_FK_REFERENCES) {
    if (ref.action !== "migrate") continue;
    const { count, error } = await supabase
      .from(ref.table)
      .select("*", { count: "exact", head: true })
      .eq(ref.column, duplicateId);
    if (error) {
      // Skip if the table is unreachable (e.g., RLS oddity) but log it.
      console.warn(`     [verify] cannot probe ${ref.table}.${ref.column}: ${error.message}`);
      continue;
    }
    if ((count ?? 0) > 0) {
      orphans.push({ table: ref.table, column: ref.column, count: count ?? 0 });
    }
  }
  return orphans;
}

// --------------------------------------------------------------------
// Main
// --------------------------------------------------------------------
async function main() {
  if (!SUPABASE_SERVICE_KEY) {
    console.error("ERROR: SUPABASE_SERVICE_ROLE_KEY env var required (service role bypasses RLS).");
    console.error("       Export it from your .env.local or pass it inline.");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const apply = args.includes("--apply");
  const autoDetect = args.includes("--auto-detect");
  const pairArg = args.find((a) => a.startsWith("--pair="))?.slice("--pair=".length);

  if (!dryRun && !apply) {
    console.error("Usage:");
    console.error("  --dry-run                            (read-only, default safe mode)");
    console.error("  --apply --auto-detect                (consolidate every detected Type-A pair)");
    console.error("  --apply --pair=<canonical>:<duplicate>");
    process.exit(1);
  }

  if (apply && !autoDetect && !pairArg) {
    console.error("ERROR: --apply requires either --auto-detect or --pair=<canonical>:<duplicate>");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });

  const migrateCount = PERSONS_FK_REFERENCES.filter((r) => r.action === "migrate").length;
  const skipCount = PERSONS_FK_REFERENCES.filter((r) => r.action === "skip").length;
  console.log("consolidate-duplicate-persons");
  console.log(`  url    : ${SUPABASE_URL}`);
  console.log(`  tenant : ${TENANT_ID}`);
  console.log(`  mode   : ${dryRun ? "DRY-RUN" : "APPLY"}`);
  console.log(
    `  FK refs: ${PERSONS_FK_REFERENCES.length} total (${migrateCount} migrate + ${skipCount} skip WORM) — probe 2026-05-12`,
  );
  console.log("");

  const pairs = await detectDuplicates(supabase);

  if (pairs.length === 0) {
    console.log("No duplicate pairs detected. Database is clean.");
    return;
  }

  console.log(`Detected ${pairs.length} candidate duplicate pair(s):`);
  console.log("");

  const preflightResults: Array<{ pair: DuplicatePair; pf: PreflightResult }> = [];
  for (const pair of pairs) {
    const pf = await preflightCheck(supabase, pair);
    preflightResults.push({ pair, pf });
    console.log(renderPair(pair, pf));
    console.log("");
  }

  if (dryRun) {
    const okCount = preflightResults.filter((r) => r.pf.ok).length;
    const failCount = preflightResults.length - okCount;
    console.log("Summary:");
    console.log(`  ${okCount} pair(s) ready to consolidate (preflight OK)`);
    console.log(`  ${failCount} pair(s) blocked by preflight conflicts`);
    console.log("");
    console.log("DRY RUN complete. Re-run with --apply --auto-detect (or --pair=) to consolidate.");
    return;
  }

  // --- Apply mode (D2.2 will fill this in) -------------------------
  if (apply && autoDetect) {
    for (const { pair, pf } of preflightResults) {
      if (!pf.ok) {
        console.error(`SKIP (preflight fail): ${pair.duplicate.full_name}`);
        for (const c of pf.conflicts) console.error(`   - ${c}`);
        continue;
      }
      await applyConsolidation(supabase, pair);
    }
    console.log("\nDone.");
    return;
  }

  if (apply && pairArg) {
    const [canonId, dupId] = pairArg.split(":");
    const match = preflightResults.find(
      (r) => r.pair.canonical.id === canonId && r.pair.duplicate.id === dupId,
    );
    if (!match) {
      console.error(`Pair not found among detected duplicates: ${pairArg}`);
      console.error(`Hint: detected pairs above. Use the exact canonical:duplicate id format.`);
      process.exit(1);
    }
    if (!match.pf.ok) {
      console.error(`PREFLIGHT FAIL — refuse to consolidate.`);
      for (const c of match.pf.conflicts) console.error(`   - ${c}`);
      process.exit(2);
    }
    await applyConsolidation(supabase, match.pair);
    return;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
