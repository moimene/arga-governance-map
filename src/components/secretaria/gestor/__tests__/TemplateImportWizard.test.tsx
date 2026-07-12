import { afterAll as __afterAllRestore, mock as __bunMockRestore } from "bun:test";
import * as __realRouter from "react-router-dom";
import * as __realImportHook from "@/hooks/secretaria/useImportPlantillaPackage";
import * as __realPreflightHook from "@/hooks/secretaria/useTemplatePreflight";
import * as __realImporter from "@/lib/secretaria/template-admin/template-importer";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TemplateImportWizard } from "../TemplateImportWizard";

const mockNavigate = vi.fn();
const mockPreflight = vi.fn();
const mockImport = vi.fn();
const searchParams = new URLSearchParams(
  "tab=importar&scope=sociedad&entity=arga&materia=FUSION&q=acta&modo=legal",
);
const gateOk = {
  ok: true,
  issues: [],
  summary: { blocking: 0, warning: 0, info: 0 },
};
const originalFileReader = globalThis.FileReader;

const modulesForRestore: Array<[string, Record<string, unknown>]> = [
  ["react-router-dom", { ...__realRouter }],
  ["@/hooks/secretaria/useImportPlantillaPackage", { ...__realImportHook }],
  ["@/hooks/secretaria/useTemplatePreflight", { ...__realPreflightHook }],
  ["@/lib/secretaria/template-admin/template-importer", { ...__realImporter }],
];

__afterAllRestore(() => {
  for (const [specifier, exports] of modulesForRestore) {
    __bunMockRestore.module(specifier, () => exports);
  }
});

vi.mock("react-router-dom", () => ({
  ...__realRouter,
  useNavigate: () => mockNavigate,
  useSearchParams: () => [searchParams, vi.fn()],
}));

vi.mock("@/hooks/secretaria/useTemplatePreflight", () => ({
  ...__realPreflightHook,
  useTemplatePreflight: () => ({ mutateAsync: mockPreflight, isPending: false }),
}));

vi.mock("@/hooks/secretaria/useImportPlantillaPackage", () => ({
  ...__realImportHook,
  useImportPlantillaPackage: () => ({ mutateAsync: mockImport, isPending: false }),
}));

vi.mock("@/lib/secretaria/template-admin/template-importer", () => ({
  ...__realImporter,
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
