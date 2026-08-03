import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";
import { EADInterpositionControl } from "../EADInterpositionControl";

const HASH = "a".repeat(64);
const CANDIDATE = {
  artifactRole: "UNSIGNED_INPUT" as const,
  fileName: "acta.docx",
  mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" as const,
  documentData: new Uint8Array([1, 2, 3]).buffer,
  renderedText: "ACTA CANONICA",
  contentHashSha256: HASH,
};

function renderControl(overrides: Partial<ComponentProps<typeof EADInterpositionControl>> = {}) {
  return render(
    <EADInterpositionControl
      sourceDomain="MINUTE"
      sourceId="33333333-3333-4333-8333-333333333333"
      domainContentHash={HASH}
      candidate={CANDIDATE}
      signatories={[]}
      label="acta del consejo"
      {...overrides}
    />,
  );
}

describe("EADInterpositionControl", () => {
  it("mantiene el candidato del navegador fuera del circuito final", () => {
    renderControl();

    expect(screen.getByText(/solo un candidato descargable/)).toBeInTheDocument();
    expect(screen.getByText(/UNSIGNED_INPUT/)).toBeInTheDocument();
    expect(screen.getByRole("alert").textContent).toContain("binario generado");
    expect(screen.getByRole("button", { name: "Custodia final no disponible" })).toBeDisabled();
  });

  it("explica el desacoplamiento cuando el hash del candidato no coincide", () => {
    renderControl({
      candidate: { ...CANDIDATE, contentHashSha256: "b".repeat(64) },
    });

    expect(screen.getByRole("alert").textContent).toContain("no coincide");
    expect(screen.getByRole("button", { name: "Custodia final no disponible" })).toBeDisabled();
  });

  it("bloquea cualquier efecto externo en simulación demo", () => {
    renderControl({ isDemoSimulation: true });

    expect(screen.getByRole("alert").textContent).toContain("Simulación demo");
    expect(screen.getByRole("button", { name: "Custodia final no disponible" })).toBeDisabled();
  });
});
