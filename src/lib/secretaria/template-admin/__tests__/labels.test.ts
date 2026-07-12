import { describe, expect, it } from "vitest";
import {
  SEMANTIC_TONE_CLASS,
  TEMPLATE_PRIMARY_TRANSITIONS,
  adoptionModeLabel,
  organoLabel,
  templateMetadataPolicy,
  templateStateTone,
  tipoLabel,
  tipoSocialLabel,
} from "../labels";

describe("template-admin canonical labels", () => {
  it("expresa NULL y ANY sin confluir ausencia con alcance universal", () => {
    expect(organoLabel(null)).toBe("Órgano no informado");
    expect(organoLabel("ANY")).toBe("Cualquier órgano");
    expect(adoptionModeLabel(null, { tipo: "MODELO_ACUERDO" })).toBe(
      "Adopción no informada",
    );
    expect(adoptionModeLabel(null, { tipo: "INFORME_PRECEPTIVO" })).toBe("No aplica");
    expect(adoptionModeLabel("ANY", { tipo: "MODELO_ACUERDO" })).toBe(
      "Cualquier forma de adopción",
    );
    expect(tipoSocialLabel(null)).toBe("Todos los tipos sociales");
    expect(tipoSocialLabel("ANY")).toBe("Todos los tipos sociales");
  });

  it("aplica la política tipada de metadatos según la naturaleza documental", () => {
    expect(templateMetadataPolicy("MODELO_ACUERDO")).toEqual({
      organoRequired: true,
      adoptionModeRequired: true,
    });
    expect(templateMetadataPolicy("CERTIFICACION")).toEqual({
      organoRequired: true,
      adoptionModeRequired: false,
    });
  });

  it("centraliza rótulos jurídicos y humaniza códigos desconocidos", () => {
    expect(tipoLabel("ACTA_ACUERDO_ESCRITO")).toBe(
      "Acta de acuerdo escrito sin sesión",
    );
    expect(tipoLabel("COMISION_DELEGADA")).toBe("Acta de comisión delegada");
    expect(tipoLabel("TIPO_LEGACY")).toBe("Tipo legacy");
    expect(organoLabel("ORGANO_ADMIN")).toBe("Órgano de Administración");
    expect(organoLabel("ADMIN_MANCOMUNADO")).toBe("Administradores mancomunados");
  });

  it("comparte tonos semánticos accesibles sin colores Tailwind nativos ni hex", () => {
    expect(templateStateTone("ACTIVA")).toBe("success");
    expect(templateStateTone("ARCHIVADA")).toBe("neutral");
    for (const classes of Object.values(SEMANTIC_TONE_CLASS)) {
      expect(classes).toContain("var(--");
      expect(classes).not.toMatch(/#[0-9a-f]{3,8}/i);
      expect(classes).not.toMatch(/(?:bg|text|border)-(?:white|black|gray|green|amber|red)-?/);
    }
  });

  it("usa vigencia, no activación técnica, en la transición de publicación", () => {
    expect(TEMPLATE_PRIMARY_TRANSITIONS.APROBADA?.label).toBe("Marcar como vigente");
    expect(TEMPLATE_PRIMARY_TRANSITIONS.APROBADA?.confirm).toContain(
      "vigente para nuevos expedientes",
    );
  });
});
