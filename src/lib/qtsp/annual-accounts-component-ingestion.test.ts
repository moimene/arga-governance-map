import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll as __afterAllRestore, mock as __bunMockRestore } from "bun:test";
import * as __realSupabaseModule from "@/integrations/supabase/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

type AnnualAccountsMocks = { invoke: ReturnType<typeof vi.fn> };

function getMocks(): AnnualAccountsMocks {
  const holder = globalThis as typeof globalThis & {
    __annualAccountsIngestionMocks?: AnnualAccountsMocks;
  };
  holder.__annualAccountsIngestionMocks ??= { invoke: vi.fn() };
  return holder.__annualAccountsIngestionMocks;
}

const mocks = getMocks();

// `mock.module` es global durante todo el proceso de `bun test`. Restauramos
// el cliente real al terminar para que este doble parcial (`functions.invoke`)
// no contamine Composer ni las pruebas Cloud que necesitan `supabase.from`.
const __realModulesForRestore: Array<[string, Record<string, unknown>]> = [
  ["@/integrations/supabase/client", { ...__realSupabaseModule }],
];

__afterAllRestore(() => {
  for (const [__specifier, __exports] of __realModulesForRestore) {
    __bunMockRestore.module(__specifier, () => __exports);
  }
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: getMocks().invoke } },
}));

import {
  archiveAnnualAccountsComponentWithEADTrust,
  buildAnnualAccountsComponentArchivePayload,
  normalizeAnnualAccountsComponentArchiveResult,
} from "./qtsp-proxy-client";

const EDGE = readFileSync(
  resolve(process.cwd(), "supabase/functions/qtsp-proxy/index.ts"),
  "utf8",
);

const UUIDS = {
  tenantId: "00000000-0000-0000-0000-000000000001",
  entityId: "11111111-1111-4111-8111-111111111111",
  bodyId: "22222222-2222-4222-8222-222222222222",
  meetingId: "33333333-3333-4333-8333-333333333333",
  agendaItemId: "44444444-4444-4444-8444-444444444444",
  evidenceBundleId: "55555555-5555-4555-8555-555555555555",
  providerActionReservationId: "66666666-6666-4666-8666-666666666666",
};

function validResult() {
  const binaryHashSha256 = "a".repeat(64);
  return {
    provider: "EAD_TRUST",
    providerName: "EAD Trust",
    service: "EVIDENCE_MANAGER",
    custodyMode: "EARCHIVE",
    status: "VERIFIED",
    providerStatus: "COMPLETED",
    signatureClaim: false,
    artifactRole: "ANNUAL_ACCOUNTS_COMPONENT",
    componentKind: "BALANCE_SHEET",
    ...UUIDS,
    matterCode: "FORMULACION_CUENTAS",
    fiscalYear: 2025,
    eadCaseFileId: "ead-case-file",
    eadEvidenceGroupId: "ead-evidence-group",
    eadEvidenceId: "ead-evidence",
    binaryHashSha256,
    binaryHashSha512: "b".repeat(128),
    evidenceManifestHash: "c".repeat(64),
    storagePath: `${UUIDS.tenantId}/secretaria/annual_accounts/component.pdf`,
    storageObjectId: `${UUIDS.tenantId}/secretaria/annual_accounts/component.pdf`,
    storageVersion: binaryHashSha256,
    reused: false,
  };
}

describe("cliente de ingestión de componentes de cuentas anuales", () => {
  beforeEach(() => mocks.invoke.mockReset());

  it("envía únicamente las coordenadas jurídicas y el binario base64", () => {
    const payload = buildAnnualAccountsComponentArchivePayload({
      meetingId: UUIDS.meetingId,
      agendaItemId: UUIDS.agendaItemId,
      fiscalYear: 2025,
      componentKind: "BALANCE_SHEET",
      documentData: new TextEncoder().encode("balance").buffer as ArrayBuffer,
      documentName: "balance-2025.pdf",
      mimeType: "application/pdf",
    });
    expect(payload).toEqual({
      action: "archive_annual_accounts_component_input",
      meetingId: UUIDS.meetingId,
      agendaItemId: UUIDS.agendaItemId,
      fiscalYear: 2025,
      componentKind: "BALANCE_SHEET",
      documentBase64: "YmFsYW5jZQ==",
      fileName: "balance-2025.pdf",
      mimeType: "application/pdf",
    });
    expect(payload).not.toHaveProperty("tenantId");
    expect(payload).not.toHaveProperty("entityId");
    expect(payload).not.toHaveProperty("providerStatus");
  });

  it("acepta solo custodia real COMPLETED y rechaza cualquier afirmación de firma", () => {
    const result = validResult();
    expect(normalizeAnnualAccountsComponentArchiveResult(result)).toEqual(result);
    expect(normalizeAnnualAccountsComponentArchiveResult({
      ...result,
      signatureClaim: true,
    })).toBeNull();
    expect(normalizeAnnualAccountsComponentArchiveResult({
      ...result,
      providerStatus: "PROCESSING",
    })).toBeNull();
  });

  it("el cortafuegos E2E impide invocar la Edge Function y no fabrica evidencia", async () => {
    const result = await archiveAnnualAccountsComponentWithEADTrust({
      meetingId: UUIDS.meetingId,
      agendaItemId: UUIDS.agendaItemId,
      fiscalYear: 2025,
      componentKind: "NOTES",
      documentData: new TextEncoder().encode("memoria").buffer as ArrayBuffer,
      documentName: "memoria.pdf",
      mimeType: "application/pdf",
    }, undefined, { forbidRealQTSP: true });
    expect(result).toBeNull();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
});

describe("límite de confianza de la Edge Function", () => {
  const start = EDGE.indexOf("async function handleArchiveAnnualAccountsComponentInput");
  const end = EDGE.indexOf("async function handleReconcileAnnualAccountsSignature", start);
  const handler = EDGE.slice(start, end);

  it("autentica, resuelve fuente exacta y exige rol antes de cualquier contacto externo", () => {
    expect(handler).toContain("authenticateEdgeRequest(req)");
    expect(handler).toContain("readCanonicalAnnualAccountsComponentSource(auth.userClient, body)");
    expect(handler).toContain("assertAnnualAccountsRole(auth.userClient, source.tenantId)");
    expect(handler).toContain("reserveEadProviderAction(auth.userClient");
    expect(EDGE).toContain('String(agenda.matter_code ?? "").trim().toUpperCase() !== "FORMULACION_CUENTAS"');
    expect(EDGE).toContain('!["DRAFT", "CONVOCADA"].includes(meetingStatus)');
    expect(handler.indexOf("assertAnnualAccountsRole")).toBeLessThan(
      handler.indexOf("createEadEvidence"),
    );
    expect(handler.indexOf("reserveEadProviderAction")).toBeLessThan(
      handler.indexOf("createEadEvidence"),
    );
  });

  it("espera COMPLETED, guarda por contenido y solo entonces inserta el bundle WORM", () => {
    expect(handler).toContain('eadEvidence.status !== "COMPLETED"');
    expect(handler).toContain("uploadImmutablePrivateBinary");
    expect(handler).toContain('.from("evidence_bundles")');
    expect(handler).toContain('artifact_role: "ANNUAL_ACCOUNTS_COMPONENT"');
    expect(handler).toContain("component_kind: source.componentKind");
    expect(handler).toContain("hash_sha256: binaryHashSha256");
    expect(handler).toContain("hash_sha512: binaryHashSha512");
    expect(handler).toContain("legal_hold: true");
    expect(handler).toContain('status: "VERIFIED"');
    expect(handler.indexOf("createEadEvidence")).toBeLessThan(
      handler.lastIndexOf('.insert({'),
    );
  });

  it("mantiene la custodia separada de cualquier firma y corta E2E antes de EAD", () => {
    expect(handler).toContain("externalProviderCallsForbidden(req)");
    expect(handler.indexOf("externalProviderCallsForbidden")).toBeLessThan(
      handler.indexOf("createEadEvidence"),
    );
    expect(handler).toContain("signature_claim: false");
    expect(handler).toContain("signed_by: null");
    expect(handler).toContain("signature_date: null");
    expect(handler).not.toContain("SIGNED_OUTPUT");
  });

  it("publica las seis clases estructuradas sin aceptar una materia genérica", () => {
    for (const kind of [
      "BALANCE_SHEET",
      "PROFIT_AND_LOSS_STATEMENT",
      "NOTES",
      "CHANGES_IN_EQUITY_STATEMENT",
      "CASH_FLOW_STATEMENT",
      "MANAGEMENT_REPORT",
    ]) expect(EDGE).toContain(`"${kind}"`);
    expect(EDGE).toContain('body.action === "archive_annual_accounts_component_input"');
  });
});
