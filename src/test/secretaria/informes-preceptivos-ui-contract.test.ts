import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { sinComentarios } from "@/test/helpers/sin-comentarios";

const root = process.cwd();
const read = (path: string) => sinComentarios(readFileSync(resolve(root, path), "utf8"));

describe("Informes preceptivos — huella solo desde documento fuente (MOI-196)", () => {
  const page = read("src/pages/secretaria/InformesPreceptivos.tsx");

  it("no asigna sourceHash desde el valor de un input de texto libre", () => {
    // El bug exacto: `sourceHash: agreementId ? null : sourceRef.trim() || null`
    expect(page).not.toMatch(/sourceHash:\s*[^,}]*sourceRef/);
    // Guard de mutación: cualquier variable de estado de un input libre (declaredRef)
    // tampoco puede alimentar sourceHash directamente.
    expect(page).not.toMatch(/sourceHash:\s*[^,}]*declaredRef/);
  });

  it("construye la fuente con el módulo hoja único, no con lógica ad-hoc en la página", () => {
    expect(page).toContain("buildInformeSourceFields");
    expect(page).toContain("informeHashDisplay");
    expect(page).toContain("@/lib/secretaria/informe-source-reference");
  });

  it("ofrece un selector de artefactos documentales del tenant, no un input libre de hash", () => {
    expect(page).toContain("useSecretariaDocumentArtifacts");
    expect(page).not.toContain('Referencia/hash fuente');
  });

  it("el módulo hoja nunca copia el texto declarado en el campo de huella", () => {
    const lib = read("src/lib/secretaria/informe-source-reference.ts");
    expect(lib).not.toMatch(/sourceHash:\s*selection\.reference/);
  });
});
