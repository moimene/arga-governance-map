import { describe, expect, it } from "vitest";
import {
  sanitizeOpenAiActaComposerInput,
  sanitizeOpenAiCapa3DraftInput,
} from "../openai-capa3-copilot-provider";
import { buildActaLegalStructureViewModel } from "@/lib/secretaria/acta-legal-structure";

describe("openai-capa3-copilot-provider", () => {
  it("sanea payloads Capa 3 antes de invocar el copiloto OpenAI", () => {
    const sanitized = sanitizeOpenAiCapa3DraftInput({
      fields: [{ campo: "objeto_informe", obligatoriedad: "OBLIGATORIO", descripcion: "Objeto" }],
      currentValues: { objeto_informe: "x".repeat(5000) },
      allowedFields: ["capa3.objeto_informe"],
      baseVariables: {
        denominacion_social: "ARGA Seguros, S.A.",
        openai_api_key: "secret",
        email: "persona@example.com",
        nested: { nif_decisor: "12345678Z", texto: "visible" },
      },
    });

    expect(sanitized.currentValues.objeto_informe).toHaveLength(4000);
    expect(sanitized.baseVariables.denominacion_social).toBe("ARGA Seguros, S.A.");
    expect(sanitized.baseVariables.openai_api_key).toBe("[redacted]");
    expect(sanitized.baseVariables.email).toBe("[redacted]");
    expect((sanitized.baseVariables.nested as Record<string, unknown>).nif_decisor).toBe("[redacted]");
    expect((sanitized.baseVariables.nested as Record<string, unknown>).texto).toBe("visible");
  });

  it("sanea payloads de formacion de acta con el mismo copiloto Capa 3", () => {
    const actaLegalStructure = buildActaLegalStructureViewModel({
      meetingId: "m-1",
      entityName: "ARGA Seguros, S.A.",
      organName: "Consejo de Administracion",
      organKind: "CONSEJO",
      date: "15/05/2026",
      startTime: "10:00",
      place: "Madrid",
      convocationText: "Convocatoria documentada.",
      president: "Antonio Rios",
      secretary: "Lucia Paredes",
      attendees: [{ name: "Antonio Rios", attendance: "PRESENTE" }],
      quorumText: "Quorum suficiente.",
      agendaItems: [],
      canonicalMinutesHash: "hash-demo",
      approvalMode: "aprobacion en el acto",
      approvalDate: "15/05/2026",
    });
    const sanitized = sanitizeOpenAiActaComposerInput({
      text: "x".repeat(40000),
      actaLegalStructure: {
        ...actaLegalStructure,
        api_key: "secret",
        nested: { email: "persona@example.com", visible: "ok" },
      } as typeof actaLegalStructure,
      allowedTargets: ["narrativa.deliberaciones"],
      maxProposals: 4,
    });

    expect(sanitized.text).toHaveLength(30000);
    expect((sanitized.actaLegalStructure as unknown as Record<string, unknown>).api_key).toBe("[redacted]");
    expect(((sanitized.actaLegalStructure as unknown as Record<string, unknown>).nested as Record<string, unknown>).email).toBe("[redacted]");
    expect(((sanitized.actaLegalStructure as unknown as Record<string, unknown>).nested as Record<string, unknown>).visible).toBe("ok");
  });
});
