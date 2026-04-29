import type { DemoScenarioRunResult } from "./runner";

export type QTSPExecutionMode = "sandbox" | "productive";

export interface QTSPApiEndpointContract {
  id: string;
  method: "GET" | "POST";
  path: string;
  purpose: string;
}

export interface DemoTrustCenter {
  provider: "EAD Trust";
  mode: "SANDBOX";
  apiReady: true;
  productiveCallsAllowed: false;
  credentialBoundary: "server-side QTSP proxy required";
  signature: {
    level: "QES_SANDBOX";
    status: "SIMULATED_READY" | "SKIPPED_BY_GATE";
    requestRef: string;
  };
  timestamp: {
    level: "TSQ_SANDBOX";
    status: "VALID" | "SKIPPED_BY_GATE";
    token: string;
  };
  evidence: {
    bundleId: string;
    manifestHash: string;
    payloadHash: string;
    sandbox: true;
    finalEvidence: false;
    auditReference: string;
  };
  apiContract: {
    auth: "Okta client_credentials";
    secretHandling: "never in browser";
    requiredEnvKeys: string[];
    endpoints: QTSPApiEndpointContract[];
  };
  guardrails: string[];
}

export const qtspApiContract = {
  auth: "Okta client_credentials",
  secretHandling: "never in browser",
  requiredEnvKeys: [
    "OKTA_TOKEN_URL",
    "OKTA_CLIENT_ID",
    "OKTA_CLIENT_SECRET",
    "OKTA_SCOPE",
    "API_BASE_URL",
    "SIGNATURE_API_BASE_URL",
  ],
  endpoints: [
    {
      id: "create-signature-request",
      method: "POST",
      path: "/api/v1/private/signature-requests",
      purpose: "Crear solicitud de firma",
    },
    {
      id: "add-document",
      method: "POST",
      path: "/api/v1/private/signature-requests/{srId}/documents",
      purpose: "Añadir documento y hash a la solicitud",
    },
    {
      id: "add-signatory",
      method: "POST",
      path: "/api/v1/private/signature-requests/{srId}/documents/{documentId}/signatories",
      purpose: "Añadir firmante",
    },
    {
      id: "activate-signature-request",
      method: "POST",
      path: "/api/v1/private/signature-requests/{srId}/activate",
      purpose: "Activar circuito de firma",
    },
    {
      id: "create-evidence",
      method: "POST",
      path: "/api/v1/private/evidences",
      purpose: "Crear evidencia con hash y obtener URL de carga",
    },
    {
      id: "get-evidence",
      method: "GET",
      path: "/api/v1/private/evidences/{evidenceId}",
      purpose: "Consultar estado de evidencia",
    },
  ] satisfies QTSPApiEndpointContract[],
} as const;

export function assertQTSPDemoGuard(demoMode: boolean, requestedMode: QTSPExecutionMode): void {
  if (demoMode && requestedMode === "productive") {
    throw new Error("Demo mode blocks productive EAD Trust/QTSP calls");
  }
}

export function buildDemoTrustCenter(run: DemoScenarioRunResult): DemoTrustCenter {
  assertQTSPDemoGuard(run.demoMode, "sandbox");

  return {
    provider: "EAD Trust",
    mode: "SANDBOX",
    apiReady: true,
    productiveCallsAllowed: false,
    credentialBoundary: "server-side QTSP proxy required",
    signature: {
      level: "QES_SANDBOX",
      status: run.outcome === "ADOPTADO" ? "SIMULATED_READY" : "SKIPPED_BY_GATE",
      requestRef: `qtsp:sandbox:${run.scenarioRunId}`,
    },
    timestamp: {
      level: "TSQ_SANDBOX",
      status: run.outcome === "ADOPTADO" ? "VALID" : "SKIPPED_BY_GATE",
      token: run.evidence.tsq,
    },
    evidence: {
      bundleId: run.ids.evidenceBundleId,
      manifestHash: run.evidence.manifestHash,
      payloadHash: run.hashes.evidencePayloadHash,
      sandbox: true,
      finalEvidence: false,
      auditReference: run.evidence.auditReference,
    },
    apiContract: qtspApiContract,
    guardrails: [
      "Credenciales Okta y secretos QTSP solo en proxy servidor",
      "Demo mode no invoca API productiva",
      "No presentación registral desde demo",
      "Evidencia sandbox no se declara evidencia productiva final",
    ],
  };
}
