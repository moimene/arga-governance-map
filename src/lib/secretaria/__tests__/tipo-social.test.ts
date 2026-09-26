import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { deriveTipoSocial, toTipoSocialAgenda, toTipoSocialMotorValidez } from "../tipo-social";

describe("deriveTipoSocial", () => {
  it("tipo_social explícito tiene prioridad sobre legal_form", () => {
    expect(deriveTipoSocial({ tipo_social: "SA", legal_form: "S.L." })).toBe("SA");
  });

  it("fixture SL (tipo_social SL / legal_form S.L.) → SL", () => {
    expect(deriveTipoSocial({ tipo_social: "SL", legal_form: "S.L." })).toBe("SL");
  });

  it("formas unipersonales explícitas se conservan", () => {
    expect(deriveTipoSocial({ tipo_social: "SLU" })).toBe("SLU");
    expect(deriveTipoSocial({ tipo_social: "SAU" })).toBe("SAU");
  });

  it("texto 'Sociedad Anónima' (con y sin tilde) → SA", () => {
    expect(deriveTipoSocial({ legal_form: "Sociedad Anónima" })).toBe("SA");
    expect(deriveTipoSocial({ legal_form: "SOCIEDAD ANONIMA" })).toBe("SA");
  });

  it("'S.A.' → SA", () => {
    expect(deriveTipoSocial({ legal_form: "S.A." })).toBe("SA");
  });

  it("fallback null/undefined → SL", () => {
    expect(deriveTipoSocial(null)).toBe("SL");
    expect(deriveTipoSocial(undefined)).toBe("SL");
    expect(deriveTipoSocial({})).toBe("SL");
  });

  it("forma desconocida no asimilable a SA → SL", () => {
    expect(deriveTipoSocial({ legal_form: "Cooperativa" })).toBe("SL");
  });
});

// MOI-209: regla común de Convocatorias y Reuniones. Antes duplicada de
// forma idéntica en ConvocatoriasStepper.tsx y ReunionStepper.tsx — este
// test fija el resultado exacto de ambos llamadores, uno por forma.
describe("toTipoSocialAgenda (convocatoria + reunión)", () => {
  it("SA → SA", () => {
    expect(toTipoSocialAgenda("SA")).toBe("SA");
  });

  it("SAU → SAU (comprobado antes que SL)", () => {
    expect(toTipoSocialAgenda("SAU")).toBe("SAU");
  });

  it("SL → SL", () => {
    expect(toTipoSocialAgenda("SL")).toBe("SL");
  });

  it("SLU → SLU (comprobado antes que SL)", () => {
    expect(toTipoSocialAgenda("SLU")).toBe("SLU");
  });

  it("SLP → SLP (comprobado antes que SLU/SL, si no colapsaría a SL)", () => {
    expect(toTipoSocialAgenda("SLP")).toBe("SLP");
  });

  it("entrada no normalizada 'SOCIEDAD LIMITADA' → SA (no contiene 'SL' contiguo)", () => {
    expect(toTipoSocialAgenda("SOCIEDAD LIMITADA")).toBe("SA");
  });

  it("valor vacío o desconocido → SA por defecto", () => {
    expect(toTipoSocialAgenda(null)).toBe("SA");
    expect(toTipoSocialAgenda(undefined)).toBe("SA");
    expect(toTipoSocialAgenda("COOPERATIVA")).toBe("SA");
  });
});

// MOI-209: regla del motor de validez (useAgreementCompliance). Antes
// duplicada allí; agrupa SAU/SLU/SLP en SL a propósito (cero cambio ARGA) —
// este test fija ese resultado exacto, uno por forma.
describe("toTipoSocialMotorValidez (motor de validez)", () => {
  it("SA → SA", () => {
    expect(toTipoSocialMotorValidez("SA")).toBe("SA");
  });

  it("SA_CV → SA", () => {
    expect(toTipoSocialMotorValidez("SA_CV")).toBe("SA");
  });

  it("SAU → SL (cero cambio ARGA, no identidad propia)", () => {
    expect(toTipoSocialMotorValidez("SAU")).toBe("SL");
  });

  it("SLU → SL (cero cambio ARGA, no identidad propia)", () => {
    expect(toTipoSocialMotorValidez("SLU")).toBe("SL");
  });

  it("SLP → SL (cero cambio ARGA, no identidad propia)", () => {
    expect(toTipoSocialMotorValidez("SLP")).toBe("SL");
  });

  it("SL → SL", () => {
    expect(toTipoSocialMotorValidez("SL")).toBe("SL");
  });

  it("entrada no normalizada 'SOCIEDAD LIMITADA' → SL", () => {
    expect(toTipoSocialMotorValidez("SOCIEDAD LIMITADA")).toBe("SL");
  });

  it("null → SL", () => {
    expect(toTipoSocialMotorValidez(null)).toBe("SL");
  });
});

// MOI-209: guard estático — impide que reaparezca una copia local de
// toTipoSocial* fuera de esta hoja (era el defecto que este issue cierra:
// tres definiciones idénticas o casi idénticas divergiendo con el tiempo).
describe("toTipoSocial* — sin copias fuera de la hoja compartida", () => {
  const SRC_ROOT = resolve(process.cwd(), "src");
  const SHARED_FILE = resolve(SRC_ROOT, "lib/secretaria/tipo-social.ts");
  const THIS_TEST_FILE = resolve(SRC_ROOT, "lib/secretaria/__tests__/tipo-social.test.ts");
  // Definición real: la keyword function/const seguida directamente del
  // identificador toTipoSocial*. No casa con llamadas (`toTipoSocialAgenda(`)
  // ni con comentarios que solo mencionan el nombre, porque exige la
  // palabra clave justo antes del identificador.
  const DEFINITION_PATTERN = /\b(?:function|const)\s+toTipoSocial\w*\s*[(=]/;

  function collectSourceFiles(dir: string): string[] {
    const entries = readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...collectSourceFiles(fullPath));
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        files.push(fullPath);
      }
    }
    return files;
  }

  it("ninguna definición de toTipoSocial* vive fuera de src/lib/secretaria/tipo-social.ts", () => {
    const offenders: string[] = [];
    for (const file of collectSourceFiles(SRC_ROOT)) {
      if (file === SHARED_FILE || file === THIS_TEST_FILE) continue;
      const content = readFileSync(file, "utf8");
      if (DEFINITION_PATTERN.test(content)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it("control positivo: el patrón SÍ detecta una definición real", () => {
    // Construido por concatenación para que este fichero mismo no case con
    // el patrón que audita (evita que el guard se dispare contra su propio
    // control positivo).
    const fnDecl = ["function", " toTipoSocialAgenda(value: unknown) {}"].join("");
    const constDecl = ["const", " toTipoSocialFoo = (v: unknown) => {}"].join("");
    expect(DEFINITION_PATTERN.test(fnDecl)).toBe(true);
    expect(DEFINITION_PATTERN.test(constDecl)).toBe(true);
    // Una llamada no es una definición.
    expect(DEFINITION_PATTERN.test("const tipoSocial = toTipoSocialAgenda(value);")).toBe(false);
  });
});
