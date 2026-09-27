import { afterAll as __afterAllRestore, mock as __bunMockRestore } from "bun:test";
import * as __realModule0 from "@/context/TenantBrandContext";
/**
 * F2.T17 — la declaración del art. 47 nombra la sociedad PROVEEDORA del
 * SUJETO (`aims_ria_subjects`, rol PROVEEDOR*), no el grupo.
 *
 * Con 0 sujetos hoy en los dos tenants (medido, carril A de F2 aplicado):
 * sin `sujetoProveedor`, la declaración se comporta EXACTAMENTE como antes de
 * F2.T17 — el hueco "[por identificar antes de la emisión]" — nunca inventa
 * una sociedad. Con sujeto, pinta la sociedad y no el grupo.
 *
 * El cap. V (arts. 51-56, obligación del proveedor del MODELO) sólo aparece
 * cuando el rol del sistema es, literalmente, PROVEEDOR_GPAI — ser proveedor
 * de un sistema que integra un modelo de uso general no es lo mismo.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DeclaracionConformidadModal from "../ai-governance/DeclaracionConformidadModal";
import type { AiSystem } from "@/hooks/useAiSystems";

const __realModulesForRestore: Array<[string, Record<string, unknown>]> = [
  ["@/context/TenantBrandContext", { ...__realModule0 }],
];

__afterAllRestore(() => {
  for (const [__specifier, __exports] of __realModulesForRestore) {
    __bunMockRestore.module(__specifier, () => __exports);
  }
});

vi.mock("@/context/TenantBrandContext", () => ({
  useTenantBranding: () => null,
}));

vi.mock("sonner", () => ({ toast: { success: () => {}, error: () => {} } }));

const BASE: AiSystem = {
  id: "sys-1",
  tenant_id: "00000000-0000-0000-0000-000000000001",
  name: "Motor de triaje de siniestros auto",
  system_type: "Clasificación",
  risk_level: "Alto",
  vendor: "Vendor legado SL",
  deployment_date: null,
  owner_id: null,
  status: "ACTIVO",
  description: null,
  use_case: "Triaje de siniestros",
  aims_reference_code: "AIS-001",
  regulatory_role: "PROVEEDOR",
  regulatory_profile: { cuestionario_id: "q-1", gpai: true },
  created_at: "2026-01-01T00:00:00Z",
};

describe("DeclaracionConformidadModal — F2.T17", () => {
  it("sin sujeto proveedor, mantiene el hueco (como hoy, 0 sujetos en Cloud)", () => {
    render(<DeclaracionConformidadModal system={BASE} isOpen onClose={() => {}} />);
    expect(screen.getByText("[por identificar antes de la emisión]")).toBeTruthy();
  });

  it("con sujeto proveedor, pinta la sociedad y no el grupo", () => {
    render(
      <DeclaracionConformidadModal
        system={BASE}
        isOpen
        onClose={() => {}}
        sujetoProveedor={{ legalName: "ARGA España Seguros y Reaseguros, S.A.", address: "Calle Falsa 123, Madrid" }}
      />,
    );
    expect(screen.getByText("ARGA España Seguros y Reaseguros, S.A.")).toBeTruthy();
    expect(screen.getByText("Calle Falsa 123, Madrid")).toBeTruthy();
    expect(screen.queryByText("[por identificar antes de la emisión]")).toBeNull();
  });

  it("el cap. V no aparece para un PROVEEDOR de sistema con GPAI (no es proveedor del modelo)", () => {
    render(<DeclaracionConformidadModal system={BASE} isOpen onClose={() => {}} />);
    expect(screen.queryByText(/Cap\. V/)).toBeNull();
  });

  it("el cap. V SÍ aparece cuando el rol es, literalmente, PROVEEDOR_GPAI", () => {
    render(
      <DeclaracionConformidadModal
        system={{ ...BASE, regulatory_role: "PROVEEDOR_GPAI" }}
        isOpen
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/Cap\. V/)).toBeTruthy();
  });
});
