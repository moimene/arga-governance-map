import { afterAll as __afterAllRestore, mock as __bunMockRestore } from "bun:test";
import * as __realModule0 from "react-router-dom";
import * as __realModule1 from "@/hooks/secretaria/useTemplatePreflight";
import * as __realModule2 from "@/hooks/secretaria/useImportPlantillaPackage";
import * as __realModule3 from "@/lib/secretaria/template-admin/template-importer";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TemplateImportWizard } from "../TemplateImportWizard";

if (typeof vi.hoisted !== "function") {
  (vi as { hoisted?: <T>(factory: () => T) => T }).hoisted = <T,>(factory: () => T) => factory();
}

const mockState = vi.hoisted(() => ({
  navigate: vi.fn(),
  preflight: vi.fn(),
  importPackage: vi.fn(),
  search: "tab=importar&scope=sociedad&entity=arga&materia=FUSION&q=acta&modo=legal",
}));
const mockNavigate = mockState.navigate;
const mockPreflight = mockState.preflight;
const mockImport = mockState.importPackage;
const gateOk = {
  ok: true,
  issues: [],
  summary: { blocking: 0, warning: 0, info: 0 },
};
const originalFileReader = globalThis.FileReader;

const __realModulesForRestore: Array<[string, Record<string, unknown>]> = [
  ["react-router-dom", { ...__realModule0 }],
  ["@/hooks/secretaria/useTemplatePreflight", { ...__realModule1 }],
  ["@/hooks/secretaria/useImportPlantillaPackage", { ...__realModule2 }],
  ["@/lib/secretaria/template-admin/template-importer", { ...__realModule3 }],
];

__afterAllRestore(() => {
  for (const [__specifier, __exports] of __realModulesForRestore) {
    __bunMockRestore.module(__specifier, () => __exports);
  }
});

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockState.navigate,
  useSearchParams: () => [new URLSearchParams(mockState.search), vi.fn()],
}));

vi.mock("@/hooks/secretaria/useTemplatePreflight", () => ({
  useTemplatePreflight: () => ({ mutateAsync: mockState.preflight, isPending: false }),
}));

vi.mock("@/hooks/secretaria/useImportPlantillaPackage", () => ({
  useImportPlantillaPackage: () => ({ mutateAsync: mockState.importPackage, isPending: false }),
}));

vi.mock("@/lib/secretaria/template-admin/template-importer", () => ({
  parseImport: () => ({ ok: true, value: {} }),
}));

describe("TemplateImportWizard", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "FileReader", {
      configurable: true,
      writable: true,
      value: class {
        result: string | null = null;
        onload: ((event: { target: unknown }) => void) | null = null;

        readAsText() {
          this.result = "{}";
          this.onload?.({ target: this });
        }
      },
    });
    mockNavigate.mockReset();
    mockPreflight.mockReset().mockResolvedValue({ ok: true, gatePre: gateOk });
    mockImport.mockReset().mockResolvedValue({
      ok: true,
      plantillaId: "draft-new",
      gatePre: gateOk,
    });
  });

  afterAll(() => {
    Object.defineProperty(globalThis, "FileReader", {
      configurable: true,
      writable: true,
      value: originalFileReader,
    });
  });

  it("abre el borrador exacto y conserva todo el contexto tras importar", async () => {
    render(<TemplateImportWizard />);
    fireEvent.click(screen.getByRole("button", { name: "Saltar a subir" }));

    const file = new File([JSON.stringify({ valid: true })], "plantilla.json", {
      type: "application/json",
    });
    fireEvent.change(screen.getByLabelText("Subir paquete JSON"), {
      target: { files: [file] },
    });

    await screen.findByRole("heading", {
      name: "3. Comprobación documental previa (Gate PRE)",
    });
    fireEvent.click(screen.getByRole("button", { name: "Ejecutar comprobación" }));
    await screen.findByRole("heading", { name: "5. Crear borrador" });
    fireEvent.click(screen.getByRole("button", { name: "Crear borrador" }));

    await waitFor(() => expect(mockImport).toHaveBeenCalledOnce());
    expect(mockNavigate).toHaveBeenCalledWith(
      "/secretaria/gestor-plantillas?tab=catalogo&scope=sociedad&entity=arga&materia=FUSION&q=acta&modo=legal&plantilla=draft-new&estado=BORRADOR",
    );
  });
});
