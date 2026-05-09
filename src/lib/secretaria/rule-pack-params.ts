// Pure helpers extracted from src/hooks/useRulePacks.ts and
// src/hooks/useRuleManager.ts. Centralised so they can be unit-tested
// without TanStack Query or Supabase mocks, and to avoid the previous
// type duplication of `RulePackJoinRow` across hooks.

import type { RuleManagerInput } from "./rule-manager-contract";

/**
 * Shape returned by `rule_pack_versions` PostgREST queries that join
 * `rule_packs!inner(tenant_id, materia, organo_tipo)`.
 *
 * `version` is text in the database (legacy semver-like). `created_at` is
 * timestamptz. PostgREST returns the joined `rule_packs` as a single object
 * because of the `!inner` hint.
 */
export type RulePackJoinRow = {
  id: string;
  pack_id: string;
  version: string;
  is_active: boolean | null;
  payload: unknown;
  created_at: string | null;
  rule_packs: {
    tenant_id: string;
    materia: string;
    organo_tipo: string | null;
  } | null;
};

/**
 * Flat shape consumed by hooks/UI.
 */
export interface RulePackVersionRow {
  id: string;
  rule_pack_id: string;
  version_tag: string;
  status: string;
  params: unknown;
  created_at: string | null;
  tenant_id: string;
  materia?: string;
  clase?: string;
  organo_tipo?: string;
}

/**
 * Map a PostgREST joined row to the flat shape consumed by the rest of the
 * codebase. `fallbackTenantId` is used when the join column is null (which
 * shouldn't happen given `!inner`, but kept defensively).
 *
 * `is_active` truthiness rule preserved from the original inline maps:
 *   true  → "ACTIVE"
 *   false → "DEPRECATED"
 *   null  → "DEPRECATED"  (legacy rows that never set the flag)
 */
export function mapRulePackJoinRowToVersionRow(
  row: RulePackJoinRow,
  fallbackTenantId: string,
): RulePackVersionRow {
  const packed = row.rule_packs;
  return {
    id: row.id,
    rule_pack_id: row.pack_id,
    version_tag: row.version,
    status: row.is_active ? "ACTIVE" : "DEPRECATED",
    params: row.payload,
    created_at: row.created_at,
    tenant_id: packed?.tenant_id ?? fallbackTenantId,
    materia: packed?.materia,
    clase: undefined,
    organo_tipo: packed?.organo_tipo ?? undefined,
  };
}

/**
 * Pick the freshest `is_active = true` rule pack version when Cloud legacy
 * data contains more than one active row for the same matter (the canonical
 * INC-14 case for `AUMENTO_CAPITAL`).
 *
 * Policy: **"última activación/creación operativa gana, aunque la versión
 * semántica sea menor"**. Order by `created_at` DESC (timestamptz,
 * deterministic) rather than `version` DESC (text, not guaranteed sortable
 * as a semver string).
 *
 * Why this is correct even when `version` and `created_at` disagree:
 *   - When an operator recreates an older version after a newer one (by
 *     mistake or rollback) and forgets to deactivate the prior row, the
 *     most-recently-created row reflects the current operational intent.
 *   - The right long-term fix for accidental duplicates is to deactivate
 *     stale rows in Cloud, not to change this ordering.
 *
 * SQL is expected to provide a stable primary ordering by `created_at` DESC
 * (and ideally a deterministic tie-breaker), but this picker is the source
 * of truth for the decision: if the SQL ordering ever changes, the picker
 * still returns the correct row.
 *
 * Stability:
 *   - Ties on `created_at` keep the first row in input order.
 *   - Rows with `created_at` null are treated as older than any non-null
 *     timestamp.
 */
export function pickFreshestRulePackVersion(
  rows: ReadonlyArray<RulePackJoinRow>,
): RulePackJoinRow | null {
  if (rows.length === 0) return null;
  let best: RulePackJoinRow = rows[0];
  for (let i = 1; i < rows.length; i++) {
    const candidate = rows[i];
    const bestTime = best.created_at;
    const candidateTime = candidate.created_at;
    if (candidateTime === null) continue;
    if (bestTime === null) {
      best = candidate;
      continue;
    }
    // ISO-8601 strings sort lexicographically === chronologically
    if (candidateTime > bestTime) {
      best = candidate;
    }
  }
  return best;
}

/**
 * Extract `legal_majority` from a rule pack `payload` JSONB.
 *
 * Defensive: payloads come from Cloud and may have varied shapes. Tries a
 * small set of common keys (en + es) and returns null if none match.
 * Returns partial info (only `code` or only `threshold`) when one is
 * present and the other is missing.
 *
 * Precedence of candidate keys: `majority` → `mayoria` → `mayoria_legal`
 * → `majority_threshold`. The first key that yields a non-null result
 * wins.
 */
export function extractMajorityFromRulePackParams(
  params: unknown,
): RuleManagerInput["agreement"]["legal_majority"] | null {
  if (!params || typeof params !== "object" || Array.isArray(params)) return null;
  const record = params as Record<string, unknown>;
  const candidates = [
    record.majority,
    record.mayoria,
    record.mayoria_legal,
    record.majority_threshold,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "number") {
      return { code: null, threshold: candidate };
    }
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      const obj = candidate as Record<string, unknown>;
      const threshold =
        typeof obj.threshold === "number"
          ? obj.threshold
          : typeof obj.umbral === "number"
            ? obj.umbral
            : typeof obj.value === "number"
              ? obj.value
              : null;
      const code =
        typeof obj.code === "string"
          ? obj.code
          : typeof obj.codigo === "string"
            ? obj.codigo
            : null;
      const description =
        typeof obj.description === "string"
          ? obj.description
          : typeof obj.descripcion === "string"
            ? obj.descripcion
            : null;
      if (threshold !== null || code !== null) {
        return { code, threshold, description };
      }
    }
  }
  return null;
}
