import { describe, expect, it } from "vitest";
import { sanitizeCapa3ProviderInput } from "../anthropic-capa3-provider";

describe("anthropic-capa3-provider", () => {
  it("redacta secretos e identificadores antes de invocar Edge Function", () => {
    const sanitized = sanitizeCapa3ProviderInput({
      fields: [{ campo: "objeto_informe", obligatoriedad: "OBLIGATORIO", descripcion: "Objeto" }],
      currentValues: { objeto_informe: "x".repeat(5000) },
      allowedFields: ["capa3.objeto_informe"],
      baseVariables: {
        denominacion_social: "ARGA Seguros, S.A.",
        anthropic_api_key: "secret",
        email: "persona@example.com",
        nested: { nif_decisor: "12345678Z", texto: "visible" },
      },
    });

    expect(sanitized.currentValues.objeto_informe).toHaveLength(4000);
    expect(sanitized.baseVariables.denominacion_social).toBe("ARGA Seguros, S.A.");
    expect(sanitized.baseVariables.anthropic_api_key).toBe("[redacted]");
    expect(sanitized.baseVariables.email).toBe("[redacted]");
    expect((sanitized.baseVariables.nested as Record<string, unknown>).nif_decisor).toBe("[redacted]");
    expect((sanitized.baseVariables.nested as Record<string, unknown>).texto).toBe("visible");
  });
});
