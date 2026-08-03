import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("copias EAD sin atribución de firma", () => {
  it("presenta el acta como aprobación y custodia documental", () => {
    const processDocx = read("src/components/secretaria/ProcessDocxButton.tsx");
    const reunion = read("src/pages/secretaria/ReunionStepper.tsx");

    expect(processDocx).toContain("Validación previa a aprobación y custodia");
    expect(processDocx).not.toContain("Validación antes de firma");
    expect(reunion).toContain("Continúa con la aprobación del acta");
    expect(reunion).toContain("firma externa");
    expect(reunion).toContain("EAD Trust solo");
    expect(reunion).not.toContain("Procede a firmar el acta");
  });

  it("separa aprobación, firma externa e interposición EAD en decisiones y registro", () => {
    const decision = read("src/pages/secretaria/DecisionUnipersonalStepper.tsx");
    const tramitador = read("src/pages/secretaria/TramitadorStepper.tsx");

    expect(decision).toContain('label: "Aprobación y registro"');
    expect(decision).toContain("firma externa legalmente exigible");
    expect(decision).toContain("sin atribuirla a EAD Trust");
    expect(decision).not.toContain('label: "Firma y registro"');
    expect(tramitador).toContain("ha validado la constancia documental");
    expect(tramitador).toContain("sin atribuir firma a EAD Trust");
    expect(tramitador).not.toContain("la RPC ha validado firma");
  });
});
