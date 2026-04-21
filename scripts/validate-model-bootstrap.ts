// scripts/validate-model-bootstrap.ts
/**
 * T18 — Parity validation for the canonical model after T14-T17 bootstrap.
 *
 * Run after T14 (bootstrap PJ), T15 (backfill condiciones), T16 (backfill
 * holdings), T17 (seed demo ARGA canonical) to confirm the Cloud state
 * matches the invariants required by the spec (§7.1-§7.3).
 *
 * Exit code:
 *   0 — all checks passed
 *   1 — one or more checks failed (printed with "Rows: ...")
 *
 * DEVIATIONS from plan §T18:
 *
 *   1. Plan uses supabase.rpc("execute_sql", ...) with literal SQL. That
 *      RPC is NOT exposed on this Cloud project (same constraint as T9-T17
 *      tests). Checks are rewritten as PostgREST queries + client-side
 *      filtering, mirroring the patterns in canonical-bootstrap.test.ts.
 *
 *   2. Plan's check-2 asserts person_type = 'JURIDICA' but the Cloud CHECK
 *      constraint persons_person_type_check restricts values to 'PF'|'PJ'.
 *      Substituted to 'PJ' (same fix as T14).
 *
 *   3. Added a 6th check: ARGA Seguros canonical cap table sums to 100%.
 *      Not in the plan but relevant guardrail post-T17. Demo cap table
 *      integrity is what the motor de reglas relies on for quórum
 *      calculations.
 *
 * This script is read-only — no writes, no side effects. Safe to re-run
 * as part of CI or on-demand.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    "Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env. " +
      "Source .env.local before running."
  );
  process.exit(1);
}
const supabase: SupabaseClient = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

// Real Cloud UUID for ARGA Seguros (see supabase-test-client.ts — updated
// at T17 from the non-existent 00000000-...-010 the plan assumed).
const ENTITY_ARGA_SEGUROS = "6d7ed736-f263-4531-a59d-c6ca0cd41602";

type Check = { name: string; ok: boolean; detail?: string };

async function checkPersonIdNotNull(): Promise<Check> {
  const { data, error } = await supabase
    .from("entities")
    .select("id")
    .is("person_id", null);
  if (error) return { name: "Toda entity tiene person_id NOT NULL", ok: false, detail: error.message };
  const ok = (data ?? []).length === 0;
  return {
    name: "Toda entity tiene person_id NOT NULL",
    ok,
    detail: ok ? undefined : `${data!.length} entities still have person_id NULL`,
  };
}

async function checkAllPjPersonType(): Promise<Check> {
  const { data, error } = await supabase
    .from("entities")
    .select("id, persons:person_id(person_type)")
    .not("person_id", "is", null);
  if (error) return { name: "Toda entity tiene PJ person_type='PJ'", ok: false, detail: error.message };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wrong = (data as any[] ?? []).filter(
    (e) => !e.persons || e.persons.person_type !== "PJ"
  );
  const ok = wrong.length === 0;
  return {
    name: "Toda entity tiene PJ person_type='PJ'",
    ok,
    detail: ok ? undefined : `${wrong.length} entities have non-PJ person_type`,
  };
}

async function checkCapitalProfileVigente(): Promise<Check> {
  const [{ data: entities, error: e1 }, { data: profiles, error: e2 }] = await Promise.all([
    supabase.from("entities").select("id"),
    supabase.from("entity_capital_profile").select("entity_id").eq("estado", "VIGENTE"),
  ]);
  if (e1 || e2) {
    return {
      name: "Toda entity tiene entity_capital_profile VIGENTE",
      ok: false,
      detail: (e1?.message ?? e2?.message) || undefined,
    };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const withProfile = new Set((profiles as any[] ?? []).map((p) => p.entity_id));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const missing = (entities as any[] ?? []).filter((e) => !withProfile.has(e.id));
  const ok = missing.length === 0;
  return {
    name: "Toda entity tiene entity_capital_profile VIGENTE",
    ok,
    detail: ok ? undefined : `${missing.length} entities missing VIGENTE profile`,
  };
}

async function checkMandatesHaveHoldings(): Promise<Check> {
  const [{ data: mandates, error: e1 }, { data: holdings, error: e2 }] = await Promise.all([
    supabase
      .from("mandates")
      .select("id, person_id, body_id, governing_bodies:body_id(entity_id)")
      .not("porcentaje_capital", "is", null),
    supabase.from("capital_holdings").select("entity_id, holder_person_id"),
  ]);
  if (e1 || e2) {
    return {
      name: "mandates con porcentaje_capital tienen capital_holdings",
      ok: false,
      detail: (e1?.message ?? e2?.message) || undefined,
    };
  }
  const hKeys = new Set(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (holdings as any[] ?? []).map((h) => `${h.holder_person_id}|${h.entity_id}`)
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const missing = (mandates as any[] ?? []).filter((m) => {
    const entityId = m.governing_bodies?.entity_id;
    return !hKeys.has(`${m.person_id}|${entityId}`);
  });
  const ok = missing.length === 0;
  return {
    name: "mandates con porcentaje_capital tienen capital_holdings",
    ok,
    detail: ok ? undefined : `${missing.length} mandates missing holdings`,
  };
}

async function checkMandatesHaveCondiciones(): Promise<Check> {
  const [{ data: mandates, error: e1 }, { data: cond, error: e2 }] = await Promise.all([
    supabase
      .from("mandates")
      .select("id, person_id, body_id, governing_bodies:body_id(entity_id)")
      .not("role", "is", null),
    supabase
      .from("condiciones_persona")
      .select("person_id, entity_id, body_id"),
  ]);
  if (e1 || e2) {
    return {
      name: "mandates con role tienen condiciones_persona",
      ok: false,
      detail: (e1?.message ?? e2?.message) || undefined,
    };
  }
  const cKeys = new Set(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (cond as any[] ?? []).map((c) => `${c.person_id}|${c.entity_id}|${c.body_id}`)
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const missing = (mandates as any[] ?? []).filter((m) => {
    const entityId = m.governing_bodies?.entity_id;
    return !cKeys.has(`${m.person_id}|${entityId}|${m.body_id}`);
  });
  const ok = missing.length === 0;
  return {
    name: "mandates con role tienen condiciones_persona",
    ok,
    detail: ok ? undefined : `${missing.length} mandates missing condicion_persona`,
  };
}

async function checkArgaCapTableSumsTo100(): Promise<Check> {
  const { data, error } = await supabase
    .from("capital_holdings")
    .select("porcentaje_capital, is_treasury")
    .eq("entity_id", ENTITY_ARGA_SEGUROS)
    .is("effective_to", null);
  if (error) return { name: "ARGA Seguros cap table vigente suma 100%", ok: false, detail: error.message };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data as any[]) ?? [];
  const total = rows
    .filter((r) => !r.is_treasury)
    .reduce((sum, r) => sum + Number(r.porcentaje_capital ?? 0), 0);
  const ok = Math.abs(total - 100) < 0.01;
  return {
    name: "ARGA Seguros cap table vigente suma 100%",
    ok,
    detail: ok ? undefined : `sum = ${total.toFixed(2)}%`,
  };
}

async function main() {
  console.log("Validando paridad del modelo canónico...");
  console.log(`  Cloud: ${url}`);
  console.log("");

  const checks: Check[] = [
    await checkPersonIdNotNull(),
    await checkAllPjPersonType(),
    await checkCapitalProfileVigente(),
    await checkMandatesHaveHoldings(),
    await checkMandatesHaveCondiciones(),
    await checkArgaCapTableSumsTo100(),
  ];

  let allOk = true;
  for (const c of checks) {
    const icon = c.ok ? "OK" : "FAIL";
    const detail = c.detail ? ` — ${c.detail}` : "";
    console.log(`[${icon}] ${c.name}${detail}`);
    if (!c.ok) allOk = false;
  }
  console.log("");
  console.log(allOk ? "All checks passed." : "Some checks FAILED. Review above.");
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
