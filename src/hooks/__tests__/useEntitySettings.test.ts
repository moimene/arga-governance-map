import { describe, expect, it } from "vitest";
import { parseEntitySettingInput, settingValueToDraft } from "../useEntitySettings";
import type { EntitySettingsCatalogRow } from "../useEntitySettingsCatalog";

const catalog = (
  overrides: Partial<EntitySettingsCatalogRow>,
): EntitySettingsCatalogRow => ({
  key: "es_cotizada",
  value_type: "enum",
  allowed_values: ["SÍ", "NO"],
  default_value: "NO",
  descripcion: "Sociedad cotizada",
  categoria: "CONFIG_CONDICIONAL",
  usado_por_plantillas: null,
  estado_catalog: "ACTIVA",
  created_at: "2026-05-13T00:00:00Z",
  ...overrides,
});

describe("entity settings value helpers", () => {
  it("parsea boolean, enum, number y text a valores JSONB coherentes", () => {
    expect(parseEntitySettingInput(catalog({ value_type: "boolean", allowed_values: null }), "true")).toEqual({
      ok: true,
      value: true,
    });
    expect(parseEntitySettingInput(catalog({ value_type: "enum" }), "SÍ")).toEqual({
      ok: true,
      value: "SÍ",
    });
    expect(parseEntitySettingInput(catalog({ value_type: "number", allowed_values: null }), "15.5")).toEqual({
      ok: true,
      value: 15.5,
    });
    expect(parseEntitySettingInput(catalog({ value_type: "text", allowed_values: null }), "Secretario no consejero")).toEqual({
      ok: true,
      value: "Secretario no consejero",
    });
  });

  it("rechaza enums fuera del catálogo", () => {
    expect(parseEntitySettingInput(catalog({ value_type: "enum" }), "QUIZÁ")).toEqual({
      ok: false,
      message: "El valor no está permitido por el catálogo.",
    });
  });

  it("rechaza números vacíos", () => {
    expect(parseEntitySettingInput(catalog({ value_type: "number", allowed_values: null }), "")).toEqual({
      ok: false,
      message: "Introduce un número válido.",
    });
  });

  it("serializa valores existentes a draft editable", () => {
    expect(settingValueToDraft(true, catalog({ value_type: "boolean", allowed_values: null }))).toBe("true");
    expect(settingValueToDraft(null, catalog({ value_type: "text", allowed_values: null }))).toBe("");
    expect(settingValueToDraft("SEGUROS", catalog({ value_type: "enum", allowed_values: ["SEGUROS"] }))).toBe("SEGUROS");
  });
});
