import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const tramitador = read("src/pages/secretaria/TramitadorStepper.tsx");
const libros = read("src/pages/secretaria/LibrosObligatorios.tsx");
const procesosGrupo = read("src/pages/secretaria/ProcesosGrupo.tsx");

describe("Expediente registral v2 — origen de dominio explícito", () => {
  it("usa la certificación validada como origen funcional cuando la entrada es una certificación", () => {
    expect(tramitador).toContain(
      'sourceDomain: certificationIntake ? "CERTIFICATION" : "AGREEMENT"',
    );
    expect(tramitador).toContain(
      "sourceId: certificationIntake?.id ?? selectedAgreement.id",
    );
    expect(tramitador).toContain(
      "certification_id: certificationIntake?.id ?? null",
    );
    expect(tramitador).not.toContain("persistRegistryFilingCertificationLink");
  });

  it("mantiene libros y campañas como orígenes funcionales separados", () => {
    expect(libros).toContain('sourceDomain: "MANDATORY_BOOK"');
    expect(procesosGrupo).toContain('sourceDomain: "GROUP_CAMPAIGN_POST_TASK"');
  });
});
