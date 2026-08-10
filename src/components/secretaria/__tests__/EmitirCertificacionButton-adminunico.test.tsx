import { afterAll as __afterAllRestore, mock as __bunMockRestore } from "bun:test";
import * as __realModule0 from "sonner";
import * as __realModule1 from "@/hooks/useCapabilityMatrix";
import * as __realModule2 from "@/hooks/useActas";
import * as __realModule3 from "@/hooks/useAuthorityEvidence";
import * as __realModule4 from "@/hooks/useSecretariaDocumentArtifacts";
// src/components/secretaria/__tests__/EmitirCertificacionButton-adminunico.test.tsx
/**
 * G3 Task 6 — coupling latente: con certificanteRole="ADMIN_UNICO" (RRM art.
 * 109 + art. 31.3 Estatutos Garrigues: el admin único certifica sin Vº Bº),
 * el botón NUNCA debe enviar el person_id del presidente vigente como
 * vistoBuenoPersonaId — aunque exista un PRESIDENTE en authority_evidence
 * (p. ej. si la sociedad tuviera ambos cargos por dato legacy). Antes del
 * fix, la línea `vistoBuenoAE?.person_id ?? presidenteAE?.person_id ?? null`
 * caía al presidente y la RPC fn_generar_certificacion rechazaba con RAISE
 * ("unexpected approval person for non-secretary certifier").
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EmitirCertificacionButton } from "../EmitirCertificacionButton";

// Captura eager de los módulos reales ANTES de registrar los mocks:
// mock.module de bun es global al proceso de test y se fuga a los archivos
// posteriores, así que cada mock se restaura al terminar este archivo.
const __realModulesForRestore: Array<[string, Record<string, unknown>]> = [
  ["sonner", { ...__realModule0 }],
  ["@/hooks/useCapabilityMatrix", { ...__realModule1 }],
  ["@/hooks/useActas", { ...__realModule2 }],
  ["@/hooks/useAuthorityEvidence", { ...__realModule3 }],
  ["@/hooks/useSecretariaDocumentArtifacts", { ...__realModule4 }],
];

__afterAllRestore(() => {
  for (const [__specifier, __exports] of __realModulesForRestore) {
    __bunMockRestore.module(__specifier, () => __exports);
  }
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/hooks/useCapabilityMatrix", () => ({
  useHasCapability: () => true,
}));

const mockGenerate = vi.fn();

vi.mock("@/hooks/useActas", () => ({
  useAuthoritativeLegalEvidence: () => ({ data: undefined, isLoading: false, error: null }),
  useGenerateAuthoritativeCertification: () => ({
    mutateAsync: mockGenerate,
    isPending: false,
  }),
  useFirmarCertificacionAutoritativa: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useEmitirCertificacionAutoritativa: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

// PRESIDENTE vigente no-nulo: es el dato que provocaba el coupling latente.
const PRESIDENTE_AE = {
  id: "ae-presidente-1",
  tenant_id: "tenant-1",
  entity_id: "entity-1",
  body_id: null,
  person_id: "11111111-1111-4111-8111-111111111111",
  cargo: "PRESIDENTE" as const,
  fecha_inicio: "2026-01-01",
  fecha_fin: null,
  fuente_designacion: "BOOTSTRAP" as const,
  inscripcion_rm_referencia: "RM-1",
  inscripcion_rm_fecha: "2026-01-01",
  estado: "VIGENTE" as const,
  metadata: {},
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

vi.mock("@/hooks/useAuthorityEvidence", () => ({
  useAuthorityEvidence: () => ({ data: [] }),
  usePresidenteVigente: () => ({ data: PRESIDENTE_AE }),
  CARGO_CERT_LABELS: {
    ADMIN_UNICO: "Administrador único",
    ADMIN_SOLIDARIO: "Administrador solidario",
    ADMIN_MANCOMUNADO: "Administrador mancomunado",
    PRESIDENTE: "Presidente",
    VICEPRESIDENTE: "Vicepresidente",
    SECRETARIO: "Secretario",
    VICESECRETARIO: "Vicesecretario",
  },
}));

vi.mock("@/hooks/useSecretariaDocumentArtifacts", () => ({
  useCertificationAnnexGate: () => ({ data: [], isLoading: false, error: null }),
}));

const AGREEMENT_ID = "22222222-2222-4222-8222-222222222222";

function renderAdminUnicoButton() {
  return render(
    <EmitirCertificacionButton
      minuteId="minute-1"
      entityId="entity-1"
      bodyId={null}
      agreementIds={[AGREEMENT_ID]}
      certifications={[]}
      minuteLegalGateStatus="APPROVED_SIGNED"
      bookDestinationStatus="POSTED"
      minuteApprovalEvidenceMode="INTERPOSITION"
      minuteApprovalSignatureClaim={false}
      minuteApprovalCanonicalStatus="APPROVED_EVIDENCED"
      certificanteRole="ADMIN_UNICO"
      certifiedAgreementsText="Se certifica el acuerdo único del orden del día."
      actaApprovalMethod="AL_FINAL_SESION"
      actaApprovalDateISO="2026-08-01T00:00:00.000Z"
      legalEmissionDateISO="2026-08-10T00:00:00.000Z"
    />,
  );
}

describe("EmitirCertificacionButton — ADMIN_UNICO", () => {
  beforeEach(() => {
    mockGenerate.mockReset().mockResolvedValue("cert-new-id");
  });

  it("envía vistoBuenoPersonaId null incondicional, no el presidente vigente", async () => {
    renderAdminUnicoButton();

    fireEvent.click(screen.getByRole("button", { name: "Preparar certificación" }));

    await waitFor(() => expect(mockGenerate).toHaveBeenCalledOnce());
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        certificanteRole: "ADMIN_UNICO",
        vistoBuenoPersonaId: null,
      }),
    );
    // Regresión explícita: el bug enviaba el person_id del presidente.
    expect(mockGenerate.mock.calls[0][0].vistoBuenoPersonaId).not.toBe(
      PRESIDENTE_AE.person_id,
    );
  });
});
