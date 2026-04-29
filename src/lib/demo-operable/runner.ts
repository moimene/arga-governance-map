import {
  DemoGateStatus,
  DemoOutcome,
  DemoScenarioDefinition,
  DemoScenarioId,
  DemoStepId,
  DemoStepOwner,
  demoScenarioDefinitions,
  demoRunSteps,
  getDemoScenarioDefinition,
} from "./scenarios";

export type DemoRunStatus = "COMPLETED" | "FAILED_SAFE";
export type DemoEvidencePosture = "SANDBOX_VERIFIABLE" | "SANDBOX_STUB" | "NOT_FINAL_EVIDENCE";

export interface DemoStableIds {
  tenantId: string;
  entityId: string;
  convocatoriaId: string;
  meetingId: string;
  agreementId: string;
  minuteId: string;
  certificationId: string;
  evidenceBundleId: string;
  snapshotId: string;
}

export interface DemoGatePreview {
  preview: true;
  estado: DemoGateStatus;
  detalles: {
    quorum_ok: boolean;
    mayoria_global_ok: boolean;
    clases_ok: boolean;
    doble_umbral_ok: boolean;
    consents_ok: boolean;
    veto_ok: boolean;
  };
}

export interface DemoGatePreviewUi {
  quorumOk: boolean;
  universalOk: boolean;
  majorityOk: boolean;
  classThresholdOk: boolean;
  conflictExclusionApplied: boolean;
  vetoOk: boolean;
}

export interface DemoExplainability {
  summary: string;
  why: string[];
  bullets: string[];
  warnings: string[];
  commercialNarrative: string;
  legalBasis: string[];
  rulesetHash: string;
  snapshotHash: string;
}

export interface DemoSandboxEvidence {
  simulated: true;
  sandbox: true;
  evidenceBundleStub: true;
  finalEvidence: false;
  filingPrevented: true;
  productiveQtspPrevented: true;
  signatureLevel: "QES_SANDBOX";
  timestampLevel: "TSQ_SANDBOX";
  tsq: string;
  integrity: "VALID" | "NOT_APPLICABLE";
  authority: "VALID" | "NOT_APPLICABLE";
  manifestHash: string;
  posture: DemoEvidencePosture;
  auditReference: string;
  simulationMeta: {
    scenario: DemoScenarioId;
    scenarioRunId: string;
    generatedAtSeed: string;
  };
}

export interface DemoTrustSimulation {
  simulated: true;
  signatureLevel: "QES_SANDBOX";
  timestampLevel: "TSQ_SANDBOX";
  ocsp: "ok";
  authority: "valid";
  provider: "EAD_TRUST_SANDBOX";
}

export interface DemoHashes {
  inputHash: string;
  snapshotHash: string;
  rulesetHash: string;
  outputHash: string;
  evidencePayloadHash: string;
}

export interface DemoRunStep {
  id: DemoStepId;
  label: string;
  status: "DONE" | "BLOCKED" | "SKIPPED";
  owner: DemoStepOwner;
}

export interface DemoScenarioRunResult {
  demoMode: true;
  simulated: true;
  sandbox: true;
  readonly: true;
  scenarioRunId: string;
  status: DemoRunStatus;
  scenario: DemoScenarioDefinition;
  outcome: DemoOutcome;
  expectedOutcome: DemoOutcome;
  ids: DemoStableIds;
  hashes: DemoHashes;
  steps: DemoRunStep[];
  gatePreview: DemoGatePreview;
  gatePreviewUi: DemoGatePreviewUi;
  explain: DemoExplainability;
  trust: DemoTrustSimulation;
  evidence: DemoSandboxEvidence;
  narrative: string;
  sourceOfTruth: "none";
  mutationAllowed: false;
  externalDependenciesEnabled: false;
  guardrails: string[];
}

export interface DemoRunOptions {
  scenarioRunId?: string;
}

const ARGA_TENANT_ID = "00000000-0000-0000-0000-000000000001";
const ARGA_ENTITY_ID = "00000000-0000-0000-0000-000000000010";
const GENERATED_AT_SEED = "2026-04-27T00:00:00.000Z";

function stableHash(input: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `sandbox_${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function stableDemoId(scenarioId: DemoScenarioId, kind: string, scenarioRunId?: string) {
  const seed = scenarioRunId ? `${scenarioId}:${scenarioRunId}:${kind}` : `${scenarioId}:${kind}`;
  return `demo:${scenarioId}:${kind}:${stableHash(seed).slice(-8)}`;
}

function buildGatePreview(scenario: DemoScenarioDefinition): DemoGatePreview {
  const facts = scenario.facts;
  const clasesOk =
    facts.classThresholdPct === undefined ||
    facts.classApprovalPct === undefined ||
    facts.classApprovalPct >= facts.classThresholdPct;
  const consentsOk = scenario.id !== "JUNTA_UNIVERSAL_FAIL_99";
  const vetoOk = !facts.vetoActive;
  const mayoriaGlobalOk = facts.globalMajorityPct >= facts.requiredMajorityPct;
  const quorumOk = facts.attendancePct >= 50;
  const allOk = quorumOk && mayoriaGlobalOk && clasesOk && consentsOk && vetoOk;
  const estado: DemoGateStatus = allOk ? "OK" : "BLOCK";

  return {
    preview: true,
    estado,
    detalles: {
      quorum_ok: quorumOk,
      mayoria_global_ok: mayoriaGlobalOk,
      clases_ok: clasesOk,
      doble_umbral_ok: clasesOk,
      consents_ok: consentsOk,
      veto_ok: vetoOk,
    },
  };
}

function buildGatePreviewUi(scenario: DemoScenarioDefinition, gatePreview: DemoGatePreview): DemoGatePreviewUi {
  return {
    quorumOk: gatePreview.detalles.quorum_ok,
    universalOk: scenario.id !== "JUNTA_UNIVERSAL_FAIL_99",
    majorityOk: gatePreview.detalles.mayoria_global_ok,
    classThresholdOk: gatePreview.detalles.clases_ok,
    conflictExclusionApplied: scenario.facts.conflictExcluded,
    vetoOk: gatePreview.detalles.veto_ok,
  };
}

function buildRunSteps(scenario: DemoScenarioDefinition): DemoRunStep[] {
  return demoRunSteps.map((step) => ({
    ...step,
    status: scenario.outcome === "BLOQUEADO" && (step.id === "ACTA" || step.id === "CERTIFICACION" || step.id === "EVIDENCIA")
      ? "SKIPPED"
      : "DONE",
  }));
}

export function runDemoScenario(scenarioId: DemoScenarioId, options: DemoRunOptions = {}): DemoScenarioRunResult {
  const scenario = getDemoScenarioDefinition(scenarioId);
  if (!scenario) {
    throw new Error(`Unknown demo scenario: ${scenarioId}`);
  }

  const scenarioRunId = options.scenarioRunId ?? stableDemoId(scenarioId, "run");
  const inputHash = stableHash(`${scenarioId}:${scenarioRunId}:input:${JSON.stringify(scenario.facts)}`);
  const snapshotHash = stableHash(`${scenarioId}:${scenarioRunId}:snapshot:${JSON.stringify(scenario.facts)}`);
  const rulesetHash = stableHash(`${scenarioId}:${scenarioRunId}:rules:${scenario.legalBasis.join("|")}`);
  const evidencePayloadHash = stableHash(`${scenarioId}:${scenarioRunId}:evidence:${snapshotHash}:${rulesetHash}:${scenario.outcome}`);
  const outputHash = stableHash(`${scenarioId}:${scenarioRunId}:output:${inputHash}:${snapshotHash}:${rulesetHash}:${evidencePayloadHash}`);
  const manifestHash = stableHash(`${scenarioId}:${scenarioRunId}:manifest:${snapshotHash}:${rulesetHash}`);
  const gatePreview = buildGatePreview(scenario);
  const adopted = scenario.outcome === "ADOPTADO";

  return {
    demoMode: true,
    simulated: true,
    sandbox: true,
    readonly: true,
    scenarioRunId,
    status: "COMPLETED",
    scenario,
    outcome: scenario.outcome,
    expectedOutcome: scenario.outcome,
    ids: {
      tenantId: ARGA_TENANT_ID,
      entityId: ARGA_ENTITY_ID,
      convocatoriaId: stableDemoId(scenarioId, "convocatoria", scenarioRunId),
      meetingId: stableDemoId(scenarioId, "meeting", scenarioRunId),
      agreementId: stableDemoId(scenarioId, "agreement", scenarioRunId),
      minuteId: stableDemoId(scenarioId, "minute", scenarioRunId),
      certificationId: stableDemoId(scenarioId, "certification", scenarioRunId),
      evidenceBundleId: stableDemoId(scenarioId, "evidence-bundle", scenarioRunId),
      snapshotId: stableDemoId(scenarioId, "snapshot", scenarioRunId),
    },
    hashes: {
      inputHash,
      snapshotHash,
      rulesetHash,
      outputHash,
      evidencePayloadHash,
    },
    steps: buildRunSteps(scenario),
    gatePreview,
    gatePreviewUi: buildGatePreviewUi(scenario, gatePreview),
    explain: {
      summary: `${scenario.label}: ${scenario.outcome}`,
      why: scenario.why,
      bullets: scenario.why,
      warnings: scenario.outcome === "BLOQUEADO" ? ["Resultado bloqueado en demo por gate determinista"] : [],
      commercialNarrative: scenario.narrative,
      legalBasis: scenario.legalBasis,
      rulesetHash,
      snapshotHash,
    },
    trust: {
      simulated: true,
      signatureLevel: "QES_SANDBOX",
      timestampLevel: "TSQ_SANDBOX",
      ocsp: "ok",
      authority: "valid",
      provider: "EAD_TRUST_SANDBOX",
    },
    evidence: {
      simulated: true,
      sandbox: true,
      evidenceBundleStub: true,
      finalEvidence: false,
      filingPrevented: true,
      productiveQtspPrevented: true,
      signatureLevel: "QES_SANDBOX",
      timestampLevel: "TSQ_SANDBOX",
      tsq: adopted ? `mock_tsq_${stableHash(`${scenarioId}:${scenarioRunId}:tsq`).slice(-8)}` : "not_applicable_gate_blocked",
      integrity: adopted ? "VALID" : "NOT_APPLICABLE",
      authority: adopted ? "VALID" : "NOT_APPLICABLE",
      manifestHash,
      posture: adopted ? "SANDBOX_VERIFIABLE" : "SANDBOX_STUB",
      auditReference: `audit:sandbox:${scenarioRunId}`,
      simulationMeta: {
        scenario: scenarioId,
        scenarioRunId,
        generatedAtSeed: GENERATED_AT_SEED,
      },
    },
    narrative: scenario.narrative,
    sourceOfTruth: "none",
    mutationAllowed: false,
    externalDependenciesEnabled: false,
    guardrails: [
      "No QTSP productivo cuando demoMode=true",
      "No filing registral cuando demoMode=true",
      "No escritura Supabase en runner local",
      "Secretaría conserva la lógica jurídica canónica",
    ],
  };
}

export function runAllDemoScenarios() {
  return demoScenarioDefinitions.map((scenario) => runDemoScenario(scenario.id));
}
