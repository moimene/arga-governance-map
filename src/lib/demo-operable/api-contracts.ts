import { demoPackVersion, getDemoPackBinding, getDemoPackEntity } from "./demo-pack";
import { runDemoScenario } from "./runner";
import type { DemoGatePreview, DemoScenarioRunResult, DemoRunOptions } from "./runner";
import type { DemoScenarioId } from "./scenarios";
import { buildDemoTrustCenter } from "./trust-sandbox";
import type { DemoTrustCenter } from "./trust-sandbox";

export interface DemoRunScenarioRequest extends DemoRunOptions {
  scenario: DemoScenarioId;
}

export interface DemoRunScenarioResponse {
  demo_mode: true;
  simulated: true;
  readonly: true;
  scenario: DemoScenarioId;
  scenario_run_id: string;
  demo_pack_version: string;
  owner: "Secretaría Societaria";
  source_of_truth: "none";
  mutation_allowed: false;
  convocatoria_id: string;
  meeting_id: string;
  agreement_id: string;
  snapshot_id: string;
  agreement_result: "ADOPTADO" | "BLOQUEADO";
  evidence_bundle_id: string;
  narrative: string;
  gate_preview: DemoGatePreview;
  explain: DemoExplainResponse;
  hashes: DemoScenarioRunResult["hashes"];
  trust: DemoScenarioRunResult["trust"];
  trust_center: DemoTrustCenter;
  evidence: DemoScenarioRunResult["evidence"];
  entity_context: {
    entity_id: string;
    entity_name: string;
    entity_kind: string;
    body_id: string;
    body_name: string;
  };
}

export interface DemoExplainResponse {
  why_adopted: string[];
  legal_basis: string[];
  ruleset_hash: string;
  snapshot_hash: string;
  evidence_posture: string;
  warnings: string[];
}

export function buildDemoExplainResponse(run: DemoScenarioRunResult): DemoExplainResponse {
  return {
    why_adopted: run.explain.why,
    legal_basis: run.explain.legalBasis,
    ruleset_hash: run.explain.rulesetHash,
    snapshot_hash: run.explain.snapshotHash,
    evidence_posture: run.evidence.posture,
    warnings: run.explain.warnings,
  };
}

export function buildDemoGatePreviewResponse(run: DemoScenarioRunResult): DemoGatePreview {
  return run.gatePreview;
}

export function buildDemoRunScenarioResponse(input: DemoRunScenarioRequest): DemoRunScenarioResponse {
  const run = runDemoScenario(input.scenario, { scenarioRunId: input.scenarioRunId });
  const binding = getDemoPackBinding(input.scenario);
  const entity = binding ? getDemoPackEntity(binding.entityId) : undefined;

  return {
    demo_mode: true,
    simulated: true,
    readonly: true,
    scenario: input.scenario,
    scenario_run_id: run.scenarioRunId,
    demo_pack_version: demoPackVersion,
    owner: "Secretaría Societaria",
    source_of_truth: "none",
    mutation_allowed: false,
    convocatoria_id: run.ids.convocatoriaId,
    meeting_id: run.ids.meetingId,
    agreement_id: run.ids.agreementId,
    snapshot_id: run.ids.snapshotId,
    agreement_result: run.outcome,
    evidence_bundle_id: run.ids.evidenceBundleId,
    narrative: run.narrative,
    gate_preview: buildDemoGatePreviewResponse(run),
    explain: buildDemoExplainResponse(run),
    hashes: run.hashes,
    trust: run.trust,
    trust_center: buildDemoTrustCenter(run),
    evidence: run.evidence,
    entity_context: {
      entity_id: entity?.id ?? run.ids.entityId,
      entity_name: entity?.name ?? "ARGA Seguros S.A.",
      entity_kind: entity?.kind ?? "SA_COTIZADA",
      body_id: entity?.governingBody.id ?? run.ids.entityId,
      body_name: entity?.governingBody.name ?? "Consejo de Administracion",
    },
  };
}
