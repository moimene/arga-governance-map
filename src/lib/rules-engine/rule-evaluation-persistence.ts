import type { EvalSeverity, MeetingAdoptionSnapshot } from "@/lib/rules-engine";

export interface RuleEvaluationResultInsert {
  tenant_id: string;
  agreement_id: string;
  etapa: string;
  ok: boolean;
  explain: Record<string, unknown>;
  blocking_issues: string[];
  warnings: string[];
  rule_pack_id: string | null;
  rule_pack_version: string | null;
  rule_pack_version_id: string | null;
  ruleset_snapshot_id: string | null;
  payload_hash: string | null;
  severity: EvalSeverity;
  evaluation_hash: string;
}

export interface BuildRuleEvaluationResultInput {
  tenantId: string;
  agreementId: string | null | undefined;
  snapshot: MeetingAdoptionSnapshot;
}

export interface RuleEvaluationPersistenceReadiness {
  ready: boolean;
  missing: string[];
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`)
    .join(",")}}`;
}

async function sha256Hex(value: unknown) {
  const data = new TextEncoder().encode(canonicalJson(value));
  const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function evaluateRuleEvaluationPersistenceReadiness(
  input: BuildRuleEvaluationResultInput,
): RuleEvaluationPersistenceReadiness {
  const trace = input.snapshot.rule_trace;
  const missing: string[] = [];

  if (!input.tenantId) missing.push("tenant_id");
  if (!input.agreementId) missing.push("agreement_id");
  if (!trace) missing.push("snapshot.rule_trace");
  if (trace?.source !== "V2_CLOUD") missing.push("rule_trace.source_v2_cloud");
  if (!trace?.rule_pack_version_id) missing.push("rule_pack_version_id");
  if (!trace?.payload_hash) missing.push("payload_hash");
  if (!trace?.ruleset_snapshot_id) missing.push("ruleset_snapshot_id");

  return {
    ready: missing.length === 0,
    missing,
  };
}

export async function buildRuleEvaluationResultInsert(
  input: BuildRuleEvaluationResultInput,
): Promise<RuleEvaluationResultInsert | null> {
  const readiness = evaluateRuleEvaluationPersistenceReadiness(input);
  if (!readiness.ready || !input.agreementId || !input.snapshot.rule_trace) return null;

  const trace = input.snapshot.rule_trace;
  const explain = {
    schema_version: "rule-evaluation-result.meeting-adoption.v1",
    source: "meeting_adoption_snapshot",
    agenda_item_index: input.snapshot.agenda_item_index,
    materia: input.snapshot.materia,
    materia_clase: input.snapshot.materia_clase,
    status_resolucion: input.snapshot.status_resolucion,
    vote_summary: input.snapshot.vote_summary,
    vote_completeness: input.snapshot.vote_completeness,
    voting_context: input.snapshot.voting_context,
    societary_validity: input.snapshot.societary_validity,
    pacto_compliance: input.snapshot.pacto_compliance,
    dual_evaluation: input.snapshot.dual_evaluation ?? null,
    rule_trace: trace,
  };
  const rowWithoutHash = {
    tenant_id: input.tenantId,
    agreement_id: input.agreementId,
    etapa: `MEETING_ADOPTION_POINT_${input.snapshot.agenda_item_index}`,
    ok: input.snapshot.societary_validity.ok && input.snapshot.status_resolucion === "ADOPTED",
    explain,
    blocking_issues: [
      ...input.snapshot.societary_validity.blocking_issues,
      ...input.snapshot.pacto_compliance.blocking_issues.map((issue) => `pacto:${issue}`),
    ],
    warnings: [
      ...input.snapshot.societary_validity.warnings,
      ...input.snapshot.pacto_compliance.warnings.map((warning) => `pacto:${warning}`),
      ...(trace.warnings ?? []),
    ],
    rule_pack_id: trace.rule_pack_id,
    rule_pack_version: trace.rule_pack_version,
    rule_pack_version_id: trace.rule_pack_version_id,
    ruleset_snapshot_id: trace.ruleset_snapshot_id,
    payload_hash: trace.payload_hash,
    severity: input.snapshot.societary_validity.severity,
  };

  return {
    ...rowWithoutHash,
    evaluation_hash: await sha256Hex(rowWithoutHash),
  };
}
